import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { createAIExecutor } from '../../../src/lib/mest-tactics/ai/executor/AIActionExecutor';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type {
  ActionStepAudit,
  BattleLogEntry,
  BattleStats,
  GameConfig,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import {
  snapshotModelState,
  toOpposedTestAudit,
} from '../reporting/BattleAuditHelpers';
import {
  computeFallbackMovePositionForRunner,
  hasLineOfSightForRunner,
  maximizeClosingMoveDestinationForRunner,
} from './MovementPlanningSupport';
import { processReactsForRunner } from './ReactResolution';
import {
  extractDamageResolutionFromUnknownForRunner,
  extractWoundsAddedFromDamageResolutionForRunner,
  pickMeleeWeaponForRunner,
} from './CombatRuntimeSupport';
import { applyReactOutcomeTrackingForRunner } from './ReactOutcomeTracking';
import {
  applyOpportunityAttackForRunner,
  getOpportunityAttackFromMoveResult,
} from './OpportunityAttackTracking';
import { executeWaitActionForRunner } from './WaitActionResolution';
import { createPassiveCombatExecutionSupportForRunner } from './PassiveCombatExecutionSupport';
import { buildCombatActionResolutionDepsForRunner } from './CombatActionResolutionDepsBuilder';
import { findTakeCoverPositionWithHeuristics } from './BonusActionPlanningHeuristics';
import type { CombatActionResolutionDeps } from './CombatActionResolution';
import type {
  ActivationDecisionLoopMissionState,
  ActivationDecisionLoopRuntime,
} from './ActivationDecisionLoopSupport';

interface BuildActivationDecisionRuntimeParams {
  character: Character;
  sideIndex: number;
  config: GameConfig;
  battlefield: Battlefield;
  gameManager: GameManager;
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  log: BattleLogEntry[];
  stats: BattleStats;
  missionSides: MissionSide[];
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  missionSideIds: string[];
  eliminatedBPBySide: Record<string, number>;
  sideNameByCharacterId: Map<string, string>;
  doctrineByCharacterId: Map<string, TacticalDoctrine>;
  sanitizeForAudit: (value: unknown) => unknown;
  syncMissionRuntimeForAttack: (
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  getFirstBloodAwarded: () => boolean;
  setFirstBloodAwarded: (value: boolean) => void;
}

export interface ActivationDecisionRuntimeBuildResult {
  missionState: ActivationDecisionLoopMissionState;
  runtime: ActivationDecisionLoopRuntime;
}

export function buildActivationDecisionRuntimeForRunner(
  params: BuildActivationDecisionRuntimeParams
): ActivationDecisionRuntimeBuildResult {
  const {
    character,
    sideIndex,
    config,
    battlefield,
    gameManager,
    tracker,
    profiler,
    log,
    stats,
    missionSides,
    missionVpBySide,
    missionRpBySide,
    missionSideIds,
    eliminatedBPBySide,
    sideNameByCharacterId,
    doctrineByCharacterId,
    sanitizeForAudit,
    syncMissionRuntimeForAttack,
    getFirstBloodAwarded,
    setFirstBloodAwarded,
  } = params;

  const passiveCombatSupport = createPassiveCombatExecutionSupportForRunner({
    tracker,
    doctrineByCharacterId,
  });
  const actionValidator = createAIExecutor(gameManager, {
    validateActions: true,
    enableReplanning: false,
    maxReplanAttempts: 1,
    verboseLogging: false,
  });

  const computeFallbackMovePosition = (
    actor: Character,
    enemies: Character[],
    currentBattlefield: Battlefield
  ): Position | null => computeFallbackMovePositionForRunner({
    actor,
    enemies,
    battlefield: currentBattlefield,
    perCharacterFovLos: config.perCharacterFovLos,
    hasLos: (observer, target, field) => hasLineOfSightForRunner(observer, target, field),
  });

  const maximizeClosingMoveDestination = (
    actor: Character,
    intendedDestination: Position,
    enemies: Character[],
    currentBattlefield: Battlefield
  ): Position => maximizeClosingMoveDestinationForRunner({
    actor,
    intendedDestination,
    enemies,
    battlefield: currentBattlefield,
    perCharacterFovLos: config.perCharacterFovLos,
    hasLos: (observer, target, field) => hasLineOfSightForRunner(observer, target, field),
  });

  const processReacts = (
    active: Character,
    opponents: Character[],
    manager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    reactingToEngaged: boolean,
    visibilityOrMu: number
  ): ReactAuditResult => processReactsForRunner({
    active,
    opponents,
    gameManager: manager,
    trigger,
    movedDistance,
    reactingToEngaged,
    visibilityOrMu,
    trackReactChoiceWindow: options => tracker.trackReactChoiceWindow(options as any),
    trackCombatExtras: result => tracker.trackCombatExtras(result as any),
    sanitizeForAudit: value => sanitizeForAudit(value),
    toOpposedTestAudit: rawResult => toOpposedTestAudit(rawResult),
  });

  const trackReactOutcome = (
    reactResult: ReactAuditResult | undefined,
    active: Character,
    actorStateBeforeReact: ModelStateAudit,
    actorStateAfterReact: ModelStateAudit
  ): void => {
    applyReactOutcomeTrackingForRunner({
      reactResult,
      active,
      actorStateBeforeReact,
      actorStateAfterReact,
      onReactChoiceTaken: () => {
        stats.reactChoicesTaken++;
      },
      onReactExecuted: () => {
        stats.reacts++;
      },
      trackPassiveUsageReact: () => {
        tracker.trackPassiveUsage('React');
      },
      trackReactorAttemptSuccess: reactor => {
        tracker.trackAttempt(reactor, 'react');
        tracker.trackSuccess(reactor, 'react');
      },
      trackReactWoundsInflicted: wounds => {
        tracker.trackReactWoundsInflicted(wounds);
      },
      trackWaitTriggeredReact: () => {
        tracker.trackWaitTriggeredReact();
      },
      trackWaitReactWoundsInflicted: wounds => {
        tracker.trackWaitReactWoundsInflicted(wounds);
      },
      extractDamageResolutionFromUnknown: rawResult => extractDamageResolutionFromUnknownForRunner(rawResult),
      extractWoundsAddedFromDamageResolution: (damageResolution, beforeState, afterState) =>
        extractWoundsAddedFromDamageResolutionForRunner(damageResolution, beforeState, afterState),
      syncMissionRuntimeForAttack: (attacker, target, beforeState, afterState, damageResolution) =>
        syncMissionRuntimeForAttack(attacker, target, beforeState, afterState, damageResolution),
    });
  };

  const applyOpportunityAttackToStep = (
    opportunityAttack: unknown,
    active: Character,
    actorStateBefore: ModelStateAudit,
    stepInteractions: ActionStepAudit['interactions'],
    stepOpposedTest: OpposedTestAudit | undefined,
    stepDetails: Record<string, unknown> | undefined
  ): {
    opposedTest: OpposedTestAudit | undefined;
    details: Record<string, unknown> | undefined;
  } => {
    const actorStateAfterOpportunity = snapshotModelState(active);
    return applyOpportunityAttackForRunner({
      opportunityAttack,
      active,
      actorStateBefore,
      actorStateAfterOpportunity,
      stepInteractions,
      stepOpposedTest,
      stepDetails,
      toOpposedTestAudit: rawResult => toOpposedTestAudit(rawResult),
      trackPassiveUsageOpportunityAttack: () => {
        tracker.trackPassiveUsage('OpportunityAttack');
      },
      trackCombatExtras: result => {
        tracker.trackCombatExtras(result as any);
      },
      syncMissionRuntimeForAttack: (attacker, target, beforeState, afterState, damageResolution) =>
        syncMissionRuntimeForAttack(attacker, target, beforeState, afterState, damageResolution),
      extractDamageResolutionFromUnknown: result => extractDamageResolutionFromUnknownForRunner(result),
    });
  };

  const executeMoveAndTrackOpportunity = (
    manager: GameManager,
    active: Character,
    destination: Position,
    enemies: Character[],
    actorStateBefore: ModelStateAudit,
    stepInteractions: ActionStepAudit['interactions'],
    stepOpposedTest: OpposedTestAudit | undefined,
    stepDetails: Record<string, unknown> | undefined
  ) => {
    const opportunityWeapon = pickMeleeWeaponForRunner(active);
    const moveResult = manager.executeMove(active, destination, {
      opponents: enemies,
      allowOpportunityAttack: true,
      opportunityWeapon: opportunityWeapon ?? undefined,
    });
    const opportunity = getOpportunityAttackFromMoveResult(moveResult);
    const trackedOpportunity = applyOpportunityAttackToStep(
      opportunity,
      active,
      actorStateBefore,
      stepInteractions,
      stepOpposedTest,
      stepDetails
    );
    return {
      moved: moveResult.moved,
      moveResult,
      opposedTest: trackedOpportunity.opposedTest,
      details: trackedOpportunity.details,
    };
  };

  const executeWaitAction = (
    active: Character,
    opponents: Character[],
    manager: GameManager,
    visibilityOrMu: number,
    selectionSource: string | undefined,
    allowWaitAction: boolean
  ) => executeWaitActionForRunner({
    allowWaitAction,
    character: active,
    opponents,
    gameManager: manager,
    visibilityOrMu,
    selectionSource,
    trackAttempt: () => {
      tracker.trackAttempt(active, 'wait');
    },
    incrementWaitAction: () => {
      tracker.incrementAction('Wait');
    },
    trackWaitChoiceTaken: source => {
      stats.waitChoicesTaken++;
      tracker.trackWaitSelection(source);
    },
    trackSuccess: () => {
      tracker.trackSuccess(active, 'wait');
      stats.waitChoicesSucceeded++;
    },
    sanitizeForAudit: value => sanitizeForAudit(value),
  });

  const buildCombatActionResolutionDeps = (): CombatActionResolutionDeps =>
    buildCombatActionResolutionDepsForRunner({
      getDoctrineForCharacter: (model, fallback) =>
        doctrineByCharacterId.get(model.id) ?? fallback ?? TacticalDoctrine.Operative,
      inspectPassiveOptions: (manager, event) => tracker.inspectPassiveOptions(manager, event as any),
      trackPassiveUsage: type => tracker.trackPassiveUsage(type),
      executeFailedHitPassiveResponse: supportParams =>
        passiveCombatSupport.executeFailedHitPassiveResponse(supportParams),
      snapshotModelState: model => snapshotModelState(model),
      sanitizeForAudit: value => sanitizeForAudit(value),
      syncMissionRuntimeForAttack: (
        attackingModel,
        targetModel,
        targetStateBefore,
        targetStateAfter,
        damageResolution
      ) => syncMissionRuntimeForAttack(
        attackingModel,
        targetModel,
        targetStateBefore,
        targetStateAfter,
        damageResolution
      ),
      extractDamageResolutionFromUnknown: result => extractDamageResolutionFromUnknownForRunner(result),
      applyAutoBonusActionIfPossible: supportParams =>
        passiveCombatSupport.applyAutoBonusActionIfPossible(supportParams),
      trackCombatExtras: result => tracker.trackCombatExtras(result as any),
      trackKO: () => tracker.trackKO(),
      trackElimination: () => tracker.trackElimination(),
      missionSideIds,
      eliminatedBPBySide,
      missionRpBySide,
      firstBloodAwarded: getFirstBloodAwarded(),
      setFirstBloodAwarded: value => {
        setFirstBloodAwarded(value);
      },
      toOpposedTestAudit: rawResult => toOpposedTestAudit(rawResult),
      findTakeCoverPosition: (defender, attacker, currentBattlefield) =>
        findTakeCoverPositionWithHeuristics(defender, attacker, currentBattlefield),
      trackLOSCheck: () => tracker.trackLOSCheck(),
      trackLOFCheck: () => tracker.trackLOFCheck(),
    });

  const missionState: ActivationDecisionLoopMissionState = {
    missionSides,
    missionVpBySide,
    missionRpBySide,
    sideNameByCharacterId,
  };

  const runtime: ActivationDecisionLoopRuntime = {
    tracker,
    profiler,
    log,
    sanitizeForAudit: value => sanitizeForAudit(value),
    syncMissionRuntimeForAttack,
    computeFallbackMovePosition,
    maximizeClosingMoveDestination,
    processReacts,
    trackReactOutcome,
    executeMoveAndTrackOpportunity,
    executeWaitAction,
    buildCombatActionResolutionDeps,
    processMoveConcludedPassives: (enemies, movedDistance) =>
      passiveCombatSupport.processMoveConcludedPassives(
        gameManager,
        battlefield,
        character,
        enemies,
        config.visibilityOrMu,
        movedDistance
      ),
    actionValidator,
  };

  return { missionState, runtime };
}

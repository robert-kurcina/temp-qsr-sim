import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import { getMarkerKeyIdsInHand } from '../../../src/lib/mest-tactics/ai/executor/ObjectiveMarkerSnapshot';
import type {
  ActionStepAudit,
  AuditVector,
  BattleLogEntry,
  GameConfig,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import { buildSpatialModelForCharacter } from './AIDecisionSupport';
import { validateDecisionForExecutionForRunner } from './DecisionLoopSupport';
import {
  shouldValidateWithExecutorForRunner,
  buildExecutorValidationContextForRunner,
} from './DecisionValidationRules';
import { executeCoreDecisionForRunner } from './DecisionExecutionSupport';
import { executeNonCoreDecisionForRunner } from './DecisionNonCoreExecutionSupport';
import { CombatActionResolutionDeps } from './CombatActionResolution';
import {
  ActionValidator,
  MoveAndOpportunityResult,
  WaitActionResult,
} from './ActivationDecisionSharedTypes';

interface ExecuteActivationDecisionParams {
  decision: ActionDecision;
  apBefore: number;
  turn: number;
  sideIndex: number;
  sideName: string;
  character: Character;
  allies: Character[];
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  missionSides: MissionSide[];
  actionValidator: ActionValidator;
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  log: BattleLogEntry[];
  actorStateBefore: ModelStateAudit;
  stepInteractions: ActionStepAudit['interactions'];
  actionsTakenThisInitiative?: number;
  computeFallbackMovePosition: (
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position | null;
  maximizeClosingMoveDestination: (
    actor: Character,
    intendedDestination: Position,
    enemies: Character[],
    battlefield: Battlefield
  ) => Position;
  executeMoveAndTrackOpportunity: (
    gameManager: GameManager,
    character: Character,
    destination: Position,
    enemies: Character[],
    actorStateBefore: ModelStateAudit,
    stepInteractions: ActionStepAudit['interactions'],
    stepOpposedTest: OpposedTestAudit | undefined,
    stepDetails: Record<string, unknown> | undefined
  ) => MoveAndOpportunityResult;
  executeWaitAction: (
    character: Character,
    opponents: Character[],
    gameManager: GameManager,
    visibilityOrMu: number,
    selectionSource: string | undefined,
    allowWaitAction: boolean
  ) => WaitActionResult;
  buildCombatActionResolutionDeps: () => CombatActionResolutionDeps;
  sanitizeForAudit: (value: unknown) => unknown;
  initialOpposedTest?: OpposedTestAudit;
  initialRangeCheck?: ActionStepAudit['rangeCheck'];
  initialDetails?: Record<string, unknown>;
}

export interface ActivationDecisionExecutionResult {
  actionExecuted: boolean;
  resultCode: string;
  stepOpposedTest: OpposedTestAudit | undefined;
  stepRangeCheck: ActionStepAudit['rangeCheck'] | undefined;
  stepDetails: Record<string, unknown> | undefined;
  vectors: AuditVector[];
}

export async function executeActivationDecisionForRunner(
  params: ExecuteActivationDecisionParams
): Promise<ActivationDecisionExecutionResult> {
  const {
    decision,
    apBefore,
    turn,
    sideIndex,
    sideName,
    character,
    allies,
    enemies,
    battlefield,
    gameManager,
    config,
    missionSides,
    actionValidator,
    tracker,
    profiler,
    log,
    actorStateBefore,
    stepInteractions,
    actionsTakenThisInitiative = 0,
    computeFallbackMovePosition,
    maximizeClosingMoveDestination,
    executeMoveAndTrackOpportunity,
    executeWaitAction,
    buildCombatActionResolutionDeps,
    sanitizeForAudit,
    initialOpposedTest,
    initialRangeCheck,
    initialDetails,
  } = params;

  let stepOpposedTest = initialOpposedTest;
  let stepRangeCheck = initialRangeCheck;
  let stepDetails = initialDetails;
  let actionExecuted = false;
  let result = '';
  const vectors: AuditVector[] = [];

  if (config.verbose) {
    console.log(`  ${character.profile.name} (${sideName}) [AP ${apBefore}]: ${decision.type}${decision.reason ? ` - ${decision.reason}` : ''}`);
  }

  const actionStartedMs = Date.now();
  const validationOutcome = validateDecisionForExecutionForRunner({
    actionValidator,
    decision,
    character,
    turn,
    apBefore,
    allies,
    enemies,
    battlefield,
    shouldValidateWithExecutor: value => shouldValidateWithExecutorForRunner(value),
    computeFallbackMovePosition: (actor, opposing, field) =>
      computeFallbackMovePosition(actor, opposing, field),
    buildValidationContext: validationParams => buildExecutorValidationContextForRunner(validationParams),
    sanitizeForAudit: value => sanitizeForAudit(value),
  });

  if (validationOutcome.resultCode) {
    result = validationOutcome.resultCode;
    stepDetails = validationOutcome.details;
  } else {
    const coreDecision = await executeCoreDecisionForRunner({
      decision,
      character,
      allies,
      enemies,
      battlefield,
      gameManager,
      config,
      sideIndex,
      turn,
      apBefore,
      actionValidator,
      computeFallbackMovePosition,
      maximizeClosingMoveDestination,
      executeMoveAndTrackOpportunity,
      executeWaitAction: (actor, opponents, manager, visibilityOrMu, selectionSource, allowWaitAction) =>
        executeWaitAction(actor, opponents, manager, visibilityOrMu, selectionSource, allowWaitAction),
      buildExecutorValidationContext: validationParams => buildExecutorValidationContextForRunner(validationParams),
      sanitizeForAudit: value => sanitizeForAudit(value),
      buildCombatActionResolutionDeps: () => buildCombatActionResolutionDeps(),
      incrementAction: actionType => tracker.incrementAction(actionType),
      actorStateBefore,
      stepInteractions,
      actionsTakenThisInitiative,
      initialOpposedTest: stepOpposedTest,
      initialRangeCheck: stepRangeCheck,
      initialDetails: stepDetails,
    });

    if (coreDecision) {
      actionExecuted = coreDecision.actionExecuted;
      result = coreDecision.resultCode;
      stepOpposedTest = coreDecision.opposedTest;
      stepRangeCheck = coreDecision.rangeCheck;
      stepDetails = coreDecision.details;
      if (coreDecision.vectors.length > 0) {
        vectors.push(...coreDecision.vectors);
      }
    } else {
      const nonCoreDecision = await executeNonCoreDecisionForRunner({
        decision,
        character,
        enemies,
        battlefield,
        gameManager,
        sideName,
        apBefore,
        allowHideAction: config.allowHideAction !== false,
        sideInitiativePoints: missionSides[sideIndex]?.state?.initiativePoints ?? 0,
        hasOpposingInBaseContact: (actor, opponents, field) => {
          const actorModel = buildSpatialModelForCharacter(actor, field);
          if (!actorModel) return false;
          for (const opponent of opponents) {
            const opponentModel = buildSpatialModelForCharacter(opponent, field);
            if (!opponentModel) continue;
            if (SpatialRules.isEngaged(actorModel, opponentModel)) {
              return true;
            }
          }
          return false;
        },
        getMarkerKeyIdsInHand: (characterId, manager) => getMarkerKeyIdsInHand(characterId, manager),
        trackAttempt: (model, action) => tracker.trackAttempt(model, action),
        incrementAction: actionType => tracker.incrementAction(actionType),
        trackSuccess: (model, action) => tracker.trackSuccess(model, action),
        trackSituationalModifiers: payload => tracker.trackSituationalModifiers(payload as any),
        trackSituationalModifierType: type => tracker.trackSituationalModifierType(type),
        sanitizeForAudit: value => sanitizeForAudit(value),
      });
      if (nonCoreDecision) {
        actionExecuted = nonCoreDecision.actionExecuted;
        result = nonCoreDecision.resultCode;
        stepDetails = nonCoreDecision.details;
      } else {
        result = `${decision.type}=false:unsupported`;
      }
    }
  }
  const actionElapsedMs = Date.now() - actionStartedMs;
  profiler.recordPhaseDuration(`action.${decision.type}`, actionElapsedMs);
  profiler.recordPhaseDuration('action.total', actionElapsedMs);

  log.push({
    turn,
    modelId: character.id,
    side: sideName,
    model: character.profile.name,
    action: decision.type,
    detail: decision.reason,
    result,
  } as any);

  return {
    actionExecuted,
    resultCode: result,
    stepOpposedTest,
    stepRangeCheck,
    stepDetails,
    vectors,
  };
}

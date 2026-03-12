import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type {
  ActionStepAudit,
  ActivationAudit,
  AuditVector,
  BattleLogEntry,
  GameConfig,
  ModelEffectAudit,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';
import { StatisticsTracker } from '../tracking/StatisticsTracker';
import { PerformanceProfiler } from '../instrumentation/PerformanceProfiler';
import {
  snapshotModelState,
} from '../reporting/BattleAuditHelpers';
import { buildDecisionTargetsForAuditForRunner } from './DecisionLoopSupport';
import { CombatActionResolutionDeps } from './CombatActionResolution';
import {
  executeActivationDecisionForRunner,
} from './ActivationDecisionExecutionSupport';
import {
  finalizeActivationDecisionStepForRunner,
} from './ActivationDecisionPostprocessSupport';
import {
  ActionValidator,
  MoveAndOpportunityResult,
  WaitActionResult,
} from './ActivationDecisionSharedTypes';

interface ExecuteActivationDecisionStepParams {
  decision: ActionDecision;
  apBefore: number;
  character: Character;
  allSides: { characters: Character[] }[];
  allies: Character[];
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  sideIndex: number;
  sideName: string;
  turn: number;
  missionSides: MissionSide[];
  sideNameByCharacterId: Map<string, string>;
  activationAudit: ActivationAudit;
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  log: BattleLogEntry[];
  actionValidator: ActionValidator;
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
  processMoveConcludedPassives: (enemies: Character[], movedDistance: number) => void;
  processReacts: (
    active: Character,
    opponents: Character[],
    gameManager: GameManager,
    trigger: 'Move' | 'NonMove',
    movedDistance: number,
    reactingToEngaged: boolean,
    visibilityOrMu: number
  ) => ReactAuditResult;
  trackReactOutcome: (
    reactResult: ReactAuditResult | undefined,
    active: Character,
    actorStateBeforeReact: ModelStateAudit,
    actorStateAfterReact: ModelStateAudit
  ) => void;
  sanitizeForAudit: (value: unknown) => unknown;
  syncMissionRuntimeForAttack: (
    attacker: Character | undefined,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  onAttackDecision: (
    target: Character,
    targetStateAfter: ModelStateAudit,
    decisionType: ActionDecision['type'],
    actionExecuted: boolean
  ) => void;
}

export async function executeActivationDecisionStepForRunner(
  params: ExecuteActivationDecisionStepParams
): Promise<{
  lastKnownAp: number;
  continueLoop: boolean;
  breakLoop: boolean;
  decisionType: ActionDecision['type'];
  resultCode: string;
  actionExecuted: boolean;
  timingMs: {
    decisionExecution: number;
    finalizeStep: number;
  };
}> {
  const {
    decision,
    apBefore,
    character,
    allSides,
    allies,
    enemies,
    battlefield,
    gameManager,
    config,
    sideIndex,
    sideName,
    turn,
    missionSides,
    sideNameByCharacterId,
    activationAudit,
    tracker,
    profiler,
    log,
    actionValidator,
    computeFallbackMovePosition,
    maximizeClosingMoveDestination,
    executeMoveAndTrackOpportunity,
    executeWaitAction,
    buildCombatActionResolutionDeps,
    processMoveConcludedPassives,
    processReacts,
    trackReactOutcome,
    sanitizeForAudit,
    syncMissionRuntimeForAttack,
    onAttackDecision,
  } = params;

  const startPos = battlefield.getCharacterPosition(character);
  const actorStateBefore = snapshotModelState(character);
  const stepVectors: AuditVector[] = [];
  const stepTargets: ActionStepAudit['targets'] = buildDecisionTargetsForAuditForRunner({
    decision,
    allSides,
    sideName,
    actorId: character.id,
    resolveSideName: characterId => sideNameByCharacterId.get(characterId),
  });
  const stepAffectedModels: ModelEffectAudit[] = [];
  const stepInteractions: ActionStepAudit['interactions'] = [];
  let stepOpposedTest: OpposedTestAudit | undefined;
  let stepRangeCheck: ActionStepAudit['rangeCheck'] | undefined;
  let stepDetails: Record<string, unknown> | undefined;
  let actionExecuted = false;
  let result = '';
  const targetStateBefore = decision.target ? snapshotModelState(decision.target) : undefined;

  const decisionExecutionStartedMs = Date.now();
  const execution = await executeActivationDecisionForRunner({
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
    actionsTakenThisInitiative: activationAudit.steps.length,
    computeFallbackMovePosition,
    maximizeClosingMoveDestination,
    executeMoveAndTrackOpportunity,
    executeWaitAction,
    buildCombatActionResolutionDeps,
    sanitizeForAudit,
    initialOpposedTest: stepOpposedTest,
    initialRangeCheck: stepRangeCheck,
    initialDetails: stepDetails,
  });
  const decisionExecutionMs = Date.now() - decisionExecutionStartedMs;

  actionExecuted = execution.actionExecuted;
  result = execution.resultCode;
  stepOpposedTest = execution.stepOpposedTest;
  stepRangeCheck = execution.stepRangeCheck;
  stepDetails = execution.stepDetails;
  if (execution.vectors.length > 0) {
    stepVectors.push(...execution.vectors);
  }

  const finalizeStartedMs = Date.now();
  const finalizeResult = finalizeActivationDecisionStepForRunner({
    decision,
    actionExecuted,
    resultCode: result,
    apBefore,
    startPos: startPos ?? undefined,
    turn,
    sideName,
    character,
    enemies,
    battlefield,
    gameManager,
    config,
    activationAudit,
    sideNameByCharacterId,
    tracker,
    profiler,
    log,
    actorStateBefore,
    targetStateBefore,
    stepVectors,
    stepTargets,
    stepAffectedModels,
    stepInteractions,
    stepOpposedTest,
    stepRangeCheck,
    stepDetails,
    computeFallbackMovePosition,
    processMoveConcludedPassives,
    processReacts,
    trackReactOutcome,
    sanitizeForAudit,
    syncMissionRuntimeForAttack,
    onAttackDecision,
  });
  const finalizeStepMs = Date.now() - finalizeStartedMs;

  return {
    ...finalizeResult,
    decisionType: decision.type,
    resultCode: result,
    actionExecuted,
    timingMs: {
      decisionExecution: decisionExecutionMs,
      finalizeStep: finalizeStepMs,
    },
  };
}

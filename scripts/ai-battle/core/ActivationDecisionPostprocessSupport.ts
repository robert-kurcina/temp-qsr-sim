import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
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
  createModelEffect,
  createMovementVector,
  snapshotModelState,
} from '../reporting/BattleAuditHelpers';
import { applyActionExecutionReactPostProcessingForRunner } from './ActionExecutionReactPostProcessing';
import { finalizeActionStepForRunner } from './ActionStepFinalizationSupport';
import { resolveStalledDecisionRecoveryForRunner } from './StalledDecisionRecoverySupport';
import { isAttackDecisionType } from './CombatExecutor';
import {
  extractDamageResolutionFromStepDetailsForRunner,
  extractDamageResolutionFromUnknownForRunner,
} from './CombatRuntimeSupport';

interface FinalizeActivationDecisionStepParams {
  decision: ActionDecision;
  actionExecuted: boolean;
  resultCode: string;
  apBefore: number;
  startPos: { x: number; y: number } | undefined;
  turn: number;
  sideName: string;
  character: Character;
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  config: GameConfig;
  activationAudit: ActivationAudit;
  sideNameByCharacterId: Map<string, string>;
  tracker: StatisticsTracker;
  profiler: PerformanceProfiler;
  log: BattleLogEntry[];
  actorStateBefore: ModelStateAudit;
  targetStateBefore: ModelStateAudit | undefined;
  stepVectors: AuditVector[];
  stepTargets: ActionStepAudit['targets'];
  stepAffectedModels: ModelEffectAudit[];
  stepInteractions: ActionStepAudit['interactions'];
  stepOpposedTest: OpposedTestAudit | undefined;
  stepRangeCheck: ActionStepAudit['rangeCheck'] | undefined;
  stepDetails: Record<string, unknown> | undefined;
  computeFallbackMovePosition: (
    actor: Character,
    enemies: Character[],
    battlefield: Battlefield
  ) => { x: number; y: number } | null;
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

export function finalizeActivationDecisionStepForRunner(
  params: FinalizeActivationDecisionStepParams
): {
  lastKnownAp: number;
  continueLoop: boolean;
  breakLoop: boolean;
} {
  const {
    decision,
    actionExecuted,
    resultCode,
    apBefore,
    startPos,
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
  } = params;

  const finalizeStartMs = Date.now();

  const actionPostProcessingStartMs = Date.now();
  const actionPostProcessing = applyActionExecutionReactPostProcessingForRunner({
    actionExecuted,
    character,
    enemies,
    battlefield,
    gameManager,
    visibilityOrMu: config.visibilityOrMu,
    startPos,
    stepVectors,
    stepInteractions,
    stepOpposedTest,
    stepDetails,
    snapshotModelState: model => snapshotModelState(model),
    createMovementVector: (start, end, stepMu) => createMovementVector(start, end, stepMu),
    incrementTotalActions: () => {
      tracker.incrementTotalActions();
    },
    trackPathMovement: (model, movedDistance) => {
      tracker.trackPathMovement(model, movedDistance);
    },
    processMoveConcludedPassives: movedDistance => {
      processMoveConcludedPassives(enemies, movedDistance);
    },
    processReacts: (active, opponents, manager, trigger, movedDistance, reactingToEngaged, visibilityOrMu) =>
      profiler.withPhaseTiming(
        'react.process',
        () => processReacts(active, opponents, manager, trigger, movedDistance, reactingToEngaged, visibilityOrMu)
      ),
    trackReactOutcome: (reactResult, active, actorStateBeforeReact, actorStateAfterReact) => {
      trackReactOutcome(
        reactResult,
        active,
        actorStateBeforeReact,
        actorStateAfterReact
      );
    },
  });
  const actionPostProcessingMs = Date.now() - actionPostProcessingStartMs;

  const finalizeActionStepStartMs = Date.now();
  const finalizedStep = finalizeActionStepForRunner({
    decision,
    character,
    actionExecuted,
    resultCode,
    apBefore,
    startPos,
    endPos: actionPostProcessing.endPos ?? undefined,
    actorStateBefore,
    targetStateBefore,
    stepSequence: activationAudit.steps.length + 1,
    stepVectors,
    stepTargets,
    stepAffectedModels,
    stepInteractions,
    stepOpposedTest: actionPostProcessing.stepOpposedTest,
    stepRangeCheck,
    stepDetails: actionPostProcessing.stepDetails,
    snapshotModelState: model => snapshotModelState(model),
    createModelEffect: (model, relation, before, after) =>
      createModelEffect(model, relation, before, after, sideNameByCharacterId),
    isAttackDecisionType: value => isAttackDecisionType(value),
    extractDamageResolutionFromStepDetails: details =>
      extractDamageResolutionFromStepDetailsForRunner(details),
    syncMissionRuntimeForAttack: (
      attacker,
      target,
      targetBefore,
      targetAfter,
      damageResolution
    ) => syncMissionRuntimeForAttack(
      attacker,
      target,
      targetBefore,
      targetAfter,
      damageResolution
    ),
    onAttackDecision: (target, targetStateAfter) => {
      onAttackDecision(target, targetStateAfter, decision.type, actionExecuted);
    },
    getApRemaining: model => gameManager.getApRemaining(model),
    sanitizeForAudit: value => sanitizeForAudit(value),
    onMoveWhileWaiting: () => {
      tracker.trackMovesWhileWaiting();
    },
  });
  const finalizeActionStepMs = Date.now() - finalizeActionStepStartMs;

  activationAudit.steps.push(finalizedStep.activationStep);
  tracker.trackCombatAssignmentsFromStep(finalizedStep.activationStep);

  const stalledRecoveryStartMs = Date.now();
  const stalledRecovery = resolveStalledDecisionRecoveryForRunner({
    actionExecuted,
    decisionType: decision.type,
    apBefore,
    apAfter: finalizedStep.apAfter,
    character,
    enemies,
    battlefield,
    gameManager,
    visibilityOrMu: config.visibilityOrMu,
    turn,
    sideName,
    computeFallbackMovePosition: (actor, opposing, field) =>
      computeFallbackMovePosition(actor, opposing, field),
    snapshotModelState: model => snapshotModelState(model),
    processReacts: (active, opponents, manager, trigger, movedDistance, reactingToEngaged, visibilityOrMu) =>
      profiler.withPhaseTiming(
        'react.process',
        () => processReacts(active, opponents, manager, trigger, movedDistance, reactingToEngaged, visibilityOrMu)
      ),
    createMovementVector: (start, end, stepMu) => createMovementVector(start, end, stepMu),
    createModelEffect: (model, relation, before, after) =>
      createModelEffect(model, relation, before, after, sideNameByCharacterId),
    sanitizeForAudit: value => sanitizeForAudit(value),
    trackPassiveUsageOpportunityAttack: () => {
      tracker.trackPassiveUsage('OpportunityAttack');
    },
    trackCombatExtras: result => {
      tracker.trackCombatExtras(result as any);
    },
    syncMissionRuntimeForAttack: (
      attacker,
      target,
      targetStateBefore,
      targetStateAfter,
      damageResolution
    ) => syncMissionRuntimeForAttack(
      attacker,
      target,
      targetStateBefore,
      targetStateAfter,
      damageResolution
    ),
    extractDamageResolutionFromUnknown: result =>
      extractDamageResolutionFromUnknownForRunner(result),
    incrementMoveAction: () => {
      tracker.incrementAction('Move');
    },
    incrementTotalActions: () => {
      tracker.incrementTotalActions();
    },
    trackPathMovement: (model, movedDistance) => {
      tracker.trackPathMovement(model, movedDistance);
    },
    processMoveConcludedPassives: movedDistance => {
      processMoveConcludedPassives(enemies, movedDistance);
    },
    appendFallbackMoveLog: () => {
      log.push({
        turn,
        modelId: character.id,
        side: sideName,
        model: character.profile.name,
        action: 'move',
        detail: 'Fallback advance after stalled decision',
        result: 'move=true:forced',
      } as any);
    },
    trackReactOutcome: (reactResult, active, actorStateBeforeReact, actorStateAfterReact) => {
      trackReactOutcome(
        reactResult as ReactAuditResult | undefined,
        active,
        actorStateBeforeReact,
        actorStateAfterReact
      );
    },
    trackMovesWhileWaiting: () => {
      tracker.trackMovesWhileWaiting();
    },
    appendActivationStep: step => {
      activationAudit.steps.push(step);
      tracker.trackCombatAssignmentsFromStep(step);
    },
    nextStepSequence: activationAudit.steps.length + 1,
  });
  const stalledRecoveryMs = Date.now() - stalledRecoveryStartMs;

  const finalizeTotalMs = Date.now() - finalizeStartMs;
  if (process.env.AI_BATTLE_TRACE_SLOW_STEPS === '1' && finalizeTotalMs > 1000) {
    console.warn(
      `[DEBUG] slow finalize ${character.profile.name}: decision=${decision.type}, result=${resultCode}, totalMs=${finalizeTotalMs.toFixed(1)}, actionPostMs=${actionPostProcessingMs.toFixed(1)}, finalizeActionStepMs=${finalizeActionStepMs.toFixed(1)}, stalledRecoveryMs=${stalledRecoveryMs.toFixed(1)}`
    );
  }

  return {
    lastKnownAp: stalledRecovery.lastKnownAp,
    continueLoop: stalledRecovery.continueLoop,
    breakLoop: stalledRecovery.breakLoop,
  };
}

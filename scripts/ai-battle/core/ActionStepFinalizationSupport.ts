import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type {
  ActionStepAudit,
  AuditVector,
  ModelEffectAudit,
  ModelStateAudit,
  OpposedTestAudit,
} from '../../shared/BattleReportTypes';

interface FinalizeActionStepParams {
  decision: ActionDecision;
  character: Character;
  actionExecuted: boolean;
  resultCode: string;
  apBefore: number;
  startPos?: Position;
  endPos?: Position;
  actorStateBefore: ModelStateAudit;
  targetStateBefore?: ModelStateAudit;
  stepSequence: number;
  stepVectors: AuditVector[];
  stepTargets: ActionStepAudit['targets'];
  stepAffectedModels: ModelEffectAudit[];
  stepInteractions: ActionStepAudit['interactions'];
  stepOpposedTest?: OpposedTestAudit;
  stepRangeCheck?: ActionStepAudit['rangeCheck'];
  stepDetails?: Record<string, unknown>;
  snapshotModelState: (model: Character) => ModelStateAudit;
  createModelEffect: (
    model: Character,
    relation: ModelEffectAudit['relation'],
    before: ModelStateAudit,
    after: ModelStateAudit
  ) => ModelEffectAudit | null;
  isAttackDecisionType: (type: ActionDecision['type']) => boolean;
  extractDamageResolutionFromStepDetails: (details: Record<string, unknown> | undefined) => unknown;
  syncMissionRuntimeForAttack: (
    attacker: Character,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  onAttackDecision: (target: Character, targetStateAfter: ModelStateAudit) => void;
  getApRemaining: (model: Character) => number;
  sanitizeForAudit: (value: unknown) => unknown;
  onMoveWhileWaiting: () => void;
}

export interface FinalizeActionStepResult {
  apAfter: number;
  stepDetails?: Record<string, unknown>;
  activationStep: ActionStepAudit;
}

export function finalizeActionStepForRunner(
  params: FinalizeActionStepParams
): FinalizeActionStepResult {
  const {
    decision,
    character,
    actionExecuted,
    resultCode,
    apBefore,
    startPos,
    endPos,
    actorStateBefore,
    targetStateBefore,
    stepSequence,
    stepVectors,
    stepTargets,
    stepAffectedModels,
    stepInteractions,
    stepOpposedTest,
    stepRangeCheck,
    snapshotModelState,
    createModelEffect,
    isAttackDecisionType,
    extractDamageResolutionFromStepDetails,
    syncMissionRuntimeForAttack,
    onAttackDecision,
    getApRemaining,
    sanitizeForAudit,
    onMoveWhileWaiting,
  } = params;

  let stepDetails = params.stepDetails;

  const actorStateAfter = snapshotModelState(character);
  const actorEffect = createModelEffect(character, 'self', actorStateBefore, actorStateAfter);
  if (actorEffect) {
    stepAffectedModels.push(actorEffect);
  }

  if (decision.target && targetStateBefore) {
    const targetStateAfter = snapshotModelState(decision.target);
    const targetEffect = createModelEffect(decision.target, 'target', targetStateBefore, targetStateAfter);
    if (targetEffect) {
      stepAffectedModels.push(targetEffect);
    }

    if (actionExecuted && isAttackDecisionType(decision.type)) {
      const damageResolution = extractDamageResolutionFromStepDetails(stepDetails);
      syncMissionRuntimeForAttack(
        character,
        decision.target,
        targetStateBefore,
        targetStateAfter,
        damageResolution
      );
    }

    if (isAttackDecisionType(decision.type)) {
      onAttackDecision(decision.target, targetStateAfter);
    }
  }

  const apAfter = getApRemaining(character);
  if (stepOpposedTest) {
    stepInteractions.push({
      kind: 'opposed_test',
      sourceModelId: character.id,
      targetModelId: decision.target?.id,
      success: stepOpposedTest.pass,
      detail: `score=${stepOpposedTest.score ?? 'n/a'}`,
    });
  }

  if (actionExecuted && decision.type === 'move' && actorStateBefore.isWaiting) {
    onMoveWhileWaiting();
  }

  if (decision.planning) {
    stepDetails = {
      ...(stepDetails ?? {}),
      planning: sanitizeForAudit(decision.planning) as Record<string, unknown>,
    };
  }

  return {
    apAfter,
    stepDetails,
    activationStep: {
      sequence: stepSequence,
      actionType: decision.type,
      decisionReason: decision.reason,
      resultCode,
      success: actionExecuted,
      apBefore,
      apAfter,
      apSpent: Math.max(0, apBefore - apAfter),
      actorPositionBefore: startPos,
      actorPositionAfter: endPos,
      actorStateBefore,
      actorStateAfter,
      vectors: stepVectors,
      targets: stepTargets,
      affectedModels: stepAffectedModels,
      interactions: stepInteractions,
      opposedTest: stepOpposedTest,
      rangeCheck: stepRangeCheck,
      details: stepDetails,
    },
  };
}

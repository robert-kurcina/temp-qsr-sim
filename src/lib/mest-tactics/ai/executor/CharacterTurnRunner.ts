import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { ActionDecision } from '../core/AIController';
import { AuditService, AuditVector, ModelEffectAudit, ModelStateAudit } from '../../audit/AuditService';
import { AIActionExecutor, AIExecutionContext } from './AIActionExecutor';
import { buildActivationLoopBudget } from './ActivationLoopBudget';
import { isAttackDecisionType, updateSideTargetCommitment } from './TargetCommitment';

export interface CharacterTurnResult {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  replannedActions: number;
}

export interface RunCharacterTurnDependencies {
  manager: {
    getApRemaining: (character: Character) => number;
    getCharacterPosition: (character: Character) => Position | undefined;
    currentTurn: number;
  };
  battlefield: Battlefield;
  executor: AIActionExecutor;
  auditService: AuditService | null;
  maxActionsPerTurn: number;
  getAIDecision: (character: Character) => ActionDecision | null;
  getAggressiveFallbackDecision: (
    character: Character,
    apRemaining: number,
    preferredTarget?: Character
  ) => ActionDecision | null;
  getAlternativeDecision: (
    character: Character,
    failedDecision: ActionDecision
  ) => ActionDecision | null;
  sanitizeDecisionForExecution: (
    character: Character,
    decision: ActionDecision,
    apRemaining: number,
    actionsTakenThisInitiative?: number
  ) => ActionDecision | null;
  createExecutionContext: (character: Character) => AIExecutionContext;
  captureModelState: (character: Character) => ModelStateAudit;
  getSideNameForCharacter: (character: Character) => string;
  findCharacterSide: (character: Character) => string | null;
  buildPressureTopologySignature: (
    actionType: string,
    sideId: string,
    attacker: Character,
    target: Character
  ) => string | undefined;
}

export function runCharacterTurnForGameLoop(
  character: Character,
  turn: number,
  deps: RunCharacterTurnDependencies
): CharacterTurnResult {
  const result: CharacterTurnResult = {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    replannedActions: 0,
  };

  const loopBudget = buildActivationLoopBudget({
    maxActionsPerTurn: deps.maxActionsPerTurn,
    attemptMultiplier: 4,
    minDecisionAttempts: 12,
    maxStalledDecisions: 3,
  });
  let actionsThisTurn = 0;
  let decisionAttempts = 0;
  let stalledDecisionAttempts = 0;

  while (decisionAttempts < loopBudget.maxDecisionAttempts) {
    const apRemaining = deps.manager.getApRemaining(character);
    if (apRemaining <= 0) {
      break;
    }

    let decision = deps.getAIDecision(character);
    if (!decision || decision.type === 'hold') {
      decision = deps.getAggressiveFallbackDecision(character, apRemaining);
      if (!decision) {
        break;
      }
    }
    decision = deps.sanitizeDecisionForExecution(
      character,
      decision,
      apRemaining,
      actionsThisTurn
    );
    if (!decision) {
      decisionAttempts++;
      stalledDecisionAttempts++;
      if (stalledDecisionAttempts >= loopBudget.maxStalledDecisions) {
        break;
      }
      continue;
    }

    const context = {
      ...deps.createExecutionContext(character),
      actionsTakenThisInitiative: actionsThisTurn,
    };
    const apBefore = apRemaining;
    const positionBefore = deps.manager.getCharacterPosition(character);
    const stateBefore = deps.captureModelState(character);
    const targetStateBefore = decision.target ? deps.captureModelState(decision.target) : undefined;

    const targets: Array<{ modelId: string; modelName: string; side?: string; relation: 'enemy' | 'ally' | 'self' }> = [];
    if (decision.target) {
      const targetSide = deps.getSideNameForCharacter(decision.target);
      targets.push({
        modelId: decision.target.id,
        modelName: decision.target.profile.name,
        side: targetSide,
        relation: decision.target.id === character.id ? 'self' : (targetSide === deps.getSideNameForCharacter(character) ? 'ally' : 'enemy'),
      });
    }

    const execResult = deps.executor.executeAction(decision, character, context);

    const apAfter = deps.manager.getApRemaining(character);
    const positionAfter = deps.manager.getCharacterPosition(character);
    const stateAfter = deps.captureModelState(character);
    const targetStateAfter = decision.target ? deps.captureModelState(decision.target) : undefined;

    const vectors: AuditVector[] = [];
    if (decision.type === 'move' && decision.position && positionBefore && positionAfter) {
      vectors.push({
        kind: 'movement',
        from: positionBefore,
        to: positionAfter,
        distanceMu: Math.sqrt(Math.pow(positionAfter.x - positionBefore.x, 2) + Math.pow(positionAfter.y - positionBefore.y, 2)),
      });
    }

    const affectedModels: ModelEffectAudit[] = [];
    if (decision.target && decision.target !== character && targetStateBefore && targetStateAfter) {
      const targetSide = deps.getSideNameForCharacter(decision.target);
      const changed: string[] = [];
      if (targetStateBefore.wounds !== targetStateAfter.wounds) changed.push('wounds');
      if (targetStateBefore.delayTokens !== targetStateAfter.delayTokens) changed.push('delayTokens');
      if (targetStateBefore.isKOd !== targetStateAfter.isKOd) changed.push('isKOd');
      if (targetStateBefore.isEliminated !== targetStateAfter.isEliminated) changed.push('isEliminated');
      if (changed.length > 0) {
        affectedModels.push({
          modelId: decision.target.id,
          modelName: decision.target.profile.name,
          side: targetSide,
          relation: 'opponent',
          before: targetStateBefore,
          after: targetStateAfter,
          changed,
        });
      }
    }

    const interactions: Array<{ kind: string; sourceModelId: string; targetModelId?: string; success?: boolean; detail?: string }> = [];
    if (decision.type === 'close_combat' || decision.type === 'ranged_combat') {
      interactions.push({
        kind: 'attack',
        sourceModelId: character.id,
        targetModelId: decision.target?.id,
        success: execResult.success,
        detail: `${decision.type} vs ${decision.target?.profile.name || 'unknown'}`,
      });
    }

    if (decision.target && targetStateAfter && isAttackDecisionType(decision.type)) {
      const sideId = deps.findCharacterSide(character);
      if (sideId) {
        updateSideTargetCommitment({
          coordinatorHost: deps.manager as any,
          sideId,
          attacker: character,
          target: decision.target,
          actionType: decision.type,
          actionExecuted: execResult.success,
          turn: deps.manager.currentTurn,
          targetStateAfter,
          topologySignature: deps.buildPressureTopologySignature(
            decision.type,
            sideId,
            character,
            decision.target
          ),
        });
      }
    }

    if (deps.auditService) {
      deps.auditService.recordAction({
        sequence: actionsThisTurn + 1,
        actionType: decision.type,
        decisionReason: decision.reason,
        resultCode: execResult.success ? 'SUCCESS' : 'FAILED',
        success: execResult.success,
        apBefore,
        apAfter,
        apSpent: apBefore - apAfter,
        actorPositionBefore: positionBefore || undefined,
        actorPositionAfter: positionAfter || undefined,
        actorStateBefore: stateBefore,
        actorStateAfter: stateAfter,
        vectors,
        targets,
        affectedModels,
        interactions,
        details: {
          replanningRecommended: execResult.replanningRecommended,
        },
      } as any);
    }

    result.totalActions++;
    actionsThisTurn++;
    decisionAttempts++;
    const apSpentPrimary = Math.max(0, apBefore - apAfter);
    if (apSpentPrimary > 0) {
      stalledDecisionAttempts = 0;
    } else {
      stalledDecisionAttempts++;
    }
    if (execResult.success) {
      result.successfulActions++;
    } else {
      result.failedActions++;
      if (execResult.replanningRecommended) {
        result.replannedActions++;

        const altDecision = deps.getAlternativeDecision(character, decision);
        if (altDecision && altDecision.type !== 'hold') {
          const altApBefore = deps.manager.getApRemaining(character);
          const sanitizedAltDecision = deps.sanitizeDecisionForExecution(
            character,
            altDecision,
            altApBefore,
            actionsThisTurn
          );
          if (!sanitizedAltDecision) {
            stalledDecisionAttempts++;
            if (stalledDecisionAttempts >= loopBudget.maxStalledDecisions) {
              break;
            }
            continue;
          }
          const altContext = {
            ...deps.createExecutionContext(character),
            actionsTakenThisInitiative: actionsThisTurn,
          };
          const altResult = deps.executor.executeAction(sanitizedAltDecision, character, altContext);
          const altApAfter = deps.manager.getApRemaining(character);
          result.totalActions++;
          actionsThisTurn++;
          decisionAttempts++;
          if (altResult.success) {
            result.successfulActions++;
          } else {
            result.failedActions++;
          }
          const altApSpent = Math.max(0, altApBefore - altApAfter);
          if (altApSpent > 0) {
            stalledDecisionAttempts = 0;
          } else {
            stalledDecisionAttempts++;
          }
        }
      }
    }

    if (stalledDecisionAttempts >= loopBudget.maxStalledDecisions) {
      break;
    }
  }

  return result;
}

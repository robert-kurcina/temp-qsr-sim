import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ModelStateAudit } from '../../shared/BattleReportTypes';
import type { ReactAuditResult } from '../validation/ValidationMetrics';
import {
  runStalledDecisionFallbackAdvance,
  type StalledDecisionFallbackAdvanceParams,
} from './ActivationFallbackRecovery';
import { handleStalledDecisionOutcomeForRunner } from './StalledDecisionOutcomeSupport';

interface ResolveStalledDecisionRecoveryParams {
  actionExecuted: boolean;
  decisionType: ActionDecision['type'];
  apBefore: number;
  apAfter: number;
  character: Character;
  enemies: Character[];
  battlefield: Battlefield;
  gameManager: GameManager;
  visibilityOrMu: number;
  turn: number;
  sideName: string;
  computeFallbackMovePosition: StalledDecisionFallbackAdvanceParams['computeFallbackMovePosition'];
  snapshotModelState: StalledDecisionFallbackAdvanceParams['snapshotModelState'];
  processReacts: StalledDecisionFallbackAdvanceParams['processReacts'];
  createMovementVector: StalledDecisionFallbackAdvanceParams['createMovementVector'];
  createModelEffect: StalledDecisionFallbackAdvanceParams['createModelEffect'];
  sanitizeForAudit: StalledDecisionFallbackAdvanceParams['sanitizeForAudit'];
  trackPassiveUsageOpportunityAttack: () => void;
  trackCombatExtras: (result: unknown) => void;
  syncMissionRuntimeForAttack: (
    attacker: Character,
    target: Character,
    targetStateBefore: ModelStateAudit,
    targetStateAfter: ModelStateAudit,
    damageResolution: unknown
  ) => void;
  extractDamageResolutionFromUnknown: (result: unknown) => unknown;
  incrementMoveAction: () => void;
  incrementTotalActions: () => void;
  trackPathMovement: (character: Character, movedDistance: number) => void;
  processMoveConcludedPassives: (movedDistance: number) => void;
  appendFallbackMoveLog: () => void;
  trackReactOutcome: (
    reactResult: ReactAuditResult | undefined,
    active: Character,
    actorStateBeforeReact: ModelStateAudit,
    actorStateAfterReact: ModelStateAudit
  ) => void;
  trackMovesWhileWaiting: () => void;
  appendActivationStep: (step: any) => void;
  nextStepSequence: number;
}

export interface StalledDecisionRecoveryResult {
  attempted: boolean;
  continueLoop: boolean;
  breakLoop: boolean;
  lastKnownAp: number;
}

export function resolveStalledDecisionRecoveryForRunner(
  params: ResolveStalledDecisionRecoveryParams
): StalledDecisionRecoveryResult {
  const successfulNonAPAction =
    params.actionExecuted && (params.decisionType === 'pushing' || params.decisionType === 'refresh');
  if (params.apAfter < params.apBefore || successfulNonAPAction) {
    return {
      attempted: false,
      continueLoop: false,
      breakLoop: false,
      lastKnownAp: params.apAfter,
    };
  }

  const fallbackOutcome = runStalledDecisionFallbackAdvance({
    character: params.character,
    enemies: params.enemies,
    battlefield: params.battlefield,
    gameManager: params.gameManager,
    visibilityOrMu: params.visibilityOrMu,
    apBefore: params.apAfter,
    computeFallbackMovePosition: params.computeFallbackMovePosition,
    snapshotModelState: params.snapshotModelState,
    processReacts: params.processReacts,
    createMovementVector: params.createMovementVector,
    createModelEffect: params.createModelEffect,
    sanitizeForAudit: params.sanitizeForAudit,
    useCheapFallback: true,
  });
  const fallbackResolution = handleStalledDecisionOutcomeForRunner({
    fallbackOutcome,
    character: params.character,
    turn: params.turn,
    sideName: params.sideName,
    trackPassiveUsageOpportunityAttack: params.trackPassiveUsageOpportunityAttack,
    trackCombatExtras: params.trackCombatExtras,
    syncMissionRuntimeForAttack: params.syncMissionRuntimeForAttack,
    extractDamageResolutionFromUnknown: params.extractDamageResolutionFromUnknown,
    incrementMoveAction: params.incrementMoveAction,
    incrementTotalActions: params.incrementTotalActions,
    trackPathMovement: params.trackPathMovement,
    processMoveConcludedPassives: params.processMoveConcludedPassives,
    appendFallbackMoveLog: params.appendFallbackMoveLog,
    trackReactOutcome: (
      reactResult,
      active,
      actorStateBeforeReact,
      actorStateAfterReact
    ) => params.trackReactOutcome(
      reactResult as ReactAuditResult | undefined,
      active,
      actorStateBeforeReact,
      actorStateAfterReact
    ),
    trackMovesWhileWaiting: params.trackMovesWhileWaiting,
    appendActivationStep: params.appendActivationStep,
    nextStepSequence: params.nextStepSequence,
  });

  return {
    attempted: true,
    continueLoop: fallbackResolution.continueLoop,
    breakLoop: !fallbackResolution.continueLoop,
    lastKnownAp: fallbackResolution.lastKnownAp,
  };
}

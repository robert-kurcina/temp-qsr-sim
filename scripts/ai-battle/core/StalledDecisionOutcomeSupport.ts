import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { ActionStepAudit, ModelStateAudit } from '../../shared/BattleReportTypes';
import type { StalledDecisionFallbackAdvanceResult } from './ActivationFallbackRecovery';

export interface StalledDecisionOutcomeResult {
  continueLoop: boolean;
  lastKnownAp: number;
}

interface HandleStalledDecisionOutcomeParams {
  fallbackOutcome: StalledDecisionFallbackAdvanceResult;
  character: Character;
  turn: number;
  sideName: string;
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
    reactResult: unknown,
    active: Character,
    actorStateBeforeReact: ModelStateAudit,
    actorStateAfterReact: ModelStateAudit
  ) => void;
  trackMovesWhileWaiting: () => void;
  appendActivationStep: (step: ActionStepAudit) => void;
  nextStepSequence: number;
}

export function handleStalledDecisionOutcomeForRunner(
  params: HandleStalledDecisionOutcomeParams
): StalledDecisionOutcomeResult {
  const {
    fallbackOutcome,
    character,
    trackPassiveUsageOpportunityAttack,
    trackCombatExtras,
    syncMissionRuntimeForAttack,
    extractDamageResolutionFromUnknown,
    incrementMoveAction,
    incrementTotalActions,
    trackPathMovement,
    processMoveConcludedPassives,
    appendFallbackMoveLog,
    trackReactOutcome,
    trackMovesWhileWaiting,
    appendActivationStep,
    nextStepSequence,
  } = params;

  if (fallbackOutcome.executed && fallbackOutcome.step && fallbackOutcome.stateBefore) {
    const opportunity = fallbackOutcome.opportunityAttack as
      | { attacker?: Character; result?: unknown }
      | undefined;
    if (opportunity?.attacker) {
      trackPassiveUsageOpportunityAttack();
      trackCombatExtras(opportunity.result);
      syncMissionRuntimeForAttack(
        opportunity.attacker,
        character,
        fallbackOutcome.stateBefore,
        fallbackOutcome.stateBeforeReact ?? fallbackOutcome.stateBefore,
        extractDamageResolutionFromUnknown(opportunity.result)
      );
    }

    incrementMoveAction();
    incrementTotalActions();
    trackPathMovement(character, fallbackOutcome.movedDistance);
    processMoveConcludedPassives(fallbackOutcome.movedDistance);
    appendFallbackMoveLog();

    const reactResult = fallbackOutcome.reactResult;
    if (fallbackOutcome.stateBeforeReact && fallbackOutcome.stateAfter) {
      trackReactOutcome(
        reactResult,
        character,
        fallbackOutcome.stateBeforeReact,
        fallbackOutcome.stateAfter
      );
    }

    if (fallbackOutcome.stateBefore.isWaiting) {
      trackMovesWhileWaiting();
    }

    fallbackOutcome.step.sequence = nextStepSequence;
    appendActivationStep(fallbackOutcome.step);

    return {
      continueLoop: true,
      lastKnownAp: fallbackOutcome.apAfter,
    };
  }

  return {
    continueLoop: false,
    lastKnownAp: fallbackOutcome.apAfter,
  };
}

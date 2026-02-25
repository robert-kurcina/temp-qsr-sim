/**
 * Initiative Card System (QSR Advanced Rule)
 * 
 * A single Initiative card (Joker or Ace from Poker deck) is assigned to the Mission Attacker at game start.
 * 
 * Card Abilities:
 * - Automatic Tie Win: Win ties automatically but receive zero cascades
 * - Voluntary Transfer: Transfer to Opposing Player to re-roll any Test (except Initiative)
 * - Return Penalty: Cannot voluntarily transfer again; assign Delay token to Friendly model
 */

import { MissionSide } from '../mission/MissionSide';
import { Character } from '../core/Character';
import { ResolveTestResult } from '../subroutines/dice-roller';

export interface InitiativeCardState {
  /** Which side currently holds the card */
  holderSideId: string | null;
  /** Whether the card has been transferred voluntarily this turn */
  transferredVoluntarily: boolean;
  /** Whether the card holder wins ties automatically */
  autoWinTies: boolean;
  /** Whether cascades are suppressed when card holder wins ties */
  suppressCascades: boolean;
}

export interface InitiativeCardOptions {
  /** Enable Initiative Card advanced rule */
  enabled: boolean;
  /** Side ID of Mission Attacker (initial card holder) */
  missionAttackerSideId: string;
}

/**
 * Create initial Initiative Card state
 */
export function createInitiativeCardState(
  options: InitiativeCardOptions
): InitiativeCardState {
  if (!options.enabled) {
    return {
      holderSideId: null,
      transferredVoluntarily: false,
      autoWinTies: false,
      suppressCascades: false,
    };
  }

  return {
    holderSideId: options.missionAttackerSideId,
    transferredVoluntarily: false,
    autoWinTies: true,
    suppressCascades: false,
  };
}

/**
 * Check if a side has the Initiative Card
 */
export function hasInitiativeCard(
  state: InitiativeCardState,
  sideId: string
): boolean {
  return state.holderSideId === sideId;
}

/**
 * Apply Initiative Card tie-breaking to a test result
 * QSR: Card holder wins ties automatically but receives zero cascades
 */
export function applyInitiativeCardToTest(
  state: InitiativeCardState,
  testResult: ResolveTestResult,
  participant1SideId: string | null,
  participant2SideId: string | null
): {
  modifiedResult: ResolveTestResult;
  cardUsed: boolean;
} {
  if (!state.holderSideId || !state.autoWinTies) {
    return { modifiedResult: testResult, cardUsed: false };
  }

  const holderIsP1 = participant1SideId === state.holderSideId;
  const holderIsP2 = participant2SideId === state.holderSideId;

  // Check if it's a tie
  if (testResult.p1FinalScore === testResult.p2FinalScore) {
    // Card holder wins the tie
    if (holderIsP1) {
      return {
        modifiedResult: {
          ...testResult,
          pass: true,
          score: 0, // Tie = 0 difference
          cascades: 0, // No cascades for tie win with card
        },
        cardUsed: true,
      };
    } else if (holderIsP2) {
      // P2 (System or opponent) wins the tie
      return {
        modifiedResult: {
          ...testResult,
          pass: false,
          score: 0,
          cascades: 0,
        },
        cardUsed: true,
      };
    }
  }

  return { modifiedResult: testResult, cardUsed: false };
}

/**
 * Voluntarily transfer Initiative Card to opposing side to re-roll a test
 * QSR: Transfer to Opposing Player to re-roll any Test (except Initiative)
 */
export function voluntarilyTransferCard(
  state: InitiativeCardState,
  fromSideId: string,
  toSideId: string,
  isInitiativeTest: boolean = false
): {
  success: boolean;
  reason?: string;
  newState: InitiativeCardState;
} {
  // Cannot transfer during Initiative Test
  if (isInitiativeTest) {
    return {
      success: false,
      reason: 'Cannot transfer Initiative Card during Initiative Test',
      newState: state,
    };
  }

  // Must be current holder
  if (state.holderSideId !== fromSideId) {
    return {
      success: false,
      reason: 'Side does not hold Initiative Card',
      newState: state,
    };
  }

  // Must transfer to opposing side
  if (fromSideId === toSideId) {
    return {
      success: false,
      reason: 'Cannot transfer to same side',
      newState: state,
    };
  }

  // Check return penalty (if card already transferred voluntarily this turn)
  if (state.transferredVoluntarily) {
    return {
      success: false,
      reason: 'Cannot voluntarily transfer again this turn (Return Penalty)',
      newState: state,
    };
  }

  return {
    success: true,
    newState: {
      ...state,
      holderSideId: toSideId,
      transferredVoluntarily: true,
    },
  };
}

/**
 * Apply Return Penalty when card returns to a side that already had it
 * QSR: Cannot voluntarily transfer again; assign Delay token to Friendly model
 */
export function applyReturnPenalty(
  state: InitiativeCardState,
  character: Character
): {
  penaltyApplied: boolean;
  delayTokensAdded: number;
} {
  // Return penalty applies when card holder cannot voluntarily transfer
  if (state.transferredVoluntarily) {
    // Assign Delay token to Friendly model
    character.state.delayTokens += 1;
    return {
      penaltyApplied: true,
      delayTokensAdded: 1,
    };
  }

  return {
    penaltyApplied: false,
    delayTokensAdded: 0,
  };
}

/**
 * Reset Initiative Card state at end of turn
 */
export function resetInitiativeCardTurnState(
  state: InitiativeCardState
): InitiativeCardState {
  return {
    ...state,
    transferredVoluntarily: false,
  };
}

/**
 * Get Initiative Card status for UI display
 */
export function getInitiativeCardStatus(
  state: InitiativeCardState,
  sides: MissionSide[]
): {
  holderSideName: string | null;
  canTransfer: boolean;
  hasReturnPenalty: boolean;
  autoWinTies: boolean;
} {
  const holderSide = sides.find((s) => s.id === state.holderSideId);

  return {
    holderSideName: holderSide?.name ?? null,
    canTransfer: !state.transferredVoluntarily && state.holderSideId !== null,
    hasReturnPenalty: state.transferredVoluntarily,
    autoWinTies: state.autoWinTies,
  };
}

/**
 * Action VP Filter
 *
 * Filters and scores actions based on their VP contribution potential.
 * Used to enforce VP-gated planning when urgency is high.
 */

import { ActionType } from './AIController';
import { VPUrgencyState, VPUrgencyLevel } from './VPUrgencyCalculator';

/**
 * VP information for an action
 */
export interface ActionVPInfo {
  /** Action type */
  actionType: ActionType;
  /** Estimated VP contribution (0.0-1.0 probability of VP gain) */
  estimatedVPContribution: number;
  /** Is this a direct VP action? (combat, objective capture) */
  isDirectVPAction: boolean;
  /** Is this a VP-enabling action? (move to position, detect to reveal) */
  isVPEnablingAction: boolean;
  /** Is this a passive action? (hide, wait - no VP contribution) */
  isPassiveAction: boolean;
  /** Is this a movement action? (positioning for future VP) */
  isMovementAction: boolean;
  /** Is this a support action? (rally, revive - indirect VP) */
  isSupportAction: boolean;
}

/**
 * Get VP information for an action
 *
 * @param actionType - Type of action
 * @param hasValidTarget - Does the action have a valid target?
 * @param inRange - Is the action in range?
 * @returns VP information for the action
 */
export function getActionVPInfo(
  actionType: ActionType,
  hasValidTarget: boolean = false,
  inRange: boolean = false
): ActionVPInfo {
  switch (actionType) {
    case 'close_combat':
      return {
        actionType,
        estimatedVPContribution: hasValidTarget ? 0.35 : 0.0,
        isDirectVPAction: true,
        isVPEnablingAction: false,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'ranged_combat':
      return {
        actionType,
        estimatedVPContribution: (hasValidTarget && inRange) ? 0.25 : 0.0,
        isDirectVPAction: true,
        isVPEnablingAction: false,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'charge':
      return {
        actionType,
        estimatedVPContribution: 0.2,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: true,
        isSupportAction: false,
      };
    case 'move':
      return {
        actionType,
        estimatedVPContribution: 0.08,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: true,
        isSupportAction: false,
      };
    case 'disengage':
      return {
        actionType,
        estimatedVPContribution: 0.1,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: true,
        isSupportAction: false,
      };
    case 'detect':
      return {
        actionType,
        estimatedVPContribution: 0.08,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'hide':
      return {
        actionType,
        estimatedVPContribution: 0.0,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: true,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'wait':
      return {
        actionType,
        estimatedVPContribution: 0.02,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: true,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'rally':
      return {
        actionType,
        estimatedVPContribution: 0.05,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: true,
      };
    case 'revive':
      return {
        actionType,
        estimatedVPContribution: 0.08,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: true,
      };
    case 'hold':
      return {
        actionType,
        estimatedVPContribution: 0.0,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: true,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'fiddle':
      return {
        actionType,
        estimatedVPContribution: 0.0,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: true,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'reload':
      return {
        actionType,
        estimatedVPContribution: 0.05,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'pushing':
      return {
        actionType,
        estimatedVPContribution: 0.15,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'refresh':
      return {
        actionType,
        estimatedVPContribution: 0.1,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'combined':
      return {
        actionType,
        estimatedVPContribution: 0.2,
        isDirectVPAction: false,
        isVPEnablingAction: true,
        isPassiveAction: false,
        isMovementAction: false,
        isSupportAction: false,
      };
    case 'none':
    default:
      return {
        actionType,
        estimatedVPContribution: 0.0,
        isDirectVPAction: false,
        isVPEnablingAction: false,
        isPassiveAction: true,
        isMovementAction: false,
        isSupportAction: false,
      };
  }
}

/**
 * Filter actions based on VP urgency
 *
 * @param actions - List of action decisions with types
 * @param urgency - VP urgency state
 * @param minVPContribution - Minimum VP contribution threshold (0.0-1.0)
 * @returns Filtered list of actions
 */
export function filterActionsByVP<T extends { action: ActionType; score?: number }>(
  actions: T[],
  urgency: VPUrgencyState,
  minVPContribution: number = 0.0
): T[] {
  // Low urgency: no filtering
  if (urgency.urgencyLevel === 'low') {
    return actions;
  }

  // Desperate mode: ONLY allow direct VP actions or high-contribution enabling actions
  if (urgency.urgencyLevel === 'desperate') {
    return actions.filter(a => {
      const vpInfo = getActionVPInfo(a.action);
      // Allow direct VP actions
      if (vpInfo.isDirectVPAction && vpInfo.estimatedVPContribution >= minVPContribution) {
        return true;
      }
      // Allow VP-enabling actions with high contribution
      if (vpInfo.isVPEnablingAction && vpInfo.estimatedVPContribution >= 0.15) {
        return true;
      }
      return false;
    });
  }

  // High urgency: Reject purely passive actions
  if (urgency.urgencyLevel === 'high') {
    return actions.filter(a => {
      const vpInfo = getActionVPInfo(a.action);
      // Reject passive actions with no VP contribution
      if (vpInfo.isPassiveAction && vpInfo.estimatedVPContribution < 0.03) {
        return false;
      }
      return true;
    });
  }

  // Medium urgency: No filtering, scoring will handle penalties
  return actions;
}

/**
 * Apply VP urgency bonus to action score
 *
 * @param action - Action decision
 * @param urgency - VP urgency state
 * @param baseScore - Base utility score
 * @returns Adjusted score with VP urgency bonus
 */
export function applyVPurgencyBonus<T extends { action: ActionType }>(
  action: T,
  urgency: VPUrgencyState,
  baseScore: number
): number {
  const vpInfo = getActionVPInfo(action.action);
  const urgencyMultiplier = getUrgencyMultiplier(urgency.urgencyLevel);

  // Direct VP actions get urgency multiplier
  if (vpInfo.isDirectVPAction) {
    return baseScore * urgencyMultiplier;
  }

  // VP-enabling actions get smaller multiplier
  if (vpInfo.isVPEnablingAction) {
    return baseScore * (1 + (urgencyMultiplier - 1) * 0.5);
  }

  // Passive actions get penalty when VP=0
  if (vpInfo.isPassiveAction && urgency.myVP === 0) {
    const passivePenalty = getPassiveActionPenalty(urgency.urgencyLevel, urgency.currentTurn, urgency.myVP);
    return Math.max(0, baseScore + passivePenalty);
  }

  return baseScore;
}

/**
 * Get urgency multiplier for scoring
 */
function getUrgencyMultiplier(urgencyLevel: VPUrgencyLevel): number {
  switch (urgencyLevel) {
    case 'desperate':
      return 3.0;
    case 'high':
      return 2.0;
    case 'medium':
      return 1.5;
    case 'low':
    default:
      return 1.0;
  }
}

/**
 * Get passive action penalty for scoring
 */
function getPassiveActionPenalty(
  urgencyLevel: VPUrgencyLevel,
  currentTurn: number,
  myVP: number
): number {
  // No penalty if leading in VP
  if (myVP > 0) {
    return 0;
  }

  // Penalty scales with urgency and turn number
  switch (urgencyLevel) {
    case 'desperate':
      // Turn 6+: -8 to -12 penalty
      return -2.5 * (currentTurn - 2);
    case 'high':
      // Turn 4-5: -4 to -6 penalty
      return -1.5 * (currentTurn - 2);
    case 'medium':
      // Turn 3-4: -2 to -3 penalty
      return -0.8 * (currentTurn - 2);
    case 'low':
    default:
      return 0;
  }
}

/**
 * Score action by VP contribution
 *
 * @param action - Action decision
 * @param urgency - VP urgency state
 * @returns VP contribution score (0.0-2.0)
 */
export function scoreActionByVP<T extends { action: ActionType }>(
  action: T,
  urgency: VPUrgencyState
): number {
  const vpInfo = getActionVPInfo(action.action);

  // Base VP contribution
  let vpScore = vpInfo.estimatedVPContribution * 2.0;

  // Urgency multiplier for direct VP actions
  if (vpInfo.isDirectVPAction) {
    const urgencyMultiplier = getUrgencyMultiplier(urgency.urgencyLevel);
    vpScore *= urgencyMultiplier;
  }

  // Penalty for passive actions when VP=0
  if (vpInfo.isPassiveAction && urgency.myVP === 0 && urgency.currentTurn >= 3) {
    const passivePenalty = getPassiveActionPenalty(urgency.urgencyLevel, urgency.currentTurn, urgency.myVP);
    vpScore += passivePenalty;
  }

  return Math.max(0, vpScore);
}

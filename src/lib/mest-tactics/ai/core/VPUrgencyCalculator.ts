/**
 * VP Urgency Calculator
 *
 * Calculates VP urgency state to drive AI decision-making.
 * Used by ActionVPFilter and UtilityScorer to prioritize VP-acquiring actions.
 */

/**
 * VP urgency level
 */
export type VPUrgencyLevel = 'low' | 'medium' | 'high' | 'desperate';

/**
 * VP urgency state
 */
export interface VPUrgencyState {
  /** My current VP */
  myVP: number;
  /** Best enemy VP */
  enemyVP: number;
  /** VP deficit (enemyVP - myVP) */
  vpDeficit: number;
  /** Turns remaining in game */
  turnsRemaining: number;
  /** Urgency level based on VP deficit and turns remaining */
  urgencyLevel: VPUrgencyLevel;
  /** VP needed per turn to catch up */
  requiredVPPerTurn: number;
  /** Current turn number */
  currentTurn: number;
  /** Maximum turns for this game */
  maxTurns: number;
  /** Am I leading in VP? */
  amILeading: boolean;
  /** VP lead margin (positive if leading, negative if trailing) */
  vpMargin: number;
}

/**
 * Configuration for VP urgency calculation
 */
export interface VPUrgencyConfig {
  /** Turn threshold for medium urgency (default: 3) */
  mediumUrgencyTurnThreshold: number;
  /** Turn threshold for high urgency (default: 5) */
  highUrgencyTurnThreshold: number;
  /** Turn threshold for desperate urgency (default: 6) */
  desperateUrgencyTurnThreshold: number;
  /** VP deficit threshold for high urgency (default: 2) */
  highUrgencyVPDeficit: number;
  /** VP deficit threshold for desperate urgency (default: 4) */
  desperateUrgencyVPDeficit: number;
  /** Enable zero VP desperation (default: true) */
  enableZeroVPDesperation: boolean;
}

/**
 * Default VP urgency configuration
 */
export const DEFAULT_VP_URGENCY_CONFIG: VPUrgencyConfig = {
  mediumUrgencyTurnThreshold: 3,
  highUrgencyTurnThreshold: 5,
  desperateUrgencyTurnThreshold: 6,
  highUrgencyVPDeficit: 2,
  desperateUrgencyVPDeficit: 4,
  enableZeroVPDesperation: true,
};

/**
 * Calculate VP urgency state
 *
 * @param myVP - My current victory points
 * @param enemyVP - Best enemy victory points
 * @param currentTurn - Current turn number
 * @param maxTurns - Maximum turns for this game
 * @param config - Optional configuration
 * @returns VP urgency state
 */
export function calculateVPUrgency(
  myVP: number,
  enemyVP: number,
  currentTurn: number,
  maxTurns: number,
  config: Partial<VPUrgencyConfig> = {}
): VPUrgencyState {
  const fullConfig = { ...DEFAULT_VP_URGENCY_CONFIG, ...config };

  const vpDeficit = enemyVP - myVP;
  const vpMargin = myVP - enemyVP;
  const turnsRemaining = Math.max(1, maxTurns - currentTurn + 1);
  const requiredVPPerTurn = turnsRemaining > 0 ? (vpDeficit + 1) / turnsRemaining : 0;
  const amILeading = myVP > enemyVP;

  // Determine urgency level
  let urgencyLevel: VPUrgencyLevel = 'low';

  // Check for desperate mode: VP=0 and late game
  if (fullConfig.enableZeroVPDesperation && myVP === 0 && currentTurn >= fullConfig.desperateUrgencyTurnThreshold) {
    urgencyLevel = 'desperate';
  }
  // Check for desperate mode: large VP deficit
  else if (vpDeficit >= fullConfig.desperateUrgencyVPDeficit) {
    urgencyLevel = 'desperate';
  }
  // Check for high urgency: moderate VP deficit or late game
  else if (
    vpDeficit >= fullConfig.highUrgencyVPDeficit ||
    currentTurn >= fullConfig.highUrgencyTurnThreshold
  ) {
    urgencyLevel = 'high';
  }
  // Check for medium urgency: small VP deficit or mid game
  else if (
    vpDeficit > 0 ||
    currentTurn >= fullConfig.mediumUrgencyTurnThreshold
  ) {
    urgencyLevel = 'medium';
  }
  // Otherwise: low urgency (leading or early game)

  return {
    myVP,
    enemyVP,
    vpDeficit,
    turnsRemaining,
    urgencyLevel,
    requiredVPPerTurn,
    currentTurn,
    maxTurns,
    amILeading,
    vpMargin,
  };
}

/**
 * Get urgency multiplier for scoring
 *
 * @param urgencyLevel - VP urgency level
 * @returns Multiplier for VP-related scoring (1.0-3.0)
 */
export function getUrgencyMultiplier(urgencyLevel: VPUrgencyLevel): number {
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
 *
 * @param urgencyLevel - VP urgency level
 * @param currentTurn - Current turn number
 * @param myVP - My current VP
 * @returns Penalty to apply to passive actions (Hide, Wait)
 */
export function getPassiveActionPenalty(
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
 * Get tactical advice based on VP urgency
 *
 * @param urgency - VP urgency state
 * @returns Array of tactical advice strings
 */
export function getVPUrgencyAdvice(urgency: VPUrgencyState): string[] {
  const advice: string[] = [];

  switch (urgency.urgencyLevel) {
    case 'desperate':
      advice.push('DESPERATE: Must acquire VP immediately - all passive actions penalized');
      if (urgency.myVP === 0) {
        advice.push('Zero VP - aggressive actions strongly preferred');
      }
      if (urgency.turnsRemaining <= 2) {
        advice.push(`Only ${urgency.turnsRemaining} turns remaining - must act now!`);
      }
      break;
    case 'high':
      advice.push('HIGH urgency: Behind on VP - prioritize combat and objectives');
      if (urgency.vpDeficit >= 2) {
        advice.push(`${urgency.vpDeficit} VP deficit - need aggressive plays`);
      }
      break;
    case 'medium':
      advice.push('MEDIUM urgency: Small VP deficit - maintain pressure');
      break;
    case 'low':
      if (urgency.amILeading) {
        advice.push(`Leading by ${urgency.vpMargin} VP - play defensively`);
      } else {
        advice.push('VP tied - early game, establish position');
      }
      break;
  }

  if (urgency.requiredVPPerTurn > 0) {
    advice.push(`Need ${urgency.requiredVPPerTurn.toFixed(1)} VP/turn to catch up`);
  }

  return advice;
}

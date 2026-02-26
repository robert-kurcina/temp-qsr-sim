/**
 * AI Stratagem Integration with Utility Scorer
 *
 * Applies stratagem modifiers to AI action scoring.
 */

import { ScoredAction, ScoredTarget, ScoredPosition } from '../core/AIController';
import { StratagemModifiers, TacticalDoctrine, AggressionLevel } from './AIStratagems';
import { ScoringModifiers, combineModifiers } from './PredictedScoringIntegration';

// ============================================================================
// Action Scoring Modifiers
// ============================================================================

/**
 * Apply stratagem modifiers to action scores
 */
export function applyStratagemModifiersToActions(
  actions: ScoredAction[],
  modifiers: StratagemModifiers
): ScoredAction[] {
  return actions.map((action) => {
    let modifiedScore = action.score;

    // Apply tactical doctrine modifiers
    switch (action.action) {
      case 'close_combat':
      case 'charge':
        modifiedScore *= modifiers.meleePreference;
        modifiedScore += modifiers.chargeBonus;
        break;

      case 'ranged_combat':
        modifiedScore *= modifiers.rangePreference;
        break;

      case 'concentrate':
        modifiedScore *= modifiers.concentratePreference;
        break;

      case 'disengage':
        // Aggressive stratagems discourage disengage
        if (modifiers.pushAdvantage) {
          modifiedScore *= 0.7;
        }
        break;

      case 'move':
        // Mission focus encourages movement to objectives
        if (modifiers.objectiveValue > 1.0) {
          modifiedScore *= 1.1;
        }
        break;
    }

    // Apply aggression modifiers to risky actions
    if (modifiers.riskTolerance < 1.0) {
      // Defensive: penalize risky actions
      if (['close_combat', 'charge'].includes(action.action)) {
        modifiedScore *= 0.9;
      }
    } else if (modifiers.riskTolerance > 1.0) {
      // Aggressive: bonus to offensive actions
      if (['close_combat', 'charge', 'ranged_combat'].includes(action.action)) {
        modifiedScore *= 1.1;
      }
    }

    return {
      ...action,
      score: modifiedScore,
    };
  });
}

/**
 * Apply combined stratagem + scoring modifiers to action scores
 */
export function applyCombinedModifiersToActions(
  actions: ScoredAction[],
  stratagemModifiers: StratagemModifiers,
  scoringModifiers: ScoringModifiers
): ScoredAction[] {
  // Combine modifiers
  const combined = combineModifiers(stratagemModifiers, scoringModifiers);
  
  // Apply combined modifiers
  return applyStratagemModifiersToActions(actions, combined);
}

// ============================================================================
// Target Scoring Modifiers
// ============================================================================

/**
 * Apply stratagem modifiers to target scores
 */
export function applyStratagemModifiersToTargets(
  targets: ScoredTarget[],
  modifiers: StratagemModifiers,
  hasMissionObjective: boolean = false
): ScoredTarget[] {
  return targets.map((target) => {
    let modifiedScore = target.score;

    // Apply planning priority modifiers (derived from TacticalDoctrine)
    if (modifiers.eliminationValue > 1.0) {
      // Aggression planning: bonus to all targets
      modifiedScore *= modifiers.eliminationValue;
    } else if (modifiers.objectiveValue > 1.0) {
      // Keys to Victory planning: prefer targets near objectives
      if (hasMissionObjective) {
        modifiedScore *= 0.9; // Slightly prefer objectives over kills
      }
    }

    // Apply aggression modifiers (derived from TacticalDoctrine)
    if (modifiers.riskTolerance > 1.0) {
      // Aggressive: prefer wounded targets (finish them off)
      const healthFactor = target.factors?.health ?? 1.0;
      if (healthFactor < 0.5) {
        modifiedScore *= 1.3; // Bonus to finish wounded
      }
    } else if (modifiers.survivalValue > 1.0) {
      // Defensive: prefer threatening targets (eliminate threats)
      const threatFactor = target.factors?.threat ?? 1.0;
      if (threatFactor > 1.5) {
        modifiedScore *= 1.2;
      }
    }

    return {
      ...target,
      score: modifiedScore,
    };
  });
}

// ============================================================================
// Position Scoring Modifiers
// ============================================================================

/**
 * Apply stratagem modifiers to position scores
 */
export function applyStratagemModifiersToPositions(
  positions: ScoredPosition[],
  modifiers: StratagemModifiers,
  distanceToObjective: number = 0
): ScoredPosition[] {
  return positions.map((position) => {
    let modifiedScore = position.score;

    // Apply engagement style modifiers (derived from TacticalDoctrine)
    if (modifiers.meleePreference > 1.0) {
      // Melee-Centric: Prefer positions closer to enemies
      const distanceFactor = position.factors?.distance ?? 1.0;
      if (distanceFactor > 0.8) {
        modifiedScore *= 1.2;
      }
    } else if (modifiers.rangePreference > 1.0) {
      // Ranged-Centric: Prefer positions at optimal range and cover
      const distanceFactor = position.factors?.distance ?? 1.0;
      const rangeMod = modifiers.optimalRangeMod;
      if (distanceFactor >= 0.5 && distanceFactor <= 0.8 * rangeMod) {
        modifiedScore *= 1.2;
      }
      // Prefer cover more
      const coverFactor = position.factors?.cover ?? 0;
      modifiedScore += coverFactor * 0.3;
    }

    // Apply planning priority modifiers (derived from TacticalDoctrine)
    if (modifiers.objectiveValue > 1.0) {
      // Keys to Victory: Bonus to positions closer to objectives
      if (distanceToObjective > 0) {
        const objectiveProximity = 1 - Math.min(1, distanceToObjective / 20);
        modifiedScore += objectiveProximity * 2;
      }
    }

    // Apply aggression modifiers (derived from TacticalDoctrine)
    if (modifiers.survivalValue > 1.0) {
      // Defensive: much higher cover value and cohesion
      const coverFactor = position.factors?.cover ?? 0;
      modifiedScore += coverFactor * 0.5;

      // Prefer positions closer to allies (cohesion)
      const cohesionFactor = position.factors?.cohesion ?? 0;
      modifiedScore += cohesionFactor * 0.3;
    } else if (modifiers.riskTolerance > 1.0) {
      // Aggressive: prefer forward positions
      const distanceFactor = position.factors?.distance ?? 1.0;
      if (distanceFactor > 0.9) {
        modifiedScore *= 1.15;
      }

      // Lower survival value weighting
      modifiedScore *= (2 - modifiers.survivalValue);
    }

    return {
      ...position,
      score: modifiedScore,
    };
  });
}

// ============================================================================
// Engagement Range Calculator
// ============================================================================

/**
 * Calculate optimal engagement range based on stratagems
 */
export function calculateOptimalEngagementRange(
  modifiers: StratagemModifiers,
  baseRange: number = 12
): number {
  return baseRange * modifiers.optimalRangeMod;
}

/**
 * Check if current distance is within optimal engagement range
 */
export function isWithinOptimalRange(
  currentDistance: number,
  modifiers: StratagemModifiers,
  baseRange: number = 12
): boolean {
  const optimalRange = calculateOptimalEngagementRange(modifiers, baseRange);
  const minRange = optimalRange * 0.5;
  const maxRange = optimalRange * 1.5;

  return currentDistance >= minRange && currentDistance <= maxRange;
}

// ============================================================================
// Retreat Decision
// ============================================================================

/**
 * Determine if AI should retreat based on stratagems and current state
 */
export function shouldRetreat(
  currentWounds: number,
  maxWounds: number,
  modifiers: StratagemModifiers,
  enemyCount: number,
  allyCount: number
): boolean {
  const healthRatio = 1 - (currentWounds / maxWounds);
  const retreatThreshold = modifiers.retreatThreshold;

  // Base retreat decision on health
  if (healthRatio < retreatThreshold) {
    return true;
  }

  // Aggressive stratagems rarely retreat
  if (modifiers.pushAdvantage && healthRatio > 0.3) {
    return false;
  }

  // Defensive stratagems retreat earlier when outnumbered
  if (modifiers.aggressionLevel === AggressionLevel.Defensive) {
    const outnumbered = enemyCount > allyCount;
    if (outnumbered && healthRatio < 0.7) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Charge Decision
// ============================================================================

/**
 * Determine if AI should charge based on stratagems
 */
export function shouldCharge(
  distance: number,
  mov: number,
  modifiers: StratagemModifiers,
  enemyHealth: number,
  allySupport: number,
  tacticalDoctrine?: TacticalDoctrine,
  aggressionLevel?: AggressionLevel
): boolean {
  // Check if charge is possible
  if (distance > mov + 1) {
    return false;
  }

  // Melee-Centric always charges if possible
  if (tacticalDoctrine === TacticalDoctrine.MeleeCentric) {
    return true;
  }

  // Aggressive charges more often
  if (aggressionLevel === AggressionLevel.Aggressive) {
    return true;
  }

  // Defensive only charges with advantage
  if (aggressionLevel === AggressionLevel.Defensive) {
    const hasAdvantage = enemyHealth < 0.5 || allySupport >= 2;
    return hasAdvantage;
  }

  // Balanced: charge if enemy is wounded or at close range
  return enemyHealth < 0.5 || distance <= 2;
}

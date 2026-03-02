/**
 * AI Predicted Scoring Integration
 *
 * Integrates predicted VP/RP scoring into AI utility scoring.
 * Allows AI to make strategic decisions based on current scoring position.
 */

import { KeyScoresBreakdown, KeyScore } from '../../../mission/MissionSide';
import { StratagemModifiers } from './AIStratagems';

// ============================================================================
// Predicted Scoring Context
// ============================================================================

/**
 * AI's view of the current scoring state
 */
export interface ScoringContext {
  /** My side's predicted scores */
  myScores: KeyScoresBreakdown;
  /** Best opponent's predicted scores */
  opponentScores: KeyScoresBreakdown;
  /** Am I leading in overall VP? */
  amILeading: boolean;
  /** VP lead margin */
  vpMargin: number;
  /** NEW: Percentage of remaining VP that I'm behind by (0.0-1.0+) */
  vpDeficitPercent: number;
  /** NEW: Total VP still available to earn this game */
  remainingVP: number;
  /** NEW: Current turn number */
  currentTurn: number;
  /** NEW: Maximum turns for this game */
  maxTurns: number;
  /** Which keys am I winning? */
  winningKeys: string[];
  /** Which keys am I losing? */
  losingKeys: string[];
  /** Confidence in current lead (0-1) */
  overallConfidence: number;
}

/**
 * Scoring-based action modifiers
 */
export interface ScoringModifiers {
  /** Multiplier for aggressive actions (charge, close combat) */
  aggressionMultiplier: number;
  /** Multiplier for defensive actions (move to cover, hold) */
  defenseMultiplier: number;
  /** Multiplier for objective-focused actions (move to zone, acquire marker) */
  objectiveMultiplier: number;
  /** Multiplier for risk-taking actions */
  riskMultiplier: number;
  /** Bonus to wait/react actions when ahead */
  waitBonus: number;
  /** Should I play for time? */
  playForTime: boolean;
  /** Should I take desperate risks? */
  desperateMode: boolean;
}

// ============================================================================
// Scoring Context Builder
// ============================================================================

/**
 * Mission configuration for VP calculation
 */
export interface MissionVPConfig {
  /** Total VP available in this mission (sum of all key VP values) */
  totalVPPool: number;
  /** Does this mission convert RP to VP at game end? */
  hasRPToVPConversion: boolean;
  /** Current turn number */
  currentTurn: number;
  /** Maximum turns for this game */
  maxTurns: number;
}

/**
 * Build scoring context from predicted scores
 * 
 * Calculates percentage-based VP deficit for mission-agnostic thresholds.
 */
export function buildScoringContext(
  myKeyScores: KeyScoresBreakdown,
  opponentKeyScores: KeyScoresBreakdown,
  missionConfig: MissionVPConfig
): ScoringContext {
  const winningKeys: string[] = [];
  const losingKeys: string[] = [];
  let totalMyPredicted = 0;
  let totalOpponentPredicted = 0;
  let totalConfidence = 0;
  let keyCount = 0;

  // Compare each key
  const allKeys = new Set([
    ...Object.keys(myKeyScores),
    ...Object.keys(opponentKeyScores),
  ]);

  for (const key of allKeys) {
    const myScore = myKeyScores[key];
    const opponentScore = opponentKeyScores[key];

    if (!myScore && !opponentScore) continue;

    const myPredicted = myScore?.predicted ?? 0;
    const opponentPredicted = opponentScore?.predicted ?? 0;

    totalMyPredicted += myPredicted;
    totalOpponentPredicted += opponentPredicted;

    if (myPredicted > opponentPredicted) {
      winningKeys.push(key);
      if (myScore) {
        totalConfidence += myScore.confidence;
        keyCount++;
      }
    } else if (opponentPredicted > myPredicted) {
      losingKeys.push(key);
    }
  }

  const amILeading = totalMyPredicted > totalOpponentPredicted;
  const vpMargin = totalMyPredicted - totalOpponentPredicted;
  const overallConfidence = keyCount > 0 ? totalConfidence / keyCount : 0.5;
  
  // Calculate remaining VP (what's still available to earn)
  // This is the mission's total VP pool minus what's already been predicted
  const alreadyPredictedVP = Math.max(totalMyPredicted, totalOpponentPredicted);
  const remainingVP = Math.max(0, missionConfig.totalVPPool - alreadyPredictedVP);
  
  // Calculate VP deficit percentage
  // If trailing: what % of remaining VP do I need to catch up?
  // If leading: what % of remaining VP does opponent need to catch up?
  let vpDeficitPercent = 0;
  if (remainingVP > 0) {
    const deficit = Math.abs(vpMargin);
    vpDeficitPercent = deficit / remainingVP;
  }

  return {
    myScores: myKeyScores,
    opponentScores: opponentKeyScores,
    amILeading,
    vpMargin,
    vpDeficitPercent,
    remainingVP,
    currentTurn: missionConfig.currentTurn,
    maxTurns: missionConfig.maxTurns,
    winningKeys,
    losingKeys,
    overallConfidence,
  };
}

// ============================================================================
// Scoring Modifiers Calculator
// ============================================================================

/**
 * Calculate scoring-based modifiers from context
 * 
 * CRITICAL: VP modifiers MUST DOMINATE tactical scoring.
 * Tactical positioning (cover, LOS) exists to SUPPORT VP pursuit, not replace it.
 * These multipliers are intentionally aggressive (10x+) to ensure AI prioritizes winning.
 * 
 * KEY CHANGE: Uses PERCENTAGE-BASED thresholds instead of fixed VP values.
 * This accounts for different mission VP pools (Elimination ~5 VP vs Triumvirate ~12 VP).
 */
export function calculateScoringModifiers(context: ScoringContext): ScoringModifiers {
  const modifiers: ScoringModifiers = {
    aggressionMultiplier: 1.0,
    defenseMultiplier: 1.0,
    objectiveMultiplier: 1.0,
    riskMultiplier: 1.0,
    waitBonus: 0,
    playForTime: false,
    desperateMode: false,
  };

  const { 
    amILeading, 
    vpMargin, 
    vpDeficitPercent, 
    remainingVP,
    currentTurn,
    maxTurns,
    winningKeys, 
    losingKeys, 
    overallConfidence 
  } = context;

  // Calculate time pressure (0.0 = early game, 1.0 = last turn)
  const timePressure = maxTurns > 0 ? currentTurn / maxTurns : 0;

  // ============================================================================
  // Scenario 1: Leading in VP (Protect the Lead)
  // ============================================================================
  if (amILeading) {
    // Use percentage of remaining VP that opponent would need to catch up
    const opponentDeficitPercent = vpDeficitPercent;
    
    if (opponentDeficitPercent >= 0.75 && remainingVP > 0) {
      // OPPONENT needs 75%+ of remaining VP to catch up - COMFORTABLE LEAD
      modifiers.defenseMultiplier = 3.0;    // +200% defensive positioning
      modifiers.waitBonus = 10;             // Massive wait/react bonus
      modifiers.playForTime = true;
      modifiers.riskMultiplier = 0.3;       // -70% risk taking
      modifiers.aggressionMultiplier = 0.3; // -70% aggression

      if (overallConfidence > 0.7) {
        // High confidence - very defensive, stall for win
        modifiers.objectiveMultiplier = 0.4; // Don't need more objectives
      }
    } else if (opponentDeficitPercent >= 0.25 && remainingVP > 0) {
      // OPPONENT needs 25-75% of remaining VP - SMALL LEAD
      modifiers.defenseMultiplier = 1.8;    // +80% defensive
      modifiers.waitBonus = 5;              // Strong wait bonus
      modifiers.riskMultiplier = 0.5;       // -50% risk
      modifiers.aggressionMultiplier = 0.6; // -40% aggression

      if (overallConfidence > 0.5) {
        // Moderate confidence - secure more VP
        modifiers.objectiveMultiplier = 1.5; // +50% objective focus
      }
    }
  }

  // ============================================================================
  // Scenario 2: Trailing in VP (Must Catch Up)
  // ============================================================================
  if (!amILeading) {
    // vpDeficitPercent = what % of remaining VP do I need to catch up?
    // 0.0 = tied, 0.5 = need 50% of remaining VP, 1.0+ = need more than all remaining VP
    
    if (vpDeficitPercent >= 1.0 && remainingVP > 0) {
      // IMPOSSIBLE/NEARLY IMPOSSIBLE: Need 100%+ of remaining VP
      // Only go desperate if there's still time
      if (timePressure < 0.8) {
        modifiers.desperateMode = true;
        modifiers.aggressionMultiplier = 5.0;  // +400% aggression
        modifiers.riskMultiplier = 3.0;        // +200% risk taking
        modifiers.defenseMultiplier = 0.3;     // -70% defense (ignore safety)
        modifiers.waitBonus = -10;             // Massive penalty to passive actions
        modifiers.objectiveMultiplier = 4.0;   // +300% objective focus

        // EXTREME: Force VP-generating actions
        if (losingKeys.includes('elimination')) {
          modifiers.aggressionMultiplier *= 1.5; // +50% more for elimination
        }
        if (losingKeys.includes('dominance') || losingKeys.includes('control')) {
          modifiers.objectiveMultiplier *= 1.5; // +50% more for zones
        }
      }
    } else if (vpDeficitPercent >= 0.50 && remainingVP > 0) {
      // HARD: Need 50-100% of remaining VP - AGGRESSIVE comeback
      modifiers.aggressionMultiplier = 2.5;  // +150% aggression
      modifiers.riskMultiplier = 1.8;        // +80% risk
      modifiers.defenseMultiplier = 0.6;     // -40% defense
      modifiers.waitBonus = -5;              // Penalty to passive actions
      modifiers.objectiveMultiplier = 2.0;   // +100% objective focus

      // Push for losing keys
      if (losingKeys.length > 0) {
        modifiers.objectiveMultiplier *= 1.3; // +30% more for specific keys
      }
    } else if (vpDeficitPercent >= 0.25 && remainingVP > 0) {
      // MODERATE: Need 25-50% of remaining VP - Slight pressure
      modifiers.aggressionMultiplier = 1.5;  // +50% aggression
      modifiers.objectiveMultiplier = 1.3;   // +30% objective focus
      modifiers.waitBonus = -2;              // Small wait penalty
    }
    
    // Late game pressure: If trailing with few turns left, increase aggression
    if (!amILeading && timePressure > 0.7 && remainingVP > 0) {
      const lateGameBonus = (timePressure - 0.7) * 3; // 0-0.9 bonus
      modifiers.aggressionMultiplier *= (1 + lateGameBonus);
      modifiers.objectiveMultiplier *= (1 + lateGameBonus);
    }
  }

  // ============================================================================
  // Scenario 3: Key-Specific Adjustments (VP Pursuit Focus)
  // ============================================================================

  // Adjust based on which keys we're winning/losing
  for (const key of winningKeys) {
    switch (key) {
      case 'dominance':
      case 'control':
      case 'poi':
        // Leading in zones/objectives - DEFEND THEM AT ALL COSTS
        modifiers.defenseMultiplier *= 2.0;
        modifiers.objectiveMultiplier *= 1.5; // Secure more
        break;
      case 'elimination':
      case 'commander_elimination':
      case 'vip_elimination':
        // Leading in eliminations - AVOID risky fights, preserve lead
        modifiers.riskMultiplier *= 0.5;
        modifiers.aggressionMultiplier *= 0.6;
        break;
      case 'sabotage':
      case 'harvest':
      case 'collection':
      case 'courier':
        // Leading in objectives - secure more
        modifiers.objectiveMultiplier *= 1.1;
        break;
      case 'sanctuary':
      case 'lastStand':
        // Leading in defensive keys - maintain position
        modifiers.defenseMultiplier *= 1.15;
        break;
    }
  }

  for (const key of losingKeys) {
    switch (key) {
      case 'dominance':
      case 'control':
      case 'poi':
        // Losing zones - contest them harder
        modifiers.objectiveMultiplier *= 1.3;
        break;
      case 'elimination':
      case 'commander_elimination':
      case 'vip_elimination':
        // Losing eliminations - be more aggressive
        modifiers.aggressionMultiplier *= 1.2;
        break;
      case 'sabotage':
      case 'harvest':
      case 'collection':
      case 'courier':
        // Losing objectives - prioritize them
        modifiers.objectiveMultiplier *= 1.4;
        break;
      case 'sanctuary':
      case 'lastStand':
        // Losing sanctuary - get models back in zone
        modifiers.defenseMultiplier *= 1.2;
        break;
      case 'aggression':
      case 'encroachment':
      case 'exit':
        // Losing movement keys - push forward
        modifiers.aggressionMultiplier *= 1.15;
        modifiers.riskMultiplier *= 1.1;
        // Additional pressure for Aggression key specifically
        if (key === 'aggression') {
          modifiers.aggressionMultiplier *= 1.1; // Stack to 1.265x total
          modifiers.meleePreference *= 1.15; // Prefer melee to close distance
        }
        break;
      case 'firstBlood':
        // Missed first blood - compensate with aggression
        modifiers.aggressionMultiplier *= 1.1;
        break;
    }
  }

  // ============================================================================
  // Confidence Adjustments
  // ============================================================================
  if (overallConfidence < 0.3 && amILeading) {
    // Leading but insecure - play safer
    modifiers.defenseMultiplier *= 1.2;
    modifiers.riskMultiplier *= 0.8;
  } else if (overallConfidence > 0.7 && !amILeading) {
    // Trailing but confident - can take calculated risks
    modifiers.riskMultiplier *= 1.1;
  }

  return modifiers;
}

// ============================================================================
// Integration with Stratagem Modifiers
// ============================================================================

/**
 * Combine scoring modifiers with stratagem modifiers
 */
export function combineModifiers(
  stratagem: StratagemModifiers,
  scoring: ScoringModifiers
): StratagemModifiers {
  return {
    ...stratagem,
    // Combat preferences
    meleePreference: stratagem.meleePreference * scoring.aggressionMultiplier,
    rangePreference: stratagem.rangePreference,
    optimalRangeMod: stratagem.optimalRangeMod,

    // Target priority
    objectiveValue: stratagem.objectiveValue * scoring.objectiveMultiplier,
    eliminationValue: stratagem.eliminationValue * scoring.aggressionMultiplier,

    // Risk tolerance
    riskTolerance: stratagem.riskTolerance * scoring.riskMultiplier,
    survivalValue: stratagem.survivalValue * scoring.defenseMultiplier,
    pushAdvantage: stratagem.pushAdvantage || scoring.desperateMode,

    // Action scoring
    chargeBonus: scoring.desperateMode
      ? stratagem.chargeBonus + 3
      : stratagem.chargeBonus + scoring.waitBonus,
    retreatThreshold: scoring.playForTime
      ? Math.min(0.9, stratagem.retreatThreshold + 0.2)
      : stratagem.retreatThreshold,
    concentratePreference: stratagem.concentratePreference,
  };
}

// ============================================================================
// Utility: Get Key-Specific Advice
// ============================================================================

/**
 * Generate tactical advice based on scoring state
 */
export function getScoringAdvice(context: ScoringContext): string[] {
  const advice: string[] = [];
  const { amILeading, vpMargin, winningKeys, losingKeys } = context;

  if (amILeading) {
    if (vpMargin >= 3) {
      advice.push('Comfortable lead - play defensively and run down the clock');
    } else {
      advice.push('Small lead - secure additional objectives to extend lead');
    }

    if (winningKeys.includes('elimination') || winningKeys.includes('commander_elimination') || winningKeys.includes('vip_elimination')) {
      advice.push('Winning eliminations - avoid risky engagements');
    }
    if (winningKeys.includes('dominance') || winningKeys.includes('control') || winningKeys.includes('poi')) {
      advice.push('Controlling zones/objectives - defend key positions');
    }
    if (winningKeys.includes('sanctuary') || winningKeys.includes('lastStand')) {
      advice.push('Winning defensive key - maintain position and stay in zone');
    }
    if (winningKeys.includes('sabotage') || winningKeys.includes('harvest') || winningKeys.includes('courier')) {
      advice.push('Ahead on objectives - secure remaining objectives');
    }
  } else {
    const deficit = Math.abs(vpMargin);
    if (deficit >= 4) {
      advice.push('Large deficit - take desperate risks to catch up');
    } else if (deficit >= 2) {
      advice.push('Moderate deficit - focus on high-value objectives');
    } else {
      advice.push('Close game - every VP counts');
    }

    if (losingKeys.includes('elimination') || losingKeys.includes('commander_elimination') || losingKeys.includes('vip_elimination')) {
      advice.push('Behind on eliminations - seek aggressive engagements');
    }
    if (losingKeys.includes('dominance') || losingKeys.includes('control') || losingKeys.includes('poi')) {
      advice.push('Losing zone control - contest objectives aggressively');
    }
    if (losingKeys.includes('courier') || losingKeys.includes('harvest') || losingKeys.includes('sabotage') || losingKeys.includes('collection')) {
      advice.push('Behind on objectives - prioritize extraction/completion');
    }
    if (losingKeys.includes('sanctuary') || losingKeys.includes('lastStand')) {
      advice.push('Losing sanctuary - get models back in zone');
    }
    if (losingKeys.includes('aggression') || losingKeys.includes('encroachment') || losingKeys.includes('exit')) {
      advice.push('Behind on movement key - push forward aggressively');
    }
    if (losingKeys.includes('firstBlood')) {
      advice.push('Missed first blood - compensate with early aggression');
    }
  }

  return advice;
}

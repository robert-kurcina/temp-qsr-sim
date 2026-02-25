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
 * Build scoring context from predicted scores
 */
export function buildScoringContext(
  myKeyScores: KeyScoresBreakdown,
  opponentKeyScores: KeyScoresBreakdown
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

  return {
    myScores: myKeyScores,
    opponentScores: opponentKeyScores,
    amILeading,
    vpMargin,
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

  const { amILeading, vpMargin, winningKeys, losingKeys, overallConfidence } = context;

  // ============================================================================
  // Scenario 1: Leading in VP
  // ============================================================================
  if (amILeading) {
    if (vpMargin >= 3) {
      // Comfortable lead (3+ VP)
      modifiers.defenseMultiplier = 1.3; // Play safer
      modifiers.waitBonus = 2; // Bonus to wait/react
      modifiers.playForTime = true;
      modifiers.riskMultiplier = 0.7; // Avoid risks

      if (overallConfidence > 0.7) {
        // High confidence - very defensive
        modifiers.aggressionMultiplier = 0.6;
        modifiers.objectiveMultiplier = 0.8; // Don't need more objectives
      }
    } else if (vpMargin >= 1) {
      // Small lead (1-2 VP)
      modifiers.defenseMultiplier = 1.1;
      modifiers.waitBonus = 1;
      modifiers.riskMultiplier = 0.9;

      if (overallConfidence > 0.5) {
        // Moderate confidence - consolidate
        modifiers.objectiveMultiplier = 1.2; // Secure more objectives
      }
    }
  }

  // ============================================================================
  // Scenario 2: Trailing in VP
  // ============================================================================
  if (!amILeading) {
    const deficit = Math.abs(vpMargin);

    if (deficit >= 4) {
      // Large deficit (4+ VP) - desperate mode
      modifiers.desperateMode = true;
      modifiers.aggressionMultiplier = 1.5; // High risk, high reward
      modifiers.riskMultiplier = 1.5;
      modifiers.defenseMultiplier = 0.7; // Ignore safety
      modifiers.waitBonus = -2; // Penalty to passive actions

      // Focus on high-value keys
      if (losingKeys.includes('elimination')) {
        modifiers.aggressionMultiplier *= 1.3;
      }
    } else if (deficit >= 2) {
      // Moderate deficit (2-3 VP)
      modifiers.aggressionMultiplier = 1.2;
      modifiers.riskMultiplier = 1.2;
      modifiers.objectiveMultiplier = 1.3; // Need objectives

      // Push for losing keys
      if (losingKeys.length > 0) {
        modifiers.objectiveMultiplier *= 1.2;
      }
    } else {
      // Small deficit (0-1 VP)
      modifiers.aggressionMultiplier = 1.1;
      modifiers.objectiveMultiplier = 1.1;
    }
  }

  // ============================================================================
  // Scenario 3: Key-Specific Adjustments
  // ============================================================================

  // Adjust based on which keys we're winning/losing
  for (const key of winningKeys) {
    switch (key) {
      case 'dominance':
      case 'control':
      case 'poi':
        // Leading in zones/objectives - defend them
        modifiers.defenseMultiplier *= 1.1;
        break;
      case 'elimination':
      case 'commander_elimination':
      case 'vip_elimination':
        // Leading in eliminations - avoid risky fights
        modifiers.riskMultiplier *= 0.9;
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

/**
 * Fractional VP Scoring Utilities
 * 
 * Shared utilities for calculating fractional predicted VP across all missions.
 * Eliminates redundancy by providing common calculation patterns.
 * 
 * @module FractionalScoringUtils
 */

import type { MissionSideStatus } from './mission-scoring';

/**
 * Key score result for fractional VP calculation
 */
export interface FractionalKeyScore {
  predicted: number;    // 0.0-1.0 (or higher for multi-VP keys)
  confidence: number;   // 0.0-1.0
  leadMargin: number;
}

/**
 * Calculate fractional VP for elimination-based keys
 * 
 * VP is proportional to enemy BP eliminated relative to total enemy BP.
 * Leading side gets full fractional VP (0.0-1.0), trailing gets reduced (0.0-0.5).
 * 
 * @param sideId - The side to calculate for
 * @param eliminationBpBySide - Map of side ID to eliminated enemy BP
 * @param totalEnemyBpBySide - Map of side ID to total enemy BP
 * @returns Fractional key score
 */
export function calculateEliminationFractionalVP(
  sideId: string,
  eliminationBpBySide: Record<string, number>,
  totalEnemyBpBySide: Record<string, number>
): FractionalKeyScore {
  const sortedElimination = Object.entries(eliminationBpBySide)
    .sort((a, b) => b[1] - a[1]);
  const bestElimination = sortedElimination[0];
  const secondElimination = sortedElimination[1];
  
  const bp = eliminationBpBySide[sideId] || 0;
  const totalEnemyBp = totalEnemyBpBySide[sideId] || 1;
  const isBest = bestElimination && sideId === bestElimination[0];
  
  // FRACTIONAL VP: Proportional to elimination progress
  const eliminationRatio = bp / totalEnemyBp;
  const predicted = isBest && (!secondElimination || bestElimination[1] > secondElimination[1])
    ? Math.min(1, eliminationRatio)  // Leading: 0.0-1.0
    : Math.min(0.5, eliminationRatio * 0.5);  // Trailing: 0.0-0.5
  
  const leadMargin = isBest && secondElimination ? bestElimination[1] - secondElimination[1] : 0;
  const opponentBest = isBest && secondElimination ? secondElimination[1] : (bestElimination?.[1] ?? 0);
  const confidence = bp > 0 && opponentBest > 0
    ? Math.max(0, Math.min(1, 1 - (opponentBest / bp)))
    : (isBest ? 1 : 0);
  
  return { predicted, confidence, leadMargin };
}

/**
 * Calculate fractional VP for bottled key
 * 
 * VP based on opponent casualty rates and bottleneck progress.
 * 
 * @param sideId - The side to calculate for
 * @param sideStatuses - All side statuses for comparison
 * @returns Fractional key score
 */
export function calculateBottledFractionalVP(
  sideId: string,
  sideStatuses: MissionSideStatus[]
): FractionalKeyScore {
  const side = sideStatuses.find(s => s.sideId === sideId);
  if (!side) return { predicted: 0, confidence: 0, leadMargin: 0 };
  
  const bottledSides = sideStatuses.filter(s => s.bottledOut);
  const opponentBottled = bottledSides.filter(s => s.sideId !== sideId);
  
  let predicted = 0;
  let confidence = 0;
  
  if (opponentBottled.length > 0) {
    // At least one opponent bottled - earn fractional VP
    const totalOpponents = sideStatuses.filter(s => s.sideId !== sideId).length;
    const bottledRatio = opponentBottled.length / Math.max(1, totalOpponents);
    predicted = 0.5 + (bottledRatio * 0.5); // 0.5-1.0 VP
    confidence = 0.8 + (bottledRatio * 0.2); // 0.8-1.0 confidence
  } else {
    // No opponents bottled yet - track progress toward bottling
    const myCasualtyRate = (side.koCount + side.eliminatedCount) / Math.max(1, side.startingCount);
    const opponentCasualtyRates = sideStatuses
      .filter(s => s.sideId !== sideId)
      .map(s => (s.koCount + s.eliminatedCount) / Math.max(1, s.startingCount));
    const avgOpponentCasualty = opponentCasualtyRates.reduce((a, b) => a + b, 0) / Math.max(1, opponentCasualtyRates.length);
    
    // If opponents are closer to bottling than us, we have predicted VP
    if (avgOpponentCasualty > myCasualtyRate) {
      predicted = (avgOpponentCasualty - myCasualtyRate) * 2; // 0-1 VP based on gap
      confidence = 0.5;
    }
  }
  
  return { predicted, confidence, leadMargin: predicted };
}

/**
 * Calculate fractional VP for zone control keys (dominance, control, poi)
 * 
 * VP proportional to zones controlled relative to total zones.
 * 
 * @param sideId - The side to calculate for
 * @param zonesControlled - Number of zones controlled by this side
 * @param totalZones - Total number of zones on battlefield
 * @param isLeading - Whether this side is leading in zone control
 * @returns Fractional key score
 */
export function calculateZoneControlFractionalVP(
  sideId: string,
  zonesControlled: number,
  totalZones: number,
  isLeading: boolean
): FractionalKeyScore {
  const controlRatio = totalZones > 0 ? zonesControlled / totalZones : 0;
  
  // Leading side gets full fractional VP, trailing gets reduced
  const predicted = isLeading ? controlRatio : controlRatio * 0.5;
  const confidence = isLeading ? Math.min(1, controlRatio + 0.3) : controlRatio * 0.8;
  const leadMargin = isLeading ? zonesControlled : -zonesControlled;
  
  return { predicted, confidence, leadMargin };
}

/**
 * Calculate fractional VP for objective marker keys (collection, acquisition, sabotage, harvest, etc.)
 * 
 * VP proportional to markers controlled/acquired relative to total markers.
 * 
 * @param sideId - The side to calculate for
 * @param markersControlled - Number of markers controlled by this side
 * @param totalMarkers - Total number of markers on battlefield
 * @param isLeading - Whether this side is leading in marker control
 * @returns Fractional key score
 */
export function calculateMarkerControlFractionalVP(
  sideId: string,
  markersControlled: number,
  totalMarkers: number,
  isLeading: boolean
): FractionalKeyScore {
  const controlRatio = totalMarkers > 0 ? markersControlled / totalMarkers : 0;
  
  // Leading side gets full fractional VP, trailing gets reduced
  const predicted = isLeading ? controlRatio : controlRatio * 0.5;
  const confidence = isLeading ? Math.min(1, controlRatio + 0.3) : controlRatio * 0.8;
  const leadMargin = isLeading ? markersControlled : -markersControlled;
  
  return { predicted, confidence, leadMargin };
}

/**
 * Calculate fractional VP for outnumbered key
 * 
 * VP based on model count ratio between sides.
 * The SMALLER side earns VP for holding out against odds.
 * Ratio >= 2:1 = 1 VP, Ratio >= 1.5:1 = 0.5 VP
 * 
 * @param sideId - The side to calculate for
 * @param myCount - This side's model count
 * @param enemyCount - Enemy's model count
 * @returns Fractional key score
 */
export function calculateOutnumberedFractionalVP(
  sideId: string,
  myCount: number,
  enemyCount: number
): FractionalKeyScore {
  if (myCount >= enemyCount) {
    // Not outnumbered - no VP
    return { predicted: 0, confidence: 0, leadMargin: 0 };
  }
  
  // Calculate ratio (enemy/my count, so >1 means we're outnumbered)
  const ratio = enemyCount / Math.max(1, myCount);
  
  // VP scales with ratio disadvantage
  // 2:1 ratio = 1 VP, 1.5:1 = 0.5 VP, <1.5:1 = 0 VP
  let predicted = 0;
  if (ratio >= 2) {
    predicted = 1.0;
  } else if (ratio >= 1.5) {
    predicted = 0.5 + ((ratio - 1.5) * 1.0); // 0.5-1.0
  }
  
  const confidence = predicted > 0 ? Math.min(1, ratio * 0.5) : 0;
  const leadMargin = predicted > 0 ? enemyCount - myCount : 0;
  
  return { predicted, confidence, leadMargin };
}

/**
 * Calculate fractional VP for aggression/encroachment keys
 * 
 * VP based on crossing ratio (models crossed / threshold).
 * 
 * @param sideId - The side to calculate for
 * @param crossedCount - Number of models that crossed
 * @param threshold - Threshold for VP award
 * @returns Fractional key score
 */
export function calculateAggressionFractionalVP(
  sideId: string,
  crossedCount: number,
  threshold: number
): FractionalKeyScore {
  const ratio = threshold > 0 ? crossedCount / threshold : 0;
  const predicted = Math.min(1, ratio); // 0.0-1.0 based on progress
  const confidence = Math.min(1, ratio * 0.8);
  const leadMargin = crossedCount - threshold;
  
  return { predicted, confidence, leadMargin };
}

/**
 * Calculate fractional VP for first blood key
 * 
 * Binary (0 or 1) but with confidence based on game state.
 * 
 * @param sideId - The side to calculate for
 * @param firstBloodSideId - Side that got first blood (if any)
 * @param currentTurn - Current turn number
 * @returns Fractional key score
 */
export function calculateFirstBloodFractionalVP(
  sideId: string,
  firstBloodSideId: string | undefined,
  currentTurn: number
): FractionalKeyScore {
  if (!firstBloodSideId) {
    // No first blood yet - both sides have 0.5 predicted with low confidence
    return { predicted: 0.5, confidence: 0.3, leadMargin: 0 };
  }
  
  if (sideId === firstBloodSideId) {
    // Got first blood - full VP with high confidence
    return { predicted: 1.0, confidence: 1.0, leadMargin: 1 };
  }
  
  // Missed first blood - 0 VP
  return { predicted: 0, confidence: 1.0, leadMargin: -1 };
}

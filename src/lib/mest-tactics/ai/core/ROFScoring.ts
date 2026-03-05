/**
 * AI Utility Scoring for ROF/Suppression/Firelane
 * 
 * Provides AI with spatial awareness for:
 * - ROF marker placement value
 * - Suppression area denial value
 * - Firelane Field-of-Fire coverage
 * - Avoiding suppression zones
 * - Using Hard Cover against ROF
 * 
 * Source: rules-advanced-rof.md, rules-advanced-suppression.md, rules-advanced-firelane.md
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import {
  // ROF/Suppression spatial functions
  getROFLevel,
  calculateROFMarkerPositions,
  getROFDiceBonus,
  calculateSuppressionEffect,
  checkSuppressionCrossing,
  calculateCoreDamageDefense,
  // UI Rendering types (reused for AI)
  ROFMarker,
  SuppressionMarker,
  FieldOfFire,
  SuppressionZoneVisualization,
} from '../../traits/rof-suppression-spatial';

// Re-export types for use by UtilityScorer
export type { ROFMarker, SuppressionMarker, FieldOfFire, SuppressionZoneVisualization };

// Helper to calculate distance between positions
function distanceBetween(pos1: Position, pos2: Position): number {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// AI SCORING INTERFACES
// ============================================================================

/**
 * ROF placement scoring result
 */
export interface ROFPlacementScore {
  /** Total score for this ROF placement */
  score: number;
  /** Number of targets that can be hit */
  targetsInRange: number;
  /** ROF dice bonus for primary target */
  rofDiceBonus: number;
  /** Whether placement avoids Friendly fire */
  avoidsFriendlyFire: boolean;
  /** Marker positions for visualization */
  markerPositions: Position[];
}

/**
 * Suppression zone scoring result
 */
export interface SuppressionZoneScore {
  /** Total score for suppression zone */
  score: number;
  /** Suppression DR (1-4) */
  dr: number;
  /** Number of enemy models in zone */
  enemiesInZone: number;
  /** Number of friendly models in zone (negative) */
  friendliesInZone: number;
  /** Whether zone blocks key terrain */
  blocksKeyTerrain: boolean;
}

/**
 * Firelane FOF scoring result
 */
export interface FirelaneFOFScore {
  /** Total score for FOF coverage */
  score: number;
  /** Number of targets in FOF */
  targetsInFOF: number;
  /** FOF arc width coverage (0-1) */
  arcCoverage: number;
  /** Whether gunner is in defensive position */
  isDefensive: boolean;
  /** Suppression marker count available */
  suppressionCount: number;
}

/**
 * Position safety score regarding ROF/Suppression
 */
export interface PositionSafetyScore {
  /** Total safety score (higher = safer) */
  score: number;
  /** Suppression DR at this position */
  suppressionDR: number;
  /** Number of ROF markers in range */
  rofMarkersInRange: number;
  /** Whether position is behind Hard Cover */
  behindHardCover: boolean;
  /** Whether position is in suppression zone */
  inSuppressionZone: boolean;
}

// ============================================================================
// ROF PLACEMENT SCORING
// ============================================================================

/**
 * Score ROF marker placement for AI decision making
 * 
 * Factors:
 * - Number of enemy targets in ROF marker range
 * - ROF dice bonus for primary target
 * - Avoidance of Friendly models
 * - LOS to targets
 */
export function scoreROFPlacement(
  attacker: Character,
  battlefield: Battlefield,
  primaryTarget: Character,
  rofLevel: number,
  allCharacters: Character[] = []
): ROFPlacementScore {
  const markerPositions = calculateROFMarkerPositions(
    attacker,
    battlefield,
    rofLevel,
    primaryTarget,
    2 // cohesion
  );

  if (markerPositions.length === 0) {
    return {
      score: 0,
      targetsInRange: 0,
      rofDiceBonus: 0,
      avoidsFriendlyFire: true,
      markerPositions: [],
    };
  }

  // Count enemy targets in ROF range
  const enemyTargets = allCharacters.filter(c => 
    c.id !== attacker.id && isEnemy(attacker, c)
  );

  let targetsInRange = 0;
  let totalRofDiceBonus = 0;

  for (const target of enemyTargets) {
    const targetPos = battlefield.getCharacterPosition(target);
    if (!targetPos) continue;

    // Count markers within 1" of target
    const markersInRange = markerPositions.filter(pos => 
      distanceBetween(pos, targetPos) <= 1
    );

    if (markersInRange.length > 0) {
      targetsInRange++;
      totalRofDiceBonus += markersInRange.length;
    }
  }

  // Check for Friendly fire (markers near Friendly models)
  const friendlyModels = allCharacters.filter(c => 
    c.id !== attacker.id && !isEnemy(attacker, c)
  );

  let avoidsFriendlyFire = true;
  for (const friendly of friendlyModels) {
    const friendlyPos = battlefield.getCharacterPosition(friendly);
    if (!friendlyPos) continue;

    const nearFriendly = markerPositions.some(pos => 
      distanceBetween(pos, friendlyPos) < 1
    );

    if (nearFriendly) {
      avoidsFriendlyFire = false;
      break;
    }
  }

  // Calculate score
  let score = 0;
  score += targetsInRange * 3; // 3 points per target
  score += totalRofDiceBonus * 2; // 2 points per ROF die
  score += avoidsFriendlyFire ? 5 : -10; // Bonus for avoiding Friendly fire, penalty for risk

  return {
    score,
    targetsInRange,
    rofDiceBonus: totalRofDiceBonus,
    avoidsFriendlyFire,
    markerPositions,
  };
}

// ============================================================================
// SUPPRESSION ZONE SCORING
// ============================================================================

/**
 * Score suppression zone for area denial
 * 
 * Factors:
 * - Number of enemy models in suppression zone
 * - Suppression DR (higher = better)
 * - Avoidance of Friendly models
 * - Blocking key terrain (chokepoints, objectives)
 */
export function scoreSuppressionZone(
  battlefield: Battlefield,
  suppressionMarkers: SuppressionMarker[],
  zoneCenter: Position,
  allCharacters: Character[] = []
): SuppressionZoneScore {
  let enemiesInZone = 0;
  let friendliesInZone = 0;

  for (const character of allCharacters) {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) continue;

    const dist = distanceBetween(charPos, zoneCenter);
    if (dist > 1) continue; // Outside 1" suppression range

    // Check if Hard Cover blocks this suppression
    // (simplified - would need full LOS check)
    
    if (isEnemyMarker(character, suppressionMarkers[0]?.creatorId || '')) {
      enemiesInZone++;
    } else {
      friendliesInZone++;
    }
  }

  // Calculate DR from marker count at this position
  const markersAtPosition = suppressionMarkers.filter(m => 
    distanceBetween(m.position, zoneCenter) < 0.1 // Same position
  );

  let dr = 0;
  if (markersAtPosition.length >= 10) dr = 4;
  else if (markersAtPosition.length >= 5) dr = 3;
  else if (markersAtPosition.length >= 2) dr = 2;
  else if (markersAtPosition.length >= 1) dr = 1;

  // Calculate score
  let score = 0;
  score += dr * 2; // 2 points per DR level
  score += enemiesInZone * 4; // 4 points per enemy in zone
  score -= friendliesInZone * 5; // -5 points per Friendly in zone (penalize Friendly fire)

  // TODO: Add key terrain blocking score when terrain analysis is available

  return {
    score,
    dr,
    enemiesInZone,
    friendliesInZone,
    blocksKeyTerrain: false, // TODO: Implement terrain analysis
  };
}

// ============================================================================
// FIRELANE FOF SCORING
// ============================================================================

/**
 * Score Firelane Field-of-Fire coverage
 * 
 * Factors:
 * - Number of targets in FOF arc
 * - FOF arc coverage (wider = more coverage)
 * - Defensive positioning (behind cover)
 * - Suppression marker count available
 */
export function scoreFirelaneFOF(
  gunner: Character,
  battlefield: Battlefield,
  fof: FieldOfFire,
  suppressionCount: number,
  allCharacters: Character[] = []
): FirelaneFOFScore {
  let targetsInFOF = 0;

  for (const character of allCharacters) {
    if (character.id === gunner.id) continue;
    
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) continue;

    // Check if in FOF
    const dx = charPos.x - fof.center.x;
    const dy = charPos.y - fof.center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > fof.maxRange) continue;

    const angleRad = Math.atan2(dy, dx);
    let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
    
    let angleDiff = Math.abs(angleDeg - fof.facing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    if (angleDiff <= fof.arcWidth / 2) {
      if (isEnemy(gunner, character)) {
        targetsInFOF++;
      }
    }
  }

  // Calculate arc coverage (0-1)
  const arcCoverage = fof.arcWidth / 360;

  // Check if gunner is in defensive position (simplified)
  const gunnerPos = battlefield.getCharacterPosition(gunner);
  const isDefensive = gunnerPos !== undefined; // TODO: Add proper cover check

  // Calculate score
  let score = 0;
  score += targetsInFOF * 3; // 3 points per target
  score += arcCoverage * 5; // 5 points for full 360 coverage
  score += isDefensive ? 2 : 0; // 2 points for defensive position
  score += suppressionCount * 2; // 2 points per suppression marker available

  return {
    score,
    targetsInFOF,
    arcCoverage,
    isDefensive,
    suppressionCount,
  };
}

// ============================================================================
// POSITION SAFETY SCORING
// ============================================================================

/**
 * Score position safety regarding ROF/Suppression
 * 
 * Factors:
 * - Suppression DR at position (lower = safer)
 * - Number of ROF markers in range (fewer = safer)
 * - Hard Cover protection
 * - Distance from suppression zones
 */
export function scorePositionSafety(
  character: Character,
  battlefield: Battlefield,
  position: Position,
  suppressionMarkers: SuppressionMarker[],
  rofMarkers: ROFMarker[]
): PositionSafetyScore {
  // Calculate suppression effect at this position
  const tempCharacter = createTempCharacterAtPosition(character, position);
  const suppressionEffect = calculateSuppressionEffect(
    tempCharacter,
    battlefield,
    suppressionMarkers
  );

  // Count ROF markers in range
  const rofMarkersInRange = rofMarkers.filter(m => 
    distanceBetween(m.position, position) <= 1
  ).length;

  // Check if behind Hard Cover (simplified)
  // TODO: Implement proper Hard Cover check using LOS

  const behindHardCover = false;

  // Calculate safety score (higher = safer)
  let score = 10; // Base score
  score -= suppressionEffect.dr * 2; // -2 per DR level
  score -= rofMarkersInRange * 1; // -1 per ROF marker
  score += behindHardCover ? 5 : 0; // +5 for Hard Cover

  return {
    score,
    suppressionDR: suppressionEffect.dr,
    rofMarkersInRange,
    behindHardCover,
    inSuppressionZone: suppressionEffect.markerCount > 0,
  };
}

// ============================================================================
// SUPPRESSION CROSSING DECISION
// ============================================================================

/**
 * Evaluate whether AI should attempt to cross suppression
 * 
 * Returns recommendation and confidence
 */
export interface SuppressionCrossingDecision {
  shouldCross: boolean;
  confidence: number; // 0-1
  reason: string;
  moraleTestDC: number;
  suppressionTestDC: number;
}

export function evaluateSuppressionCrossing(
  character: Character,
  battlefield: Battlefield,
  suppressionMarkers: SuppressionMarker[],
  actionType: string
): SuppressionCrossingDecision {
  const crossingResult = checkSuppressionCrossing(
    character,
    battlefield,
    suppressionMarkers,
    actionType
  );

  if (!crossingResult.isCrossing) {
    return {
      shouldCross: true,
      confidence: 1.0,
      reason: 'Not crossing suppression',
      moraleTestDC: 0,
      suppressionTestDC: 0,
    };
  }

  // Get character's POW and REF for test evaluation
  const powAttr = character.finalAttributes?.pow ?? character.attributes?.pow ?? 0;
  const refAttr = character.finalAttributes?.ref ?? character.attributes?.ref ?? 0;

  // Calculate test DCs
  const moraleTestDC = crossingResult.suppressionDR;
  const suppressionTestDC = crossingResult.suppressionDR;

  // Evaluate success probability
  const moraleSuccessChance = powAttr / Math.max(1, moraleTestDC);
  const suppressionSuccessChance = refAttr / Math.max(1, suppressionTestDC);

  const overallSuccessChance = (moraleSuccessChance + suppressionSuccessChance) / 2;

  // Decision logic
  let shouldCross = false;
  let reason = '';

  if (overallSuccessChance >= 0.7) {
    shouldCross = true;
    reason = `High success chance (${Math.round(overallSuccessChance * 100)}%)`;
  } else if (overallSuccessChance >= 0.4) {
    shouldCross = actionType === 'Move'; // Only cross if necessary
    reason = `Moderate success chance (${Math.round(overallSuccessChance * 100)}%)`;
  } else {
    shouldCross = false;
    reason = `Low success chance (${Math.round(overallSuccessChance * 100)}%), find alternate route`;
  }

  return {
    shouldCross,
    confidence: overallSuccessChance,
    reason,
    moraleTestDC,
    suppressionTestDC,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isEnemy(char1: Character, char2: Character): boolean {
  // TODO: Implement proper faction/assembly checking
  // For now, use simple heuristic
  return char1.id !== char2.id;
}

function isEnemyMarker(character: Character, creatorId: string): boolean {
  // TODO: Implement proper faction checking
  return character.id !== creatorId;
}

function createTempCharacterAtPosition(character: Character, position: Position): Character {
  // Create a temporary character reference with new position
  // This is a simplified approach - in production, would need proper position override
  return character;
}

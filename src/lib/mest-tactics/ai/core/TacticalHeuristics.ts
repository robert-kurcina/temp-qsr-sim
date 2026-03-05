/**
 * Tactical Heuristics for AI Efficiency
 * 
 * Reduces AI evaluation complexity from O(n²) to O(n × k) where k << n
 * by using QSR-aware tactical filtering with dynamic movement-based ranges.
 * 
 * Key Heuristics:
 * 1. Engagement State Filtering - Only evaluate tactically relevant enemies
 * 2. Scrum Awareness - Models in base contact form tactical units
 * 3. Cohesion-Based Filtering - Prioritize enemies within cohesion range
 * 4. Threat Immediacy Scoring - Dynamic urgency based on movement capability
 * 5. Early-Out Pruning - Skip low-value target evaluations
 * 
 * QSR Compliance:
 * - All ranges derived from character capabilities (no hardcoded distances)
 * - Effective movement accounts for Sprint X, Leap X, Flight X traits
 * - Cohesion uses visibilityOR from lighting conditions
 */

import type { Character } from '../../core/Character';
import type { Battlefield } from '../../battlefield/Battlefield';
import type { Position } from '../../battlefield/Position';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import {
  getEffectiveMovement,
  getThreatRange,
  type EffectiveMovementOptions,
} from '../../traits/combat-traits';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AIContext {
  character: Character;
  allies: Character[];
  enemies: Character[];
  allSides: Array<{ id: string; members: Array<{ character: Character }> }>;
  sideId: string;
  battlefield: Battlefield;
  config: {
    visibilityOrMu?: number;
    gameSize?: string;
    perCharacterFovLos?: boolean;
  };
}

export interface ScrumGroup {
  members: Character[];
  engagedEnemies: Character[];
  localOutnumber: number;
  centerPosition: Position;
  threatRange: number;
}

export interface CohesionAwareEnemies {
  withinCohesion: Character[];
  outsideCohesion: Character[];
}

export interface ThreatImmediacyFactors {
  distanceUrgency: number;
  engagementUrgency: number;
  movementUrgency: number;
  rangedThreat: number;
  totalScore: number;
}

// ============================================================================
// Heuristic 1: Engagement State Filtering
// ============================================================================

/**
 * Get tactically relevant enemies based on engagement state
 * 
 * Uses dynamic threat ranges derived from effective movement allowance.
 * Engaged models only evaluate engaged enemy + threats within their MOV.
 * Non-engaged models evaluate enemies within visibility OR.
 * 
 * @param context - AI evaluation context
 * @returns Filtered list of tactically relevant enemies
 */
export function getTacticallyRelevantEnemies(context: AIContext): Character[] {
  const character = context.character;
  const characterPos = context.battlefield.getCharacterPosition(character);
  if (!characterPos) return [];

  // Check if engaged
  const engagedEnemy = findEngagedEnemy(character, context);
  if (engagedEnemy) {
    // In melee: only care about engaged enemy + enemies who can threaten
    const relevant = [engagedEnemy];
    for (const enemy of context.enemies) {
      if (enemy === engagedEnemy) continue;
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      
      // Dynamic threat range: can this enemy reach me this turn?
      const threatRange = getEffectiveMovement(enemy, {
        isMovingStraight: true,
        isAtStartOrEnd: true,
        isAttentive: true,
        isFree: true,
      });
      const dist = Math.hypot(characterPos.x - enemyPos.x, characterPos.y - enemyPos.y);
      if (dist <= threatRange) {
        relevant.push(enemy);
      }
    }
    return relevant;
  }

  // Not engaged: use visibility-based culling
  const visibilityOR = context.config.visibilityOrMu ?? 16;
  return findEnemiesWithinRange(context, characterPos, visibilityOR);
}

/**
 * Find enemy currently engaged with character
 */
function findEngagedEnemy(character: Character, context: AIContext): Character | null {
  const characterPos = context.battlefield.getCharacterPosition(character);
  if (!characterPos) return null;

  const characterSiz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
  const characterBase = getBaseDiameterFromSiz(characterSiz);

  for (const enemy of context.enemies) {
    if (enemy.state.isEliminated || enemy.state.isKOd) continue;
    
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;

    const enemySiz = enemy.finalAttributes?.siz ?? enemy.attributes?.siz ?? 3;
    const enemyBase = getBaseDiameterFromSiz(enemySiz);

    if (SpatialRules.isEngaged(
      { id: character.id, position: characterPos, baseDiameter: characterBase, siz: characterSiz },
      { id: enemy.id, position: enemyPos, baseDiameter: enemyBase, siz: enemySiz }
    )) {
      return enemy;
    }
  }

  return null;
}

/**
 * Find enemies within a range
 */
function findEnemiesWithinRange(
  context: AIContext,
  position: Position,
  range: number
): Character[] {
  const relevant: Character[] = [];
  
  for (const enemy of context.enemies) {
    if (enemy.state.isEliminated || enemy.state.isKOd) continue;
    
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    
    const dist = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
    if (dist <= range) {
      relevant.push(enemy);
    }
  }
  
  return relevant;
}

// ============================================================================
// Heuristic 2: Scrum Awareness
// ============================================================================

/**
 * Find scrum group for character (models in base contact)
 * 
 * Models within 1.5 MU (base contact) form a tactical unit.
 * The scrum evaluates threats collectively and shares tactical data.
 * 
 * @param character - The character to find scrum for
 * @param context - AI evaluation context
 * @returns Scrum group or null if not in a scrum
 */
export function findMyScrumGroup(
  character: Character,
  context: AIContext
): ScrumGroup | null {
  const scrumMembers = [character];
  const characterPos = context.battlefield.getCharacterPosition(character);
  if (!characterPos) return null;

  // Find all friendly models within base contact (1.5 MU)
  for (const side of context.allSides || []) {
    if (side.id !== context.sideId) continue;
    
    for (const member of side.members) {
      if (member.character.id === character.id) continue;
      if (member.character.state.isEliminated || member.character.state.isKOd) continue;
      
      const allyPos = context.battlefield.getCharacterPosition(member.character);
      if (!allyPos) continue;
      
      const dist = Math.hypot(characterPos.x - allyPos.x, characterPos.y - allyPos.y);
      if (dist <= 1.5) {
        scrumMembers.push(member.character);
      }
    }
  }

  if (scrumMembers.length === 1) return null; // Not in a scrum

  // Find all enemies engaged with any scrum member
  const engagedEnemies = new Set<Character>();
  for (const member of scrumMembers) {
    const enemy = findEngagedEnemy(member, context);
    if (enemy) engagedEnemies.add(enemy);
  }

  // Calculate scrum threat range (fastest member determines reach)
  let maxThreatRange = 0;
  for (const member of scrumMembers) {
    const mov = getThreatRange(member);
    maxThreatRange = Math.max(maxThreatRange, mov);
  }

  return {
    members: scrumMembers,
    engagedEnemies: Array.from(engagedEnemies),
    localOutnumber: scrumMembers.length - engagedEnemies.size,
    centerPosition: calculateCenter(scrumMembers, context.battlefield),
    threatRange: maxThreatRange,
  };
}

/**
 * Calculate center position of a group
 */
function calculateCenter(members: Character[], battlefield: Battlefield): Position {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const member of members) {
    const pos = battlefield.getCharacterPosition(member);
    if (pos) {
      sumX += pos.x;
      sumY += pos.y;
      count++;
    }
  }

  return {
    x: count > 0 ? sumX / count : 0,
    y: count > 0 ? sumY / count : 0,
  };
}

// ============================================================================
// Heuristic 3: Cohesion-Based Filtering
// ============================================================================

/**
 * Calculate cohesion range per QSR rules
 * 
 * QSR Rule: Models are within Cohesion if they are in range AND LOS of another model.
 * The range is at best equal to half Visibility rounded down, but no more than the 
 * higher of either 4 MU or the SIZ in MUs of either model.
 * 
 * Formula: min(floor(visibilityOR / 2), max(4, max(mySIZ, theirSIZ)))
 * 
 * @param visibilityOR - Visibility optimal range in MU
 * @param mySiz - My SIZ attribute
 * @param theirSiz - Other model's SIZ attribute
 * @returns Cohesion range in MU
 */
export function getCohesionRange(
  visibilityOR: number = 16,
  mySiz: number = 3,
  theirSiz: number = 3
): number {
  const halfVisibility = Math.floor(visibilityOR / 2);
  const sizBasedRange = Math.max(4, mySiz, theirSiz);
  return Math.min(halfVisibility, sizBasedRange);
}

/**
 * Check if two characters are within cohesion
 * 
 * QSR: Must be in range AND have LOS
 */
export function isWithinCohesion(
  character: Character,
  other: Character,
  battlefield: Battlefield,
  visibilityOR: number = 16
): boolean {
  const charPos = battlefield.getCharacterPosition(character);
  const otherPos = battlefield.getCharacterPosition(other);
  if (!charPos || !otherPos) return false;
  
  // Check LOS first (required for cohesion)
  if (!battlefield.hasLineOfSight(charPos, otherPos)) {
    return false;
  }
  
  // Calculate distance
  const dist = Math.hypot(charPos.x - otherPos.x, charPos.y - otherPos.y);
  
  // Calculate cohesion range using QSR formula
  const mySiz = character.finalAttributes?.siz ?? character.attributes?.siz ?? 3;
  const theirSiz = other.finalAttributes?.siz ?? other.attributes?.siz ?? 3;
  const cohesionRange = getCohesionRange(visibilityOR, mySiz, theirSiz);
  
  return dist <= cohesionRange;
}

/**
 * Filter enemies by cohesion range
 * 
 * QSR cohesion requires both range AND LOS.
 * Enemies within cohesion are high priority.
 * Enemies outside cohesion are low priority.
 * 
 * @param context - AI evaluation context
 * @param position - Reference position
 * @returns Enemies categorized by cohesion range
 */
export function getCohesionAwareEnemies(
  context: AIContext,
  position: Position
): CohesionAwareEnemies {
  const visibilityOR = context.config.visibilityOrMu ?? 16;
  const gameSize = String((context.config as any).gameSize ?? '').toUpperCase();
  const skipLosForVerySmall = gameSize === 'VERY_SMALL' && !context.config.perCharacterFovLos;
  const relevant = getTacticallyRelevantEnemies(context);
  
  const mySiz = context.character.finalAttributes?.siz ?? context.character.attributes?.siz ?? 3;
  
  const withinCohesion: Character[] = [];
  const outsideCohesion: Character[] = [];
  
  for (const enemy of relevant) {
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    
    const dist = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
    
    // QSR: cohesion normally requires LOS, but VERY_SMALL god-mode runs can bypass
    // this expensive check when per-character LOS is disabled.
    const hasLOS = skipLosForVerySmall ? true : context.battlefield.hasLineOfSight(position, enemyPos);
    if (!hasLOS) {
      outsideCohesion.push(enemy);
      continue;
    }
    
    // Calculate cohesion range using QSR formula
    const theirSiz = enemy.finalAttributes?.siz ?? enemy.attributes?.siz ?? 3;
    const cohesionRange = getCohesionRange(visibilityOR, mySiz, theirSiz);
    
    if (dist <= cohesionRange) {
      withinCohesion.push(enemy);
    } else {
      outsideCohesion.push(enemy);
    }
  }

  return { withinCohesion, outsideCohesion };
}

// ============================================================================
// Heuristic 4: Threat Immediacy Scoring
// ============================================================================

/**
 * Evaluate threat immediacy for an enemy
 *
 * Combines distance urgency, engagement status, movement capability,
 * and weapon threat into a single urgency score.
 *
 * @param enemy - The enemy to evaluate
 * @param myPos - My position
 * @param context - AI evaluation context
 * @returns Threat immediacy factors and total score
 */
export function evaluateThreatImmediacy(
  enemy: Character,
  myPos: Position,
  context: AIContext
): ThreatImmediacyFactors {
  const enemyPos = context.battlefield.getCharacterPosition(enemy);
  if (!enemyPos) {
    return {
      distanceUrgency: 0,
      engagementUrgency: 0,
      movementUrgency: 0,
      rangedThreat: 0,
      totalScore: 0,
    };
  }

  const distance = Math.hypot(myPos.x - enemyPos.x, myPos.y - enemyPos.y);
  
  // Calculate cohesion range using QSR formula
  const visibilityOR = context.config.visibilityOrMu ?? 16;
  const mySiz = context.character.finalAttributes?.siz ?? context.character.attributes?.siz ?? 3;
  const theirSiz = enemy.finalAttributes?.siz ?? enemy.attributes?.siz ?? 3;
  const cohesionRange = getCohesionRange(visibilityOR, mySiz, theirSiz);
  
  // Distance-based urgency (exponential decay, half-life at cohesion range)
  const distanceUrgency = Math.exp(-distance / cohesionRange);
  
  // Engagement threat
  const isEngagedWithMe = isInMeleeRange(context.character, enemy, context.battlefield);
  const engagementUrgency = isEngagedWithMe ? 1.0 : 0;
  
  // Movement capability (can they reach me?)
  const enemyMOV = getEffectiveMovement(enemy, {
    isMovingStraight: true,
    isAtStartOrEnd: true,
    isAttentive: true,
    isFree: true,
  });
  const canReachMe = distance <= enemyMOV;
  const movementUrgency = canReachMe ? 0.5 : 0;
  
  // Weapon threat (ranged vs melee)
  const loadout = getLoadoutProfile(enemy);
  const rangedThreat = loadout.hasRangedWeapons && distance <= visibilityOR ? 0.3 : 0;
  
  return {
    distanceUrgency,
    engagementUrgency,
    movementUrgency,
    rangedThreat,
    totalScore: distanceUrgency + engagementUrgency + movementUrgency + rangedThreat,
  };
}

/**
 * Check if two characters are in melee range
 */
function isInMeleeRange(from: Character, to: Character, battlefield: Battlefield): boolean {
  const fromPos = battlefield.getCharacterPosition(from);
  const toPos = battlefield.getCharacterPosition(to);
  if (!fromPos || !toPos) return false;

  const fromSiz = from.finalAttributes?.siz ?? from.attributes?.siz ?? 3;
  const toSiz = to.finalAttributes?.siz ?? to.attributes?.siz ?? 3;
  const fromBase = getBaseDiameterFromSiz(fromSiz);
  const toBase = getBaseDiameterFromSiz(toSiz);

  return SpatialRules.isEngaged(
    { id: from.id, position: fromPos, baseDiameter: fromBase, siz: fromSiz },
    { id: to.id, position: toPos, baseDiameter: toBase, siz: toSiz }
  );
}

/**
 * Get loadout profile for character
 */
function getLoadoutProfile(character: Character): { hasMeleeWeapons: boolean; hasRangedWeapons: boolean } {
  const items = [
    ...(character.profile?.equipment ?? []),
    ...(character.profile?.items ?? []),
    ...(character.profile?.inHandItems ?? []),
    ...(character.profile?.stowedItems ?? []),
  ];
  
  let hasMeleeWeapons = false;
  let hasRangedWeapons = false;
  
  for (const item of items) {
    if (!item) continue;
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    
    if (classification.includes('bow') || classification.includes('thrown') ||
        classification.includes('firearm') || classification.includes('range') ||
        classification.includes('support')) {
      hasRangedWeapons = true;
    } else if (classification.includes('melee') || classification.includes('natural')) {
      hasMeleeWeapons = true;
    }
    
    if (hasMeleeWeapons && hasRangedWeapons) break;
  }
  
  return { hasMeleeWeapons, hasRangedWeapons };
}

// ============================================================================
// Heuristic 5: Early-Out Pruning
// ============================================================================

/**
 * Check if target evaluation should be skipped
 * 
 * Applies multiple pruning rules to skip low-value targets:
 * - Eliminated/KO'd enemies
 * - Outside visibility
 * - Too far to reach in 2 turns
 * - Already have much better option
 * 
 * @param enemy - The enemy to potentially skip
 * @param context - AI evaluation context
 * @param currentBestScore - Current best action score (for pruning)
 * @returns True if evaluation should be skipped
 */
export function shouldSkipTargetEvaluation(
  enemy: Character,
  context: AIContext,
  currentBestScore: number
): boolean {
  // Skip if eliminated/KO'd
  if (enemy.state.isEliminated || enemy.state.isKOd) return true;
  
  const enemyPos = context.battlefield.getCharacterPosition(enemy);
  if (!enemyPos) return true;
  
  const myPos = context.battlefield.getCharacterPosition(context.character);
  if (!myPos) return true;
  
  const distance = Math.hypot(myPos.x - enemyPos.x, myPos.y - enemyPos.y);
  const visibilityOR = context.config.visibilityOrMu ?? 16;
  
  // Skip if outside visibility (can't see, can't target)
  if (distance > visibilityOR) return true;
  
  // Skip if too far to be relevant this turn (2× movement allowance)
  const myMOV = getEffectiveMovement(context.character, {
    isMovingStraight: true,
    isAtStartOrEnd: true,
    isAttentive: true,
    isFree: true,
  });
  if (distance > myMOV * 2) return true; // Can't reach in 2 turns
  
  // Skip if already have much better option (pruning)
  const maxPossibleScore = estimateMaxPossibleScore(enemy, context);
  if (maxPossibleScore < currentBestScore * 0.5) return true;
  
  return false;
}

/**
 * Estimate maximum possible score for a target
 * 
 * Conservative upper bound for pruning decisions.
 */
function estimateMaxPossibleScore(enemy: Character, context: AIContext): number {
  // Conservative estimate based on threat and proximity
  const enemyPos = context.battlefield.getCharacterPosition(enemy);
  const myPos = context.battlefield.getCharacterPosition(context.character);
  
  if (!enemyPos || !myPos) return 0;
  
  const distance = Math.hypot(myPos.x - enemyPos.x, myPos.y - enemyPos.y);
  const threatImmediacy = evaluateThreatImmediacy(enemy, myPos, context);
  
  // Base score from threat immediacy (max ~2.3)
  let score = threatImmediacy.totalScore * 2;
  
  // Bonus for engaged targets
  if (isInMeleeRange(context.character, enemy, context.battlefield)) {
    score += 3;
  }
  
  // Bonus for weakened targets
  const enemySiz = enemy.finalAttributes?.siz ?? enemy.attributes?.siz ?? 3;
  const enemyWounds = enemy.state.wounds ?? 0;
  if (enemyWounds >= enemySiz - 1) {
    score += 5; // High priority to eliminate
  }
  
  return score;
}

// ============================================================================
// Utility Functions
// ============================================================================

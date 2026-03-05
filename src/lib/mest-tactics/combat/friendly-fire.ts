/**
 * Friendly Fire Rules (QSR)
 * 
 * Whenever the target of a Direct Range Attack is missed, one randomly selected model
 * (Opposing or Friendly) is subject to being attacked starting with those closest to
 * the target in this order:
 * 1. If it is in base-contact with the target
 * 2. If it is within 1" of the target
 * 3. If it is within 1" of LOF to the target
 * 
 * The player of the new target performs an Unopposed REF Test as a Defender Hit Test
 * using the misses from the failed Attack.
 * 
 * - Do not reduce Armor Rating if a Concentrated attack
 * - Friendly Attentive Ordered models in base-contact with the attacker are never at risk
 */

import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { LOSOperations } from '../battlefield/los/LOSOperations';
import { TestDice, DiceType, resolveTest } from '../subroutines/dice-roller';
import { Item } from '../core/Item';

export interface FriendlyFireTarget {
  /** Character that may be hit by friendly fire */
  character: Character;
  /** Position of the character */
  position: Position;
  /** Base diameter in MU */
  baseDiameter: number;
  /** Priority: 1 = base-contact, 2 = within 1", 3 = within 1" of LOF */
  priority: number;
  /** Distance to original target (for sorting within priority) */
  distanceToTarget: number;
}

export interface FriendlyFireResult {
  /** Whether friendly fire was triggered (attack missed) */
  triggered: boolean;
  /** Whether a new target was hit */
  hit: boolean;
  /** The character that was hit by friendly fire (if any) */
  hitCharacter?: Character;
  /** The REF test result for the friendly fire target */
  refTestScore?: number;
  /** Number of misses from original attack (used as penalty) */
  misses: number;
  /** Reason if no friendly fire occurred */
  reason?: string;
}

export interface FriendlyFireOptions {
  /** Original attacker */
  attacker: Character;
  /** Original intended target */
  originalTarget: Character;
  /** Original target's position */
  originalTargetPosition: Position;
  /** All characters on the battlefield (excluding attacker) */
  allCharacters: Character[];
  /** Character positions lookup */
  getCharacterPosition: (character: Character) => Position | undefined;
  /** Battlefield instance for LOS checks */
  battlefield: Battlefield;
  /** Weapon used in the attack */
  weapon: Item;
  /** Number of misses from the original attack */
  misses: number;
  /** Whether the original attack was Concentrated (affects AR reduction) */
  isConcentrated?: boolean;
}

/**
 * Check if two models are in base-contact
 */
export function isInBaseContact(
  pos1: Position,
  baseDiameter1: number,
  pos2: Position,
  baseDiameter2: number
): boolean {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const contactDistance = (baseDiameter1 + baseDiameter2) / 2;
  return distance <= contactDistance;
}

/**
 * Check if a position is within 1" of another position
 */
export function isWithin1Inch(
  pos1: Position,
  pos2: Position
): boolean {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= 1;
}

/**
 * Check if a position is within 1" of a line segment (LOF corridor)
 * LOF is treated as a 1 MU wide corridor
 */
export function isWithin1InchOfLOF(
  point: Position,
  lineStart: Position,
  lineEnd: Position
): boolean {
  // Calculate distance from point to line segment
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // LOF is 1 MU wide corridor, so check if within 0.5 MU of center line
  return distance <= 0.5;
}

/**
 * Find all potential friendly fire targets
 */
export function findFriendlyFireTargets(
  options: Omit<FriendlyFireOptions, 'misses' | 'weapon' | 'isConcentrated'>
): FriendlyFireTarget[] {
  const { attacker, originalTarget, originalTargetPosition, allCharacters, getCharacterPosition, battlefield } = options;
  
  const targets: FriendlyFireTarget[] = [];
  const attackerPos = getCharacterPosition(attacker);
  
  if (!attackerPos) {
    return [];
  }

  const attackerBase = getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3);
  const originalTargetBase = getBaseDiameterFromSiz(
    originalTarget.finalAttributes.siz ?? originalTarget.attributes.siz ?? 3
  );

  for (const character of allCharacters) {
    // Skip the attacker and original target
    if (character.id === attacker.id || character.id === originalTarget.id) {
      continue;
    }

    // Skip if not Attentive and Ordered (already out of the fight)
    if (!character.state.isAttentive || !character.state.isOrdered) {
      continue;
    }

    // QSR: Friendly Attentive Ordered models in base-contact with attacker are never at risk
    const charPos = getCharacterPosition(character);
    if (!charPos) {
      continue;
    }

    const charBase = getBaseDiameterFromSiz(
      character.finalAttributes.siz ?? character.attributes.siz ?? 3
    );

    // Check if in base-contact with attacker (safe)
    if (isInBaseContact(attackerPos, attackerBase, charPos, charBase)) {
      continue;
    }

    // Determine priority based on position relative to original target
    let priority: number | null = null;
    const targetPos = originalTargetPosition;
    const distanceToTarget = Math.sqrt(
      Math.pow(charPos.x - targetPos.x, 2) + Math.pow(charPos.y - targetPos.y, 2)
    );

    // Priority 1: Base-contact with target
    if (isInBaseContact(charPos, charBase, targetPos, originalTargetBase)) {
      priority = 1;
    }
    // Priority 2: Within 1" of target
    else if (isWithin1Inch(charPos, targetPos)) {
      priority = 2;
    }
    // Priority 3: Within 1" of LOF to target
    else if (isWithin1InchOfLOF(charPos, attackerPos, targetPos)) {
      priority = 3;
    }

    if (priority !== null) {
      targets.push({
        character,
        position: charPos,
        baseDiameter: charBase,
        priority,
        distanceToTarget,
      });
    }
  }

  // Sort by priority (ascending), then by distance (ascending)
  targets.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.distanceToTarget - b.distanceToTarget;
  });

  return targets;
}

/**
 * Select a random target from the highest priority group
 * QSR: "one randomly selected model"
 */
export function selectRandomTarget(
  targets: FriendlyFireTarget[],
  rng: () => number = Math.random
): FriendlyFireTarget | null {
  if (targets.length === 0) {
    return null;
  }

  // Get all targets with the highest priority (lowest number)
  const highestPriority = targets[0].priority;
  const priorityTargets = targets.filter(t => t.priority === highestPriority);

  if (priorityTargets.length === 0) {
    return null;
  }

  // Randomly select from this group
  const randomIndex = Math.floor(rng() * priorityTargets.length);
  return priorityTargets[randomIndex];
}

/**
 * Resolve the Friendly Fire REF Test
 * QSR: "have the player of the new target perform an Unopposed REF Test 
 * as a Defender Hit Test DR misses from the failed Attack"
 */
export function resolveFriendlyFireRefTest(
  target: Character,
  misses: number,
  rng: () => number = Math.random
): { score: number; hit: boolean } {
  // Unopposed REF Test vs. System (2 Base dice + 2)
  // The misses act as penalty dice
  
  // Target rolls 2 Base dice + REF attribute
  const refAttribute = target.finalAttributes.ref ?? target.attributes.ref ?? 0;
  
  const penaltyDice: TestDice = {};
  
  // Apply misses as Modifier dice penalty
  if (misses > 0) {
    penaltyDice[DiceType.Modifier] = misses;
  }
  
  // Use resolveTest for unopposed test (target vs. System)
  const rollResult = resolveTest(
    {
      character: target,
      attribute: 'ref',
      penaltyDice,
    },
    {
      isSystemPlayer: true, // System player (2 Base + 2 fixed)
    }
  );
  
  // Hit if target passes (score >= 0 means tie or win)
  const hit = rollResult.pass;
  
  return {
    score: rollResult.p1FinalScore,
    hit,
  };
}

/**
 * Main Friendly Fire resolution function
 */
export function resolveFriendlyFire(
  options: FriendlyFireOptions
): FriendlyFireResult {
  const { misses, isConcentrated = false } = options;
  
  // If the original attack hit, no friendly fire
  if (misses <= 0) {
    return {
      triggered: false,
      hit: false,
      misses,
      reason: 'Original attack hit',
    };
  }

  // Find potential targets
  const targets = findFriendlyFireTargets(options);
  
  if (targets.length === 0) {
    return {
      triggered: true,
      hit: false,
      misses,
      reason: 'No valid friendly fire targets',
    };
  }

  // Select random target from highest priority group
  const selectedTarget = selectRandomTarget(targets);
  
  if (!selectedTarget) {
    return {
      triggered: true,
      hit: false,
      misses,
      reason: 'No target selected',
    };
  }

  // Resolve REF test
  const refTest = resolveFriendlyFireRefTest(
    selectedTarget.character,
    misses
  );

  // Note: Armor is not reduced if Concentrated attack
  // (This would be handled in damage resolution if needed)

  return {
    triggered: true,
    hit: refTest.hit,
    hitCharacter: refTest.hit ? selectedTarget.character : undefined,
    refTestScore: refTest.score,
    misses,
  };
}

/**
 * Helper to integrate friendly fire into ranged combat attacks
 * Call this after a missed ranged attack
 */
export function handleFriendlyFireAfterMiss(
  attacker: Character,
  originalTarget: Character,
  originalTargetPosition: Position,
  allCharacters: Character[],
  getCharacterPosition: (character: Character) => Position | undefined,
  battlefield: Battlefield,
  weapon: Item,
  misses: number,
  isConcentrated?: boolean,
  rng?: () => number
): FriendlyFireResult {
  return resolveFriendlyFire({
    attacker,
    originalTarget,
    originalTargetPosition,
    allCharacters,
    getCharacterPosition,
    battlefield,
    weapon,
    misses,
    isConcentrated,
  });
}

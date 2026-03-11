import type { Character } from '../../core/Character';
import type { Position } from '../../battlefield/Position';
import type { Battlefield } from '../../battlefield/Battlefield';
import type { AIContext } from './AIController';
import { calculateAgility, resolveFallingTest } from '../../actions/agility';
import { getLeapAgilityBonus } from '../../traits/combat-traits';
import { TERRAIN_HEIGHTS } from '../../battlefield/terrain/TerrainElement';
import { detectGapAlongLine, getGapTacticalValue } from '../../battlefield/GapDetector';

type MeleeCountCallbacks = {
  countFriendlyInMeleeRange: (position: Position, range: number) => number;
  countEnemyInMeleeRange: (position: Position, range: number) => number;
  evaluateCover: (position: Position) => number;
};

export function evaluateBonusActions(
  context: AIContext,
  target: Character,
  hitCascades: number,
  attackerPos: Position | undefined,
  callbacks: MeleeCountCallbacks
): { score: number; reason: string; bonusType?: string } {
  const battlefield = context.battlefield;
  const attacker = context.character;
  const attackerPosition = attackerPos ?? battlefield.getCharacterPosition(attacker);
  const targetPosition = battlefield.getCharacterPosition(target);

  if (!attackerPosition || !targetPosition) {
    return { score: 0, reason: 'No position data' };
  }

  // Count cascades available for bonus actions
  const availableCascades = hitCascades;
  if (availableCascades < 1) {
    return { score: 0, reason: 'No cascades available' };
  }

  let bestScore = 0;
  let bestReason = '';
  let bestBonusType = '';

  // 1. PUSH-BACK: Check if pushing target creates advantage
  const pushBackScore = evaluatePushBack(
    context,
    attacker,
    target,
    attackerPosition,
    targetPosition,
    availableCascades,
    callbacks
  );
  if (pushBackScore.score > bestScore) {
    bestScore = pushBackScore.score;
    bestReason = pushBackScore.reason;
    bestBonusType = 'push-back';
  }

  // 2. PULL-BACK: Check if pulling target creates advantage
  const pullBackScore = evaluatePullBack(
    context,
    attacker,
    target,
    attackerPosition,
    targetPosition,
    availableCascades,
    callbacks
  );
  if (pullBackScore.score > bestScore) {
    bestScore = pullBackScore.score;
    bestReason = pullBackScore.reason;
    bestBonusType = 'pull-back';
  }

  // 3. REVERSAL: Check if swapping positions creates advantage
  const reversalScore = evaluateReversal(
    context,
    attacker,
    target,
    attackerPosition,
    targetPosition,
    availableCascades,
    callbacks
  );
  if (reversalScore.score > bestScore) {
    bestScore = reversalScore.score;
    bestReason = reversalScore.reason;
    bestBonusType = 'reversal';
  }

  return {
    score: bestScore,
    reason: bestReason,
    bonusType: bestBonusType || undefined,
  };
}

function evaluatePushBack(
  context: AIContext,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position,
  cascades: number,
  callbacks: MeleeCountCallbacks
): { score: number; reason: string } {
  const battlefield = context.battlefield;
  const pushDistance = Math.floor(cascades / 2); // 1" per 2 cascades
  if (pushDistance < 1) {
    return { score: 0, reason: 'Not enough cascades' };
  }

  // Calculate push direction (away from attacker)
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;
  const dist = Math.hypot(dx, dy) || 1;
  const pushDir = { x: dx / dist, y: dy / dist };

  // Check where target would be pushed
  const newPos = {
    x: targetPos.x + pushDir.x * pushDistance,
    y: targetPos.y + pushDir.y * pushDistance,
  };

  let score = 0;
  const reasons: string[] = [];

  // 1. Check for Delay token (push into wall/impassable/precipice)
  const terrainAtNewPos = battlefield.getTerrainAt(newPos);
  if (terrainAtNewPos?.movement === 'Impassable' || terrainAtNewPos?.movement === 'Blocking') {
    score += 8; // High value for causing Delay
    reasons.push('Delay token (wall)');
  }

  // 2. Check if push reduces outnumbering against attacker
  const friendsBefore = callbacks.countFriendlyInMeleeRange(attackerPos, 1.5);
  const enemiesBefore = callbacks.countEnemyInMeleeRange(attackerPos, 1.5);
  const outnumberedBefore = enemiesBefore > friendsBefore;

  // After push, target is no longer in melee range
  const enemiesAfter = enemiesBefore - 1;
  const outnumberedAfter = enemiesAfter > friendsBefore;

  if (outnumberedBefore && !outnumberedAfter) {
    score += 6; // Good value for escaping outnumber
    reasons.push('Escape outnumber');
  }

  // 3. Check if push creates outnumbering against target
  const friendsNearNewPos = callbacks.countFriendlyInMeleeRange(newPos, 1.5);
  const enemiesNearNewPos = callbacks.countEnemyInMeleeRange(newPos, 1.5);
  const createsOutnumber = friendsNearNewPos > enemiesNearNewPos && enemiesNearNewPos > 0;

  if (createsOutnumber) {
    score += 5; // Good value for creating local advantage
    reasons.push('Create outnumber');
  }

  // 4. Check if push breaks engagement with other enemies
  const engagedBefore = battlefield.isEngaged?.(attacker) ?? false;
  // After push, target is no longer engaged with attacker
  if (engagedBefore && enemiesBefore === 1) {
    score += 3; // Moderate value for breaking engagement
    reasons.push('Break engagement');
  }

  return {
    score,
    reason: reasons.join(', ') || 'Push-back',
  };
}

function evaluatePullBack(
  context: AIContext,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position,
  cascades: number,
  callbacks: MeleeCountCallbacks
): { score: number; reason: string } {
  const pullDistance = Math.floor(cascades / 2);
  if (pullDistance < 1) {
    return { score: 0, reason: 'Not enough cascades' };
  }

  // Pull toward attacker
  const dx = attackerPos.x - targetPos.x;
  const dy = attackerPos.y - targetPos.y;
  const dist = Math.hypot(dx, dy) || 1;
  const pullDir = { x: dx / dist, y: dy / dist };

  const newPos = {
    x: targetPos.x + pullDir.x * pullDistance,
    y: targetPos.y + pullDir.y * pullDistance,
  };

  let score = 0;
  const reasons: string[] = [];

  // Pull-back is valuable when it:
  // 1. Pulls enemy into our outnumbering zone
  const friendsNearNewPos = callbacks.countFriendlyInMeleeRange(newPos, 1.5);
  const enemiesNearNewPos = callbacks.countEnemyInMeleeRange(newPos, 1.5);
  const createsOutnumber = friendsNearNewPos > enemiesNearNewPos && enemiesNearNewPos > 0;

  if (createsOutnumber) {
    score += 6;
    reasons.push('Pull into outnumber');
  }

  // 2. Pulls enemy away from their support
  const friendsNearOldPos = callbacks.countFriendlyInMeleeRange(targetPos, 1.5);
  if (friendsNearOldPos > friendsNearNewPos) {
    score += 3;
    reasons.push('Isolate from support');
  }

  return {
    score,
    reason: reasons.join(', ') || 'Pull-back',
  };
}

function evaluateReversal(
  context: AIContext,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position,
  cascades: number,
  callbacks: MeleeCountCallbacks
): { score: number; reason: string } {
  // Reversal costs 2 cascades
  if (cascades < 2) {
    return { score: 0, reason: 'Need 2+ cascades' };
  }

  let score = 0;
  const reasons: string[] = [];

  // Reversal is valuable when it:
  // 1. Moves attacker out of enemy outnumbering
  const friendsAtOld = callbacks.countFriendlyInMeleeRange(attackerPos, 1.5);
  const enemiesAtOld = callbacks.countEnemyInMeleeRange(attackerPos, 1.5);
  const outnumberedAtOld = enemiesAtOld > friendsAtOld;

  const friendsAtNew = callbacks.countFriendlyInMeleeRange(targetPos, 1.5);
  const enemiesAtNew = callbacks.countEnemyInMeleeRange(targetPos, 1.5);
  const outnumberedAtNew = enemiesAtNew > friendsAtNew;

  if (outnumberedAtOld && !outnumberedAtNew) {
    score += 7;
    reasons.push('Escape outnumber');
  }

  // 2. Moves attacker into better position (cover, objective, etc.)
  const coverAtOld = callbacks.evaluateCover(attackerPos);
  const coverAtNew = callbacks.evaluateCover(targetPos);
  if (coverAtNew > coverAtOld) {
    score += 3;
    reasons.push('Better cover');
  }

  return {
    score,
    reason: reasons.join(', ') || 'Reversal',
  };
}

/**
 * Evaluate jump down attack opportunity
 * QSR: Jump down onto enemy to cause Falling Collision
 * - Falling character ignores one miss
 * - Target must make Falling Test (potential Stun damage)
 */
export function evaluateJumpDownAttack(
  context: AIContext,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position
): { score: number; reason: string; canJump: boolean } {
  const battlefield = context.battlefield;

  // Get terrain heights
  const attackerTerrain = battlefield.getTerrainAt(attackerPos);
  const targetTerrain = battlefield.getTerrainAt(targetPos);

  const attackerHeight = getTerrainHeight(attackerTerrain);
  const targetHeight = getTerrainHeight(targetTerrain);

  // Calculate fall distance
  const fallDistance = attackerHeight - targetHeight;

  // Can only jump down if attacker is higher
  if (fallDistance <= 0) {
    return { score: 0, reason: 'Not elevated', canJump: false };
  }

  // Calculate max jump range
  const maxJumpRange = calculateMaxJumpRange(attacker, false);

  // Check horizontal distance
  const horizontalDistance = Math.hypot(
    attackerPos.x - targetPos.x,
    attackerPos.y - targetPos.y
  );

  // For every 1 MU down, allow +0.5 MU across
  const maxAcrossFromFall = fallDistance * 0.5;
  const effectiveMaxJump = maxJumpRange + maxAcrossFromFall;

  // Check if jump is possible
  if (horizontalDistance > effectiveMaxJump) {
    return { score: 0, reason: 'Too far', canJump: false };
  }

  // Calculate expected damage to target
  const targetAgi = calculateAgility(target);
  const fallingResult = resolveFallingTest(target, fallDistance, targetAgi);
  const expectedStun = fallingResult.delayTokens;
  const expectedWound = fallingResult.woundAdded;

  // Calculate risk to self (also takes Falling Test, but ignores one miss)
  const attackerAgi = calculateAgility(attacker);
  const attackerFallingResult = resolveFallingTest(attacker, fallDistance, attackerAgi);
  const attackerRisk = Math.max(0, attackerFallingResult.delayTokens - 1); // Ignores one miss

  // Score calculation
  let score = 0;
  const reasons: string[] = [];

  // High value for eliminating weakened enemy
  const targetSiz = target.finalAttributes?.siz ?? target.attributes?.siz ?? 3;
  const targetWounds = target.state.wounds;
  if (expectedWound && targetWounds >= targetSiz - 1) {
    score += 15; // Very high value for potential elimination
    reasons.push('Eliminate weakened');
  } else if (expectedStun >= 2) {
    score += 8; // High value for significant Stun
    reasons.push(`${expectedStun} Stun`);
  } else if (expectedStun >= 1) {
    score += 4; // Moderate value for Stun
    reasons.push(`${expectedStun} Stun`);
  }

  // Subtract risk to self
  if (attackerRisk >= 2) {
    score -= 6; // High risk
    reasons.push(`High risk (${attackerRisk} Stun)`);
  } else if (attackerRisk >= 1) {
    score -= 3; // Moderate risk
    reasons.push(`Risk (${attackerRisk} Stun)`);
  }

  // Bonus for height advantage (tactical positioning)
  if (fallDistance >= 2) {
    score += 2;
    reasons.push('Height advantage');
  }

  return {
    score: Math.max(0, score),
    reason: reasons.join(', ') || 'Jump down',
    canJump: true,
  };
}

/**
 * Evaluate push off ledge opportunity
 * QSR: Push enemy off ledge to cause falling damage
 * - Target receives Delay token if resists falling
 * - Target makes Falling Test (potential Stun/Wounds)
 */
export function evaluatePushOffLedge(
  context: AIContext,
  attacker: Character,
  target: Character,
  attackerPos: Position,
  targetPos: Position,
  pushDirection: { x: number; y: number }
): { score: number; reason: string; canPush: boolean } {
  const battlefield = context.battlefield;

  // Calculate push destination
  const pushDistance = attacker.finalAttributes?.siz ?? 3; // Base push = SIZ
  const destPos = {
    x: targetPos.x + pushDirection.x * pushDistance,
    y: targetPos.y + pushDirection.y * pushDistance,
  };

  // Check if destination is off battlefield (Elimination!)
  if (isOffBattlefield(destPos, battlefield)) {
    return {
      score: 20, // Very high value for elimination
      reason: 'Push off battlefield (Elimination)',
      canPush: true,
    };
  }

  // Get terrain heights
  const targetTerrain = battlefield.getTerrainAt(targetPos);
  const destTerrain = battlefield.getTerrainAt(destPos);

  const targetHeight = getTerrainHeight(targetTerrain);
  const destHeight = getTerrainHeight(destTerrain);

  // Check if there's a height difference (ledge)
  const fallDistance = targetHeight - destHeight;

  if (fallDistance < 1.0) {
    return { score: 0, reason: 'No ledge', canPush: false };
  }

  // Calculate expected falling damage
  const targetAgi = calculateAgility(target);
  const fallingResult = resolveFallingTest(target, fallDistance, targetAgi);
  const expectedStun = fallingResult.delayTokens;
  const expectedWound = fallingResult.woundAdded;

  // Score calculation
  let score = 0;
  const reasons: string[] = [];

  // Delay token for falling (QSR: resists being pushed across ledge)
  score += 5;
  reasons.push('Delay token');

  // High value for eliminating weakened enemy
  const targetSiz = target.finalAttributes?.siz ?? target.attributes?.siz ?? 3;
  const targetWounds = target.state.wounds;
  if (expectedWound && targetWounds >= targetSiz - 1) {
    score += 15; // Very high value for potential elimination
    reasons.push('Eliminate weakened');
  } else if (expectedStun >= 2) {
    score += 8; // High value for significant Stun
    reasons.push(`${expectedStun} Stun`);
  } else if (expectedStun >= 1) {
    score += 4; // Moderate value for Stun
    reasons.push(`${expectedStun} Stun`);
  }

  // Bonus for significant fall
  if (fallDistance >= 3) {
    score += 3;
    reasons.push(`${fallDistance.toFixed(1)} MU fall`);
  }

  return {
    score: Math.max(0, score),
    reason: reasons.join(', ') || 'Push off ledge',
    canPush: true,
  };
}

/**
 * Evaluate gap crossing opportunity
 * QSR: Jump across gaps using Agility + Leap + Running bonus
 * - For every 1 MU down, +0.5 MU across
 * - Wall-to-wall jumps provide tactical advantage
 */
export function evaluateGapCrossing(
  context: AIContext,
  fromPos: Position,
  toPos: Position
): { score: number; reason: string; canCross: boolean } {
  const battlefield = context.battlefield;
  const character = context.character;

  // Detect gap between positions
  const gap = detectGapAlongLine(battlefield, fromPos, toPos);

  if (!gap || gap.width < 0.5) {
    return { score: 0, reason: 'No gap', canCross: false };
  }

  // Calculate jump capability
  const agility = calculateAgility(character);
  const leapBonus = getLeapAgilityBonus(character);

  // Downward jump bonus
  const fallDistance = gap.startHeight - gap.endHeight;
  const downwardBonus = fallDistance > 0 ? fallDistance * 0.5 : 0;

  const maxJumpRange = agility + leapBonus + downwardBonus;

  // Check if gap is crossable
  const canCross = gap.width <= maxJumpRange;

  if (!canCross) {
    return { score: 0, reason: `Gap too wide (${gap.width.toFixed(1)} MU)`, canCross: false };
  }

  // Score calculation
  let score = 0;
  const reasons: string[] = [];

  // Base value for crossing gap (tactical mobility)
  score += 3;
  reasons.push('Cross gap');

  // Wall-to-wall jump is tactically valuable (chokepoint control)
  if (gap.isWallToWall) {
    score += 4;
    reasons.push('Wall-to-wall');
  }

  // Height advantage bonus
  if (fallDistance >= 1) {
    score += 2;
    reasons.push(`${fallDistance.toFixed(1)} MU height`);
  }

  // Gap tactical value
  const tacticalValue = getGapTacticalValue(gap);
  score += tacticalValue;

  // Risk assessment (falling if failed)
  if (fallDistance >= 2) {
    score -= 2; // Risk penalty
    reasons.push('Risk');
  }

  return {
    score: Math.max(0, score),
    reason: reasons.join(', ') || 'Gap crossing',
    canCross: true,
  };
}

/**
 * Calculate maximum jump range for a character
 * QSR: Jump range = Agility + Leap X bonus + Running bonus (if applicable)
 */
function calculateMaxJumpRange(character: Character, hasRunningStart: boolean = false): number {
  const agility = calculateAgility(character);
  const leapBonus = getLeapAgilityBonus(character);

  // Running start bonus: +1 MU per 4 MU run (simplified: +2 MU if has running start)
  const runningBonus = hasRunningStart ? 2 : 0;

  return agility + leapBonus + runningBonus;
}

/**
 * Get terrain height from TerrainElement per OVR-003
 */
function getTerrainHeight(terrain: any): number {
  if (!terrain || !terrain.name) return 0;
  const heightData = TERRAIN_HEIGHTS[terrain.name.toLowerCase()];
  return heightData?.height ?? 0;
}

/**
 * Check if position is off the battlefield
 */
function isOffBattlefield(position: Position, battlefield: Battlefield): boolean {
  return position.x < 0 || position.x > battlefield.width ||
         position.y < 0 || position.y > battlefield.height;
}

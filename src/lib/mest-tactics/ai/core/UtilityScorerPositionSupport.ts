import type { Character } from '../../core/Character';
import type { Position } from '../../battlefield/Position';
import type { AIContext } from './AIController';
import { isAttackableEnemy } from './ai-utils';
import type { EvaluationSession } from './UtilityScorerSessionSupport';
import {
  scorePositionSafety,
  scoreSuppressionZone,
  type ROFMarker,
  type SuppressionMarker,
} from './ROFScoring';

interface ThreatLoadoutProfile {
  hasMeleeWeapons: boolean;
  hasRangedWeapons: boolean;
}

interface PositionSupportCommonDeps {
  context: AIContext;
  position: Position;
  session: EvaluationSession;
  positionKey: (position: Position) => string;
  hasLineOfSightBetweenPositions: (from: Position, to: Position) => boolean;
}

interface PositionSupportLoadoutDeps extends PositionSupportCommonDeps {
  getLoadoutProfile: (character: Character) => ThreatLoadoutProfile;
}

interface PositionROFSafetyDeps {
  character: Character;
  position: Position;
  context: AIContext;
}

export function evaluateCoverAtPosition({
  context,
  position,
  session,
  positionKey,
  hasLineOfSightBetweenPositions,
  getLoadoutProfile,
}: PositionSupportLoadoutDeps): number {
  const cacheKey = positionKey(position);
  const cached = session.coverCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const loadout = getLoadoutProfile(context.character);
  const coverPriority = loadout.hasRangedWeapons && !loadout.hasMeleeWeapons
    ? 1.2
    : loadout.hasMeleeWeapons && !loadout.hasRangedWeapons
      ? 0.9
      : 1.0;

  let bestCover = 0;
  for (const enemy of context.enemies) {
    if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;

    const hasLOS = hasLineOfSightBetweenPositions(enemyPos, position);
    if (!hasLOS) {
      bestCover = Math.max(bestCover, 1.0);
    }
  }

  const result = Math.min(1.5, bestCover * coverPriority);
  session.coverCache.set(cacheKey, result);
  return result;
}

export function isNearCoverEdge(
  position: Position,
  context: AIContext,
  hasLineOfSightBetweenPositions: (from: Position, to: Position) => boolean
): boolean {
  const sampleRadius = 1.0;
  const sampleCount = 8;
  let hasCoverNearby = false;
  let hasExposedNearby = false;

  for (let i = 0; i < sampleCount; i++) {
    const angle = (i / sampleCount) * Math.PI * 2;
    const samplePos = {
      x: position.x + Math.cos(angle) * sampleRadius,
      y: position.y + Math.sin(angle) * sampleRadius,
    };

    let isInCover = true;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      if (!hasLineOfSightBetweenPositions(enemyPos, samplePos)) {
        isInCover = false;
        break;
      }
    }

    if (isInCover) {
      hasCoverNearby = true;
    } else {
      hasExposedNearby = true;
    }

    if (hasCoverNearby && hasExposedNearby) {
      return true;
    }
  }

  return false;
}

interface PositionSupportLeanDeps extends PositionSupportLoadoutDeps {
  isNearCoverEdge: (position: Position, context: AIContext) => boolean;
}

export function evaluateLeanOpportunityAtPosition({
  context,
  position,
  session,
  positionKey,
  hasLineOfSightBetweenPositions,
  getLoadoutProfile,
  isNearCoverEdge: isNearCoverEdgeFn,
}: PositionSupportLeanDeps): number {
  const cacheKey = `lean:${positionKey(position)}`;
  const cached = session.coverCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const loadout = getLoadoutProfile(context.character);
  if (!loadout.hasRangedWeapons) {
    session.coverCache.set(cacheKey, 0);
    return 0;
  }

  const characterPos = context.battlefield.getCharacterPosition(context.character);
  if (!characterPos) {
    session.coverCache.set(cacheKey, 0);
    return 0;
  }

  let visibleEnemies = 0;
  for (const enemy of context.enemies) {
    if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    if (hasLineOfSightBetweenPositions(position, enemyPos)) {
      visibleEnemies++;
    }
  }

  const nearCover = isNearCoverEdgeFn(position, context);
  let leanScore = 0;
  if (visibleEnemies > 0 && nearCover) {
    leanScore = 0.5 + (visibleEnemies * 0.15);
  }

  const result = Math.min(1.0, leanScore);
  session.coverCache.set(cacheKey, result);
  return result;
}

export function evaluateExposureRiskAtPosition({
  context,
  position,
  session,
  positionKey,
  hasLineOfSightBetweenPositions,
}: PositionSupportCommonDeps): number {
  const cacheKey = `exposure:${positionKey(position)}`;
  const cached = session.coverCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const enemyCount = context.enemies.filter(enemy =>
    isAttackableEnemy(context.character, enemy, context.config)
  ).length;
  if (enemyCount === 0) {
    session.coverCache.set(cacheKey, 0);
    return 0;
  }

  let sightLines = 0;
  for (const enemy of context.enemies) {
    if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    if (hasLineOfSightBetweenPositions(enemyPos, position)) {
      sightLines++;
    }
  }

  const result = sightLines / enemyCount;
  session.coverCache.set(cacheKey, result);
  return result;
}

export function countEnemySightLinesToPosition({
  context,
  position,
  session,
  positionKey,
  hasLineOfSightBetweenPositions,
}: PositionSupportCommonDeps): number {
  const cacheKey = positionKey(position);
  const cached = session.positionExposureCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let count = 0;
  for (const enemy of context.enemies) {
    if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    if (hasLineOfSightBetweenPositions(enemyPos, position)) {
      count += 1;
    }
  }

  session.positionExposureCache.set(cacheKey, count);
  return count;
}

export function evaluateThreatReliefAtPosition(
  position: Position,
  currentPosition: Position,
  countEnemySightLines: (position: Position) => number
): number {
  const currentExposure = countEnemySightLines(currentPosition);
  const nextExposure = countEnemySightLines(position);
  if (currentExposure <= 0) return 0;

  const delta = (currentExposure - nextExposure) / currentExposure;
  return Math.max(-1, Math.min(1, delta));
}

export function evaluatePositionSafetyFromROF({
  character,
  position,
  context,
}: PositionROFSafetyDeps): number {
  // TODO: Integrate with battlefield suppression marker tracking.
  const suppressionMarkers: SuppressionMarker[] = [];
  const rofMarkers: ROFMarker[] = [];
  const safety = scorePositionSafety(
    character,
    context.battlefield,
    position,
    suppressionMarkers,
    rofMarkers
  );
  return safety.score / 10;
}

export function evaluateSuppressionZoneControlAtPosition(
  position: Position,
  context: AIContext
): number {
  // TODO: Integrate with battlefield suppression marker tracking.
  const suppressionMarkers: SuppressionMarker[] = [];
  const allCharacters = [context.character, ...context.allies, ...context.enemies];
  const zoneScore = scoreSuppressionZone(
    context.battlefield,
    suppressionMarkers,
    position,
    allCharacters
  );
  return zoneScore.enemiesInZone * 2 - zoneScore.friendliesInZone * 3;
}

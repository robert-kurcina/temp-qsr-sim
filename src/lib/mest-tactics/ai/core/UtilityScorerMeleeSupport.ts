import type { Character } from '../../core/Character';
import type { Item } from '../../core/Item';
import type { Position } from '../../battlefield/Position';
import type { AIContext } from './AIController';
import { getMeleeThreatWeapons } from '../shared/ThreatProfileSupport';

function normalizeTraitName(trait: string): string {
  return String(trait).toLowerCase().replace(/\[|\]/g, '').trim();
}

function itemHasTrait(item: Item | undefined, traitName: string): boolean {
  if (!item || !Array.isArray(item.traits)) {
    return false;
  }
  const normalizedNeedle = normalizeTraitName(traitName);
  return item.traits.some(trait => normalizeTraitName(trait).includes(normalizedNeedle));
}

export function getMeleeWeapons(character: Character): Item[] {
  return getMeleeThreatWeapons(character);
}

export function hasChargeTraitMeleeWeapon(character: Character): boolean {
  return getMeleeWeapons(character).some(weapon => itemHasTrait(weapon, 'charge'));
}

export function estimateMeleeAttackApCost(character: Character, engaged: boolean): number {
  const weapon = getMeleeWeapons(character)[0];
  if (!weapon) {
    return 1;
  }
  if (engaged && itemHasTrait(weapon, 'awkward')) {
    return 2;
  }
  return 1;
}

export function countFriendlyInMeleeRange(context: AIContext, position: Position, range: number): number {
  const battlefield = context.battlefield;
  let count = 0;

  for (const ally of context.allies) {
    if (ally.state.isEliminated || ally.state.isKOd) continue;
    const allyPos = battlefield.getCharacterPosition(ally);
    if (!allyPos) continue;
    const dist = Math.hypot(position.x - allyPos.x, position.y - allyPos.y);
    if (dist <= range) {
      count++;
    }
  }

  return count;
}

export function countEnemyInMeleeRange(context: AIContext, position: Position, range: number): number {
  const battlefield = context.battlefield;
  let count = 0;

  for (const enemy of context.enemies) {
    if (enemy.state.isEliminated || enemy.state.isKOd) continue;
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const dist = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
    if (dist <= range) {
      count++;
    }
  }

  return count;
}

export function evaluateOutnumberAdvantage(position: Position, context: AIContext): number {
  const friends = countFriendlyInMeleeRange(context, position, 1.5);
  const enemies = countEnemyInMeleeRange(context, position, 1.5);

  if (enemies === 0) {
    return 0;
  }

  const ratio = friends / Math.max(1, enemies);

  if (ratio >= 2) {
    return 3;
  }
  if (ratio >= 1.5) {
    return 2;
  }
  if (ratio >= 1) {
    return 1;
  }
  if (ratio >= 0.5) {
    return -1;
  }
  return -3;
}

function normalizeAngle(angle: number): number {
  return angle < 0 ? angle + 2 * Math.PI : angle;
}

export function evaluateFlankingPosition(position: Position, context: AIContext): number {
  let flankingScore = 0;

  const enemiesInRange: Character[] = [];
  for (const enemy of context.enemies) {
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const dist = Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y);
    if (dist <= 6) {
      enemiesInRange.push(enemy);
    }
  }

  if (enemiesInRange.length === 0) {
    return 0;
  }

  for (const enemy of enemiesInRange) {
    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;

    const alliesEngaging: Position[] = [];
    for (const ally of context.allies) {
      if (ally.id === context.character.id) continue;
      if (ally.state.isKOd || ally.state.isEliminated) continue;

      const allyPos = context.battlefield.getCharacterPosition(ally);
      if (!allyPos) continue;

      const allyDist = Math.hypot(allyPos.x - enemyPos.x, allyPos.y - enemyPos.y);
      if (allyDist <= 1.5) {
        alliesEngaging.push(allyPos);
      }
    }

    if (alliesEngaging.length === 0) {
      continue;
    }

    for (const allyPos of alliesEngaging) {
      const allyAngle = Math.atan2(allyPos.y - enemyPos.y, allyPos.x - enemyPos.x);
      const thisAngle = Math.atan2(position.y - enemyPos.y, position.x - enemyPos.x);
      const normalizedAllyAngle = normalizeAngle(allyAngle);
      const normalizedThisAngle = normalizeAngle(thisAngle);

      let angleDiff = Math.abs(normalizedThisAngle - normalizedAllyAngle);
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }

      if (angleDiff > Math.PI / 2) {
        flankingScore += 2;
      }
    }
  }

  return Math.min(flankingScore, 6);
}

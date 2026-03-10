import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { PathfindingEngine } from '../../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import { assessBestMeleeLegality, getMeleeWeaponsForLegality } from '../../../src/lib/mest-tactics/ai/shared/MeleeLegality';

interface FallbackMoveParams {
  actor: Character;
  enemies: Character[];
  battlefield: Battlefield;
  perCharacterFovLos: boolean;
  hasLos: (observer: Character, target: Character, battlefield: Battlefield) => boolean;
}

interface MaximizeMoveParams {
  actor: Character;
  intendedDestination: Position;
  enemies: Character[];
  battlefield: Battlefield;
  perCharacterFovLos: boolean;
  hasLos: (observer: Character, target: Character, battlefield: Battlefield) => boolean;
}

export function areCharactersEngagedForRunner(
  attacker: Character,
  defender: Character,
  battlefield: Battlefield
): boolean {
  const attackerPos = battlefield.getCharacterPosition(attacker);
  const defenderPos = battlefield.getCharacterPosition(defender);
  if (!attackerPos || !defenderPos) return false;

  const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
  const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
  return SpatialRules.isEngaged(
    {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attackerSiz),
      siz: attackerSiz,
    },
    {
      id: defender.id,
      position: defenderPos,
      baseDiameter: getBaseDiameterFromSiz(defenderSiz),
      siz: defenderSiz,
    }
  );
}

export function assessCloseCombatLegalityForRunner(
  attacker: Character,
  defender: Character,
  battlefield: Battlefield,
  options: { isFirstAction?: boolean; actionsTakenThisInitiative?: number } = {}
) {
  const actionsTakenThisInitiative = Math.max(0, options.actionsTakenThisInitiative ?? 0);
  const isFirstAction = options.isFirstAction ?? actionsTakenThisInitiative === 0;
  return assessBestMeleeLegality(attacker, defender, battlefield, {
    weapons: getMeleeWeaponsForLegality(attacker),
    isFirstAction,
    isFreeAtStart: !(battlefield.isEngaged?.(attacker) ?? false),
  });
}

export function isFreeFromEngagementForRunner(
  character: Character,
  enemies: Character[],
  battlefield: Battlefield
): boolean {
  return !enemies.some(enemy => areCharactersEngagedForRunner(character, enemy, battlefield));
}

export function computeEngageMovePositionForRunner(
  attacker: Character,
  defender: Character,
  battlefield: Battlefield,
  options?: { requireEngagement?: boolean }
): Position | null {
  const attackerPos = battlefield.getCharacterPosition(attacker);
  const defenderPos = battlefield.getCharacterPosition(defender);
  if (!attackerPos || !defenderPos) return null;

  const attackerSiz = attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3;
  const defenderSiz = defender.finalAttributes.siz ?? defender.attributes.siz ?? 3;
  const requiredDistance = (getBaseDiameterFromSiz(attackerSiz) + getBaseDiameterFromSiz(defenderSiz)) / 2;
  const dx = defenderPos.x - attackerPos.x;
  const dy = defenderPos.y - attackerPos.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= requiredDistance || distance === 0) return null;

  const mov = (attacker.finalAttributes.mov ?? attacker.attributes.mov ?? 2) + 2;
  const distanceToEngage = distance - requiredDistance;
  const requireEngagement = options?.requireEngagement ?? false;
  if (requireEngagement && distanceToEngage > mov + 0.05) {
    return null;
  }
  const step = requireEngagement ? distanceToEngage : Math.min(mov, distanceToEngage);
  if (step <= 0) return null;

  const ratio = step / distance;
  return {
    x: Math.max(0, Math.min(battlefield.width - 1, attackerPos.x + dx * ratio)),
    y: Math.max(0, Math.min(battlefield.height - 1, attackerPos.y + dy * ratio)),
  };
}

export function computeFallbackMovePositionForRunner(params: FallbackMoveParams): Position | null {
  const { actor, enemies, battlefield, perCharacterFovLos, hasLos } = params;
  const actorPos = battlefield.getCharacterPosition(actor);
  if (!actorPos || enemies.length === 0) {
    return null;
  }

  const candidateEnemies = perCharacterFovLos
    ? enemies.filter(enemy => hasLos(actor, enemy, battlefield))
    : enemies;

  if (candidateEnemies.length === 0) {
    return null;
  }

  let nearestEnemy: Character | null = null;
  let nearestDistance = Infinity;
  for (const enemy of candidateEnemies) {
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const distance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = enemy;
    }
  }

  if (!nearestEnemy || nearestDistance <= 1) {
    return null;
  }

  const enemyPos = battlefield.getCharacterPosition(nearestEnemy);
  if (!enemyPos) {
    return null;
  }

  const mov = actor.finalAttributes.mov ?? actor.attributes.mov ?? 2;
  const moveAllowance = Math.max(1, mov + 2);
  const engine = new PathfindingEngine(battlefield);
  const path = engine.findPathWithMaxMu(
    actorPos,
    enemyPos,
    {
      movementMetric: 'length',
      useNavMesh: true,
      useHierarchical: true,
      optimizeWithLOS: true,
      footprintDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? actor.attributes.siz ?? 3),
    },
    moveAllowance
  );

  const desired = path.points[path.points.length - 1] ?? computeDirectAdvanceStepForRunner(actorPos, enemyPos, moveAllowance);
  if (!desired) {
    return null;
  }

  return snapToOpenCellForRunner(desired, actor, battlefield) ??
    snapToOpenCellForRunner(actorPos, actor, battlefield);
}

export function maximizeClosingMoveDestinationForRunner(params: MaximizeMoveParams): Position {
  const {
    actor,
    intendedDestination,
    enemies,
    battlefield,
    perCharacterFovLos,
    hasLos,
  } = params;
  const actorPos = battlefield.getCharacterPosition(actor);
  if (!actorPos || enemies.length === 0) {
    return intendedDestination;
  }

  const visibleEnemies = perCharacterFovLos
    ? enemies.filter(enemy => hasLos(actor, enemy, battlefield))
    : enemies;
  const candidateEnemies = visibleEnemies.length > 0 ? visibleEnemies : enemies;
  if (candidateEnemies.length === 0) {
    return intendedDestination;
  }

  let targetEnemy: Character | null = null;
  let bestIntendedDistance = Number.POSITIVE_INFINITY;
  for (const enemy of candidateEnemies) {
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const distToIntended = Math.hypot(enemyPos.x - intendedDestination.x, enemyPos.y - intendedDestination.y);
    if (distToIntended < bestIntendedDistance) {
      bestIntendedDistance = distToIntended;
      targetEnemy = enemy;
    }
  }
  if (!targetEnemy) {
    return intendedDestination;
  }

  const targetPos = battlefield.getCharacterPosition(targetEnemy);
  if (!targetPos) {
    return intendedDestination;
  }

  const currentDistance = Math.hypot(targetPos.x - actorPos.x, targetPos.y - actorPos.y);
  const intendedDistance = Math.hypot(targetPos.x - intendedDestination.x, targetPos.y - intendedDestination.y);
  const intendedTravel = Math.hypot(intendedDestination.x - actorPos.x, intendedDestination.y - actorPos.y);

  const mov = actor.finalAttributes.mov ?? actor.attributes.mov ?? 2;
  const moveAllowance = Math.max(1, mov + 2);
  if (intendedDistance >= currentDistance - 1e-6 || intendedTravel >= moveAllowance - 0.15) {
    return intendedDestination;
  }

  const engine = new PathfindingEngine(battlefield);
  const path = engine.findPathWithMaxMu(
    actorPos,
    targetPos,
    {
      movementMetric: 'length',
      useNavMesh: true,
      useHierarchical: true,
      optimizeWithLOS: true,
      footprintDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? actor.attributes.siz ?? 3),
    },
    moveAllowance
  );
  const desired = path.points[path.points.length - 1] ?? computeDirectAdvanceStepForRunner(actorPos, targetPos, moveAllowance);
  if (!desired) {
    return intendedDestination;
  }

  const snapped = snapToOpenCellForRunner(desired, actor, battlefield);
  if (!snapped) {
    return intendedDestination;
  }

  const snappedDistance = Math.hypot(targetPos.x - snapped.x, targetPos.y - snapped.y);
  if (snappedDistance + 0.05 >= intendedDistance) {
    return intendedDestination;
  }

  return snapped;
}

export function computeDirectAdvanceStepForRunner(
  actorPos: Position,
  enemyPos: Position,
  moveAllowance: number
): Position | null {
  const dx = enemyPos.x - actorPos.x;
  const dy = enemyPos.y - actorPos.y;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 0 || moveAllowance <= 0) {
    return null;
  }

  const step = Math.min(moveAllowance, distance);
  const ratio = step / distance;
  return {
    x: actorPos.x + dx * ratio,
    y: actorPos.y + dy * ratio,
  };
}

export function hasLineOfSightForRunner(
  observer: Character,
  target: Character,
  battlefield: Battlefield,
  captureForAudit: { vectors?: any[] } = {}
): boolean {
  const observerPos = battlefield.getCharacterPosition(observer);
  const targetPos = battlefield.getCharacterPosition(target);
  if (!observerPos || !targetPos) return false;

  const result = SpatialRules.hasLineOfSight(
    battlefield,
    {
      id: observer.id,
      position: observerPos,
      baseDiameter: getBaseDiameterFromSiz(observer.finalAttributes.siz ?? observer.attributes.siz ?? 3),
      siz: observer.finalAttributes.siz ?? observer.attributes.siz ?? 3,
    },
    {
      id: target.id,
      position: targetPos,
      baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
      siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
    }
  );

  if (captureForAudit && captureForAudit.vectors) {
    captureForAudit.vectors.push({
      kind: 'los',
      from: { x: observerPos.x, y: observerPos.y },
      to: { x: targetPos.x, y: targetPos.y },
      distanceMu: Math.hypot(targetPos.x - observerPos.x, targetPos.y - observerPos.y),
      success: result,
    });
  }

  return result;
}

export function snapToOpenCellForRunner(
  position: Position,
  actor: Character,
  battlefield: Battlefield
): Position | null {
  const actorPos = battlefield.getCharacterPosition(actor);
  if (!actorPos) return null;
  const actorBase = getBaseDiameterFromSiz(actor.finalAttributes.siz ?? actor.attributes.siz ?? 3);

  const cx = Math.max(0, Math.min(battlefield.width - 1, Math.round(position.x)));
  const cy = Math.max(0, Math.min(battlefield.height - 1, Math.round(position.y)));

  for (let radius = 0; radius <= 4; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = Math.max(0, Math.min(battlefield.width - 1, cx + dx));
        const y = Math.max(0, Math.min(battlefield.height - 1, cy + dy));
        if (x === actorPos.x && y === actorPos.y) continue;
        if (battlefield.canOccupy({ x, y }, actorBase)) {
          return { x, y };
        }
      }
    }
  }

  return null;
}

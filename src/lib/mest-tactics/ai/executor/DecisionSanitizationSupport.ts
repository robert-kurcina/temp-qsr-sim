import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { Character } from '../../core/Character';
import { ActionDecision } from '../core/AIController';
import { assessBestMeleeLegality, getMeleeWeaponsForLegality } from '../shared/MeleeLegality';

export interface DecisionValidationDeps {
  battlefield: Battlefield;
  allowWaitAction?: boolean;
  allowHideAction?: boolean;
  getEnemyCharacters: (character: Character) => Character[];
  hasRangedWeapon: (character: Character) => boolean;
}

export interface DecisionSanitizationDeps extends DecisionValidationDeps {
  hasMeleeWeapon: (character: Character) => boolean;
  fallbackDecision: (
    character: Character,
    apRemaining: number,
    preferredTarget?: Character
  ) => ActionDecision | null;
}

export function estimateImmediateMoveAllowanceForGameLoop(character: Character): number {
  const mov = character.finalAttributes.mov ?? character.attributes.mov ?? 2;
  return Math.max(0, mov + 2);
}

export function isEngagedWithEnemyTargetForGameLoop(
  character: Character,
  target: Character,
  battlefield: Battlefield,
  options: { actionsTakenThisInitiative?: number } = {}
): boolean {
  const actionsTakenThisInitiative = Math.max(0, options.actionsTakenThisInitiative ?? 0);
  const melee = assessBestMeleeLegality(character, target, battlefield, {
    weapons: getMeleeWeaponsForLegality(character),
    isFirstAction: actionsTakenThisInitiative === 0,
    isFreeAtStart: !(battlefield.isEngaged?.(character) ?? false),
  });
  return melee.canAttack;
}

export function findEngagedEnemyForGameLoop(
  character: Character,
  battlefield: Battlefield,
  enemies: Character[]
): Character | null {
  const actorPos = battlefield.getCharacterPosition(character);
  if (!actorPos) return null;

  const actorModel = {
    id: character.id,
    position: actorPos,
    baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3),
    siz: character.finalAttributes.siz ?? character.attributes.siz ?? 3,
  };

  let best: Character | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const enemyPos = battlefield.getCharacterPosition(enemy);
    if (!enemyPos) continue;
    const enemyModel = {
      id: enemy.id,
      position: enemyPos,
      baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3),
      siz: enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3,
    };
    if (!SpatialRules.isEngaged(actorModel, enemyModel)) continue;
    const distance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
}

export function isEngagedWithAnyEnemyForGameLoop(
  character: Character,
  battlefield: Battlefield,
  enemies: Character[]
): boolean {
  return findEngagedEnemyForGameLoop(character, battlefield, enemies) !== null;
}

export function snapToOpenMoveCellForGameLoop(
  character: Character,
  seed: Position,
  allowance: number,
  origin: Position,
  battlefield: Battlefield
): Position | null {
  const actorBase = getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3);
  const candidates: Position[] = [
    { x: seed.x, y: seed.y },
    { x: Math.round(seed.x * 10) / 10, y: Math.round(seed.y * 10) / 10 },
  ];

  const isValid = (candidate: Position): boolean => {
    if (Math.hypot(candidate.x - origin.x, candidate.y - origin.y) > allowance + 0.05) return false;
    if (!battlefield.isWithinBounds(candidate, actorBase)) return false;
    const occupant = battlefield.getCharacterAt(candidate);
    if (occupant && occupant.id !== character.id) return false;
    return battlefield.canOccupy(candidate, actorBase, character.id);
  };

  for (const candidate of candidates) {
    if (isValid(candidate)) return candidate;
  }

  for (let radius = 0.25; radius <= 1.5; radius += 0.25) {
    const steps = Math.max(12, Math.round((Math.PI * 2 * radius) / 0.3));
    for (let step = 0; step < steps; step++) {
      const theta = (step / steps) * Math.PI * 2;
      const candidate = {
        x: seed.x + Math.cos(theta) * radius,
        y: seed.y + Math.sin(theta) * radius,
      };
      if (isValid(candidate)) return candidate;
    }
  }

  return null;
}

export function resolveReachableMoveDestinationForGameLoop(
  character: Character,
  desired: Position,
  battlefield: Battlefield
): Position | null {
  const start = battlefield.getCharacterPosition(character);
  if (!start) return null;

  const allowance = estimateImmediateMoveAllowanceForGameLoop(character);
  const dx = desired.x - start.x;
  const dy = desired.y - start.y;
  const distance = Math.hypot(dx, dy);
  const clamped = distance > allowance && distance > 0.001
    ? {
      x: start.x + (dx / distance) * allowance,
      y: start.y + (dy / distance) * allowance,
    }
    : desired;

  const snappedPrimary = snapToOpenMoveCellForGameLoop(character, clamped, allowance, start, battlefield);
  if (snappedPrimary) return snappedPrimary;

  if (distance <= 0.001) return null;
  for (let scale = 0.9; scale >= 0.2; scale -= 0.1) {
    const probe = {
      x: start.x + (dx * scale),
      y: start.y + (dy * scale),
    };
    const snapped = snapToOpenMoveCellForGameLoop(character, probe, allowance, start, battlefield);
    if (snapped) return snapped;
  }

  return null;
}

export function isValidDecisionForGameLoop(
  decision: ActionDecision,
  character: Character,
  deps: DecisionValidationDeps,
  options: { actionsTakenThisInitiative?: number } = {}
): boolean {
  const { battlefield } = deps;
  if (decision.type === 'wait' && deps.allowWaitAction === false) {
    return false;
  }
  if (decision.type === 'hide' && deps.allowHideAction === false) {
    return false;
  }

  const characterPos = battlefield.getCharacterPosition(character);
  if (!characterPos) {
    return decision.type === 'hold' || decision.type === 'none';
  }

  if (
    (decision.type === 'close_combat' || decision.type === 'ranged_combat' || decision.type === 'disengage' || decision.type === 'charge') &&
    (!decision.target || decision.target.state.isKOd || decision.target.state.isEliminated)
  ) {
    return false;
  }

  if (decision.type === 'move') {
    if (!decision.position) return false;
    if (isEngagedWithAnyEnemyForGameLoop(character, battlefield, deps.getEnemyCharacters(character))) return false;
    const actorBase = getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3);
    if (!battlefield.isWithinBounds(decision.position, actorBase)) {
      return false;
    }
    if (!battlefield.canOccupy(decision.position, actorBase, character.id)) {
      return false;
    }
    const moveDistance = Math.hypot(decision.position.x - characterPos.x, decision.position.y - characterPos.y);
    if (moveDistance > estimateImmediateMoveAllowanceForGameLoop(character) + 0.25) {
      return false;
    }
  }

  if (decision.type === 'charge') {
    if (!decision.target || !decision.position) return false;
    if (isEngagedWithAnyEnemyForGameLoop(character, battlefield, deps.getEnemyCharacters(character))) return false;
    const actorBase = getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3);
    if (!battlefield.isWithinBounds(decision.position, actorBase)) {
      return false;
    }
    if (!battlefield.canOccupy(decision.position, actorBase, character.id)) {
      return false;
    }
    const moveDistance = Math.hypot(decision.position.x - characterPos.x, decision.position.y - characterPos.y);
    if (moveDistance > estimateImmediateMoveAllowanceForGameLoop(character) + 0.25) {
      return false;
    }
    const targetPos = battlefield.getCharacterPosition(decision.target);
    if (!targetPos) return false;
    const actorModel = {
      id: character.id,
      position: decision.position,
      baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3),
      siz: character.finalAttributes.siz ?? character.attributes.siz ?? 3,
    };
    const targetModel = {
      id: decision.target.id,
      position: targetPos,
      baseDiameter: getBaseDiameterFromSiz(decision.target.finalAttributes.siz ?? decision.target.attributes.siz ?? 3),
      siz: decision.target.finalAttributes.siz ?? decision.target.attributes.siz ?? 3,
    };
    if (!SpatialRules.isEngaged(actorModel, targetModel)) {
      return false;
    }
  }

  if (decision.type === 'close_combat') {
    if (!decision.target) return false;
    if (!isEngagedWithEnemyTargetForGameLoop(character, decision.target, battlefield, options)) {
      return false;
    }
  }

  if (decision.type === 'ranged_combat' && isEngagedWithAnyEnemyForGameLoop(character, battlefield, deps.getEnemyCharacters(character))) {
    return false;
  }

  if (decision.type === 'ranged_combat' && !deps.hasRangedWeapon(character)) {
    return false;
  }

  if (decision.type === 'disengage' && !isEngagedWithAnyEnemyForGameLoop(character, battlefield, deps.getEnemyCharacters(character))) {
    return false;
  }
  return true;
}

export function sanitizeDecisionForExecutionForGameLoop(
  character: Character,
  decision: ActionDecision,
  apRemaining: number,
  deps: DecisionSanitizationDeps,
  options: { actionsTakenThisInitiative?: number } = {}
): ActionDecision | null {
  if (decision.type === 'wait' && deps.allowWaitAction === false) {
    return deps.fallbackDecision(character, apRemaining, decision.target);
  }
  if (decision.type === 'hide' && deps.allowHideAction === false) {
    return deps.fallbackDecision(character, apRemaining, decision.target);
  }

  if (
    (decision.type === 'close_combat' || decision.type === 'ranged_combat' || decision.type === 'disengage' || decision.type === 'charge') &&
    (!decision.target || decision.target.state.isKOd || decision.target.state.isEliminated)
  ) {
    return deps.fallbackDecision(character, apRemaining);
  }

  const engagedEnemy = findEngagedEnemyForGameLoop(
    character,
    deps.battlefield,
    deps.getEnemyCharacters(character)
  );

  switch (decision.type) {
    case 'ranged_combat': {
      if (!deps.hasRangedWeapon(character) || engagedEnemy) {
        return deps.fallbackDecision(character, apRemaining, decision.target);
      }
      break;
    }
    case 'close_combat': {
      if (
        !decision.target ||
        !isEngagedWithEnemyTargetForGameLoop(character, decision.target, deps.battlefield, options)
      ) {
        return deps.fallbackDecision(character, apRemaining, decision.target);
      }
      break;
    }
    case 'charge': {
      if (!deps.hasMeleeWeapon(character) || engagedEnemy || apRemaining < 2 || !decision.position) {
        return deps.fallbackDecision(character, apRemaining, decision.target);
      }
      const destination = resolveReachableMoveDestinationForGameLoop(character, decision.position, deps.battlefield);
      if (!destination) {
        return deps.fallbackDecision(character, apRemaining, decision.target);
      }
      decision = { ...decision, position: destination };
      break;
    }
    case 'move': {
      if (engagedEnemy) {
        return deps.hasMeleeWeapon(character)
          ? {
            type: 'close_combat',
            target: engagedEnemy,
            reason: 'Sanitized: engaged, convert move to close combat',
            priority: 2.6,
            requiresAP: true,
          }
          : {
            type: 'disengage',
            target: engagedEnemy,
            reason: 'Sanitized: engaged, convert move to disengage',
            priority: 2.4,
            requiresAP: true,
          };
      }
      if (!decision.position) {
        return deps.fallbackDecision(character, apRemaining, decision.target);
      }
      const destination = resolveReachableMoveDestinationForGameLoop(character, decision.position, deps.battlefield);
      if (!destination) {
        return deps.fallbackDecision(character, apRemaining, decision.target);
      }
      decision = { ...decision, position: destination };
      break;
    }
    case 'disengage': {
      if (!engagedEnemy) {
        return deps.fallbackDecision(character, apRemaining);
      }
      if (
        !decision.target ||
        !isEngagedWithEnemyTargetForGameLoop(character, decision.target, deps.battlefield, options)
      ) {
        decision = { ...decision, target: engagedEnemy };
      }
      break;
    }
    default:
      break;
  }

  if (!isValidDecisionForGameLoop(decision, character, deps, options)) {
    return deps.fallbackDecision(character, apRemaining, decision.target);
  }
  return decision;
}

import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { Item } from '../core/Item';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { getSprintLevel, getLeapAgilityBonus, checkLeapUsage, getSurefootedTerrainBonus, TerrainType } from '../traits/combat-traits';
import { resolveDeclaredWeapon } from './declared-weapon';

export interface MoveActionDeps {
  getCharacterPosition: (character: Character) => Position | undefined;
  moveCharacter: (character: Character, position: Position) => boolean;
  getTerrainAt: (position: Position) => TerrainType;
  canOccupy: (position: Position, baseDiameter: number) => boolean; // QSR: Footprint validation
  executeCloseCombatAttack: (
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: {
      attacker: { id: string; position: Position; baseDiameter: number; siz: number };
      target: { id: string; position: Position; baseDiameter: number; siz: number };
      allowBonusActions: boolean;
      weaponIndex?: number;
    }
  ) => unknown;
  /** Optional pathfinding engine for calculating actual movement cost */
  findPathCost?: (start: Position, end: Position) => number | null;
}

export function executeMoveAction(
  deps: MoveActionDeps,
  mover: Character,
  destination: Position,
  options: {
    opponents?: Character[];
    allowOpportunityAttack?: boolean;
    opportunityWeapon?: Item;
    isMovingStraight?: boolean;
    isAtStartOrEndOfMovement?: boolean;
  } = {}
) {
  const start = deps.getCharacterPosition(mover);
  if (!start) {
    throw new Error('Missing mover position.');
  }

  // Sprint X: Bonus movement when moving in a straight line
  const sprintBonus = getSprintMovementBonus(mover, options.isMovingStraight ?? false, mover.state.isAttentive, true);

  // Leap X: Agility bonus at start or end of movement
  const leapResult = checkLeapUsage(mover, options.isAtStartOrEndOfMovement ?? false);
  const agilityBonus = leapResult.agilityBonus;

  // Surefooted X: Upgrade terrain effects
  const currentTerrain = deps.getTerrainAt(destination);
  if (currentTerrain === 'Impassable') {
    return { moved: false, reason: 'Destination is impassable terrain' };
  }
  const upgradedTerrain = getSurefootedTerrainBonus(mover, currentTerrain);

  // Calculate effective movement allowance per QSR:
  // normal Move allowance is MOV + 2 MU, then apply trait-based bonuses.
  const baseMov = mover.finalAttributes.mov ?? 2;
  const effectiveMov = baseMov + 2 + sprintBonus + agilityBonus;

  // Check for impassable terrain at destination
  if (currentTerrain === 'Impassable') {
    return { moved: false, reason: 'Destination is impassable terrain' };
  }

  // QSR: Check if model can fit at destination (footprint validation)
  const moverBase = getBaseDiameterFromSiz(mover.finalAttributes.siz ?? mover.attributes.siz ?? 3);
  if (!deps.canOccupy(destination, moverBase)) {
    return { moved: false, reason: `Destination too small for model (requires ${moverBase.toFixed(1)} MU clearance)` };
  }

  // Calculate movement cost using pathfinding if available, otherwise use straight-line distance
  let movementCost: number;
  if (deps.findPathCost) {
    const pathCost = deps.findPathCost(start, destination);
    if (pathCost !== null) {
      movementCost = pathCost;
    } else {
      // Pathfinding failed (blocked), can't move
      return { moved: false, reason: 'Path blocked by terrain or obstacles' };
    }
  } else {
    // Fallback to straight-line distance (for AI moves that were pathfinding-validated)
    const dx = destination.x - start.x;
    const dy = destination.y - start.y;
    movementCost = Math.hypot(dx, dy);
  }

  // Allow move if within effective movement allowance
  // Add small epsilon for floating point comparison
  if (movementCost > effectiveMov + 1e-6) {
    return { moved: false, reason: `Destination out of range: ${movementCost.toFixed(1)} MU exceeds max movement (${effectiveMov} MU)` };
  }

  const moved = deps.moveCharacter(mover, destination);
  if (!moved) {
    return { moved: false };
  }

  let opportunity: { attacker: Character; result: unknown } | null = null;
  if (options.allowOpportunityAttack && options.opponents?.length && options.opportunityWeapon) {
    for (const opponent of options.opponents) {
      if (!opponent.state.isAttentive || !opponent.state.isOrdered) continue;
      const opponentPos = deps.getCharacterPosition(opponent);
      if (!opponentPos) continue;
      const moverBase = getBaseDiameterFromSiz(mover.finalAttributes.siz);
      const opponentBase = getBaseDiameterFromSiz(opponent.finalAttributes.siz);
      const wasEngaged = SpatialRules.isEngaged(
        { id: mover.id, position: start, baseDiameter: moverBase, siz: mover.finalAttributes.siz },
        { id: opponent.id, position: opponentPos, baseDiameter: opponentBase, siz: opponent.finalAttributes.siz }
      );
      const nowEngaged = SpatialRules.isEngaged(
        { id: mover.id, position: destination, baseDiameter: moverBase, siz: mover.finalAttributes.siz },
        { id: opponent.id, position: opponentPos, baseDiameter: opponentBase, siz: opponent.finalAttributes.siz }
      );
      if (wasEngaged && !nowEngaged) {
        const resolved = resolveDeclaredWeapon(opponent, options.opportunityWeapon);
        const result = deps.executeCloseCombatAttack(opponent, mover, resolved.weapon, {
          attacker: { id: opponent.id, position: opponentPos, baseDiameter: opponentBase, siz: opponent.finalAttributes.siz },
          target: { id: mover.id, position: destination, baseDiameter: moverBase, siz: mover.finalAttributes.siz },
          allowBonusActions: true,
          weaponIndex: resolved.weaponIndex,
        });
        opportunity = { attacker: opponent, result };
        break;
      }
    }
  }

  return { 
    moved: true, 
    opportunityAttack: opportunity,
    sprintBonusApplied: sprintBonus > 0,
    leapBonusApplied: agilityBonus > 0,
    terrainUpgraded: currentTerrain !== upgradedTerrain,
  };
}

function getSprintMovementBonus(character: Character, isMovingStraight: boolean, isAttentive: boolean, isFree: boolean): number {
  const sprintLevel = getSprintLevel(character);
  if (sprintLevel <= 0 || !isMovingStraight) {
    return 0;
  }
  // X × 4" if Attentive Free, otherwise X × 2"
  if (isAttentive && isFree) {
    return sprintLevel * 4;
  }
  return sprintLevel * 2;
}

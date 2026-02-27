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
  // Note: AI uses pathfinding which already validated the path distance
  // We only check terrain type here, not distance
  if (currentTerrain === 'Impassable') {
    return { moved: false, reason: 'Destination is impassable terrain' };
  }
  
  // For AI-selected positions, pathfinding has already validated the path
  // We trust the pathfinding and don't do distance validation here
  // The pathfinding engine accounts for obstacles and terrain costs
  
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

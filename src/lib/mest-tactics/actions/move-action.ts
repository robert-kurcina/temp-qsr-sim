import { Character } from '../Character';
import { Position } from '../battlefield/Position';
import { Item } from '../Item';
import { SpatialRules } from '../battlefield/spatial-rules';
import { getBaseDiameterFromSiz } from '../battlefield/size-utils';

export interface MoveActionDeps {
  getCharacterPosition: (character: Character) => Position | undefined;
  moveCharacter: (character: Character, position: Position) => boolean;
  executeCloseCombatAttack: (
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: {
      attacker: { id: string; position: Position; baseDiameter: number; siz: number };
      target: { id: string; position: Position; baseDiameter: number; siz: number };
      allowBonusActions: boolean;
    }
  ) => unknown;
}

export function executeMoveAction(
  deps: MoveActionDeps,
  mover: Character,
  destination: Position,
  options: { opponents?: Character[]; allowOpportunityAttack?: boolean; opportunityWeapon?: Item } = {}
) {
  const start = deps.getCharacterPosition(mover);
  if (!start) {
    throw new Error('Missing mover position.');
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
        const result = deps.executeCloseCombatAttack(opponent, mover, options.opportunityWeapon, {
          attacker: { id: opponent.id, position: opponentPos, baseDiameter: opponentBase, siz: opponent.finalAttributes.siz },
          target: { id: mover.id, position: destination, baseDiameter: moverBase, siz: mover.finalAttributes.siz },
          allowBonusActions: true,
        });
        opportunity = { attacker: opponent, result };
        break;
      }
    }
  }

  return { moved: true, opportunityAttack: opportunity };
}

import { Character } from '../core/Character';
import { Item } from '../core/Item';
import { Position } from '../battlefield/Position';
import { makeDisengageAction } from './disengage';
import { TestContext } from '../utils/TestContext';
import { BonusActionOutcome, BonusActionSelection, applyBonusAction, buildBonusActionOptions } from './bonus-actions';
import { normalizeVector } from '../battlefield/spatial-helpers';

export interface DisengageActionDeps {
  battlefield: import('../battlefield/Battlefield').Battlefield | null;
  getCharacterPosition: (character: Character) => Position | undefined;
  moveCharacter: (character: Character, position: Position) => boolean;
  applyRefresh: (character: Character) => boolean;
}

export function executeDisengageAction(
  deps: DisengageActionDeps,
  disengager: Character,
  defender: Character,
  defenderWeapon: Item,
  options: {
    context?: TestContext;
    moveEnd?: Position;
    allowBonusActions?: boolean;
    bonusAction?: BonusActionSelection;
    bonusActionOpponents?: Character[];
  } = {}
) {
  if (!deps.battlefield) {
    throw new Error('Battlefield not set.');
  }
  if (!defender.state.isOrdered) {
    return { pass: false, reason: 'Defender must be Ordered.' };
  }
  const result = makeDisengageAction(disengager, defender, defenderWeapon, options.context ?? {});
  if (!result.pass) {
    return { pass: false, result };
  }

  const disengagerPos = deps.getCharacterPosition(disengager);
  const defenderPos = deps.getCharacterPosition(defender);
  if (!disengagerPos || !defenderPos) {
    return { pass: true, result, moved: false };
  }
  const mov = disengager.finalAttributes.mov ?? disengager.attributes.mov ?? 0;
  const direction = normalizeVector({
    x: disengagerPos.x - defenderPos.x,
    y: disengagerPos.y - defenderPos.y,
  });
  const destination = options.moveEnd ?? (direction ? {
    x: disengagerPos.x + direction.x * mov,
    y: disengagerPos.y + direction.y * mov,
  } : disengagerPos);
  const moved = deps.moveCharacter(disengager, destination);

  let bonusActionOptions: ReturnType<typeof buildBonusActionOptions> | undefined;
  let bonusActionOutcome: BonusActionOutcome | undefined;
  const allowBonusActions = options.allowBonusActions ?? true;
  if (allowBonusActions) {
    bonusActionOptions = buildBonusActionOptions({
      battlefield: deps.battlefield,
      attacker: disengager,
      target: defender,
      cascades: result.testResult.cascades ?? 0,
      isCloseCombat: true,
      engaged: false,
    });
    if (options.bonusAction) {
      bonusActionOutcome = applyBonusAction(
        {
          battlefield: deps.battlefield,
          attacker: disengager,
          target: defender,
          cascades: result.testResult.cascades ?? 0,
          isCloseCombat: true,
          engaged: false,
        },
        { ...options.bonusAction, opponents: options.bonusActionOpponents }
      );
      if (bonusActionOutcome.refreshApplied) {
        deps.applyRefresh(disengager);
      }
    }
  }

  return { pass: true, result, moved, moveEnd: moved ? destination : undefined, bonusActionOptions, bonusActionOutcome };
}

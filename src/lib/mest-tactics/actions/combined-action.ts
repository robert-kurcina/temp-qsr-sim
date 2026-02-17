import { Character } from '../Character';
import { Position } from '../battlefield/Position';

export interface CombinedActionDeps {
  spendAp: (character: Character, amount: number) => boolean;
  moveCharacter: (character: Character, position: Position) => boolean;
}

export function executeCombinedAction(
  deps: CombinedActionDeps,
  actor: Character,
  moveEnd: Position,
  action: () => unknown,
  options: { spendAp?: boolean } = {}
) {
  if (options.spendAp ?? true) {
    if (!deps.spendAp(actor, 2)) {
      return { success: false, reason: 'Not enough AP.' };
    }
  }
  const moved = deps.moveCharacter(actor, moveEnd);
  if (!moved) {
    return { success: false, reason: 'Move failed.' };
  }
  const actionResult = action();
  return { success: true, moved: true, actionResult };
}

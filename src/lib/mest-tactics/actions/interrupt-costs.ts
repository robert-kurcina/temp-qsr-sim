import { Character } from '../core/Character';
import { CharacterStatus } from '../core/types';

export interface InterruptCostDeps {
  setCharacterStatus: (characterId: string, status: CharacterStatus) => void;
  refreshUsed: Set<string>;
}

export function applyInterruptCost(
  deps: InterruptCostDeps,
  character: Character
): { removedWait: boolean; delayAdded: boolean } {
  if (character.state.isWaiting) {
    character.state.isWaiting = false;
    deps.setCharacterStatus(character.id, CharacterStatus.Done);
    character.refreshStatusFlags();
    return { removedWait: true, delayAdded: false };
  }
  character.state.delayTokens += 1;
  character.refreshStatusFlags();
  return { removedWait: false, delayAdded: true };
}

export function applyPassiveOptionCost(
  deps: InterruptCostDeps,
  character: Character
): { removedWait: boolean; delayAdded: boolean } {
  if (character.state.isWaiting) {
    character.state.isWaiting = false;
    deps.setCharacterStatus(character.id, CharacterStatus.Done);
    character.refreshStatusFlags();
    return { removedWait: true, delayAdded: false };
  }
  character.state.delayTokens += 1;
  character.refreshStatusFlags();
  return { removedWait: false, delayAdded: true };
}

export function applyRefresh(
  deps: InterruptCostDeps,
  character: Character
): boolean {
  if (deps.refreshUsed.has(character.id)) {
    return false;
  }
  if (character.state.delayTokens > 0) {
    character.state.delayTokens = Math.max(0, character.state.delayTokens - 1);
  } else if (character.state.isAttentive && character.state.fearTokens > 0) {
    character.state.fearTokens = Math.max(0, character.state.fearTokens - 1);
  } else {
    return false;
  }
  character.refreshStatusFlags();
  deps.refreshUsed.add(character.id);
  return true;
}

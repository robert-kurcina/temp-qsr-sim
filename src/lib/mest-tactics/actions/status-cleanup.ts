import { Character } from '../Character';
import { CharacterStatus } from '../types';
import { promotePendingStatusTokens } from '../status-system';

export interface StatusCleanupDeps {
  setCharacterStatus: (characterId: string, status: CharacterStatus) => void;
}

export function applyKOCleanup(deps: StatusCleanupDeps, character: Character): void {
  if (!character.state.isKOd && !character.state.isEliminated) {
    character.refreshStatusFlags();
    return;
  }
  if (character.state.isKOd) {
    character.state.delayTokens = 0;
    character.state.fearTokens = 0;
    character.state.isWaiting = false;
    character.state.isHidden = false;
    deps.setCharacterStatus(character.id, CharacterStatus.Done);
  }
  if (character.state.isEliminated) {
    character.state.delayTokens = 0;
    character.state.fearTokens = 0;
    character.state.isWaiting = false;
    character.state.isHidden = false;
    character.state.statusTokens = {};
    character.state.statusEffects = [];
    deps.setCharacterStatus(character.id, CharacterStatus.Done);
  }
  character.refreshStatusFlags();
}

export function applyOngoingStatusEffects(deps: StatusCleanupDeps, character: Character): void {
  if (character.state.isKOd || character.state.isEliminated) {
    character.refreshStatusFlags();
    return;
  }
  promotePendingStatusTokens(character);
  const poison = character.state.statusTokens.Poison ?? 0;
  const burn = character.state.statusTokens.Burn ?? 0;
  const acid = character.state.statusTokens.Acid ?? 0;
  const totalWounds = poison + burn + acid;
  if (totalWounds <= 0) {
    character.refreshStatusFlags();
    return;
  }

  character.state.wounds += totalWounds;
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  if (character.state.wounds >= siz) {
    character.state.isKOd = true;
  }
  if (character.state.wounds >= siz + 3) {
    character.state.isEliminated = true;
  }
  applyKOCleanup(deps, character);
}

import { Character } from '../Character';
import { CharacterStatus } from '../types';

export interface ActivationDeps {
  apPerActivation: number;
  getCharacterStatus: (characterId: string) => CharacterStatus | undefined;
  setCharacterStatus: (characterId: string, status: CharacterStatus) => void;
  setActiveCharacterId: (characterId: string | null) => void;
  applyOngoingStatusEffects: (character: Character) => void;
  clearTransfixUsed: (characterId: string) => void;
  clearFiddleUsed: (characterId: string) => void;
  getApRemaining: (characterId: string) => number;
  setApRemaining: (characterId: string, value: number) => void;
}

export function beginActivation(deps: ActivationDeps, character: Character): number {
  const status = deps.getCharacterStatus(character.id);
  if (status !== CharacterStatus.Ready) {
    return 0;
  }
  deps.setActiveCharacterId(character.id);
  deps.clearTransfixUsed(character.id);
  deps.clearFiddleUsed(character.id);
  deps.applyOngoingStatusEffects(character);
  if (character.state.isWaiting) {
    character.state.isWaiting = false;
  }

  const delayTokens = character.state.delayTokens;
  const apAvailable = Math.max(0, deps.apPerActivation - delayTokens);
  const remainingDelay = Math.max(0, delayTokens - deps.apPerActivation);
  character.state.delayTokens = remainingDelay;
  character.refreshStatusFlags();
  deps.setApRemaining(character.id, apAvailable);
  return apAvailable;
}

export function endActivation(deps: ActivationDeps, character: Character): void {
  deps.setActiveCharacterId(null);
  deps.setCharacterStatus(character.id, CharacterStatus.Done);
}

export function setWaiting(deps: ActivationDeps, character: Character): void {
  character.state.isWaiting = true;
  deps.setCharacterStatus(character.id, CharacterStatus.Waiting);
}

export function getApRemaining(deps: ActivationDeps, character: Character): number {
  return deps.getApRemaining(character.id) ?? 0;
}

export function spendAp(deps: ActivationDeps, character: Character, amount: number): boolean {
  const current = deps.getApRemaining(character.id);
  if (amount <= 0 || current < amount) return false;
  deps.setApRemaining(character.id, current - amount);
  return true;
}

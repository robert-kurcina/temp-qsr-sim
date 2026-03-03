import { Character } from '../core/Character';
import { CharacterStatus } from '../core/types';
import { checkSneakyAutoHide, getSneakyLevel, resetMultipleAttackTracking } from '../traits/combat-traits';

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
  getCharacterPosition: (character: Character) => { x: number; y: number } | undefined;
  isBehindCover: (character: Character) => boolean;
  isInLos: (character: Character, opposingCharacter: Character) => boolean;
  getOpposingCharacters: () => Character[];
  isFreeFromEngagement: (character: Character) => boolean;
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
  const waitingAtStart = character.state.isWaiting;

  const delayTokens = character.state.delayTokens;
  let apAvailable = Math.max(0, deps.apPerActivation - delayTokens);
  const remainingDelay = Math.max(0, delayTokens - deps.apPerActivation);
  character.state.delayTokens = remainingDelay;

  if (waitingAtStart) {
    // OVR-001: Wait maintenance (overrides QSR Line 858)
    // "If character is Free, Wait is maintained at 0 AP.
    //  If character is not Free, may pay 1 AP to maintain."
    const isFree = deps.isFreeFromEngagement(character);
    if (isFree) {
      // Free: Wait maintained at 0 AP (no cost)
      // Wait status maintained automatically
    } else {
      // Not Free: May pay 1 AP to maintain Wait
      if (apAvailable >= 1) {
        apAvailable -= 1;
        // Wait status maintained
      } else {
        // Not enough AP, must remove Wait
        character.state.isWaiting = false;
      }
    }
  }

  character.refreshStatusFlags();
  deps.setApRemaining(character.id, apAvailable);
  return apAvailable;
}

export function endActivation(deps: ActivationDeps, character: Character): void {
  deps.setActiveCharacterId(null);
  deps.setCharacterStatus(character.id, CharacterStatus.Done);
  
  // QSR Line 470: Clear Overreach status at end of Initiative
  // Overreach -1 REF penalty only applies during the Initiative it was declared
  character.state.isOverreach = false;

  // Sneaky X: Auto-Hide at end of initiative if Attentive and behind Cover or not in LOS
  const sneakyLevel = getSneakyLevel(character);
  if (sneakyLevel > 0 && character.state.isAttentive && !character.state.isHidden) {
    const isBehindCover = deps.isBehindCover(character);
    const opposingCharacters = deps.getOpposingCharacters();
    const isInLosToAny = opposingCharacters.some(opp =>
      opp.state.isAttentive && deps.isInLos(character, opp)
    );

    const sneakyResult = checkSneakyAutoHide(character, true, isBehindCover, isInLosToAny);
    if (sneakyResult.canAutoHide) {
      character.state.isHidden = true;
    }
  }
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

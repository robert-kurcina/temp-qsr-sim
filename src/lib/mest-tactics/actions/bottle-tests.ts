import { Character } from '../core/Character';
import { CharacterStatus } from '../core/types';
import { resolveBottleForSide, BottleTestResult } from '../status/bottle-tests';

export interface BottleTestDeps {
  setCharacterStatus: (characterId: string, status: CharacterStatus) => void;
}

export function resolveBottleTests(
  deps: BottleTestDeps,
  sides: Array<{
    id: string;
    characters: Character[];
    orderedCandidate: Character | null;
    opposingCount: number;
    rolls?: number[];
  }>
): Record<string, BottleTestResult> {
  const results: Record<string, BottleTestResult> = {};
  for (const side of sides) {
    const result = resolveBottleForSide(side.characters, side.orderedCandidate, side.opposingCount, side.rolls);
    results[side.id] = result;
    if (result.bottledOut) {
      for (const character of side.characters) {
        character.state.isEliminated = true;
        deps.setCharacterStatus(character.id, CharacterStatus.Done);
      }
    }
  }
  return results;
}

import { Character } from '../Character';
import { CharacterStatus } from '../types';
import { resolveBottleForSide, BottleTestResult } from '../bottle-tests';

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

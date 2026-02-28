import { Character } from '../core/Character';
import { CharacterStatus } from '../core/types';
import { resolveBottleForSide, BottleTestResult } from '../status/bottle-tests';
import { MissionSide } from '../mission/MissionSide';
import { Battlefield } from '../battlefield/Battlefield';

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
    side?: MissionSide;
  }>,
  battlefield: Battlefield | null = null
): Record<string, BottleTestResult> {
  const results: Record<string, BottleTestResult> = {};
  for (const side of sides) {
    const result = resolveBottleForSide(
      side.characters,
      side.orderedCandidate,
      side.opposingCount,
      side.rolls,
      side.side,
      battlefield
    );
    results[side.id] = result;
    if (result.bottledOut) {
      for (const character of side.characters) {
        character.state.isEliminated = true;
        character.state.eliminatedByFear = true; // QSR: Track elimination by Fear (Bottle Test)
        deps.setCharacterStatus(character.id, CharacterStatus.Done);
      }
    }
  }
  return results;
}

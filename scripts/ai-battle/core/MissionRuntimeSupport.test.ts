import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import {
  applyMissionRuntimeUpdateForRunner,
  applyMissionStartOverridesForRunner,
  resolveMissionWinnerNameForRunner,
} from './MissionRuntimeSupport';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {
      isEliminated: false,
      isKOd: false,
    },
  } as unknown as Character;
}

describe('MissionRuntimeSupport', () => {
  it('applies mission runtime update deltas', () => {
    const result = applyMissionRuntimeUpdateForRunner({
      update: {
        delta: {
          vpBySide: { Alpha: 1 },
          rpBySide: { Bravo: 2 },
        },
      } as any,
      missionSideIds: ['Alpha', 'Bravo'],
      missionVpBySide: {},
      missionRpBySide: {},
      missionImmediateWinnerSideId: null,
    });

    expect(result.missionVpBySide.Alpha).toBe(1);
    expect(result.missionVpBySide.Bravo).toBe(0);
    expect(result.missionRpBySide.Bravo).toBe(2);
  });

  it('resolves winner by immediate winner or VP lead', () => {
    expect(
      resolveMissionWinnerNameForRunner({
        missionImmediateWinnerSideId: 'Alpha',
        missionVpBySide: { Alpha: 0, Bravo: 99 },
      })
    ).toBe('Alpha');

    expect(
      resolveMissionWinnerNameForRunner({
        missionImmediateWinnerSideId: null,
        missionVpBySide: { Alpha: 2, Bravo: 1 },
      })
    ).toBe('Alpha');
  });

  it('applies defender wait-start override for configured missions', () => {
    const defender = createCharacter('d1');
    const attacker = createCharacter('a1');
    const waited: string[] = [];

    applyMissionStartOverridesForRunner(
      { missionId: 'QAI_13' } as any,
      [{ characters: [defender] }, { characters: [attacker] }],
      character => waited.push(character.id)
    );

    expect(waited).toEqual(['d1']);
  });
});

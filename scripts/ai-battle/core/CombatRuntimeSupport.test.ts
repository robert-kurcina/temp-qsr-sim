import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import {
  extractDamageResolutionFromStepDetailsForRunner,
  extractDamageResolutionFromUnknownForRunner,
  extractWoundsAddedFromDamageResolutionForRunner,
  normalizeAttackResultForRunner,
  pickMeleeWeaponForRunner,
  pickRangedWeaponForRunner,
} from './CombatRuntimeSupport';

function createCharacter(items: any[], inHandItems?: any[]): Character {
  return {
    id: 'c',
    profile: {
      equipment: items,
      items,
      inHandItems,
    },
  } as unknown as Character;
}

describe('CombatRuntimeSupport', () => {
  it('picks melee and ranged weapons from profile equipment', () => {
    const character = createCharacter([
      { name: 'Sword', classification: 'Melee' },
      { name: 'Bow', classification: 'Bow' },
    ]);
    expect(pickMeleeWeaponForRunner(character)?.name).toBe('Sword');
    expect(pickRangedWeaponForRunner(character)?.name).toBe('Bow');
  });

  it('prefers tracked in-hand melee weapons and falls back to Unarmed', () => {
    const tracked = createCharacter(
      [
        { name: 'Sword', classification: 'Melee' },
        { name: 'Bow', classification: 'Bow' },
      ],
      [{ name: 'Bow', classification: 'Bow' }]
    );
    expect(pickMeleeWeaponForRunner(tracked)?.name).toBe('Bow');
    expect(pickRangedWeaponForRunner(tracked)?.name).toBe('Bow');

    const emptyHands = createCharacter(
      [{ name: 'Sword', classification: 'Melee' }],
      []
    );
    expect(pickMeleeWeaponForRunner(emptyHands)?.name).toBe('Unarmed');
  });

  it('normalizes attack result and extracts damage resolution payloads', () => {
    const result = {
      result: {
        hit: true,
        damageResolution: { defenderKOd: true, defenderEliminated: false },
      },
    };
    expect(normalizeAttackResultForRunner(result)).toEqual({
      hit: true,
      ko: true,
      eliminated: false,
    });

    expect(
      extractDamageResolutionFromUnknownForRunner(result)
    ).toEqual({ defenderKOd: true, defenderEliminated: false });

    expect(
      extractDamageResolutionFromStepDetailsForRunner({ attackResult: result })
    ).toEqual({ defenderKOd: true, defenderEliminated: false });
  });

  it('extracts wounds from payload or falls back to state delta', () => {
    expect(
      extractWoundsAddedFromDamageResolutionForRunner(
        { woundsAdded: 1, stunWoundsAdded: 2 },
        { wounds: 0 } as any,
        { wounds: 0 } as any
      )
    ).toBe(3);

    expect(
      extractWoundsAddedFromDamageResolutionForRunner(
        undefined,
        { wounds: 1 } as any,
        { wounds: 3 } as any
      )
    ).toBe(2);
  });
});

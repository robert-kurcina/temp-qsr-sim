import { describe, expect, it } from 'vitest';
import type { Character } from '../core/Character';
import type { Item } from '../core/Item';
import { isUnarmed } from './combat-traits';

function makeItem(name: string, classification: string): Item {
  return {
    name,
    class: classification,
    classification,
    type: classification,
    bp: 0,
    traits: [],
  } as Item;
}

function makeCharacter(profile: Record<string, unknown>): Character {
  return {
    id: 'c',
    profile: {
      name: 'p',
      archetype: 'Average' as any,
      ...profile,
    },
    allTraits: [],
  } as unknown as Character;
}

describe('isUnarmed', () => {
  it('returns false when any weapon is in hand', () => {
    const character = makeCharacter({
      inHandItems: [makeItem('Bow', 'Bow')],
      items: [makeItem('Bow', 'Bow')],
    });
    expect(isUnarmed(character)).toBe(false);
  });

  it('returns true when no weapons are in hand and no natural weapons are present', () => {
    const character = makeCharacter({
      inHandItems: [],
      stowedItems: [makeItem('Sword', 'Melee')],
      items: [makeItem('Sword', 'Melee')],
    });
    expect(isUnarmed(character)).toBe(true);
  });

  it('returns false when natural weapons exist even with empty hands', () => {
    const character = makeCharacter({
      inHandItems: [],
      items: [makeItem('Claws', 'Natural')],
    });
    expect(isUnarmed(character)).toBe(false);
  });

  it('keeps backward compatibility when in-hand state is unavailable', () => {
    const armed = makeCharacter({ items: [makeItem('Sword', 'Melee')] });
    const unarmed = makeCharacter({ items: [] });

    expect(isUnarmed(armed)).toBe(false);
    expect(isUnarmed(unarmed)).toBe(true);
  });
});


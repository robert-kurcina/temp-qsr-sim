import { describe, expect, it } from 'vitest';
import type { Character } from '../../core/Character';
import type { Item } from '../../core/Item';
import { getLoadoutProfile, hasMeleeWeapon, hasRangedWeapon } from './LoadoutProfile';

function makeCharacter(itemsBySlot: {
  items?: Item[];
  equipment?: Item[];
  inHandItems?: Item[];
  stowedItems?: Item[];
}): Character {
  return {
    profile: {
      ...itemsBySlot,
    },
    items: itemsBySlot.items ?? itemsBySlot.equipment ?? [],
  } as unknown as Character;
}

function makeItem(classification: string, traits?: string[]): Item {
  return {
    name: classification,
    classification,
    traits,
  } as unknown as Item;
}

describe('LoadoutProfile', () => {
  it('detects melee and ranged weapons across profile slots', () => {
    const sword = makeItem('Melee Sword');
    const bow = makeItem('Bow');
    const character = makeCharacter({
      items: [sword],
      stowedItems: [bow],
    });

    expect(hasMeleeWeapon(character)).toBe(true);
    expect(hasRangedWeapon(character)).toBe(true);
    expect(getLoadoutProfile(character).primaryWeaponType).toBe('mixed');
  });

  it('treats throwable melee weapons as both ranged and melee', () => {
    const spear = makeItem('Melee Spear', ['Throwable']);
    const character = makeCharacter({ equipment: [spear] });

    const loadout = getLoadoutProfile(character);
    expect(loadout.hasMeleeWeapons).toBe(true);
    expect(loadout.hasRangedWeapons).toBe(true);
    expect(loadout.primaryWeaponType).toBe('mixed');
  });

  it('returns none when no weapon classifications are present', () => {
    const gear = makeItem('Armor');
    const character = makeCharacter({ items: [gear] });

    const loadout = getLoadoutProfile(character);
    expect(loadout.hasMeleeWeapons).toBe(false);
    expect(loadout.hasRangedWeapons).toBe(false);
    expect(loadout.primaryWeaponType).toBe('none');
  });
});

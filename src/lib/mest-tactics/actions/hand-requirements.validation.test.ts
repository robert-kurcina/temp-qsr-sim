import { describe, expect, it } from 'vitest';
import type { Character } from '../core/Character';
import type { Item } from '../core/Item';
import { validateItemUsage } from './hand-requirements';

function makeItem(name: string, hands: 0 | 1 | 2, classification: string = 'Melee'): Item {
  const traits = hands === 2 ? ['[2H]'] : hands === 1 ? ['[1H]'] : [];
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    class: classification,
    classification,
    type: classification,
    bp: 0,
    traits,
  } as Item;
}

function makeCharacter(inHandItems: Item[], totalHands: number = 2): Character {
  return {
    id: 'test-character',
    profile: {
      name: 'test-profile',
      archetype: 'Average' as any,
      totalHands,
      inHandItems,
      items: inHandItems,
      equipment: inHandItems,
    },
    state: {},
  } as unknown as Character;
}

describe('validateItemUsage hand commitment behavior', () => {
  it('allows using a 1H weapon already in hand when all hands are committed', () => {
    const sword = makeItem('Sword', 1);
    const shield = makeItem('Shield', 1, 'Shield');
    const actor = makeCharacter([sword, shield]);

    const result = validateItemUsage(actor, sword);
    expect(result.valid).toBe(true);
    expect(result.canUse).toBe(true);
    expect(result.handsAvailable).toBe(0);
    expect(result.effectiveHandsAvailable).toBe(1);
    expect(result.usingOneLessHand).toBe(false);
  });

  it('allows attacking with either 1H weapon when dual-wielding', () => {
    const sword = makeItem('Sword', 1);
    const dagger = makeItem('Dagger', 1);
    const actor = makeCharacter([sword, dagger]);

    const swordCheck = validateItemUsage(actor, sword);
    const daggerCheck = validateItemUsage(actor, dagger);

    expect(swordCheck.valid).toBe(true);
    expect(daggerCheck.valid).toBe(true);
    expect(swordCheck.handsAvailable).toBe(0);
    expect(daggerCheck.handsAvailable).toBe(0);
  });

  it('allows 2H weapon use while over-committed and flags interrupt vulnerability', () => {
    const spear = makeItem('Spear', 2);
    const shield = makeItem('Shield', 1, 'Shield');
    const actor = makeCharacter([spear, shield]);

    const result = validateItemUsage(actor, spear);
    expect(result.valid).toBe(true);
    expect(result.canUse).toBe(true);
    expect(result.usingOneLessHand).toBe(true);
    expect(result.overCommittedBy).toBe(1);
    expect(result.reason).toContain('over-committed');
  });

  it('fails when trying to use a weapon that is not already in hand and no hands are free', () => {
    const sword = makeItem('Sword', 1);
    const shield = makeItem('Shield', 1, 'Shield');
    const halberd = makeItem('Halberd', 2);
    const actor = makeCharacter([sword, shield]);

    const result = validateItemUsage(actor, halberd);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Not enough hands');
  });
});


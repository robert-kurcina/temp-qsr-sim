import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import { computeBreakpointState, resolveBottleForSide } from './bottle-tests';
import type { Profile } from '../core/Profile';

function makeCharacter(name: string): Character {
  const profile: Profile = {
    name,
    archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 3, str: 0, for: 0, mov: 0, siz: 3 } },
    items: [],
    totalBp: 0,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 0,
    adjPhysicality: 0,
    durability: 0,
    adjDurability: 0,
    burden: { totalLaden: 0, totalBurden: 0 },
    totalHands: 0,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return character;
}

describe('bottle-tests', () => {
  it('should detect breakpoint and double breakpoint', () => {
    const chars = [makeCharacter('a'), makeCharacter('b'), makeCharacter('c'), makeCharacter('d')];
    chars[0].state.isKOd = true;
    chars[1].state.isEliminated = true;
    const state = computeBreakpointState(chars);
    expect(state.isAtBreakpoint).toBe(true);
    expect(state.isAtDoubleBreakpoint).toBe(false);
  });

  it('should fail bottle test when at breakpoint and roll is low', () => {
    const chars = [makeCharacter('a'), makeCharacter('b')];
    chars[0].state.isKOd = true;
    chars[1].finalAttributes.pow = 1;
    const result = resolveBottleForSide(chars, chars[1], 4, [1, 1]);
    expect(result.bottledOut).toBe(true);
  });
});

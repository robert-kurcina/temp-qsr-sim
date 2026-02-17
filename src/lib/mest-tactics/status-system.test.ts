import { describe, it, expect } from 'vitest';
import { Character } from './Character';
import type { Profile } from './Profile';
import { addStatusToken, applyStatusFromTrait, applyStatusTraitOnHit, getStatusDefinitions, getStatusTokenCount, removeStatusToken } from './status-system';

describe('status-system', () => {
  it('should track status tokens on a character', () => {
    const profile: Profile = {
      name: 'Status Tester',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
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
    addStatusToken(character, 'Confused', 2);
    expect(getStatusTokenCount(character, 'Confused')).toBe(2);
    removeStatusToken(character, 'Confused', 1);
    expect(getStatusTokenCount(character, 'Confused')).toBe(1);
  });

  it('should infer status types from trait descriptions', () => {
    const definitions = getStatusDefinitions();
    const names = definitions.map(def => def.name);
    expect(names).toContain('Confused');
  });

  it('should apply status tokens based on trait name', () => {
    const profile: Profile = {
      name: 'Trait Status',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
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
    const status = applyStatusFromTrait(character, 'Confuse X', 3);
    expect(status).toBe('Confused');
    expect(getStatusTokenCount(character, 'Confused')).toBe(2);
  });

  it('should apply Confused tokens when the unopposed test passes', () => {
    const profile: Profile = {
      name: 'Confuse Pass',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 4, pow: 1, str: 0, for: 0, mov: 0, siz: 3 } },
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
    applyStatusTraitOnHit(character, 'Confuse X', { rating: 3, testRolls: [1, 1] });
    expect(getStatusTokenCount(character, 'Confused')).toBe(2);
  });

  it('should not apply Confused tokens when the unopposed test fails', () => {
    const profile: Profile = {
      name: 'Confuse Fail',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
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
    applyStatusTraitOnHit(character, 'Confuse X', { rating: 2, testRolls: [1, 1] });
    expect(getStatusTokenCount(character, 'Confused')).toBe(0);
  });
});

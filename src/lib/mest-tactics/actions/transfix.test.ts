import { describe, it, expect } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { resolveTransfixEffect } from '../status/status-system';

describe('transfix', () => {
  it('should assign Transfixed tokens when targets fail the test', () => {
    const sourceProfile: Profile = {
      name: 'Source',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 3, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 } as any,
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: ['Transfix 2'],
      allTraits: [],
    };
    const targetProfile: Profile = {
      name: 'Target',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 } as any,
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: [],
      allTraits: [],
    };

    const battlefield = new Battlefield(12, 12);
    const source = new Character(sourceProfile);
    const target = new Character(targetProfile);

    const results = resolveTransfixEffect(
      battlefield,
      {
        id: source.id,
        character: source,
        position: { x: 2, y: 2 },
        baseDiameter: 2,
        siz: 3,
      },
      [
        {
          character: target,
          position: { x: 3, y: 2 },
          baseDiameter: 2,
        },
      ],
      { testRolls: { [target.id]: [1, 1] } }
    );

    expect(results[0].misses).toBeGreaterThan(0);
    expect(target.state.statusTokens.Transfixed || 0).toBeGreaterThan(0);
  });

  it('should reduce effective X when target has Transfix trait', () => {
    const sourceProfile: Profile = {
      name: 'Source',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 3, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 } as any,
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: ['Transfix 3'],
      allTraits: [],
    };
    const targetProfile: Profile = {
      name: 'Target',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 } as any,
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: ['Transfix 2'],
      allTraits: [],
    };

    const battlefield = new Battlefield(12, 12);
    const source = new Character(sourceProfile);
    const target = new Character(targetProfile);

    const results = resolveTransfixEffect(
      battlefield,
      {
        id: source.id,
        character: source,
        position: { x: 2, y: 2 },
        baseDiameter: 2,
        siz: 3,
      },
      [
        {
          character: target,
          position: { x: 3, y: 2 },
          baseDiameter: 2,
        },
      ],
      { testRolls: { [target.id]: [1, 1] } }
    );

    expect(results[0].effectiveX).toBeLessThan(3);
  });
});

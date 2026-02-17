import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from './character-factory';
import { Battlefield } from './battlefield/Battlefield';
import { applyFearFromWounds, applyFearFromAllyKO } from './morale';
import type { Profile } from './Profile';

describe('morale', () => {
  let battlefield: Battlefield;
  let attacker: any;
  let defender: any;

  beforeEach(async () => {
    battlefield = new Battlefield(12, 12);
    const attackerProfile: Profile = {
      name: 'Attacker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 4, int: 0, pow: 4, str: 0, for: 0, mov: 4, siz: 3 } },
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
    const defenderProfile: Profile = {
      name: 'Defender',
      archetype: { attributes: { cca: 0, rca: 0, ref: 2, int: 0, pow: 1, str: 0, for: 0, mov: 4, siz: 3 } },
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
    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);
    battlefield.placeCharacter(attacker, { x: 2, y: 6 });
    battlefield.placeCharacter(defender, { x: 6, y: 6 });
  });

  it('should add fear tokens when failing a morale test after wounds', () => {
    const result = applyFearFromWounds(defender, 1, [1, 1]);
    expect(result.pass).toBe(false);
    expect(defender.state.fearTokens).toBeGreaterThan(0);
  });

  it('should not add fear tokens when passing morale test', () => {
    const result = applyFearFromWounds(attacker, 1, [6, 6]);
    expect(result.pass).toBe(true);
    expect(attacker.state.fearTokens).toBe(0);
  });

  it('should apply fear to allies within cohesion on KO', async () => {
    const allyProfile: Profile = {
      name: 'Ally',
      archetype: { attributes: { cca: 0, rca: 0, ref: 2, int: 0, pow: 1, str: 0, for: 0, mov: 4, siz: 3 } },
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
    const ally = await createCharacter(allyProfile);
    battlefield.placeCharacter(ally, { x: 7, y: 6 });

    const results = applyFearFromAllyKO(battlefield, defender, [ally], {
      visibilityOrMu: 16,
      requireLOS: false,
      rollsById: { [ally.id]: [1, 1] },
    });
    expect(results.length).toBe(1);
    expect(ally.state.fearTokens).toBeGreaterThanOrEqual(1);
  });
});

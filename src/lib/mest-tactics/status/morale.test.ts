import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../utils/character-factory';
import { Battlefield } from '../battlefield/Battlefield';
import { applyFearFromWounds, applyFearFromAllyKO } from './morale';
import type { Profile } from '../core/Profile';

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

  it('should not run a fear test if already Disordered', () => {
    defender.state.fearTokens = 2;
    defender.refreshStatusFlags();

    const result = applyFearFromWounds(defender, 1, [1, 1]);

    expect(result.pass).toBe(true);
    expect(result.fearAdded).toBe(0);
    expect(defender.state.fearTokens).toBe(2);
  });

  it('should not run a fear test if Engaged and not Distracted', () => {
    defender.state.isEngaged = true;
    defender.state.delayTokens = 0;
    defender.state.isDistracted = false;

    const result = applyFearFromWounds(defender, 1, [1, 1]);

    expect(result.pass).toBe(true);
    expect(result.fearAdded).toBe(0);
    expect(defender.state.fearTokens).toBe(0);
  });

  it('should run a fear test if Engaged and Distracted', () => {
    defender.finalAttributes.pow = 0;
    defender.state.isEngaged = true;
    defender.state.delayTokens = 1;
    defender.refreshStatusFlags();
    defender.state.isEngaged = true;

    const result = applyFearFromWounds(defender, 1, [1, 1]);

    expect(result.pass).toBe(false);
    expect(result.fearAdded).toBeGreaterThan(0);
  });

  it('should only require one fear test per turn', () => {
    defender.finalAttributes.pow = 0;

    const first = applyFearFromWounds(defender, 1, [1, 1]);
    const fearAfterFirst = defender.state.fearTokens;
    const second = applyFearFromWounds(defender, 1, [1, 1]);

    expect(first.pass).toBe(false);
    expect(second.pass).toBe(true);
    expect(second.fearAdded).toBe(0);
    expect(defender.state.fearTokens).toBe(fearAfterFirst);
  });

  it('should set fear tokens to cascades when cascades exceed current fear', () => {
    defender.finalAttributes.pow = 0;
    defender.state.fearTokens = 1;
    defender.refreshStatusFlags();

    const result = applyFearFromWounds(defender, 1, [1, 1]);

    expect(result.pass).toBe(false);
    expect(defender.state.fearTokens).toBe(2);
  });

  it('should add exactly one fear token when cascades do not exceed current fear', () => {
    defender.finalAttributes.pow = 1;
    defender.state.fearTokens = 1;
    defender.refreshStatusFlags();

    const result = applyFearFromWounds(defender, 1, [1, 1]);

    expect(result.pass).toBe(false);
    expect(defender.state.fearTokens).toBe(2);
  });
});

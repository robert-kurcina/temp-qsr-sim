import { describe, it, expect } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { buildPassiveOptions, buildActiveToggleOptions } from './passive-options';

describe('passive-options', () => {
  it('should offer TakeCover when defender is attentive and ordered', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain(new TerrainElement('Tree', { x: 8, y: 5 }).toFeature());
    const profile: Profile = {
      name: 'Attacker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 2, int: 0, pow: 0, str: 0, for: 0, mov: 2, siz: 3 } },
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
    const attacker = new Character({ ...profile, name: 'Attacker' });
    const defender = new Character({
      ...profile,
      name: 'Defender',
      finalTraits: ['Counter-strike!'],
      allTraits: ['Counter-strike!'],
    });
    battlefield.placeCharacter(attacker, { x: 2, y: 2 });
    battlefield.placeCharacter(defender, { x: 8, y: 2 });

    const options = buildPassiveOptions({
      kind: 'RangedAttackDeclared',
      attacker,
      defender,
      battlefield,
    });
    const takeCover = options.find(option => option.type === 'TakeCover');
    expect(takeCover?.available).toBe(true);
  });

  it('should expose Overreach toggle for non-natural melee weapons', () => {
    const profile: Profile = {
      name: 'Attacker',
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
    const attacker = new Character(profile);
    const options = buildActiveToggleOptions({
      attacker,
      weapon: {
        name: 'Sword',
        class: 'Melee',
        classification: 'Melee',
        type: 'Melee',
        bp: 0,
        traits: [],
      },
    });
    const overreach = options.find(option => option.type === 'Overreach');
    expect(overreach?.available).toBe(true);
  });

  it('should offer CounterStrike when a melee hit test fails and defender is engaged', () => {
    const battlefield = new Battlefield(8, 8);
    const attackerProfile: Profile = {
      name: 'Attacker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 1, int: 0, pow: 0, str: 0, for: 0, mov: 2, siz: 3 } },
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
      ...attackerProfile,
      name: 'Defender',
      archetype: { attributes: { cca: 0, rca: 0, ref: 2, int: 0, pow: 0, str: 0, for: 0, mov: 2, siz: 3 } },
      finalTraits: ['Counter-strike!'],
      allTraits: ['Counter-strike!'],
    };
    const attacker = new Character(attackerProfile);
    const defender = new Character(defenderProfile);
    battlefield.placeCharacter(attacker, { x: 2, y: 2 });
    battlefield.placeCharacter(defender, { x: 3, y: 2 });

    const options = buildPassiveOptions({
      kind: 'HitTestFailed',
      attacker,
      defender,
      battlefield,
      attackType: 'melee',
    });

    const counterStrike = options.find(option => option.type === 'CounterStrike');
    expect(counterStrike?.available).toBe(true);
  });

  it('should offer CounterFire when a ranged hit test fails with LOS', () => {
    const battlefield = new Battlefield(8, 8);
    const profile: Profile = {
      name: 'Attacker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 2, int: 0, pow: 0, str: 0, for: 0, mov: 2, siz: 3 } },
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
    const attacker = new Character({ ...profile, name: 'Attacker' });
    const defender = new Character({
      ...profile,
      name: 'Defender',
      finalTraits: ['Counter-strike!'],
      allTraits: ['Counter-strike!'],
    });
    battlefield.placeCharacter(attacker, { x: 1, y: 1 });
    battlefield.placeCharacter(defender, { x: 6, y: 1 });

    const options = buildPassiveOptions({
      kind: 'HitTestFailed',
      attacker,
      defender,
      battlefield,
      attackType: 'ranged',
    });

    const counterFire = options.find(option => option.type === 'CounterFire');
    expect(counterFire?.available).toBe(true);
  });
});

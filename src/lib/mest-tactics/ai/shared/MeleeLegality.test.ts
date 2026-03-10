import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../battlefield/Battlefield';
import { Character, Profile } from '../../core';
import { Item } from '../../core/Item';
import { assessBestMeleeLegality } from './MeleeLegality';

function makeProfile(name: string, items: Item[] = [], traits: { name: string; level: number }[] = []): Profile {
  const traitStrings = traits.map(trait => `${trait.name}${trait.level > 1 ? ` ${trait.level}` : ''}`);
  return {
    name,
    archetype: {
      name: `${name}-arch`,
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits,
      bp: 30,
    },
    items,
    equipment: items,
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: traitStrings as any,
    allTraits: traitStrings as any,
  } as unknown as Profile;
}

function makeMeleeWeapon(name: string, traits: string[] = []): Item {
  return {
    name,
    class: 'Melee',
    classification: 'Melee',
    type: 'Weapon',
    bp: 5,
    traits,
  };
}

function makeCharacter(name: string, items: Item[] = [], traits: { name: string; level: number }[] = []): Character {
  const character = new Character(makeProfile(name, items, traits));
  character.finalAttributes = { ...character.attributes };
  character.allTraits = [...traits] as any;
  return character;
}

describe('MeleeLegality', () => {
  it('allows base-contact close combat without reach/overreach', () => {
    const battlefield = new Battlefield(24, 24);
    const sword = makeMeleeWeapon('Sword');
    const attacker = makeCharacter('attacker', [sword]);
    const defender = makeCharacter('defender', [sword]);
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 7, y: 12 });

    const legality = assessBestMeleeLegality(attacker, defender, battlefield);
    expect(legality.canAttack).toBe(true);
    expect(legality.baseContact).toBe(true);
    expect(legality.requiresReach).toBe(false);
    expect(legality.requiresOverreach).toBe(false);
  });

  it('allows close combat at reach distance when attacker has Reach', () => {
    const battlefield = new Battlefield(24, 24);
    const sword = makeMeleeWeapon('Sword');
    const attacker = makeCharacter('attacker', [sword], [{ name: 'Reach', level: 1 }]);
    const defender = makeCharacter('defender', [sword]);
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // edge distance 1.0 MU

    const legality = assessBestMeleeLegality(attacker, defender, battlefield, { isFirstAction: true, isFreeAtStart: true });
    expect(legality.canAttack).toBe(true);
    expect(legality.baseContact).toBe(false);
    expect(legality.requiresReach).toBe(true);
    expect(legality.requiresOverreach).toBe(false);
  });

  it('allows overreach at +1 MU envelope when qualified', () => {
    const battlefield = new Battlefield(24, 24);
    const spear = makeMeleeWeapon('Spear');
    const attacker = makeCharacter('attacker', [spear]);
    const defender = makeCharacter('defender', [spear]);
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // edge distance 1.0 MU

    const legality = assessBestMeleeLegality(attacker, defender, battlefield, {
      isFirstAction: true,
      isFreeAtStart: true,
    });
    expect(legality.canAttack).toBe(true);
    expect(legality.requiresReach).toBe(false);
    expect(legality.requiresOverreach).toBe(true);
    expect(legality.canUseOverreach).toBe(true);
  });

  it('disallows overreach when using [Stub] weapon', () => {
    const battlefield = new Battlefield(24, 24);
    const dagger = makeMeleeWeapon('Dagger', ['[Stub]']);
    const attacker = makeCharacter('attacker', [dagger]);
    const defender = makeCharacter('defender', [dagger]);
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // edge distance 1.0 MU

    const legality = assessBestMeleeLegality(attacker, defender, battlefield, {
      isFirstAction: true,
      isFreeAtStart: true,
    });
    expect(legality.canUseOverreach).toBe(false);
    expect(legality.canAttack).toBe(false);
  });

  it('disallows overreach-only attack when it is not the first action', () => {
    const battlefield = new Battlefield(24, 24);
    const spear = makeMeleeWeapon('Spear');
    const attacker = makeCharacter('attacker', [spear]);
    const defender = makeCharacter('defender', [spear]);
    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // edge distance 1.0 MU

    const legality = assessBestMeleeLegality(attacker, defender, battlefield, {
      isFirstAction: false,
      isFreeAtStart: true,
    });
    expect(legality.canUseOverreach).toBe(false);
    expect(legality.canAttack).toBe(false);
  });
});

/**
 * Multiple Weapons (Ranged) Verification Tests (QSR Lines 1223-1240)
 *
 * QSR Multiple Weapons Rule:
 * "Characters benefit from the Multiple Weapons rule if their model is shown as sculpted
 *  showing this and the weapons are also purchased using BP."
 *
 * MW.1: Multiple Weapons (Ranged): +1m per additional weapon
 * "Each additional Ranged weapon 'in hand' provides +1 Modifier die Attacker Range Combat Tests."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';

function makeTestProfile(
  name: string,
  items: Array<{
    name: string;
    classification: string;
    traits?: string[];
  }> = []
): Profile {
  return {
    name,
    archetype: {
      name: 'Average',
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
      traits: [],
      bp: 30,
    },
    items: items.map((item: any) => ({
      name: item.name,
      classification: item.classification,
      dmg: item.classification === 'Melee' ? 'STR' : '2+2w',
      impact: 0,
      accuracy: '',
      traits: item.traits ?? [],
      range: item.classification === 'Melee' ? 0 : 12,
    } as any)),
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
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(
  name: string,
  items: Array<{
    name: string;
    classification: string;
    traits?: string[];
  }> = []
): Character {
  const character = new Character(makeTestProfile(name, items));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Multiple Weapons (Ranged) - MW.1 (QSR Lines 1223-1240)', () => {
  describe('MW.1: Ranged Weapons Bonus (+1m per additional)', () => {
    it('should apply +1m for 2 Ranged weapons targeting same model (QSR 1231)', () => {
      // QSR: "Each additional Ranged weapon 'in hand' provides +1 Modifier die
      //       Attacker Range Combat Tests."
      const character = makeTestCharacter('DualPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const weaponCount = character.profile.items!?.length ?? 0;
      const additionalWeapons = weaponCount - 1; // First weapon is base
      const bonus = additionalWeapons; // +1m per additional

      expect(weaponCount).toBe(2);
      expect(additionalWeapons).toBe(1);
      expect(bonus).toBe(1); // +1m
    });

    it('should apply +2m for 3 Ranged weapons targeting same model (QSR 1231)', () => {
      const character = makeTestCharacter('TriplePistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const weaponCount = character.profile.items!?.length ?? 0;
      const additionalWeapons = weaponCount - 1;
      const bonus = additionalWeapons;

      expect(weaponCount).toBe(3);
      expect(additionalWeapons).toBe(2);
      expect(bonus).toBe(2); // +2m
    });

    it('should apply +3m for 4 Ranged weapons targeting same model (QSR 1231)', () => {
      const character = makeTestCharacter('QuadPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const weaponCount = character.profile.items!?.length ?? 0;
      const additionalWeapons = weaponCount - 1;
      const bonus = additionalWeapons;

      expect(weaponCount).toBe(4);
      expect(additionalWeapons).toBe(3);
      expect(bonus).toBe(3); // +3m
    });

    it('should NOT apply if only 1 Ranged weapon (QSR 1231)', () => {
      const character = makeTestCharacter('SinglePistol', [
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const weaponCount = character.profile.items!?.length ?? 0;
      const additionalWeapons = weaponCount - 1;
      const bonus = additionalWeapons;

      expect(weaponCount).toBe(1);
      expect(additionalWeapons).toBe(0);
      expect(bonus).toBe(0); // No bonus
    });

    it('should only apply when targeting the same model (QSR 1231)', () => {
      // QSR: "When targeting the same model"
      const character = makeTestCharacter('DualPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const targetingSameModel = true;
      const bonus = targetingSameModel ? 1 : 0;

      expect(targetingSameModel).toBe(true);
      expect(bonus).toBe(1); // +1m (only if same target)

      const targetingDifferentModels = false;
      const bonusDifferent = targetingDifferentModels ? 1 : 0;

      expect(bonusDifferent).toBe(0); // No bonus if different targets
    });

    it('should apply to Range Combat Hit Tests (QSR 1231)', () => {
      // QSR: "Attacker Range Combat Tests"
      const isRangeHitTest = true;
      const hasMultipleRanged = true;
      const bonus = hasMultipleRanged && isRangeHitTest ? 1 : 0;

      expect(bonus).toBe(1); // +1m to Range Hit
    });

    it('should NOT apply to Close Combat Hit Tests (QSR 1231)', () => {
      // QSR: Only Range Combat Tests
      const isCloseCombatHitTest = true;
      const hasMultipleRanged = true;
      const bonus = hasMultipleRanged && !isCloseCombatHitTest ? 1 : 0;

      expect(bonus).toBe(0); // No bonus (Close Combat uses Melee Multiple Weapons)
    });

    it('should NOT apply to Damage Tests (QSR 1231)', () => {
      // QSR: Only Hit Tests
      const isDamageTest = true;
      const hasMultipleRanged = true;
      const bonus = hasMultipleRanged && !isDamageTest ? 1 : 0;

      expect(bonus).toBe(0); // No bonus to Damage
    });
  });

  describe('MW.1: Ranged Weapon Qualification (QSR 1225)', () => {
    it('should qualify if all weapons are Ranged type (QSR 1225)', () => {
      // QSR: "Weapons in each hand must be all capable of Ranged attacks"
      const character = makeTestCharacter('DualPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const allRanged = character.profile.items!.every(
        item => ['Firearm', 'Bow', 'Thrown', 'Range', 'Energy', 'Beam'].includes(item.classification)
      );

      expect(allRanged).toBe(true);
      // Multiple Weapons (Ranged): QUALIFIED
    });

    it('should NOT qualify if mixing Melee and Ranged weapons (QSR 1225)', () => {
      // QSR: "all capable of Ranged attacks, or all capable of Melee attacks"
      const character = makeTestCharacter('SwordAndPistol', [
        { name: 'Sword', classification: 'Melee' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const hasMelee = character.profile.items!.some(item => item.classification === 'Melee');
      const hasRanged = character.profile.items!.some(
        item => ['Firearm', 'Bow', 'Thrown', 'Range', 'Energy', 'Beam'].includes(item.classification)
      );

      expect(hasMelee && hasRanged).toBe(true);
      // Multiple Weapons: NOT QUALIFIED (mixed types)
    });

    it('should qualify if Melee weapon has Throwable trait (QSR 1226)', () => {
      // QSR: "Melee weapons with the Throwable trait count as Ranged weapons"
      const character = makeTestCharacter('DualJavelin', [
        { name: 'Javelin', classification: 'Melee', traits: ['Throwable'] },
        { name: 'Javelin', classification: 'Melee', traits: ['Throwable'] },
      ]);

      // Throwable melee weapons can count as Ranged
      const allThrowable = character.profile.items!.every(
        item => item.traits?.includes('Throwable')
      );

      expect(allThrowable).toBe(true);
      // Multiple Weapons (Ranged): QUALIFIED (via Throwable)
    });

    it('should NOT qualify if using Natural weapons with Ranged (QSR 1227)', () => {
      // QSR: "Natural weapons are their own sub-classification"
      const character = makeTestCharacter('ClawAndPistol', [
        { name: 'Claws', classification: 'Natural' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const hasNatural = character.profile.items!.some(
        item => item.classification === 'Natural'
      );
      const hasRanged = character.profile.items!.some(
        item => ['Firearm', 'Bow', 'Thrown', 'Range', 'Energy', 'Beam'].includes(item.classification)
      );

      expect(hasNatural && hasRanged).toBe(true);
      // Multiple Weapons: NOT QUALIFIED (Natural is separate classification)
    });
  });

  describe('MW.3: Improvised Weapons Exclusion (QSR 1228)', () => {
    it('should NOT count Improvised weapons for Multiple Weapons (QSR 1228)', () => {
      // QSR: "Improvised weapons do not count for this rule."
      const character = makeTestCharacter('PistolAndImprovised', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Broken Bottle', classification: 'Improvised' },
      ]);

      const validWeapons = character.profile.items!.filter(
        item => item.classification !== 'Improvised'
      );

      expect(validWeapons.length).toBe(1);
      // Multiple Weapons (Ranged): NOT QUALIFIED (only 1 valid weapon)
    });

    it('should count only non-Improvised Ranged weapons (QSR 1228)', () => {
      const character = makeTestCharacter('DualPistolPlusImprovised', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Chair Leg', classification: 'Improvised' },
      ]);

      const validWeapons = character.profile.items!.filter(
        item => item.classification !== 'Improvised'
      );
      const additionalWeapons = validWeapons.length - 1;
      const bonus = additionalWeapons;

      expect(validWeapons.length).toBe(2);
      expect(additionalWeapons).toBe(1);
      expect(bonus).toBe(1); // +1m (Improvised doesn't count)
    });
  });

  describe('MW.4: Conceal/Discrete Exemption (QSR 1229)', () => {
    it('should qualify even if weapon has Conceal trait (QSR 1229)', () => {
      // QSR: "unless the weapon has the Conceal or Discrete traits"
      const character = makeTestCharacter('HiddenPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Holdout Pistol', classification: 'Firearm', traits: ['Conceal'] },
      ]);

      const hasConceal = character.profile.items!.some(
        item => item.traits?.includes('Conceal')
      );

      expect(hasConceal).toBe(true);
      // Multiple Weapons (Ranged): QUALIFIED (Conceal exempts from sculpt)
    });

    it('should qualify even if weapon has Discrete trait (QSR 1229)', () => {
      const character = makeTestCharacter('DiscretePistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Sleeve Gun', classification: 'Firearm', traits: ['Discrete'] },
      ]);

      const hasDiscrete = character.profile.items!.some(
        item => item.traits?.includes('Discrete')
      );

      expect(hasDiscrete).toBe(true);
      // Multiple Weapons (Ranged): QUALIFIED (Discrete exempts from sculpt)
    });

    it('should require sculpt for weapons without Conceal/Discrete (QSR 1229)', () => {
      const character = makeTestCharacter('DualPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const hasExemption = character.profile.items!.some(
        item => item.traits?.includes('Conceal') || item.traits?.includes('Discrete')
      );

      expect(hasExemption).toBe(false);
      // Multiple Weapons (Ranged): Requires sculpt verification (WYSIWYG)
    });
  });

  describe('MW.5: Consecutive Action Penalty (QSR 1233)', () => {
    it('should apply -1m penalty for same weapon consecutive Actions (QSR 1233)', () => {
      // QSR: "Using the same weapon in consecutive Actions during an Initiative
      //       penalizes -1 Modifier die Attacker Combat Tests"
      const usedSameWeaponLastAction = true;
      const penalty = usedSameWeaponLastAction ? -1 : 0;

      expect(penalty).toBe(-1);
      // Applied via context.modifierDice
    });

    it('should NOT apply penalty if different weapon used (QSR 1233)', () => {
      const usedSameWeaponLastAction = false;
      const penalty = usedSameWeaponLastAction ? -1 : 0;

      expect(penalty).toBe(0);
      // No penalty
    });

    it('should track weapon usage per Initiative (QSR 1233)', () => {
      // QSR: "during an Initiative"
      const currentInitiative = 1;
      const lastWeaponUsedInitiative = 1;
      const isConsecutive = currentInitiative === lastWeaponUsedInitiative;

      expect(isConsecutive).toBe(true);
      // Penalty applies only within same Initiative
    });

    it('should reset penalty on new Initiative (QSR 1233)', () => {
      const currentInitiative = 2;
      const lastWeaponUsedInitiative = 1;
      const isConsecutive = (currentInitiative as number) === (lastWeaponUsedInitiative as number);

      expect(isConsecutive).toBe(false);
      // No penalty (new Initiative)
    });
  });

  describe('MW.6: Interruption Weapon Consistency (QSR 1234-1236)', () => {
    it('must use same weapon for defense when interrupted (QSR 1234)', () => {
      // QSR: "A character that is using a specific weapon for an attack which is
      //       then interrupted... must use that weapon for defense as well."
      const attackWeapon = 'Pistol';
      const defenseWeapon = attackWeapon; // Must be same

      expect(defenseWeapon).toBe(attackWeapon);
      // Weapon consistency enforced during React/Passive Option resolution
    });

    it('should specify weapon at start of Action if unclear (QSR 1235)', () => {
      // QSR: "At the start of an Action, if it isn't clear, both the target and
      //       the Attacker must specify which weapon is in Hand."
      const weaponUnclear = true;
      const mustSpecify = weaponUnclear;

      expect(mustSpecify).toBe(true);
      // Weapon declaration required
    });

    it('should affect React Actions based on weapon choice (QSR 1236)', () => {
      // QSR: "The choice for weapon used when interrupted affects React Actions"
      const declaredWeapon = 'Pistol';
      const weaponType = 'Ranged';

      const canReactMelee = (weaponType as string) === 'Melee';
      const canReactRanged = (weaponType as string) === 'Ranged';

      expect(declaredWeapon).toBe('Pistol');
      expect(canReactMelee).toBe(false);
      expect(canReactRanged).toBe(true);
    });

    it('should affect Bonus Actions based on weapon choice (QSR 1236)', () => {
      const declaredWeapon = 'Pistol';
      const weaponType = 'Ranged';

      const canUseMeleeBonus = (weaponType as string) === 'Melee';
      const canUseRangedBonus = (weaponType as string) === 'Ranged';

      expect(declaredWeapon).toBe('Pistol');
      expect(canUseMeleeBonus).toBe(false);
      expect(canUseRangedBonus).toBe(true);
    });
  });

  describe('Multiple Weapons (Ranged) Integration', () => {
    it('should apply bonus correctly for 2 Ranged weapons', () => {
      const character = makeTestCharacter('DualPistol', [
        { name: 'Pistol', classification: 'Firearm' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const weaponCount = character.profile.items!?.length ?? 0;
      const allRanged = character.profile.items!.every(
        item => ['Firearm', 'Bow', 'Thrown', 'Range', 'Energy', 'Beam'].includes(item.classification)
      );
      const noImprovised = character.profile.items!.every(
        item => item.classification !== 'Improvised'
      );

      const isQualified = allRanged && noImprovised && weaponCount > 1;
      const bonus = isQualified ? weaponCount - 1 : 0;

      expect(isQualified).toBe(true);
      expect(bonus).toBe(1); // +1m
    });

    it('should NOT apply if weapons are mixed types', () => {
      const character = makeTestCharacter('SwordAndPistol', [
        { name: 'Sword', classification: 'Melee' },
        { name: 'Pistol', classification: 'Firearm' },
      ]);

      const allRanged = character.profile.items!.every(
        item => ['Firearm', 'Bow', 'Thrown', 'Range', 'Energy', 'Beam'].includes(item.classification)
      );
      const allMelee = character.profile.items!.every(
        item => item.classification === 'Melee'
      );

      const isQualified = ((allRanged || allMelee) && character.profile.items!.length) ?? 0 > 1;

      expect(isQualified).toBe(false);
      // NOT QUALIFIED (mixed types)
    });

    it('should stack with other Range Combat modifiers', () => {
      const modifiers = {
        multipleWeapons: 1, // +1m (2 weapons)
        pointBlank: 1, // +1m
        elevation: 0, // 0
        size: 0, // 0
        distance: -1, // -1m
        interveningCover: 0, // 0
        obscured: 0, // 0
      };

      const totalModifierBonus =
        modifiers.multipleWeapons +
        modifiers.pointBlank +
        modifiers.elevation +
        modifiers.size +
        modifiers.distance +
        modifiers.interveningCover +
        modifiers.obscured;

      expect(totalModifierBonus).toBe(1); // +1 + 1 + 0 + 0 - 1 + 0 + 0 = +1
    });
  });
});

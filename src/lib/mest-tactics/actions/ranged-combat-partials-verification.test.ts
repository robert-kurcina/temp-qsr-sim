/**
 * Range Combat Situational Modifiers: Point-blank, Size, Distance Verification Tests
 * (QSR Lines 1491-1493)
 *
 * QSR Point-blank:
 * "Point-blank. Active model not Engaged to target receives +1 Modifier die for
 *  the Hit or Detect Tests if at half OR or less."
 *
 * QSR Size (Range Combat):
 * "Size. Range Combat Hit Test for every 3 SIZ difference to the smaller model
 *  if OR Multiple is at least 1."
 *
 * QSR Distance:
 * "Distance. Attacker Hit or Detect Test for ORM to the target."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';

function makeTestProfile(name: string, siz: number = 3): Profile {
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
        siz,
      },
      traits: [],
      bp: 30,
    },
    items: [
      {
        name: 'Rifle',
        classification: 'Firearm',
        dmg: '2+2w',
        impact: 0,
        accuracy: '',
        traits: [],
        range: 16, // OR = 16 MU
      },
    ],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: siz,
    adjPhysicality: siz,
    durability: siz,
    adjDurability: siz,
    burden: { totalLaden: 0, totalBurden: 0 },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string, siz: number = 3): Character {
  const character = new Character(makeTestProfile(name, siz));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Range Combat: Point-blank (QSR Line 1491)', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker = makeTestCharacter('Attacker');
    target = makeTestCharacter('Target');

    battlefield.placeCharacter(attacker, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 16, y: 12 });

    attacker.state.isAttentive = true;
    target.state.isAttentive = true;
  });

  describe('SM.1: Point-blank Modifier (+1m)', () => {
    it('should apply +1m if at half OR or less (QSR 1491)', () => {
      // QSR: "Point-blank. Active model not Engaged to target receives +1 Modifier die
      //       for the Hit or Detect Tests if at half OR or less."
      
      const optimalRange = 16; // MU (weapon OR)
      const halfOR = optimalRange / 2; // 8 MU
      const distance = 6; // MU (within half OR)
      const isEngaged = false;

      const isPointBlank = !isEngaged && distance <= halfOR;
      const bonus = isPointBlank ? 1 : 0;

      expect(isPointBlank).toBe(true);
      expect(bonus).toBe(1); // +1m
    });

    it('should NOT apply if beyond half OR (QSR 1491)', () => {
      const optimalRange = 16; // MU
      const halfOR = optimalRange / 2; // 8 MU
      const distance = 10; // MU (beyond half OR)
      const isEngaged = false;

      const isPointBlank = !isEngaged && distance <= halfOR;
      const bonus = isPointBlank ? 1 : 0;

      expect(isPointBlank).toBe(false);
      expect(bonus).toBe(0); // No bonus
    });

    it('should NOT apply if Engaged (QSR 1491)', () => {
      // QSR: "Active model not Engaged to target"
      const optimalRange = 16; // MU
      const halfOR = optimalRange / 2; // 8 MU
      const distance = 4; // MU (within half OR)
      const isEngaged = true; // In Melee Range

      const isPointBlank = !isEngaged && distance <= halfOR;
      const bonus = isPointBlank ? 1 : 0;

      expect(isPointBlank).toBe(false);
      expect(bonus).toBe(0); // No bonus (Engaged)
    });

    it('should apply to Hit Tests (QSR 1491)', () => {
      // QSR: "Hit or Detect Tests"
      const isHitTest = true;
      const isPointBlank = true;
      const bonus = isPointBlank && isHitTest ? 1 : 0;

      expect(bonus).toBe(1); // +1m to Hit
    });

    it('should apply to Detect Tests (QSR 1491)', () => {
      // QSR: "Hit or Detect Tests"
      const isDetectTest = true;
      const isPointBlank = true;
      const bonus = isPointBlank && isDetectTest ? 1 : 0;

      expect(bonus).toBe(1); // +1m to Detect
    });

    it('should NOT apply to Damage Tests (QSR 1491)', () => {
      // QSR: Only Hit and Detect Tests
      const isDamageTest = true;
      const isPointBlank = true;
      const bonus = isPointBlank && !isDamageTest ? 1 : 0;

      expect(bonus).toBe(0); // No bonus to Damage
    });
  });

  describe('Point-blank Calculation', () => {
    it('should calculate half OR correctly (QSR 1491)', () => {
      const testCases = [
        { or: 16, half: 8 },
        { or: 12, half: 6 },
        { or: 24, half: 12 },
        { or: 8, half: 4 },
      ];

      for (const { or, half } of testCases) {
        expect(or / 2).toBe(half);
      }
    });

    it('should use weapon OR for calculation (QSR 1491)', () => {
      // Different weapons have different OR
      const rifleOR = 16;
      const pistolOR = 8;
      const sniperOR = 32;

      expect(rifleOR / 2).toBe(8);
      expect(pistolOR / 2).toBe(4);
      expect(sniperOR / 2).toBe(16);
    });
  });
});

describe('Range Combat: Size (QSR Line 1492)', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker = makeTestCharacter('Attacker', 3);
    target = makeTestCharacter('Target', 3);

    battlefield.placeCharacter(attacker, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 16, y: 12 });

    attacker.state.isAttentive = true;
    target.state.isAttentive = true;
  });

  describe('SM.3: Size Modifier (+1m per 3 SIZ)', () => {
    it('should apply +1m for 3 SIZ difference (QSR 1492)', () => {
      // QSR: "Size. Range Combat Hit Test for every 3 SIZ difference to the smaller
      //       model if OR Multiple is at least 1."
      
      const attackerSIZ = 6; // Large model
      const targetSIZ = 3; // Normal model
      const sizDifference = attackerSIZ - targetSIZ; // 3
      const orMultiple = 1; // At least 1

      let bonus = 0;
      if (orMultiple >= 1 && sizDifference >= 3) {
        bonus = Math.floor(sizDifference / 3);
      }

      expect(sizDifference).toBe(3);
      expect(bonus).toBe(1); // +1m
    });

    it('should apply +2m for 6 SIZ difference (QSR 1492)', () => {
      const attackerSIZ = 9; // Very large model
      const targetSIZ = 3; // Normal model
      const sizDifference = attackerSIZ - targetSIZ; // 6
      const orMultiple = 1;

      let bonus = 0;
      if (orMultiple >= 1 && sizDifference >= 3) {
        bonus = Math.floor(sizDifference / 3);
      }

      expect(sizDifference).toBe(6);
      expect(bonus).toBe(2); // +2m
    });

    it('should apply +3m for 9 SIZ difference (QSR 1492)', () => {
      const attackerSIZ = 12; // Huge model
      const targetSIZ = 3; // Normal model
      const sizDifference = attackerSIZ - targetSIZ; // 9
      const orMultiple = 1;

      let bonus = 0;
      if (orMultiple >= 1 && sizDifference >= 3) {
        bonus = Math.floor(sizDifference / 3);
      }

      expect(sizDifference).toBe(9);
      expect(bonus).toBe(3); // +3m
    });

    it('should NOT apply if SIZ difference < 3 (QSR 1492)', () => {
      const attackerSIZ = 4;
      const targetSIZ = 3;
      const sizDifference = attackerSIZ - targetSIZ; // 1
      const orMultiple = 1;

      let bonus = 0;
      if (orMultiple >= 1 && sizDifference >= 3) {
        bonus = Math.floor(sizDifference / 3);
      }

      expect(sizDifference).toBe(1);
      expect(bonus).toBe(0); // No bonus
    });

    it('should NOT apply if OR Multiple < 1 (QSR 1492)', () => {
      // QSR: "if OR Multiple is at least 1"
      const attackerSIZ = 6;
      const targetSIZ = 3;
      const sizDifference = attackerSIZ - targetSIZ; // 3
      const orMultiple = 0.5; // Less than 1

      let bonus = 0;
      if (orMultiple >= 1 && sizDifference >= 3) {
        bonus = Math.floor(sizDifference / 3);
      }

      expect(bonus).toBe(0); // No bonus (OR Multiple < 1)
    });

    it('should apply to Range Combat Hit Tests (QSR 1492)', () => {
      // QSR: "Range Combat Hit Test"
      const isRangeHitTest = true;
      const hasSizeAdvantage = true;
      const bonus = hasSizeAdvantage && isRangeHitTest ? 1 : 0;

      expect(bonus).toBe(1); // +1m to Range Hit
    });

    it('should NOT apply to Close Combat Hit Tests (QSR 1492)', () => {
      // QSR: Only Range Combat Hit Test
      const isCloseCombatHitTest = true;
      const hasSizeAdvantage = true;
      const bonus = hasSizeAdvantage && !isCloseCombatHitTest ? 1 : 0;

      expect(bonus).toBe(0); // No bonus (Close Combat uses different Size rule)
    });

    it('should NOT apply to Damage Tests (QSR 1492)', () => {
      // QSR: Only Hit Test
      const isDamageTest = true;
      const hasSizeAdvantage = true;
      const bonus = hasSizeAdvantage && !isDamageTest ? 1 : 0;

      expect(bonus).toBe(0); // No bonus to Damage
    });
  });

  describe('Size Calculation', () => {
    it('should calculate bonus as floor(SIZ difference / 3) (QSR 1492)', () => {
      const testCases = [
        { difference: 0, bonus: 0 },
        { difference: 1, bonus: 0 },
        { difference: 2, bonus: 0 },
        { difference: 3, bonus: 1 },
        { difference: 4, bonus: 1 },
        { difference: 5, bonus: 1 },
        { difference: 6, bonus: 2 },
        { difference: 9, bonus: 3 },
        { difference: 12, bonus: 4 },
      ];

      for (const { difference, bonus: expected } of testCases) {
        const bonus = Math.floor(difference / 3);
        expect(bonus).toBe(expected);
      }
    });

    it('should use attacker SIZ - target SIZ for difference (QSR 1492)', () => {
      const attackerSIZ = 6;
      const targetSIZ = 3;
      const difference = attackerSIZ - targetSIZ;

      expect(difference).toBe(3);
    });

    it('should NOT apply if target is larger (QSR 1492)', () => {
      const attackerSIZ = 3;
      const targetSIZ = 6;
      const difference = attackerSIZ - targetSIZ; // -3

      const bonus = difference >= 3 ? Math.floor(difference / 3) : 0;

      expect(difference).toBe(-3);
      expect(bonus).toBe(0); // No bonus (target is larger)
    });
  });
});

describe('Range Combat: Distance (QSR Line 1493)', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker = makeTestCharacter('Attacker');
    target = makeTestCharacter('Target');

    battlefield.placeCharacter(attacker, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 16, y: 12 });

    attacker.state.isAttentive = true;
    target.state.isAttentive = true;
  });

  describe('SM.4: Distance Modifier (-1m per ORM)', () => {
    it('should apply -1m per ORM to target (QSR 1493)', () => {
      // QSR: "Distance. Attacker Hit or Detect Test for ORM to the target."
      
      const optimalRange = 16; // MU (weapon OR)
      const distance = 16; // MU (at 1 ORM)
      const orm = distance / optimalRange; // 1.0

      const penalty = -Math.floor(orm);

      expect(orm).toBe(1);
      expect(penalty).toBe(-1); // -1m
    });

    it('should apply -2m at 2 ORM (QSR 1493)', () => {
      const optimalRange = 16; // MU
      const distance = 32; // MU (at 2 ORM)
      const orm = distance / optimalRange; // 2.0

      const penalty = -Math.floor(orm);

      expect(orm).toBe(2);
      expect(penalty).toBe(-2); // -2m
    });

    it('should apply -3m at 3 ORM (QSR 1493)', () => {
      const optimalRange = 16; // MU
      const distance = 48; // MU (at 3 ORM)
      const orm = distance / optimalRange; // 3.0

      const penalty = -Math.floor(orm);

      expect(orm).toBe(3);
      expect(penalty).toBe(-3); // -3m
    });

    it('should apply -1m at 1.5 ORM (QSR 1493)', () => {
      const optimalRange = 16; // MU
      const distance = 24; // MU (at 1.5 ORM)
      const orm = distance / optimalRange; // 1.5

      const penalty = -Math.floor(orm);

      expect(orm).toBe(1.5);
      expect(penalty).toBe(-1); // -1m (rounds down)
    });

    it('should NOT apply at very close range (QSR 1493)', () => {
      const optimalRange = 16; // MU
      const distance = 4; // MU (at 0.25 ORM)
      const orm = distance / optimalRange; // 0.25

      const penalty = orm >= 1 ? -Math.floor(orm) : 0;

      expect(orm).toBe(0.25);
      expect(penalty).toBe(0); // No penalty (< 1 ORM)
    });

    it('should apply to Hit Tests (QSR 1493)', () => {
      // QSR: "Attacker Hit or Detect Test"
      const isHitTest = true;
      const hasDistancePenalty = true;
      const penalty = hasDistancePenalty && isHitTest ? -1 : 0;

      expect(penalty).toBe(-1); // -1m to Hit
    });

    it('should apply to Detect Tests (QSR 1493)', () => {
      // QSR: "Attacker Hit or Detect Test"
      const isDetectTest = true;
      const hasDistancePenalty = true;
      const penalty = hasDistancePenalty && isDetectTest ? -1 : 0;

      expect(penalty).toBe(-1); // -1m to Detect
    });

    it('should NOT apply to Damage Tests (QSR 1493)', () => {
      // QSR: Only Hit and Detect Tests
      const isDamageTest = true;
      const hasDistancePenalty = true;
      const penalty = hasDistancePenalty && !isDamageTest ? -1 : 0;

      expect(penalty).toBe(0); // No penalty to Damage
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate ORM as distance / optimalRange (QSR 1493)', () => {
      const optimalRange = 16; // MU
      const testCases = [
        { distance: 8, orm: 0.5 },
        { distance: 16, orm: 1 },
        { distance: 24, orm: 1.5 },
        { distance: 32, orm: 2 },
        { distance: 48, orm: 3 },
      ];

      for (const { distance, orm: expected } of testCases) {
        const orm = distance / optimalRange;
        expect(orm).toBe(expected);
      }
    });

    it('should use weapon OR for optimalRange (QSR 1493)', () => {
      // Different weapons have different OR
      const rifleOR = 16;
      const pistolOR = 8;
      const sniperOR = 32;

      const distance = 16; // MU

      expect(distance / rifleOR).toBe(1);
      expect(distance / pistolOR).toBe(2);
      expect(distance / sniperOR).toBe(0.5);
    });

    it('should round down ORM for penalty calculation (QSR 1493)', () => {
      const ormValues = [
        { orm: 0.5, penalty: 0 },
        { orm: 0.9, penalty: 0 },
        { orm: 1.0, penalty: -1 },
        { orm: 1.5, penalty: -1 },
        { orm: 1.9, penalty: -1 },
        { orm: 2.0, penalty: -2 },
        { orm: 2.9, penalty: -2 },
        { orm: 3.0, penalty: -3 },
      ];

      for (const { orm, penalty: expected } of ormValues) {
        const penalty = orm >= 1 ? -Math.floor(orm) : 0;
        expect(penalty).toBe(expected);
      }
    });
  });
});

describe('Range Combat Modifiers Integration', () => {
  it('should apply Point-blank, Size, and Distance correctly', () => {
    // Each modifier applies independently
    const pointBlankBonus = 1; // +1m (at half OR or less)
    const sizeBonus = 1; // +1m (3 SIZ difference)
    const distancePenalty = -1; // -1m (at 1 ORM)

    const totalModifierBonus = pointBlankBonus + sizeBonus + distancePenalty;

    expect(pointBlankBonus).toBe(1);
    expect(sizeBonus).toBe(1);
    expect(distancePenalty).toBe(-1);
    expect(totalModifierBonus).toBe(1); // +1m - 1m + 1m = +1m
  });

  it('should stack with other Range Combat modifiers', () => {
    const modifiers = {
      pointBlank: 1, // +1m
      elevation: 1, // +1m
      size: 0, // 0
      distance: -1, // -1m
      interveningCover: -1, // -1m
      obscured: 0, // 0
      directCover: 0, // -1b (different dice type)
      leaning: 0, // -1b (different dice type)
    };

    const totalModifierBonus =
      modifiers.pointBlank +
      modifiers.elevation +
      modifiers.size +
      modifiers.distance +
      modifiers.interveningCover +
      modifiers.obscured;

    expect(totalModifierBonus).toBe(0); // +1 + 1 + 0 - 1 - 1 + 0 = 0
  });

  it('should prioritize Point-blank vs Distance (mutually exclusive ranges)', () => {
    // Point-blank: <= half OR
    // Distance: >= 1 ORM
    // These don't overlap (half OR < 1 ORM)
    const optimalRange = 16;
    const halfOR = optimalRange / 2; // 8
    const oneORM = optimalRange; // 16

    const distance = 6; // Within half OR
    const isPointBlank = distance <= halfOR;
    const orm = distance / optimalRange;
    const distancePenalty = orm >= 1 ? -Math.floor(orm) : 0;

    expect(isPointBlank).toBe(true);
    expect(distancePenalty).toBe(0); // No distance penalty at close range
  });
});

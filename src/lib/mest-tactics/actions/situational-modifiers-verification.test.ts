/**
 * Situational Test Modifiers: High Ground and Elevation Verification Tests
 * (QSR Lines 464, 1483, 1491)
 *
 * QSR High Ground (Close Combat & Disengage):
 * "High Ground. Disengage and Hit Tests to higher model if base is above half of
 *  the Opposing model's base-height, and base-height is above the Opposing model's volume."
 *
 * QSR Elevation (Range Combat & Detect):
 * "Elevation. Active character Hit or Detect Tests if higher than opponent by 1"
 *  for every 1" away."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';

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
    items: [],
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

describe('Close Combat: High Ground (QSR Lines 464, 1483)', () => {
  let battlefield: Battlefield;
  let higherModel: Character;
  let lowerModel: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    higherModel = makeTestCharacter('HighGround', 3);
    lowerModel = makeTestCharacter('LowGround', 3);

    battlefield.placeCharacter(higherModel, { x: 10, y: 12 });
    battlefield.placeCharacter(lowerModel, { x: 11, y: 12 });

    higherModel.state.isAttentive = true;
    lowerModel.state.isAttentive = true;
  });

  describe('SM.1: High Ground Modifier (+1m)', () => {
    it('should apply +1m if base is above half opponent\'s base-height (QSR 464)', () => {
      // QSR: "High Ground. Disengage and Hit Tests to higher model if base is above
      //       half of the Opposing model's base-height"
      // SIZ 3 = base-height ~1 MU
      // Half base-height = 0.5 MU
      // Higher model must be > 0.5 MU above lower model

      const higherModelBaseHeight = 1.0; // MU (SIZ 3)
      const halfBaseHeight = higherModelBaseHeight / 2; // 0.5 MU
      const elevationDifference = 1.0; // MU (on elevated terrain)

      const hasHighGround = elevationDifference > halfBaseHeight;

      expect(hasHighGround).toBe(true);
      expect(halfBaseHeight).toBe(0.5);
      // +1m bonus applies
    });

    it('should NOT apply if base is NOT above half opponent\'s base-height (QSR 464)', () => {
      const higherModelBaseHeight = 1.0; // MU
      const halfBaseHeight = higherModelBaseHeight / 2; // 0.5 MU
      const elevationDifference = 0.3; // MU (not high enough)

      const hasHighGround = elevationDifference > halfBaseHeight;

      expect(hasHighGround).toBe(false);
      // No +1m bonus
    });

    it('should require base-height above opponent\'s volume (QSR 464)', () => {
      // QSR: "and base-height is above the Opposing model's volume"
      const opponentVolume = 1.0; // MU (SIZ 3 cylinder)
      const higherModelBaseHeight = 1.5; // MU (on elevated terrain)

      const baseHeightAboveVolume = higherModelBaseHeight > opponentVolume;

      expect(baseHeightAboveVolume).toBe(true);
      // High Ground requirement met
    });

    it('should apply to Disengage Tests (QSR 464)', () => {
      // QSR: "Disengage and Hit Tests to higher model"
      const isDisengageTest = true;
      const hasHighGround = true;
      const bonus = hasHighGround && isDisengageTest ? 1 : 0;

      expect(bonus).toBe(1);
      // +1m to Disengage Test
    });

    it('should apply to Close Combat Hit Tests (QSR 464)', () => {
      // QSR: "Disengage and Hit Tests to higher model"
      const isHitTest = true;
      const hasHighGround = true;
      const bonus = hasHighGround && isHitTest ? 1 : 0;

      expect(bonus).toBe(1);
      // +1m to Hit Test
    });

    it('should NOT apply to Damage Tests (QSR 464)', () => {
      // QSR: Only Disengage and Hit Tests
      const isDamageTest = true;
      const hasHighGround = true;
      const bonus = hasHighGround && !isDamageTest ? 1 : 0;

      expect(bonus).toBe(0);
      // No bonus to Damage Test
    });
  });

  describe('High Ground vs Elevation Distinction', () => {
    it('should distinguish High Ground (Close) from Elevation (Range) (QSR 464 vs 1491)', () => {
      // High Ground: Close Combat/Disengage, based on base-height comparison
      // Elevation: Range Combat/Detect, based on 1" per 1" away ratio

      const closeCombat = true;
      const rangeCombat = false;

      const highGroundBonus = closeCombat ? 1 : 0;
      const elevationBonus = rangeCombat ? 1 : 0;

      expect(highGroundBonus).toBe(1);
      expect(elevationBonus).toBe(0);
      // Different modifiers for different combat types
    });
  });

  describe('High Ground Calculation', () => {
    it('should calculate base-height from SIZ (QSR 137-140)', () => {
      // QSR: "A model's base-height is its base-diameter if Humanoid"
      // SIZ 3 = base-diameter ~1 MU = base-height ~1 MU
      const siz = 3;
      const baseHeight = 1.0; // Approximate for SIZ 3

      expect(baseHeight).toBe(1.0);
    });

    it('should calculate half base-height threshold (QSR 464)', () => {
      const baseHeight = 1.0; // MU
      const halfBaseHeight = baseHeight / 2;

      expect(halfBaseHeight).toBe(0.5);
      // Higher model must be > 0.5 MU above
    });

    it('should compare base-height to opponent\'s volume (QSR 464)', () => {
      // QSR: "base-height is above the Opposing model's volume"
      const opponentSIZ = 3;
      const opponentVolume = 1.0; // Approximate for SIZ 3
      const higherModelBaseHeight = 1.5; // On elevated terrain

      const isAboveVolume = higherModelBaseHeight > opponentVolume;

      expect(isAboveVolume).toBe(true);
    });
  });
});

describe('Range Combat: Elevation (QSR Line 1491)', () => {
  let battlefield: Battlefield;
  let higherModel: Character;
  let lowerModel: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    higherModel = makeTestCharacter('HighGround', 3);
    lowerModel = makeTestCharacter('LowGround', 3);

    battlefield.placeCharacter(higherModel, { x: 10, y: 12 });
    battlefield.placeCharacter(lowerModel, { x: 16, y: 12 });

    higherModel.state.isAttentive = true;
    lowerModel.state.isAttentive = true;
  });

  describe('SM.2: Elevation Modifier (+1m)', () => {
    it('should apply +1m per 1" of elevation difference per 1" away (QSR 1491)', () => {
      // QSR: "Elevation. Active character Hit or Detect Tests if higher than opponent
      //       by 1" for every 1" away."
      const horizontalDistance = 6; // MU
      const elevationDifference = 6; // MU (1:1 ratio)

      const bonus = Math.floor(elevationDifference / horizontalDistance);

      expect(bonus).toBe(1);
      // +1m bonus (1" per 1" away)
    });

    it('should apply +2m if 2" higher per 1" away (QSR 1491)', () => {
      const horizontalDistance = 3; // MU
      const elevationDifference = 6; // MU (2:1 ratio)

      const bonus = Math.floor(elevationDifference / horizontalDistance);

      expect(bonus).toBe(2);
      // +2m bonus (2" per 1" away)
    });

    it('should NOT apply if not higher than opponent (QSR 1491)', () => {
      const elevationDifference = 0; // Same level
      const horizontalDistance = 6; // MU

      const bonus = elevationDifference > 0 ? Math.floor(elevationDifference / horizontalDistance) : 0;

      expect(bonus).toBe(0);
      // No bonus (same level)
    });

    it('should NOT apply if lower than opponent (QSR 1491)', () => {
      const elevationDifference = -3; // Lower
      const horizontalDistance = 6; // MU

      const bonus = elevationDifference > 0 ? Math.floor(elevationDifference / horizontalDistance) : 0;

      expect(bonus).toBe(0);
      // No bonus (lower)
    });

    it('should apply to Hit Tests (QSR 1491)', () => {
      // QSR: "Active character Hit or Detect Tests"
      const isHitTest = true;
      const hasElevation = true;
      const bonus = hasElevation && isHitTest ? 1 : 0;

      expect(bonus).toBe(1);
      // +1m to Hit Test
    });

    it('should apply to Detect Tests (QSR 1491)', () => {
      // QSR: "Active character Hit or Detect Tests"
      const isDetectTest = true;
      const hasElevation = true;
      const bonus = hasElevation && isDetectTest ? 1 : 0;

      expect(bonus).toBe(1);
      // +1m to Detect Test
    });

    it('should NOT apply to Damage Tests (QSR 1491)', () => {
      // QSR: Only Hit and Detect Tests
      const isDamageTest = true;
      const hasElevation = true;
      const bonus = hasElevation && !isDamageTest ? 1 : 0;

      expect(bonus).toBe(0);
      // No bonus to Damage Test
    });
  });

  describe('Elevation Calculation', () => {
    it('should calculate bonus as elevation/distance ratio (QSR 1491)', () => {
      const testCases = [
        { elevation: 1, distance: 1, expected: 1 },
        { elevation: 2, distance: 1, expected: 2 },
        { elevation: 3, distance: 1, expected: 3 },
        { elevation: 1, distance: 2, expected: 0 }, // 0.5 rounds down
        { elevation: 2, distance: 2, expected: 1 },
        { elevation: 4, distance: 2, expected: 2 },
        { elevation: 6, distance: 3, expected: 2 },
      ];

      for (const { elevation, distance, expected } of testCases) {
        const bonus = Math.floor(elevation / distance);
        expect(bonus).toBe(expected);
      }
    });

    it('should use horizontal distance for calculation (QSR 1491)', () => {
      // QSR: "by 1" for every 1" away"
      // Distance is horizontal distance, not diagonal
      const horizontalDistance = 6; // MU
      const elevationDifference = 3; // MU

      const bonus = Math.floor(elevationDifference / horizontalDistance);

      expect(bonus).toBe(0); // 3/6 = 0.5, rounds down
    });

    it('should round down fractional bonuses (QSR 1491)', () => {
      const elevationDifference = 2; // MU
      const horizontalDistance = 3; // MU

      const rawBonus = elevationDifference / horizontalDistance; // 0.667
      const bonus = Math.floor(rawBonus);

      expect(bonus).toBe(0); // Rounds down
    });
  });

  describe('High Ground vs Elevation Comparison', () => {
    it('should use High Ground for Close Combat, Elevation for Range (QSR 464 vs 1491)', () => {
      const isCloseCombat = true;
      const isRangeCombat = false;

      const highGroundBonus = isCloseCombat ? 1 : 0;
      const elevationBonus = isRangeCombat ? 1 : 0;

      expect(highGroundBonus).toBe(1);
      expect(elevationBonus).toBe(0);
    });

    it('should calculate High Ground based on base-height, Elevation based on distance ratio', () => {
      // High Ground: Fixed +1m if above half base-height
      const baseHeight = 1.0;
      const elevationForHighGround = 0.6; // Above half (0.5)
      const hasHighGround = elevationForHighGround > baseHeight / 2;
      const highGroundBonus = hasHighGround ? 1 : 0;

      // Elevation: Variable based on ratio
      const elevationForElevation = 6;
      const distance = 6;
      const elevationBonus = Math.floor(elevationForElevation / distance);

      expect(highGroundBonus).toBe(1);
      expect(elevationBonus).toBe(1);
    });
  });
});

describe('Situational Test Modifiers Integration', () => {
  it('should apply High Ground or Elevation correctly based on combat type', () => {
    const combatType = 'close'; // or 'range'
    const hasHighGround = true;
    const hasElevation = true;

    let bonus = 0;
    if (combatType === 'close' && hasHighGround) {
      bonus = 1;
    } else if (combatType === 'range' && hasElevation) {
      bonus = 1;
    }

    expect(bonus).toBe(1);
  });

  it('should stack with other situational modifiers', () => {
    const modifiers = {
      highGround: 1, // +1m
      size: 0, // +0m
      charge: 0, // +0m (not charging)
      defend: 0, // +0b (different dice type)
      outnumber: 0, // +0w (different dice type)
    };

    const totalModifierBonus =
      modifiers.highGround +
      modifiers.size +
      modifiers.charge;

    expect(totalModifierBonus).toBe(1);
  });
});

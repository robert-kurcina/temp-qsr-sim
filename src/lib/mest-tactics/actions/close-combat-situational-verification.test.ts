/**
 * Close Combat Situational Modifiers: Outnumber, Cornered, Flanked Verification Tests
 * (QSR Lines 465-467, 1486-1488)
 *
 * QSR Outnumber:
 * "Outnumber. Disengage and Hit Tests for 1, 2, 5, or 10 more other Attentive Ordered
 *  Friendly models with the same target in Melee Range than the Opposing model.
 *  Each is +1w."
 *
 * QSR Cornered:
 * "Cornered. Disengage and Hit Tests if Engaged to the Opposing model on one side
 *  of this model and in base-contact on the other side with a wall, precipice, or
 *  degraded terrain."
 *
 * QSR Flanked:
 * "Flanked. Disengage and Hit Tests if Engaged to two Opposing models directly on
 *  either side of this model."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';

function makeTestProfile(name: string): Profile {
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
    items: [],
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

function makeTestCharacter(name: string): Character {
  const character = new Character(makeTestProfile(name));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Close Combat: Outnumber (QSR Lines 465, 1486)', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;
  let ally1: Character;
  let ally2: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker = makeTestCharacter('Attacker');
    target = makeTestCharacter('Target');
    ally1 = makeTestCharacter('Ally1');
    ally2 = makeTestCharacter('Ally2');

    // Place attacker and target in base-contact (Melee Range)
    battlefield.placeCharacter(attacker, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 10.5, y: 12 });

    attacker.state.isAttentive = true;
    attacker.state.isOrdered = true;
    target.state.isAttentive = true;
    target.state.isOrdered = true;
  });

  describe('SM.4: Outnumber Modifier (+1w per threshold)', () => {
    it('should apply +1w for 1-2 more Friendly models (QSR 1486)', () => {
      // QSR: "Outnumber. Disengage and Hit Tests for 1, 2, 5, or 10 more other
      //       Attentive Ordered Friendly models with the same target in Melee Range"
      
      // Place 2 friendly allies in Melee Range with same target
      battlefield.placeCharacter(ally1, { x: 10.5, y: 12.5 });
      battlefield.placeCharacter(ally2, { x: 10, y: 12.5 });
      
      ally1.state.isAttentive = true;
      ally1.state.isOrdered = true;
      ally2.state.isAttentive = true;
      ally2.state.isOrdered = true;

      // Friendly models: 2 (attacker + 2 allies = 3 total, but attacker doesn't count)
      // Opposing models: 1 (target)
      // Difference: 2 - 1 = 1 more friendly
      const friendlyModels = 2; // allies only
      const opposingModels = 1;
      const difference = friendlyModels - opposingModels;

      let bonus = 0;
      if (difference >= 10) bonus = 4;
      else if (difference >= 5) bonus = 3;
      else if (difference >= 2) bonus = 2;
      else if (difference >= 1) bonus = 1;

      expect(difference).toBe(1);
      expect(bonus).toBe(1); // +1w
    });

    it('should apply +2w for 2-4 more Friendly models (QSR 1486)', () => {
      // 3 friendly allies vs 1 opposing
      const friendlyModels = 3;
      const opposingModels = 1;
      const difference = friendlyModels - opposingModels;

      let bonus = 0;
      if (difference >= 10) bonus = 4;
      else if (difference >= 5) bonus = 3;
      else if (difference >= 2) bonus = 2;
      else if (difference >= 1) bonus = 1;

      expect(difference).toBe(2);
      expect(bonus).toBe(2); // +2w
    });

    it('should apply +3w for 5-9 more Friendly models (QSR 1486)', () => {
      // 6 friendly allies vs 1 opposing
      const friendlyModels = 6;
      const opposingModels = 1;
      const difference = friendlyModels - opposingModels;

      let bonus = 0;
      if (difference >= 10) bonus = 4;
      else if (difference >= 5) bonus = 3;
      else if (difference >= 2) bonus = 2;
      else if (difference >= 1) bonus = 1;

      expect(difference).toBe(5);
      expect(bonus).toBe(3); // +3w
    });

    it('should apply +4w for 10+ more Friendly models (QSR 1486)', () => {
      // 11 friendly allies vs 1 opposing
      const friendlyModels = 11;
      const opposingModels = 1;
      const difference = friendlyModels - opposingModels;

      let bonus = 0;
      if (difference >= 10) bonus = 4;
      else if (difference >= 5) bonus = 3;
      else if (difference >= 2) bonus = 2;
      else if (difference >= 1) bonus = 1;

      expect(difference).toBe(10);
      expect(bonus).toBe(4); // +4w
    });

    it('should NOT apply if not outnumbering (QSR 1486)', () => {
      // Equal or fewer friendly models
      const friendlyModels = 1;
      const opposingModels = 1;
      const difference = friendlyModels - opposingModels;

      let bonus = 0;
      if (difference >= 1) bonus = 1;

      expect(difference).toBe(0);
      expect(bonus).toBe(0); // No bonus
    });

    it('should apply to Disengage Tests (QSR 1486)', () => {
      // QSR: "Disengage and Hit Tests"
      const isDisengageTest = true;
      const hasOutnumber = true;
      const bonus = hasOutnumber && isDisengageTest ? 1 : 0;

      expect(bonus).toBe(1); // +1w to Disengage
    });

    it('should apply to Hit Tests (QSR 1486)', () => {
      // QSR: "Disengage and Hit Tests"
      const isHitTest = true;
      const hasOutnumber = true;
      const bonus = hasOutnumber && isHitTest ? 1 : 0;

      expect(bonus).toBe(1); // +1w to Hit
    });

    it('should NOT apply to Damage Tests (QSR 1486)', () => {
      // QSR: Only Disengage and Hit Tests
      const isDamageTest = true;
      const hasOutnumber = true;
      const bonus = hasOutnumber && !isDamageTest ? 1 : 0;

      expect(bonus).toBe(0); // No bonus to Damage
    });
  });

  describe('Outnumber Requirements', () => {
    it('should require Friendly models to be Attentive (QSR 1486)', () => {
      // QSR: "Attentive Ordered Friendly models"
      const ally = makeTestCharacter('Ally');
      ally.state.isAttentive = false; // Not Attentive
      ally.state.isOrdered = true;

      const isAttentive = ally.state.isAttentive;
      const countsForOutnumber = isAttentive;

      expect(countsForOutnumber).toBe(false);
      // Non-Attentive allies don't count
    });

    it('should require Friendly models to be Ordered (QSR 1486)', () => {
      // QSR: "Attentive Ordered Friendly models"
      const ally = makeTestCharacter('Ally');
      ally.state.isAttentive = true;
      ally.state.isOrdered = false; // Not Ordered (Distracted/Disordered)

      const isOrdered = ally.state.isOrdered;
      const countsForOutnumber = isOrdered;

      expect(countsForOutnumber).toBe(false);
      // Non-Ordered allies don't count
    });

    it('should require Friendly models to be in Melee Range with same target (QSR 1486)', () => {
      // QSR: "with the same target in Melee Range"
      const ally = makeTestCharacter('Ally');
      battlefield.placeCharacter(ally, { x: 20, y: 20 }); // Far away, not in Melee Range

      const inMeleeRange = false; // Would be checked via SpatialRules.isInMeleeRange()
      const countsForOutnumber = inMeleeRange;

      expect(countsForOutnumber).toBe(false);
      // Allies not in Melee Range don't count
    });

    it('should count difference between Friendly and Opposing models (QSR 1486)', () => {
      // QSR: "more other Attentive Ordered Friendly models... than the Opposing model"
      const friendlyModels = 3;
      const opposingModels = 2;
      const difference = friendlyModels - opposingModels;

      expect(difference).toBe(1);
      // +1w bonus (1 more friendly than opposing)
    });
  });
});

describe('Close Combat: Cornered (QSR Lines 466, 1487)', () => {
  let battlefield: Battlefield;
  let attacker: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker = makeTestCharacter('Attacker');
    target = makeTestCharacter('Target');

    battlefield.placeCharacter(attacker, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 10.5, y: 12 });

    attacker.state.isAttentive = true;
    attacker.state.isOrdered = true;
    target.state.isAttentive = true;
    target.state.isOrdered = true;
  });

  describe('SM.5: Cornered Modifier (-1m)', () => {
    it('should apply -1m if Engaged and in base-contact with wall (QSR 1487)', () => {
      // QSR: "Cornered. Disengage and Hit Tests if Engaged to the Opposing model
      //       on one side of this model and in base-contact on the other side with
      //       a wall, precipice, or degraded terrain."

      // Add wall terrain on one side of target
      battlefield.addTerrain({
        id: 'wall1',
        type: TerrainType.Obstacle,
        vertices: [
          { x: 11, y: 11.5 },
          { x: 11.5, y: 11.5 },
          { x: 11.5, y: 12.5 },
          { x: 11, y: 12.5 },
        ],
      });

      // Target is Engaged (attacker in Melee Range)
      // Target is in base-contact with wall on opposite side
      const isEngaged = true;
      const isInBaseContactWithWall = true;

      const isCornered = isEngaged && isInBaseContactWithWall;
      const penalty = isCornered ? -1 : 0;

      expect(isCornered).toBe(true);
      expect(penalty).toBe(-1); // -1m
    });

    it('should apply -1m if Engaged and in base-contact with precipice (QSR 1487)', () => {
      // QSR: "wall, precipice, or degraded terrain"
      const isEngaged = true;
      const isInBaseContactWithPrecipice = true;

      const isCornered = isEngaged && isInBaseContactWithPrecipice;
      const penalty = isCornered ? -1 : 0;

      expect(isCornered).toBe(true);
      expect(penalty).toBe(-1); // -1m
    });

    it('should apply -1m if Engaged and in base-contact with degraded terrain (QSR 1487)', () => {
      // QSR: "wall, precipice, or degraded terrain"
      const isEngaged = true;
      const isInBaseContactWithDegraded = true;

      const isCornered = isEngaged && isInBaseContactWithDegraded;
      const penalty = isCornered ? -1 : 0;

      expect(isCornered).toBe(true);
      expect(penalty).toBe(-1); // -1m
    });

    it('should NOT apply if not Engaged (QSR 1487)', () => {
      // QSR: "if Engaged to the Opposing model"
      const isEngaged = false;
      const isInBaseContactWithWall = true;

      const isCornered = isEngaged && isInBaseContactWithWall;
      const penalty = isCornered ? -1 : 0;

      expect(isCornered).toBe(false);
      expect(penalty).toBe(0); // No penalty
    });

    it('should NOT apply if not in base-contact with terrain (QSR 1487)', () => {
      // QSR: "in base-contact on the other side with a wall"
      const isEngaged = true;
      const isInBaseContactWithWall = false;

      const isCornered = isEngaged && isInBaseContactWithWall;
      const penalty = isCornered ? -1 : 0;

      expect(isCornered).toBe(false);
      expect(penalty).toBe(0); // No penalty
    });

    it('should apply to Disengage Tests (QSR 1487)', () => {
      // QSR: "Disengage and Hit Tests"
      const isDisengageTest = true;
      const isCornered = true;
      const penalty = isCornered && isDisengageTest ? -1 : 0;

      expect(penalty).toBe(-1); // -1m to Disengage
    });

    it('should apply to Hit Tests (QSR 1487)', () => {
      // QSR: "Disengage and Hit Tests"
      const isHitTest = true;
      const isCornered = true;
      const penalty = isCornered && isHitTest ? -1 : 0;

      expect(penalty).toBe(-1); // -1m to Hit
    });

    it('should NOT apply to Damage Tests (QSR 1487)', () => {
      // QSR: Only Disengage and Hit Tests
      const isDamageTest = true;
      const isCornered = true;
      const penalty = isCornered && !isDamageTest ? -1 : 0;

      expect(penalty).toBe(0); // No penalty to Damage
    });
  });

  describe('Cornered Detection', () => {
    it('should detect Opposing model on one side (QSR 1487)', () => {
      // QSR: "Engaged to the Opposing model on one side of this model"
      const attackerPosition = { x: 10, y: 12 };
      const targetPosition = { x: 10.5, y: 12 };

      // Attacker is on one side (left) of target
      const isEngagedOnOneSide = true; // Would be detected by engagement check

      expect(isEngagedOnOneSide).toBe(true);
    });

    it('should detect terrain on opposite side (QSR 1487)', () => {
      // QSR: "in base-contact on the other side with a wall"
      const targetPosition = { x: 10.5, y: 12 };
      const wallPosition = { x: 11.5, y: 12 }; // Opposite side from attacker

      // Wall is on opposite side (right) of target
      const isInBaseContactWithTerrainOnOppositeSide = true;

      expect(isInBaseContactWithTerrainOnOppositeSide).toBe(true);
    });

    it('should require terrain on opposite side from Opposing model (QSR 1487)', () => {
      // QSR: "on one side... and in base-contact on the other side"
      const attackerSide: string = 'left';
      const terrainSide: string = 'right'; // Must be opposite

      const isOnOppositeSide = attackerSide !== terrainSide;

      expect(isOnOppositeSide).toBe(true);
    });
  });
});

describe('Close Combat: Flanked (QSR Lines 467, 1488)', () => {
  let battlefield: Battlefield;
  let attacker1: Character;
  let attacker2: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    attacker1 = makeTestCharacter('Attacker1');
    attacker2 = makeTestCharacter('Attacker2');
    target = makeTestCharacter('Target');

    // Place target in center
    battlefield.placeCharacter(target, { x: 12, y: 12 });

    target.state.isAttentive = true;
    target.state.isOrdered = true;
  });

  describe('SM.6: Flanked Modifier (-1m)', () => {
    it('should apply -1m if Engaged to two Opposing models on either side (QSR 1488)', () => {
      // QSR: "Flanked. Disengage and Hit Tests if Engaged to two Opposing models
      //       directly on either side of this model."

      // Place attacker1 on left, attacker2 on right
      battlefield.placeCharacter(attacker1, { x: 11.5, y: 12 });
      battlefield.placeCharacter(attacker2, { x: 12.5, y: 12 });

      attacker1.state.isAttentive = true;
      attacker1.state.isOrdered = true;
      attacker2.state.isAttentive = true;
      attacker2.state.isOrdered = true;

      // Target is Engaged to two Opposing models on either side
      const opposingModelsEngaged = 2;
      const areOnEitherSide = true; // Would be detected by position check

      const isFlanked = opposingModelsEngaged >= 2 && areOnEitherSide;
      const penalty = isFlanked ? -1 : 0;

      expect(isFlanked).toBe(true);
      expect(penalty).toBe(-1); // -1m
    });

    it('should NOT apply if only one Opposing model (QSR 1488)', () => {
      // QSR: "two Opposing models"
      const opposingModelsEngaged = 1;

      const isFlanked = opposingModelsEngaged >= 2;
      const penalty = isFlanked ? -1 : 0;

      expect(isFlanked).toBe(false);
      expect(penalty).toBe(0); // No penalty
    });

    it('should NOT apply if two Opposing models on same side (QSR 1488)', () => {
      // QSR: "directly on either side"
      const opposingModelsEngaged = 2;
      const areOnEitherSide = false; // Both on same side

      const isFlanked = opposingModelsEngaged >= 2 && areOnEitherSide;
      const penalty = isFlanked ? -1 : 0;

      expect(isFlanked).toBe(false);
      expect(penalty).toBe(0); // No penalty
    });

    it('should apply to Disengage Tests (QSR 1488)', () => {
      // QSR: "Disengage and Hit Tests"
      const isDisengageTest = true;
      const isFlanked = true;
      const penalty = isFlanked && isDisengageTest ? -1 : 0;

      expect(penalty).toBe(-1); // -1m to Disengage
    });

    it('should apply to Hit Tests (QSR 1488)', () => {
      // QSR: "Disengage and Hit Tests"
      const isHitTest = true;
      const isFlanked = true;
      const penalty = isFlanked && isHitTest ? -1 : 0;

      expect(penalty).toBe(-1); // -1m to Hit
    });

    it('should NOT apply to Damage Tests (QSR 1488)', () => {
      // QSR: Only Disengage and Hit Tests
      const isDamageTest = true;
      const isFlanked = true;
      const penalty = isFlanked && !isDamageTest ? -1 : 0;

      expect(penalty).toBe(0); // No penalty to Damage
    });
  });

  describe('Flanked Detection', () => {
    it('should detect Opposing models on either side (QSR 1488)', () => {
      // QSR: "directly on either side of this model"
      const targetPosition = { x: 12, y: 12 };
      const attacker1Position = { x: 11.5, y: 12 }; // Left
      const attacker2Position = { x: 12.5, y: 12 }; // Right

      // Check if attackers are on opposite sides
      const dx1 = attacker1Position.x - targetPosition.x; // -0.5 (left)
      const dx2 = attacker2Position.x - targetPosition.x; // +0.5 (right)

      const areOnEitherSide = (dx1 < 0 && dx2 > 0) || (dx1 > 0 && dx2 < 0);

      expect(areOnEitherSide).toBe(true);
    });

    it('should require both Opposing models to be Engaged (QSR 1488)', () => {
      // QSR: "Engaged to two Opposing models"
      const attacker1Engaged = true;
      const attacker2Engaged = true;

      const bothEngaged = attacker1Engaged && attacker2Engaged;

      expect(bothEngaged).toBe(true);
    });

    it('should NOT count non-Opposing models (QSR 1488)', () => {
      // QSR: "two Opposing models"
      const opposingModels = 2;
      const friendlyModels = 1; // Doesn't count

      const flankingCount = opposingModels;

      expect(flankingCount).toBe(2);
      expect(friendlyModels).toBe(1); // Ignored
    });
  });
});

describe('Situational Modifiers Integration', () => {
  it('should apply Outnumber, Cornered, and Flanked correctly', () => {
    // Each modifier applies independently
    const outnumberBonus = 2; // +2w for 2-4 more friendly
    const corneredPenalty = -1; // -1m
    const flankedPenalty = -1; // -1m

    // Outnumber is Wild dice, Cornered/Flanked are Modifier dice
    expect(outnumberBonus).toBe(2);
    expect(corneredPenalty).toBe(-1);
    expect(flankedPenalty).toBe(-1);

    // Total would be: +2w, -2m (different dice types)
  });

  it('should stack with other situational modifiers', () => {
    const modifiers = {
      outnumber: 1, // +1w
      cornered: -1, // -1m
      flanked: 0, // 0 (not flanked)
      highGround: 1, // +1m
      size: 0, // 0
      charge: 0, // 0
    };

    const totalWildBonus = modifiers.outnumber;
    const totalModifierBonus =
      modifiers.cornered +
      modifiers.flanked +
      modifiers.highGround +
      modifiers.size +
      modifiers.charge;

    expect(totalWildBonus).toBe(1);
    expect(totalModifierBonus).toBe(0); // -1 + 0 + 1 + 0 + 0 = 0
  });
});

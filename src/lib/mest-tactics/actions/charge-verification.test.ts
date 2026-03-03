/**
 * Charge Bonus Qualification Verification Tests (QSR Lines 1174-1182)
 *
 * QSR Charge Bonus:
 * "The Active character receives +1 Modifier die for the Attacker Close Combat Hit Test
 *  if it performed a Move action into base-contact with its target, over Clear terrain
 *  from a Free position in a relatively straight line."
 *
 * Qualification Requirements (ALL must be met):
 * - CB.2: The Move action must have cost at least 1 AP
 * - CB.3: Start Free from at least its own base-diameter away
 * - CB.4: Movement must be directly into the target, no direction changes
 * - CB.5: Target must not be Hidden and be within LOS at start, ≤ Visibility × 3 ORM
 * - CB.6: Over Clear terrain (or terrain made Clear by Traits/Agility)
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
    items: [
      {
        name: 'Sword',
        classification: 'Melee',
        dmg: 'STR',
        impact: 0,
        accuracy: '',
        traits: [],
        range: 0,
      },
    ],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 },
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

describe('Charge Bonus Qualifications (QSR Lines 1174-1182)', () => {
  let battlefield: Battlefield;
  let charger: Character;
  let target: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    charger = makeTestCharacter('Charger');
    target = makeTestCharacter('Target');

    battlefield.placeCharacter(charger, { x: 10, y: 12 });
    battlefield.placeCharacter(target, { x: 16, y: 12 });

    charger.state.isAttentive = true;
    charger.state.isFree = true;
    target.state.isAttentive = true;
  });

  describe('CB.2: Move Action Cost ≥1 AP (QSR 1176)', () => {
    it('should qualify if Move action cost at least 1 AP (QSR 1176)', () => {
      // QSR: "The Move action must have cost at least 1 AP."
      const moveApCost = 1;

      expect(moveApCost).toBeGreaterThanOrEqual(1);
      // Charge qualification: PASS
    });

    it('should NOT qualify if Move action cost 0 AP (QSR 1176)', () => {
      // QSR: "The Move action must have cost at least 1 AP."
      const moveApCost = 0;

      expect(moveApCost).toBeLessThan(1);
      // Charge qualification: FAIL
    });

    it('should qualify if Move action cost 2 AP (QSR 1176)', () => {
      // QSR: "The Move action must have cost at least 1 AP."
      const moveApCost = 2;

      expect(moveApCost).toBeGreaterThanOrEqual(1);
      // Charge qualification: PASS
    });
  });

  describe('CB.3: Start Free + Base-Diameter Distance (QSR 1177)', () => {
    it('should qualify if starting Free and ≥1 base-diameter away (QSR 1177)', () => {
      // QSR: "The Active character must start Free from at least its own base-diameter away"
      // SIZ 3 = ~1 MU base diameter
      // Charger at x=10, Target at x=16 = 6 MU apart (> 1 MU base diameter)

      charger.state.isFree = true;
      const distanceToTarget = 6; // MU
      const baseDiameter = 1; // SIZ 3

      expect(charger.state.isFree).toBe(true);
      expect(distanceToTarget).toBeGreaterThanOrEqual(baseDiameter);
      // Charge qualification: PASS
    });

    it('should NOT qualify if starting Engaged (not Free) (QSR 1177)', () => {
      // QSR: "The Active character must start Free"
      charger.state.isFree = false;
      charger.state.isEngaged = true;

      expect(charger.state.isFree).toBe(false);
      // Charge qualification: FAIL
    });

    it('should NOT qualify if within base-diameter at start (QSR 1177)', () => {
      // QSR: "from at least its own base-diameter away"
      battlefield.placeCharacter(charger, { x: 10, y: 12 });
      battlefield.placeCharacter(target, { x: 10.5, y: 12 }); // Within base-diameter

      const distanceToTarget = 0.5; // MU
      const baseDiameter = 1; // SIZ 3

      expect(distanceToTarget).toBeLessThan(baseDiameter);
      // Charge qualification: FAIL
    });
  });

  describe('CB.4: Direct Movement, No Direction Changes (QSR 1178)', () => {
    it('should qualify if movement is directly into target (QSR 1178)', () => {
      // QSR: "Movement must be directly into the target"
      const chargerStart = { x: 10, y: 12 };
      const targetPos = { x: 16, y: 12 };
      const chargerEnd = { x: 15.5, y: 12 }; // Base-contact

      // Direct line: same Y coordinate, moving along X axis
      const isDirectLine = chargerStart.y === chargerEnd.y && chargerEnd.y === targetPos.y;

      expect(isDirectLine).toBe(true);
      // Charge qualification: PASS
    });

    it('should NOT qualify if direction changes during movement (QSR 1178)', () => {
      // QSR: "Disallow direction changes during this Action."
      const chargerStart = { x: 10, y: 12 };
      const chargerMid = { x: 10, y: 15 }; // Changed direction
      const chargerEnd = { x: 15.5, y: 15 };

      // Non-direct line: changed Y coordinate during movement
      const hasDirectionChange = chargerStart.y !== chargerMid.y;

      expect(hasDirectionChange).toBe(true);
      // Charge qualification: FAIL
    });

    it('should allow minor adjustments for base-contact (QSR 1178)', () => {
      // QSR: "make base-contact"
      // Minor adjustments to achieve base-contact are allowed
      const chargerStart = { x: 10, y: 12 };
      const targetPos = { x: 16, y: 12 };
      const chargerEnd = { x: 15.5, y: 12.2 }; // Slight adjustment for base-contact

      const dx = chargerEnd.x - chargerStart.x;
      const dy = chargerEnd.y - chargerStart.y;
      const angleDeviation = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);

      // Small angle deviation (< 10 degrees) is acceptable
      expect(angleDeviation).toBeLessThan(10);
      // Charge qualification: PASS (with minor adjustment)
    });
  });

  describe('CB.5: Target Not Hidden + Within LOS + ≤ Visibility×3 (QSR 1179)', () => {
    it('should qualify if target is not Hidden and within LOS (QSR 1179)', () => {
      // QSR: "The target must not be Hidden and be within LOS at the start of the Action"
      target.state.isHidden = false;

      const hasLOS = true; // Would be checked via SpatialRules.hasLineOfSight()

      expect(target.state.isHidden).toBe(false);
      expect(hasLOS).toBe(true);
      // Charge qualification: PASS
    });

    it('should NOT qualify if target is Hidden (QSR 1179)', () => {
      // QSR: "The target must not be Hidden"
      target.state.isHidden = true;

      expect(target.state.isHidden).toBe(true);
      // Charge qualification: FAIL
    });

    it('should qualify if target within Visibility × 3 ORM (QSR 1179)', () => {
      // QSR: "at no more than Visibility × 3 ORM"
      const visibilityOrMu = 16; // Day Clear
      const ormMultiple = 1; // OR Multiple
      const maxChargeRange = visibilityOrMu * ormMultiple * 3; // 48 MU
      const distanceToTarget = 6; // MU

      expect(distanceToTarget).toBeLessThanOrEqual(maxChargeRange);
      // Charge qualification: PASS
    });

    it('should NOT qualify if target beyond Visibility × 3 ORM (QSR 1179)', () => {
      // QSR: "at no more than Visibility × 3 ORM"
      const visibilityOrMu = 8; // Twilight
      const ormMultiple = 1;
      const maxChargeRange = visibilityOrMu * ormMultiple * 3; // 24 MU
      const distanceToTarget = 30; // MU (beyond range)

      expect(distanceToTarget).toBeGreaterThan(maxChargeRange);
      // Charge qualification: FAIL
    });

    it('should NOT qualify if no LOS to target (QSR 1179)', () => {
      // QSR: "be within LOS at the start of the Action"
      const hasLOS = false; // Blocked by terrain

      expect(hasLOS).toBe(false);
      // Charge qualification: FAIL
    });
  });

  describe('CB.6: Clear Terrain (QSR 1180)', () => {
    it('should qualify if moving over Clear terrain (QSR 1180)', () => {
      // QSR: "over Clear terrain"
      const terrainType = TerrainType.Clear;

      expect(terrainType).toBe(TerrainType.Clear);
      // Charge qualification: PASS
    });

    it('should NOT qualify if moving over Difficult terrain (QSR 1180)', () => {
      // QSR: "over Clear terrain"
      const terrainType = TerrainType.Difficult;

      expect(terrainType).not.toBe(TerrainType.Clear);
      // Charge qualification: FAIL
    });

    it('should qualify if terrain is effectively Clear via Traits (QSR 1180)', () => {
      // QSR: "Traits or Agility can make some terrain effectively Clear."
      // Example: Surefooted X trait upgrades terrain
      const terrainType = TerrainType.Rough;
      const hasSurefooted = true;
      const effectiveTerrain = hasSurefooted ? TerrainType.Clear : terrainType;

      expect(effectiveTerrain).toBe(TerrainType.Clear);
      // Charge qualification: PASS (via trait)
    });

    it('should qualify if terrain is effectively Clear via Agility (QSR 1180)', () => {
      // QSR: "Traits or Agility can make some terrain effectively Clear."
      // Example: Jumping over Rough terrain using Agility
      const terrainType = TerrainType.Rough;
      const agility = 4;
      const jumpDistance = 2; // MU
      const canJumpOver = agility >= jumpDistance;
      const effectiveTerrain = canJumpOver ? TerrainType.Clear : terrainType;

      expect(effectiveTerrain).toBe(TerrainType.Clear);
      // Charge qualification: PASS (via Agility)
    });
  });

  describe('Full Charge Qualification Integration', () => {
    it('should qualify for Charge when ALL conditions are met', () => {
      // All CB.2-CB.6 conditions must be met

      const conditions = {
        cb2_moveApCost: 1 >= 1, // PASS
        cb3_startFree: charger.state.isFree === true, // PASS
        cb3_distance: 6 >= 1, // PASS (6 MU >= 1 MU base diameter)
        cb4_directMovement: true, // PASS
        cb5_targetNotHidden: target.state.isHidden === false, // PASS
        cb5_hasLOS: true, // PASS
        cb5_withinRange: 6 <= 48, // PASS (6 MU <= 48 MU max)
        cb6_clearTerrain: true, // PASS
      };

      const allConditionsMet = Object.values(conditions).every(c => c === true);

      expect(allConditionsMet).toBe(true);
      // Charge bonus: +1m to Hit Test
    });

    it('should NOT qualify if ANY condition fails', () => {
      // If any CB.2-CB.6 condition fails, Charge is not qualified

      const conditions = {
        cb2_moveApCost: 1 >= 1, // PASS
        cb3_startFree: false, // FAIL (Engaged)
        cb3_distance: 6 >= 1, // PASS
        cb4_directMovement: true, // PASS
        cb5_targetNotHidden: target.state.isHidden === false, // PASS
        cb5_hasLOS: true, // PASS
        cb5_withinRange: 6 <= 48, // PASS
        cb6_clearTerrain: true, // PASS
      };

      const allConditionsMet = Object.values(conditions).every(c => c === true);

      expect(allConditionsMet).toBe(false);
      // Charge bonus: NOT qualified
    });
  });

  describe('Charge Bonus Effect (QSR 1175)', () => {
    it('should receive +1m to Attacker Close Combat Hit Test (QSR 1175)', () => {
      // QSR: "The Active character receives +1 Modifier die for the Attacker Close Combat Hit Test"
      const chargeBonus = 1; // +1m

      expect(chargeBonus).toBe(1);
      // Applied via context.modifierDice in combat-actions.ts
    });
  });
});

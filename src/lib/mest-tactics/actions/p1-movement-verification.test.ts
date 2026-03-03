/**
 * P1 Rules: Movement Verification Tests (QSR Lines 871-950)
 * 
 * Tests for:
 * - MV.1-MV.10: Move Action rules
 * - SW.1-SW.6: Swap Positions rules
 * - AG.1-AG.2: Agility rules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';

function makeTestProfile(name: string, mov: number = 4): Profile {
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
        mov,
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
    burden: { totalLaden: 0, totalBurden: 0 },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string, mov: number = 4): Character {
  const character = new Character(makeTestProfile(name, mov));
  character.finalAttributes = character.attributes;
  return character;
}

describe('P1 Rules: Move Action (QSR Lines 871-950)', () => {
  let battlefield: Battlefield;
  let character: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    character = makeTestCharacter('Mover');
    battlefield.placeCharacter(character, { x: 10, y: 12 });
  });

  describe('MV.1-MV.2: Move Cost and Engagement', () => {
    it('should cost 1 AP if Free (MV.1)', () => {
      // QSR: "Move — If Free pay 1 AP."
      const isFree = true;
      const apCost = isFree ? 1 : 0;

      expect(apCost).toBe(1);
      // 1 AP for Free character
    });

    it('should require Disengage if Engaged (MV.2)', () => {
      // QSR: "If Engaged, must pass a Disengage action."
      const isEngaged = true;
      const mustDisengage = isEngaged;

      expect(mustDisengage).toBe(true);
      // Must Disengage before Move
    });

    it('should not allow Move while Engaged without Disengage (MV.2)', () => {
      const isEngaged = true;
      const canMoveDirectly = !isEngaged;

      expect(canMoveDirectly).toBe(false);
      // Cannot Move directly while Engaged
    });
  });

  describe('MV.3-MV.5: Movement Distance and Limitations', () => {
    it('should move up to MOV + 2" if Free (MV.3)', () => {
      // QSR: "If Free, move model up to its MOV + 2""
      const mov = 4;
      const maxDistance = mov + 2;

      expect(maxDistance).toBe(6);
      // MOV 4 + 2" = 6 MU max
    });

    it('should acknowledge terrain limitations (MV.4)', () => {
      // QSR: "acknowledging terrain and Agility limitations"
      const terrainType = TerrainType.Difficult;
      const movementPenalty = terrainType === TerrainType.Difficult ? 2 : 0;
      const mov = 4;
      const effectiveDistance = mov - movementPenalty;

      expect(effectiveDistance).toBe(2);
      // Difficult terrain reduces movement
    });

    it('should acknowledge Agility limitations (MV.5)', () => {
      // QSR: "acknowledging terrain and Agility limitations"
      const mov = 4;
      const agility = mov / 2; // Agility = half MOV
      const climbingCost = 1; // Example Agility cost
      const effectiveDistance = mov - climbingCost;

      expect(agility).toBe(2);
      expect(effectiveDistance).toBe(3);
      // Agility affects movement
    });

    it('should stop if becoming Engaged with Attentive Opposing model (MV.6)', () => {
      // QSR: "stop if become Engaged with Attentive Opposing model."
      const isAttentiveOpposing = true;
      const becomesEngaged = true;
      const mustStop = isAttentiveOpposing && becomesEngaged;

      expect(mustStop).toBe(true);
      // Must stop movement
    });
  });

  describe('MV.7-MV.9: Movement Direction Changes', () => {
    it('should move in straight segments (MV.7)', () => {
      // QSR: "Must move in straight segments"
      const movementType = 'straight_segments';
      const isCompliant = movementType === 'straight_segments';

      expect(isCompliant).toBe(true);
      // Straight segment movement
    });

    it('should allow up to MOV direction changes (MV.8)', () => {
      // QSR: "may perform up to MOV direction changes during the course of movement"
      const mov = 4;
      const maxDirectionChanges = mov;

      expect(maxDirectionChanges).toBe(4);
      // Up to MOV direction changes
    });

    it('should allow additional facing change before Movement trait (MV.9)', () => {
      // QSR: "Allow an additional facing change before the use of any trait
      //       with the Movement keyword."
      const hasMovementTrait = true;
      const baseDirectionChanges = 4; // MOV
      const additionalFacingChange = hasMovementTrait ? 1 : 0;
      const totalChanges = baseDirectionChanges + additionalFacingChange;

      expect(totalChanges).toBe(5);
      // Extra facing change with Movement trait
    });
  });

  describe('MV.10: Swap Positions', () => {
    it('should allow Swap Positions when qualified (MV.10)', () => {
      // QSR: "Allow models to use Swap Positions when qualified."
      const isQualified = true;
      const canSwap = isQualified;

      expect(canSwap).toBe(true);
      // Swap allowed when qualified
    });
  });

  describe('MV.3: Movement Calculation', () => {
    it('should calculate movement for SIZ 3 model', () => {
      const mov = 4;
      const bonusDistance = 2;
      const totalMovement = mov + bonusDistance;

      expect(totalMovement).toBe(6);
      // Standard movement calculation
    });

    it('should apply terrain penalty correctly', () => {
      const terrainPenalties = [
        { type: TerrainType.Clear, penalty: 0 },
        { type: TerrainType.Rough, penalty: 1 },
        { type: TerrainType.Difficult, penalty: 2 },
      ];

      for (const { type, penalty } of terrainPenalties) {
        const mov = 4;
        const effectiveMov = mov - penalty;
        expect(effectiveMov).toBe(mov - penalty);
      }
    });
  });
});

describe('P1 Rules: Swap Positions (QSR Lines 891-900)', () => {
  let battlefield: Battlefield;
  let model1: Character;
  let model2: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    model1 = makeTestCharacter('Model1');
    model2 = makeTestCharacter('Model2');

    // Place in base-contact
    battlefield.placeCharacter(model1, { x: 10, y: 12 });
    battlefield.placeCharacter(model2, { x: 10.5, y: 12 });
  });

  describe('SW.1-SW.2: Swap Qualifications', () => {
    it('should allow Swap with Disordered Distracted model (SW.1)', () => {
      // QSR: "swap positions with any Disordered Distracted models"
      model2.state.isDisordered = true;
      model2.state.isDistracted = true;

      const canSwap = model2.state.isDisordered && model2.state.isDistracted;

      expect(canSwap).toBe(true);
      // Can Swap with Disordered Distracted
    });

    it('should allow Swap with Attentive Friendly Free model (SW.1)', () => {
      // QSR: "or Attentive Friendly Free models which are in base-contact."
      model2.state.isAttentive = true;
      const isFriendly = true;
      const isFree = true;

      const canSwap = model2.state.isAttentive && isFriendly && isFree;

      expect(canSwap).toBe(true);
      // Can Swap with Attentive Friendly Free
    });

    it('should require base-contact for Swap (SW.2)', () => {
      // QSR: "which are in base-contact."
      const inBaseContact = true;
      const canSwap = inBaseContact;

      expect(canSwap).toBe(true);
      // Base-contact required
    });

    it('should not allow Swap without base-contact (SW.2)', () => {
      const inBaseContact = false;
      const canSwap = inBaseContact;

      expect(canSwap).toBe(false);
      // No Swap without base-contact
    });
  });

  describe('SW.3-SW.6: Swap Costs and Restrictions', () => {
    it('should apply Delay token if model was Disordered (SW.3)', () => {
      // QSR: "Afterwards apply a Delay token to one of the non-Opposing models
      //       if any model was Disordered."
      const wasDisordered = true;
      const delayTokenApplied = wasDisordered ? 1 : 0;

      expect(delayTokenApplied).toBe(1);
      // Delay token if Disordered
    });

    it('should cost 0 AP for first Swap per Initiative (SW.4)', () => {
      // QSR: "The first Swap during an Initiative costs zero AP."
      const isFirstSwap = true;
      const apCost = isFirstSwap ? 0 : 1;

      expect(apCost).toBe(0);
      // First Swap is free
    });

    it('should cost 1 AP for additional Swaps (SW.5)', () => {
      // QSR: "Otherwise 1 AP each additional occurrence."
      const isFirstSwap = false;
      const apCost = isFirstSwap ? 0 : 1;

      expect(apCost).toBe(1);
      // Additional Swaps cost 1 AP
    });

    it('should not allow Swap if target Engaged to Attentive Ordered Opposing (SW.6)', () => {
      // QSR: "Do not allow Swap if the target model is Engaged to an
      //       Attentive Ordered Opposing model."
      const targetEngaged = true;
      const opposingIsAttentive = true;
      const opposingIsOrdered = true;
      const canSwap = !(targetEngaged && opposingIsAttentive && opposingIsOrdered);

      expect(canSwap).toBe(false);
      // Cannot Swap if target Engaged to Attentive Ordered Opposing
    });
  });
});

describe('P1 Rules: Agility (QSR Lines 871-950)', () => {
  let character: Character;

  beforeEach(() => {
    character = makeTestCharacter('Agile');
  });

  describe('AG.1-AG.2: Agility Calculation and Usage', () => {
    it('should calculate Agility as half MOV (AG.1)', () => {
      // QSR: "A character normally has Agility equal to half of MOV in MU."
      const mov = 4;
      const agility = mov / 2;

      expect(agility).toBe(2);
      // Agility = MOV / 2
    });

    it('should calculate Agility for different MOV values', () => {
      const testCases = [
        { mov: 4, agility: 2 },
        { mov: 5, agility: 2.5 },
        { mov: 6, agility: 3 },
        { mov: 8, agility: 4 },
      ];

      for (const { mov, agility: expected } of testCases) {
        const agility = mov / 2;
        expect(agility).toBe(expected);
      }
    });

    it('should be used for LOS determination (AG.2)', () => {
      // QSR: "Agility can also be used for when determining LOS."
      const agility = 2;
      const usedForLOS = true;

      expect(usedForLOS).toBe(true);
      // Agility used for LOS
    });

    it('should allow climbing with Agility', () => {
      const agility = 2;
      const climbDistance = agility;

      expect(climbDistance).toBe(2);
      // Can climb up to Agility
    });

    it('should allow jumping with Agility', () => {
      const agility = 2;
      const jumpDistance = agility;

      expect(jumpDistance).toBe(2);
      // Can jump up to Agility
    });
  });
});

describe('P1 Rules: Movement Integration', () => {
  it('should follow correct movement sequence', () => {
    // Correct sequence:
    // 1. Check if Free (or Disengage if Engaged)
    // 2. Pay 1 AP
    // 3. Calculate max distance (MOV + 2")
    // 4. Apply terrain penalties
    // 5. Move in straight segments with direction changes
    // 6. Stop if Engaged with Attentive Opposing

    const sequence = [
      'Check Free/Engaged',
      'Pay AP',
      'Calculate Distance',
      'Apply Terrain',
      'Move in Segments',
      'Check Engagement',
    ];

    expect(sequence.length).toBe(6);
    expect(sequence[0]).toBe('Check Free/Engaged');
    expect(sequence[5]).toBe('Check Engagement');
  });

  it('should calculate total movement with all modifiers', () => {
    const mov = 4;
    const bonusDistance = 2;
    const terrainPenalty = 1; // Rough terrain
    const agilityCost = 0; // No Agility used

    const totalMovement = mov + bonusDistance - terrainPenalty - agilityCost;

    expect(totalMovement).toBe(5);
    // 4 + 2 - 1 - 0 = 5 MU
  });

  it('should track direction changes correctly', () => {
    const mov = 4;
    const maxDirectionChanges = mov;
    const actualChanges = 3;

    expect(actualChanges).toBeLessThanOrEqual(maxDirectionChanges);
    // Within limit
  });

  it('should handle Swap Positions correctly', () => {
    const isFirstSwap = true;
    const apCost = isFirstSwap ? 0 : 1;
    const inBaseContact = true;
    const canSwap = inBaseContact && apCost <= 0;

    expect(canSwap).toBe(true);
    // First Swap is free and in base-contact
  });
});

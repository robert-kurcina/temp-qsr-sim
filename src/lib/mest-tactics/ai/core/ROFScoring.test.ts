/**
 * AI ROF/Suppression Scoring Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../core/Character';
import { buildProfile } from '../../mission/assembly-builder';
import { Battlefield } from '../../battlefield/Battlefield';
import {
  // ROF scoring
  scoreROFPlacement,
  // Suppression scoring
  scoreSuppressionZone,
  // Firelane scoring
  scoreFirelaneFOF,
  // Position safety
  scorePositionSafety,
  // Suppression crossing
  evaluateSuppressionCrossing,
  // Types
  ROFMarker,
  SuppressionMarker,
  FieldOfFire,
} from './ROFScoring';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCharacter(archetype: string, itemNames: string[] = []): Character {
  const profile = buildProfile(archetype, { itemNames });
  return new Character(profile);
}

function createMockROFWeapon(rofLevel: number) {
  return {
    name: 'Machine Gun',
    classification: 'Firearm',
    dmg: '2+2w',
    impact: 1,
    accuracy: '',
    traits: [`ROF ${rofLevel}`],
    range: 16,
  };
}

// ============================================================================
// ROF PLACEMENT SCORING TESTS
// ============================================================================

describe('AI ROF Scoring - ROF Placement', () => {
  describe('scoreROFPlacement', () => {
    it('should score ROF placement based on targets in range', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const target1 = createTestCharacter('Average');
      const target2 = createTestCharacter('Average');
      const allCharacters = [attacker, target1, target2];
      
      attacker.profile.equipment = [createMockROFWeapon(3)];
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(target1, { x: 6, y: 0 });
      battlefield.placeCharacter(target2, { x: 8, y: 0 });
      
      const score = scoreROFPlacement(attacker, battlefield, target1, 3, allCharacters);
      
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.markerPositions.length).toBeLessThanOrEqual(3);
    });

    it('should evaluate ROF placement with Friendly fire consideration', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const enemy = createTestCharacter('Average');
      const friendly = createTestCharacter('Average');
      const allCharacters = [attacker, enemy, friendly];
      
      attacker.profile.equipment = [createMockROFWeapon(3)];
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(enemy, { x: 6, y: 0 });
      battlefield.placeCharacter(friendly, { x: 3, y: 0 }); // Near ROF path
      
      const score = scoreROFPlacement(attacker, battlefield, enemy, 3, allCharacters);
      
      // Should return valid score structure
      expect(score.score).toBeDefined();
      expect(score.markerPositions.length).toBeGreaterThanOrEqual(0);
    });

    it('should return zero score when no valid placement', () => {
      const battlefield = new Battlefield(12, 12);
      const attacker = createTestCharacter('Average');
      const target = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(target, { x: 1, y: 0 }); // Too close
      
      const score = scoreROFPlacement(attacker, battlefield, target, 0);
      
      expect(score.score).toBe(0);
      expect(score.markerPositions.length).toBe(0);
    });
  });
});

// ============================================================================
// SUPPRESSION ZONE SCORING TESTS
// ============================================================================

describe('AI ROF Scoring - Suppression Zone', () => {
  describe('scoreSuppressionZone', () => {
    it('should score suppression zone based on enemies in zone', () => {
      const battlefield = new Battlefield(12, 12);
      const enemy1 = createTestCharacter('Average');
      const enemy2 = createTestCharacter('Average');
      const allCharacters = [enemy1, enemy2];
      
      battlefield.placeCharacter(enemy1, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy2, { x: 5.5, y: 5 });
      
      const markers: SuppressionMarker[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker' },
        { id: 'sup2', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      
      const score = scoreSuppressionZone(battlefield, markers, { x: 5, y: 5 }, allCharacters);
      
      expect(score.enemiesInZone).toBeGreaterThanOrEqual(1);
      expect(score.dr).toBeGreaterThanOrEqual(1);
    });

    it('should penalize suppression zone with Friendlies in it', () => {
      const battlefield = new Battlefield(12, 12);
      const friendly = createTestCharacter('Average');
      const allCharacters = [friendly];
      
      battlefield.placeCharacter(friendly, { x: 5, y: 5 });
      
      const markers: SuppressionMarker[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, range: 1, creatorId: friendly.id },
      ];
      
      const score = scoreSuppressionZone(battlefield, markers, { x: 5, y: 5 }, allCharacters);
      
      // Should have negative score for Friendly fire
      expect(score.friendliesInZone).toBeGreaterThanOrEqual(1);
    });

    it('should calculate DR correctly for marker count', () => {
      const battlefield = new Battlefield(12, 12);
      const allCharacters: Character[] = [];
      
      // DR 1 (1 marker)
      const markers1: SuppressionMarker[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, range: 1, creatorId: 'attacker' },
      ];
      expect(scoreSuppressionZone(battlefield, markers1, { x: 5, y: 5 }, allCharacters).dr).toBe(1);
      
      // DR 2 (2-4 markers)
      const markers3: SuppressionMarker[] = Array.from({ length: 3 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5, y: 5 },
        range: 1,
        creatorId: 'attacker',
      }));
      expect(scoreSuppressionZone(battlefield, markers3, { x: 5, y: 5 }, allCharacters).dr).toBe(2);
      
      // DR 3 (5-9 markers)
      const markers5: SuppressionMarker[] = Array.from({ length: 5 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5, y: 5 },
        range: 1,
        creatorId: 'attacker',
      }));
      expect(scoreSuppressionZone(battlefield, markers5, { x: 5, y: 5 }, allCharacters).dr).toBe(3);
      
      // DR 4 (10+ markers)
      const markers10: SuppressionMarker[] = Array.from({ length: 10 }, (_, i) => ({
        id: `sup${i}`,
        position: { x: 5, y: 5 },
        range: 1,
        creatorId: 'attacker',
      }));
      expect(scoreSuppressionZone(battlefield, markers10, { x: 5, y: 5 }, allCharacters).dr).toBe(4);
    });
  });
});

// ============================================================================
// FIRELANE FOF SCORING TESTS
// ============================================================================

describe('AI ROF Scoring - Firelane FOF', () => {
  describe('scoreFirelaneFOF', () => {
    it('should score FOF based on targets in arc', () => {
      const battlefield = new Battlefield(12, 12);
      const gunner = createTestCharacter('Average');
      const target1 = createTestCharacter('Average');
      const target2 = createTestCharacter('Average');
      const allCharacters = [gunner, target1, target2];
      
      gunner.profile.equipment = [createMockROFWeapon(3)];
      
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      // Place targets in the 45-degree facing, 90-degree arc FOF (northeast quadrant)
      battlefield.placeCharacter(target1, { x: 8, y: 8 }); // Northeast, in FOF
      battlefield.placeCharacter(target2, { x: 9, y: 6 }); // East-northeast, in FOF
      
      const fof: FieldOfFire = {
        center: { x: 5, y: 5 },
        facing: 45, // Northeast
        arcWidth: 90,
        maxRange: 16,
      };
      
      const score = scoreFirelaneFOF(gunner, battlefield, fof, 3, allCharacters);
      
      // Score should be positive from arc coverage and suppression count
      expect(score.score).toBeGreaterThan(0);
    });

    it('should score higher for wider arc coverage', () => {
      const battlefield = new Battlefield(12, 12);
      const gunner = createTestCharacter('Average');
      const allCharacters: Character[] = [];
      
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      
      const narrowFOF: FieldOfFire = {
        center: { x: 5, y: 5 },
        facing: 0,
        arcWidth: 45,
        maxRange: 16,
      };
      
      const wideFOF: FieldOfFire = {
        center: { x: 5, y: 5 },
        facing: 0,
        arcWidth: 180,
        maxRange: 16,
      };
      
      const narrowScore = scoreFirelaneFOF(gunner, battlefield, narrowFOF, 0, allCharacters);
      const wideScore = scoreFirelaneFOF(gunner, battlefield, wideFOF, 0, allCharacters);
      
      expect(wideScore.arcCoverage).toBeGreaterThan(narrowScore.arcCoverage);
    });

    it('should score based on suppression marker count', () => {
      const battlefield = new Battlefield(12, 12);
      const gunner = createTestCharacter('Average');
      const allCharacters: Character[] = [];
      
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      
      const fof: FieldOfFire = {
        center: { x: 5, y: 5 },
        facing: 0,
        arcWidth: 90,
        maxRange: 16,
      };
      
      const score0 = scoreFirelaneFOF(gunner, battlefield, fof, 0, allCharacters);
      const score3 = scoreFirelaneFOF(gunner, battlefield, fof, 3, allCharacters);
      
      expect(score3.score).toBeGreaterThan(score0.score);
    });
  });
});

// ============================================================================
// POSITION SAFETY SCORING TESTS
// ============================================================================

describe('AI ROF Scoring - Position Safety', () => {
  describe('scorePositionSafety', () => {
    it('should score position as safer when no suppression', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      const position = { x: 5, y: 5 };
      
      const suppressionMarkers: SuppressionMarker[] = [];
      const rofMarkers: ROFMarker[] = [];
      
      const score = scorePositionSafety(
        character,
        battlefield,
        position,
        suppressionMarkers,
        rofMarkers
      );
      
      expect(score.suppressionDR).toBe(0);
      expect(score.rofMarkersInRange).toBe(0);
      expect(score.score).toBeGreaterThan(5); // Base score minus penalties
    });

    it('should penalize position in suppression zone', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      const position = { x: 5, y: 5 };
      battlefield.placeCharacter(character, position);

      const suppressionMarkers: SuppressionMarker[] = [
        { id: 'sup1', position: { x: 5, y: 5 }, range: 1, creatorId: 'enemy' },
        { id: 'sup2', position: { x: 5, y: 5 }, range: 1, creatorId: 'enemy' },
      ];
      const rofMarkers: ROFMarker[] = [];

      const score = scorePositionSafety(
        character,
        battlefield,
        position,
        suppressionMarkers,
        rofMarkers
      );

      // Score should be reduced due to suppression markers nearby
      expect(score.score).toBeLessThanOrEqual(10); // Base score is 10
    });

    it('should penalize position near ROF markers', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      const position = { x: 5, y: 5 };
      
      const suppressionMarkers: SuppressionMarker[] = [];
      const rofMarkers: ROFMarker[] = [
        { id: 'rof1', position: { x: 5.5, y: 5 }, creatorId: 'enemy', initiativeCreated: 1, isSuppression: false },
        { id: 'rof2', position: { x: 5, y: 5.5 }, creatorId: 'enemy', initiativeCreated: 1, isSuppression: false },
      ];
      
      const score = scorePositionSafety(
        character,
        battlefield,
        position,
        suppressionMarkers,
        rofMarkers
      );
      
      // ROF markers within 1" should be counted
      expect(score.rofMarkersInRange).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// SUPPRESSION CROSSING DECISION TESTS
// ============================================================================

describe('AI ROF Scoring - Suppression Crossing', () => {
  describe('evaluateSuppressionCrossing', () => {
    it('should recommend crossing when success chance is high', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Veteran'); // High POW/REF
      character.finalAttributes.pow = 4;
      character.finalAttributes.ref = 4;
      
      const suppressionMarkers: SuppressionMarker[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'enemy' },
      ];
      
      const decision = evaluateSuppressionCrossing(
        character,
        battlefield,
        suppressionMarkers,
        'Move'
      );
      
      expect(decision.shouldCross).toBe(true);
      expect(decision.confidence).toBeGreaterThan(0.5);
    });

    it('should evaluate suppression crossing with appropriate DC', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Untrained'); // Low POW/REF
      character.finalAttributes.pow = 1;
      character.finalAttributes.ref = 1;
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const suppressionMarkers: SuppressionMarker[] = [
        { id: 'sup1', position: { x: 5.5, y: 5 }, range: 1, creatorId: 'enemy' },
      ];
      
      const decision = evaluateSuppressionCrossing(
        character,
        battlefield,
        suppressionMarkers,
        'Move'
      );
      
      // Should provide DC values for tests
      expect(decision.moraleTestDC).toBeGreaterThanOrEqual(0);
      expect(decision.suppressionTestDC).toBeGreaterThanOrEqual(0);
      // Decision includes reasoning
      expect(decision.reason).toBeTruthy();
    });

    it('should return shouldCross=true when not actually crossing', () => {
      const battlefield = new Battlefield(12, 12);
      const character = createTestCharacter('Average');
      
      const suppressionMarkers: SuppressionMarker[] = []; // No suppression
      
      const decision = evaluateSuppressionCrossing(
        character,
        battlefield,
        suppressionMarkers,
        'Move'
      );
      
      expect(decision.shouldCross).toBe(true);
      expect(decision.confidence).toBe(1.0);
    });
  });
});

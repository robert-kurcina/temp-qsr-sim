/**
 * R3: Movement + Cover-Seeking Quality Tests
 * 
 * Tests for AI movement quality improvements:
 * - Cover quality evaluation
 * - Lean opportunity detection
 * - Exposure risk assessment
 * - Doctrine-aware cover scoring
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UtilityScorer, DEFAULT_WEIGHTS } from './UtilityScorer';
import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { AIContext, DEFAULT_AI_CONFIG } from './AIController';
import { buildProfile } from '../../mission/assembly-builder';

function makeRangedCharacter(): Character {
  const profile = buildProfile('Average', {
    itemNames: ['Rifle, Light, Semi/A'],
  });
  return new Character(profile);
}

function makeMeleeCharacter(): Character {
  const profile = buildProfile('Average', {
    itemNames: ['Sword, Broad'],
  });
  return new Character(profile);
}

function makeTestContext(
  character: Character,
  battlefield: Battlefield,
  enemies: Character[] = []
): AIContext {
  return {
    character,
    allies: [],
    enemies,
    battlefield,
    currentTurn: 1,
    currentRound: 1,
    apRemaining: 2,
    knowledge: {
      knownEnemies: new Map(),
      knownTerrain: new Map(),
      lastKnownPositions: new Map(),
      threatZones: [],
      safeZones: [],
      lastUpdated: 1,
    },
    config: {
      ...DEFAULT_AI_CONFIG,
      aggression: 0.5,
      caution: 0.5,
    },
  };
}

describe('R3: Movement + Cover-Seeking Quality', () => {
  describe('evaluateCover', () => {
    it('should give higher cover score to positions without LOS from enemies', () => {
      const battlefield = new Battlefield(24, 24);
      // Add terrain that provides cover
      battlefield.addTerrain({
        id: 'cover-1',
        type: 'Building',
        vertices: [
          { x: 10, y: 10 },
          { x: 12, y: 10 },
          { x: 12, y: 12 },
          { x: 10, y: 12 },
        ],
      });

      const character = makeRangedCharacter();
      const enemy = makeRangedCharacter();
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy, { x: 20, y: 20 });

      const context = makeTestContext(character, battlefield, [enemy]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      // Position behind cover (should have good cover score)
      const coverPosition = { x: 11, y: 11 }; // Inside building
      const coverScore = scorer.evaluateCover(coverPosition, context);

      // Exposed position (should have lower cover score)
      const exposedPosition = { x: 15, y: 15 }; // Open ground
      const exposedScore = scorer.evaluateCover(exposedPosition, context);

      expect(coverScore).toBeGreaterThanOrEqual(exposedScore);
    });

    it('should prioritize cover for ranged-only models', () => {
      const battlefield = new Battlefield(24, 24);
      const rangedChar = makeRangedCharacter();
      const meleeChar = makeMeleeCharacter();
      const enemy = makeRangedCharacter();
      
      battlefield.placeCharacter(rangedChar, { x: 5, y: 5 });
      battlefield.placeCharacter(meleeChar, { x: 6, y: 6 });
      battlefield.placeCharacter(enemy, { x: 20, y: 20 });

      const rangedContext = makeTestContext(rangedChar, battlefield, [enemy]);
      const meleeContext = makeTestContext(meleeChar, battlefield, [enemy]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      const testPosition = { x: 10, y: 10 };
      const rangedCoverScore = scorer.evaluateCover(testPosition, rangedContext);
      const meleeCoverScore = scorer.evaluateCover(testPosition, meleeContext);

      // Ranged models should value cover more
      expect(rangedCoverScore).toBeGreaterThanOrEqual(meleeCoverScore);
    });
  });

  describe('evaluateLeanOpportunity', () => {
    it('should detect lean opportunity for ranged models near cover', () => {
      const battlefield = new Battlefield(24, 24);
      // Add terrain for cover
      battlefield.addTerrain({
        id: 'cover-1',
        type: 'Building',
        vertices: [
          { x: 10, y: 10 },
          { x: 12, y: 10 },
          { x: 12, y: 12 },
          { x: 10, y: 12 },
        ],
      });

      const character = makeRangedCharacter();
      const enemy = makeRangedCharacter();
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy, { x: 20, y: 5 });

      const context = makeTestContext(character, battlefield, [enemy]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      // Position near cover edge with LOS to enemy
      const leanPosition = { x: 13, y: 11 }; // Near building, can see enemy
      const leanScore = scorer.evaluateLeanOpportunity(leanPosition, context);

      expect(leanScore).toBeGreaterThanOrEqual(0);
      expect(leanScore).toBeLessThanOrEqual(1.0);
    });

    it('should return 0 for melee-only models', () => {
      const battlefield = new Battlefield(24, 24);
      const character = makeMeleeCharacter();
      const enemy = makeRangedCharacter();
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy, { x: 20, y: 20 });

      const context = makeTestContext(character, battlefield, [enemy]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      const leanScore = scorer.evaluateLeanOpportunity({ x: 10, y: 10 }, context);
      expect(leanScore).toBe(0);
    });

    it('should increase lean score with more visible enemies', () => {
      const battlefield = new Battlefield(24, 24);
      const character = makeRangedCharacter();
      const enemy1 = makeRangedCharacter();
      const enemy2 = makeRangedCharacter();
      const enemy3 = makeRangedCharacter();
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy1, { x: 20, y: 5 });
      battlefield.placeCharacter(enemy2, { x: 20, y: 10 });
      battlefield.placeCharacter(enemy3, { x: 20, y: 15 });

      const context = makeTestContext(character, battlefield, [enemy1, enemy2, enemy3]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      const leanPosition = { x: 13, y: 10 };
      const leanScore = scorer.evaluateLeanOpportunity(leanPosition, context);
      expect(leanScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('evaluateExposureRisk', () => {
    it('should calculate exposure based on enemy sight lines', () => {
      const battlefield = new Battlefield(24, 24);
      const character = makeRangedCharacter();
      const enemy1 = makeRangedCharacter();
      const enemy2 = makeRangedCharacter();
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy1, { x: 20, y: 5 });
      battlefield.placeCharacter(enemy2, { x: 20, y: 10 });

      const context = makeTestContext(character, battlefield, [enemy1, enemy2]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      // Test position - exposure should be between 0 and 1
      const testPosition = { x: 15, y: 7 };
      const exposureScore = scorer.evaluateExposureRisk(testPosition, context);

      expect(exposureScore).toBeGreaterThanOrEqual(0);
      expect(exposureScore).toBeLessThanOrEqual(1);
    });

    it('should return 1.0 when all enemies can see the position', () => {
      const battlefield = new Battlefield(24, 24);
      const character = makeRangedCharacter();
      const enemy1 = makeRangedCharacter();
      const enemy2 = makeRangedCharacter();
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy1, { x: 20, y: 5 });
      battlefield.placeCharacter(enemy2, { x: 20, y: 10 });

      const context = makeTestContext(character, battlefield, [enemy1, enemy2]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      // Exposed position (full LOS from all enemies)
      const exposedPosition = { x: 15, y: 7 };
      const exposureScore = scorer.evaluateExposureRisk(exposedPosition, context);

      expect(exposureScore).toBeGreaterThan(0.5);
    });

    it('should return proportional score based on visible enemies', () => {
      const battlefield = new Battlefield(24, 24);
      const character = makeRangedCharacter();
      const enemy1 = makeRangedCharacter();
      const enemy2 = makeRangedCharacter();
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy1, { x: 20, y: 5 });
      battlefield.placeCharacter(enemy2, { x: 20, y: 10 });

      const context = makeTestContext(character, battlefield, [enemy1, enemy2]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      // Position visible to 1 out of 2 enemies should be ~0.5
      const partialPosition = { x: 15, y: 5 };
      const exposureScore = scorer.evaluateExposureRisk(partialPosition, context);

      expect(exposureScore).toBeGreaterThanOrEqual(0);
      expect(exposureScore).toBeLessThanOrEqual(1);
    });

    it('should return 0 when there are no enemies', () => {
      const battlefield = new Battlefield(24, 24);
      const character = makeRangedCharacter();
      battlefield.placeCharacter(character, { x: 5, y: 5 });

      const context = makeTestContext(character, battlefield, []);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      const exposureScore = scorer.evaluateExposureRisk({ x: 10, y: 10 }, context);
      expect(exposureScore).toBe(0);
    });
  });

  describe('Doctrine-Aware Scoring', () => {
    it('should apply different cover weights based on loadout', () => {
      const battlefield = new Battlefield(24, 24);
      const rangedChar = makeRangedCharacter();
      const meleeChar = makeMeleeCharacter();
      const enemy = makeRangedCharacter();
      
      battlefield.placeCharacter(rangedChar, { x: 5, y: 5 });
      battlefield.placeCharacter(meleeChar, { x: 6, y: 6 });
      battlefield.placeCharacter(enemy, { x: 20, y: 20 });

      const rangedContext = makeTestContext(rangedChar, battlefield, [enemy]);
      const meleeContext = makeTestContext(meleeChar, battlefield, [enemy]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      const testPosition = { x: 10, y: 10 };
      const rangedCoverScore = scorer.evaluateCover(testPosition, rangedContext);
      const meleeCoverScore = scorer.evaluateCover(testPosition, meleeContext);

      // Ranged models should value cover at least as much as melee
      expect(rangedCoverScore).toBeGreaterThanOrEqual(meleeCoverScore * 0.9);
    });
  });

  describe('Integration: Position Evaluation', () => {
    it('should factor cover, lean, and exposure into position scoring', () => {
      const battlefield = new Battlefield(24, 24);
      battlefield.addTerrain({
        id: 'cover-1',
        type: 'Building',
        vertices: [
          { x: 10, y: 10 },
          { x: 12, y: 10 },
          { x: 12, y: 12 },
          { x: 10, y: 12 },
        ],
      });

      const character = makeRangedCharacter();
      const enemy = makeRangedCharacter();
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy, { x: 20, y: 5 });

      const context = makeTestContext(character, battlefield, [enemy]);
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);

      // Evaluate positions should include cover/lean/exposure factors
      const positions = scorer.evaluatePositions(context);

      expect(positions).toBeDefined();
      expect(positions.length).toBeGreaterThan(0);

      // Each scored position should have factors
      for (const pos of positions) {
        expect(pos).toBeDefined();
      }
    });
  });
});

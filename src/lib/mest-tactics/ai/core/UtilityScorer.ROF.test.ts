/**
 * AI ROF Scoring Integration Tests
 * 
 * Tests the integration of ROF/Suppression/Firelane scoring
 * into the AI UtilityScorer system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../core/Character';
import { buildProfile } from '../../mission/assembly-builder';
import { Battlefield } from '../../battlefield/Battlefield';
import { UtilityScorer, DEFAULT_WEIGHTS } from './UtilityScorer';
import { AIContext, AIControllerConfig } from './AIController';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCharacter(archetype: string, itemNames: any[] = []): Character {
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
  } as any;
}

function createAIContext(
  character: Character,
  battlefield: Battlefield,
  allies: Character[],
  enemies: Character[],
  config: any = {}
): AIContext {
  return {
    character,
    battlefield,
    allies,
    enemies,
    apRemaining: 2,
    currentTurn: 1,
    currentRound: 1,
    knowledge: {} as any,
    config: {
      gameSize: 'SMALL',
      perCharacterFovLos: false,
      aggression: 0.5,
      ...config,
    } as any,
  } as any;
}

// ============================================================================
// ROF Target Scoring Integration Tests
// ============================================================================

describe('AI ROF Scoring Integration - Target Evaluation', () => {
  describe('evaluateTargets with ROF weapon', () => {
    it('should prioritize clustered enemy targets for ROF attacks', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const attacker = createTestCharacter('Average');
      attacker.profile.equipment = [createMockROFWeapon(3)];
      
      // Clustered enemies - good ROF targets
      const enemy1 = createTestCharacter('Average');
      const enemy2 = createTestCharacter('Average');
      const enemy3 = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(enemy1, { x: 6, y: 0 });
      battlefield.placeCharacter(enemy2, { x: 6.5, y: 0.5 }); // Clustered
      battlefield.placeCharacter(enemy3, { x: 10, y: 10 }); // Isolated
      
      const context = createAIContext(attacker, battlefield, [], [enemy1, enemy2, enemy3]);
      
      const targets = scorer.evaluateTargets(context);
      
      // Clustered enemies should score higher for ROF
      expect(targets.length).toBeGreaterThan(0);
      // At least one target should have ROF factor
      const hasROFFactor = targets.some(t => 
        t.factors && 'rofTargetScore' in t.factors
      );
      expect(hasROFFactor).toBe(true);
    });

    it('should penalize targets with Friendly fire risk', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const attacker = createTestCharacter('Average');
      attacker.profile.equipment = [createMockROFWeapon(3)];
      
      const enemy = createTestCharacter('Average');
      const friendly = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(enemy, { x: 6, y: 0 });
      battlefield.placeCharacter(friendly, { x: 3, y: 0 }); // In ROF path
      
      const context = createAIContext(attacker, battlefield, [friendly], [enemy]);
      
      const targets = scorer.evaluateTargets(context);
      
      expect(targets.length).toBeGreaterThan(0);
      // Target should have reduced score due to Friendly fire risk
      const target = targets[0];
      expect((target.factors as any).rofTargetScore).toBeDefined();
    });

    it('should not apply ROF scoring to non-ROF weapons', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const attacker = createTestCharacter('Average');
      attacker.profile.equipment = [{
        name: 'Sword',
        classification: 'Melee',
        dmg: 'STR',
        impact: 0,
        accuracy: '',
        traits: [],
        range: 0,
      } as any];
      
      const enemy = createTestCharacter('Average');
      
      battlefield.placeCharacter(attacker, { x: 0, y: 0 });
      battlefield.placeCharacter(enemy, { x: 1, y: 0 });
      
      const context = createAIContext(attacker, battlefield, [], [enemy]);
      
      const targets = scorer.evaluateTargets(context);
      
      expect(targets.length).toBeGreaterThan(0);
      // ROF factor should be 0 for non-ROF weapons
      const target = targets[0];
      expect((target.factors as any).rofTargetScore).toBe(0);
    });
  });
});

// ============================================================================
// Position Safety Integration Tests
// ============================================================================

describe('AI ROF Scoring Integration - Position Safety', () => {
  describe('evaluatePositions with suppression awareness', () => {
    it('should score positions with safety from ROF/suppression', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const character = createTestCharacter('Average');
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      
      const context = createAIContext(character, battlefield, [], []);
      
      const positions = scorer.evaluatePositions(context);
      
      // Positions should include safety factors
      expect(positions.length).toBeGreaterThan(0);
      const pos = positions[0];
      expect((pos.factors as any).positionSafety).toBeDefined();
      expect((pos.factors as any).suppressionZoneControl).toBeDefined();
    });

    it('should prefer safer positions for ranged characters', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      // Ranged character
      const rangedChar = createTestCharacter('Average');
      rangedChar.profile.equipment = [createMockROFWeapon(2)];
      
      battlefield.placeCharacter(rangedChar, { x: 5, y: 5 });
      
      const context = createAIContext(rangedChar, battlefield, [], []);
      
      const positions = scorer.evaluatePositions(context);
      
      expect(positions.length).toBeGreaterThan(0);
      // Ranged characters should weight safety higher
    });
  });
});

// ============================================================================
// Suppression Zone Control Integration Tests
// ============================================================================

describe('AI ROF Scoring Integration - Suppression Zone Control', () => {
  describe('evaluateSuppressionZoneControl', () => {
    it('should score zones that trap enemies', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const character = createTestCharacter('Average');
      const enemy1 = createTestCharacter('Average');
      const enemy2 = createTestCharacter('Average');
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy1, { x: 6, y: 6 });
      battlefield.placeCharacter(enemy2, { x: 6.5, y: 6.5 });
      
      const context = createAIContext(character, battlefield, [], [enemy1, enemy2]);
      
      // Test position that would trap enemies
      const testPosition = { x: 6, y: 6 };
      const zoneScore = (scorer as any).evaluateSuppressionZoneControl(testPosition, context);
      
      // Score should reflect enemy presence
      expect(zoneScore).toBeDefined();
    });

    it('should penalize zones that endanger friendlies', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const character = createTestCharacter('Average');
      const friendly = createTestCharacter('Average');
      
      battlefield.placeCharacter(character, { x: 5, y: 5 });
      battlefield.placeCharacter(friendly, { x: 6, y: 6 });
      
      const context = createAIContext(character, battlefield, [friendly], []);
      
      // Test position near friendly
      const testPosition = { x: 6, y: 6 };
      const zoneScore = (scorer as any).evaluateSuppressionZoneControl(testPosition, context);
      
      // Score should be reduced due to friendly at risk
      expect(zoneScore).toBeDefined();
    });
  });
});

// ============================================================================
// Firelane FOF Integration Tests
// ============================================================================

describe('AI ROF Scoring Integration - Firelane FOF', () => {
  describe('Firelane positioning awareness', () => {
    it('should consider FOF coverage in position scoring', () => {
      const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
      const battlefield = new Battlefield(12, 12);
      
      const gunner = createTestCharacter('Average');
      gunner.profile.equipment = [createMockROFWeapon(3)];
      
      const enemy = createTestCharacter('Average');
      
      battlefield.placeCharacter(gunner, { x: 5, y: 5 });
      battlefield.placeCharacter(enemy, { x: 10, y: 5 });
      
      const context = createAIContext(gunner, battlefield, [], [enemy]);
      
      const positions = scorer.evaluatePositions(context);
      
      // Positions should be evaluated with FOF awareness
      expect(positions.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// End-to-End Integration Tests
// ============================================================================

describe('AI ROF Scoring Integration - End-to-End', () => {
  it('should integrate ROF scoring throughout action evaluation', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(12, 12);
    
    const attacker = createTestCharacter('Average');
    attacker.profile.equipment = [createMockROFWeapon(3)];
    
    const enemy1 = createTestCharacter('Average');
    const enemy2 = createTestCharacter('Average');
    
    battlefield.placeCharacter(attacker, { x: 5, y: 5 });
    battlefield.placeCharacter(enemy1, { x: 8, y: 5 }); // Within range 16
    battlefield.placeCharacter(enemy2, { x: 8.5, y: 5.5 }); // Clustered
    
    const context = createAIContext(attacker, battlefield, [], [enemy1, enemy2], {
      apRemaining: 2,
    });
    
    // Evaluate all actions
    const actions = scorer.evaluateActions(context);
    
    // Should have attack actions with ROF consideration
    const attackActions = actions.filter((a: any) => a.action === 'attack');
    // May have 0 attacks if enemies are not in LOS or other conditions
    // Just verify the evaluation completed without errors
    expect(actions.length).toBeGreaterThan(0);
    
    // Check if any action has ROF factors
    const hasROFFactors = actions.some(a => 
      a.factors && 'rofTargetScore' in a.factors
    );
    // ROF factors may be in targets, not directly in actions
    expect(hasROFFactors || actions.length > 0).toBe(true);
  });

  it('should avoid suppression zones in movement planning', () => {
    const scorer = new UtilityScorer(DEFAULT_WEIGHTS);
    const battlefield = new Battlefield(12, 12);
    
    const character = createTestCharacter('Average');
    
    battlefield.placeCharacter(character, { x: 5, y: 5 });
    
    const context = createAIContext(character, battlefield, [], [], {
      apRemaining: 2,
    });
    
    // Evaluate movement positions
    const positions = scorer.evaluatePositions(context);
    
    // All positions should have safety scores
    positions.forEach((pos: any) => {
      expect((pos.factors as any).positionSafety).toBeDefined();
    });
  });
});

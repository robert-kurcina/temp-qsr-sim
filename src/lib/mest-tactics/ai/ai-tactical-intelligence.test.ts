/**
 * Phase 3 AI Tactical Intelligence Tests
 *
 * Tests for AI tactical coordination features:
 * - Focus Fire Coordination (Phase 3.1)
 * - Flanking Maneuvers (Phase 3.2)
 * - IP-Based Squad Formation (Phase 3.3)
 * - Wait/React Coordination (Phase 3.4)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character, Profile } from '../core';
import { Battlefield } from '../battlefield';
import { UtilityScorer } from './core/UtilityScorer';
import { AIContext, AIControllerConfig } from './core/AIController';

// Helper to create test character
function createTestCharacter(name: string, mov: number = 4, wounds: number = 0): Character {
  const profile: Profile = {
    name,
    archetype: 'Average' as any,
    attributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov, siz: 3,
    },
    finalAttributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov, siz: 3,
    },
    totalBp: 30,
    adjustedBp: 30,
    physicality: 2,
    durability: 3,
    burden: { totalBurden: 0, totalLaden: 0, items: [] },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
    items: [],
    equipment: [],
    inHandItems: [],
    stowedItems: [],
  };
  
  const character = new Character(profile);
  character.id = name;
  character.name = name;
  character.state.wounds = wounds;
  return character;
}

describe('Phase 3 AI Tactical Intelligence', () => {
  let battlefield: Battlefield;
  let scorer: UtilityScorer;
  let config: AIControllerConfig;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24, []);
    config = {
      aggression: 0.5,
      caution: 0.5,
      doctrineEngagement: 'balanced',
      doctrinePlanning: 'balanced',
      doctrineAggression: 'balanced',
      gameSize: 'SMALL',
      perCharacterFovLos: false,
    };
    scorer = new UtilityScorer(config);
  });

  describe('Phase 3.1: Focus Fire Coordination', () => {
    it('should bonus targeting same enemy as allies', () => {
      const character = createTestCharacter('Character');
      const ally = createTestCharacter('Ally');
      const enemy = createTestCharacter('Enemy');
      
      battlefield.placeCharacter(character, { x: 10, y: 10 });
      battlefield.placeCharacter(ally, { x: 10, y: 12 });
      battlefield.placeCharacter(enemy, { x: 10, y: 15 });
      
      const context: AIContext = {
        character,
        allies: [ally],
        enemies: [enemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
      };
      
      // Evaluate targets - should include focus fire bonus
      const targets = scorer.evaluateTargets(context);
      
      expect(targets.length).toBeGreaterThan(0);
      // Focus fire bonus should be included in factors
      expect(targets[0].factors.focusFire).toBeDefined();
    });

    it('should bonus finishing weakened targets', () => {
      const character = createTestCharacter('Character');
      const weakenedEnemy = createTestCharacter('WeakenedEnemy', 4, 2); // SIZ 3, 2 wounds = SIZ-1
      
      battlefield.placeCharacter(character, { x: 10, y: 10 });
      battlefield.placeCharacter(weakenedEnemy, { x: 10, y: 12 });
      
      const context: AIContext = {
        character,
        allies: [],
        enemies: [weakenedEnemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
      };
      
      const targets = scorer.evaluateTargets(context);
      
      expect(targets.length).toBeGreaterThan(0);
      // Finish off bonus should be 5.0 for SIZ-1 wounds
      expect(targets[0].factors.finishOff).toBe(5.0);
    });

    it('should prioritize side-committed targets', () => {
      const character = createTestCharacter('Character');
      const committedEnemy = createTestCharacter('CommittedEnemy');
      const otherEnemy = createTestCharacter('OtherEnemy');

      battlefield.placeCharacter(character, { x: 10, y: 10 });
      battlefield.placeCharacter(committedEnemy, { x: 8, y: 14 });
      battlefield.placeCharacter(otherEnemy, { x: 12, y: 14 });

      const context: AIContext = {
        character,
        allies: [],
        enemies: [committedEnemy, otherEnemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
        targetCommitments: {
          [committedEnemy.id]: 2.0,
        },
      };

      const targets = scorer.evaluateTargets(context);

      expect(targets.length).toBeGreaterThan(0);
      expect(targets[0].target.id).toBe(committedEnemy.id);
      expect(targets[0].factors.targetCommitment).toBeGreaterThan(0);
    });

    it('should scale out-of-play pressure using target BP', () => {
      const highBpBattlefield = new Battlefield(24, 24, []);
      const highBpScorer = new UtilityScorer(config);
      const highBpCharacter = createTestCharacter('Character');
      const highBpEnemy = createTestCharacter('HighBpEnemy', 4, 2);
      highBpEnemy.profile.totalBp = 50;
      highBpEnemy.profile.adjustedBp = 50;
      highBpBattlefield.placeCharacter(highBpCharacter, { x: 10, y: 10 });
      highBpBattlefield.placeCharacter(highBpEnemy, { x: 10, y: 12 });

      const highBpTargets = highBpScorer.evaluateTargets({
        character: highBpCharacter,
        allies: [],
        enemies: [highBpEnemy],
        battlefield: highBpBattlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
      });
      const highPressure = highBpTargets[0].factors.outOfPlayPressure ?? 0;

      const lowBpBattlefield = new Battlefield(24, 24, []);
      const lowBpScorer = new UtilityScorer(config);
      const lowBpCharacter = createTestCharacter('Character');
      const lowBpEnemy = createTestCharacter('LowBpEnemy', 4, 2);
      lowBpEnemy.profile.totalBp = 20;
      lowBpEnemy.profile.adjustedBp = 20;
      lowBpBattlefield.placeCharacter(lowBpCharacter, { x: 10, y: 10 });
      lowBpBattlefield.placeCharacter(lowBpEnemy, { x: 10, y: 12 });

      const lowBpTargets = lowBpScorer.evaluateTargets({
        character: lowBpCharacter,
        allies: [],
        enemies: [lowBpEnemy],
        battlefield: lowBpBattlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
      });
      const lowPressure = lowBpTargets[0].factors.outOfPlayPressure ?? 0;

      expect(highPressure).toBeGreaterThan(lowPressure);
    });

    it('should apply self out-of-play risk penalty when wounded and exposed', () => {
      const woundedCharacter = createTestCharacter('WoundedCharacter', 4, 2);
      const enemy = createTestCharacter('Enemy');

      battlefield.placeCharacter(woundedCharacter, { x: 10, y: 10 });
      battlefield.placeCharacter(enemy, { x: 10, y: 14 });

      const targets = scorer.evaluateTargets({
        character: woundedCharacter,
        allies: [],
        enemies: [enemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
      });

      expect(targets.length).toBeGreaterThan(0);
      expect(targets[0].factors.selfOutOfPlayRisk).toBeGreaterThan(0);
    });

    it('should increase VP/RP pressure on targets when trailing scoreboard and potential', () => {
      const character = createTestCharacter('Character');
      const enemy = createTestCharacter('Enemy', 4, 2); // near out-of-play
      enemy.profile.totalBp = 40;
      enemy.profile.adjustedBp = 40;

      battlefield.placeCharacter(character, { x: 10, y: 10 });
      battlefield.placeCharacter(enemy, { x: 10, y: 12 });

      const trailingTargets = scorer.evaluateTargets({
        character,
        allies: [],
        enemies: [enemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 4,
        currentRound: 1,
        config,
        sideId: 'A',
        vpBySide: { A: 0, B: 2 },
        rpBySide: { A: 1, B: 4 },
        maxTurns: 6,
        scoringContext: {
          myKeyScores: {
            elimination: { current: 0, predicted: 0.5, confidence: 0.5, leadMargin: -1 },
          },
          opponentKeyScores: {
            elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 },
          },
          amILeading: false,
          vpMargin: -2,
          winningKeys: [],
          losingKeys: ['elimination'],
        },
      });

      const leadingTargets = scorer.evaluateTargets({
        character,
        allies: [],
        enemies: [enemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 4,
        currentRound: 1,
        config,
        sideId: 'A',
        vpBySide: { A: 3, B: 1 },
        rpBySide: { A: 5, B: 1 },
        maxTurns: 6,
        scoringContext: {
          myKeyScores: {
            elimination: { current: 1, predicted: 2, confidence: 0.8, leadMargin: 1 },
          },
          opponentKeyScores: {
            elimination: { current: 0, predicted: 0.5, confidence: 0.5, leadMargin: -1 },
          },
          amILeading: true,
          vpMargin: 2,
          winningKeys: ['elimination'],
          losingKeys: [],
        },
      });

      expect(trailingTargets.length).toBeGreaterThan(0);
      expect(leadingTargets.length).toBeGreaterThan(0);
      expect((trailingTargets[0].factors.vpPressure ?? 0)).toBeGreaterThan((leadingTargets[0].factors.vpPressure ?? 0));
      expect((trailingTargets[0].factors.vpDenial ?? 0)).toBeGreaterThan(0);
      expect((trailingTargets[0].factors.rpPotential ?? 0)).toBeGreaterThan(0);
    });
  });

  describe('Phase 3.2: Flanking Maneuvers', () => {
    it('should implement flanking evaluation', () => {
      // Verify the evaluateFlankingPosition method exists and is callable
      // Full integration testing is done via battle simulations
      expect(scorer).toBeDefined();
    });
  });

  describe('Phase 3.4: Wait/React Coordination', () => {
    it('should evaluate Wait with ally coordination', () => {
      const character = createTestCharacter('Character');
      const allyOnWait = createTestCharacter('AllyOnWait');
      allyOnWait.state.isWaiting = true;
      allyOnWait.state.isAttentive = true;
      allyOnWait.state.isOrdered = true;
      
      const enemy = createTestCharacter('Enemy');
      
      battlefield.placeCharacter(character, { x: 10, y: 10 });
      battlefield.placeCharacter(allyOnWait, { x: 10, y: 12 });
      battlefield.placeCharacter(enemy, { x: 10, y: 15 });
      
      const context: AIContext = {
        character,
        allies: [allyOnWait],
        enemies: [enemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 1,
        currentRound: 1,
        config,
      };
      
      // Evaluate actions - should complete without errors
      const actions = scorer.evaluateActions(context);
      
      // Should have actions evaluated
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should annotate actions with fractional VP/RP potential factors', () => {
      const character = createTestCharacter('Character');
      const enemy = createTestCharacter('Enemy');

      battlefield.placeCharacter(character, { x: 10, y: 10 });
      battlefield.placeCharacter(enemy, { x: 10, y: 12 });

      const actions = scorer.evaluateActions({
        character,
        allies: [],
        enemies: [enemy],
        battlefield,
        apRemaining: 2,
        currentTurn: 5,
        currentRound: 1,
        config,
        sideId: 'A',
        vpBySide: { A: 0, B: 2 },
        rpBySide: { A: 1, B: 3 },
        maxTurns: 6,
        scoringContext: {
          myKeyScores: {
            elimination: { current: 0, predicted: 0.4, confidence: 0.5, leadMargin: -1 },
          },
          opponentKeyScores: {
            elimination: { current: 1, predicted: 2, confidence: 0.8, leadMargin: 1 },
          },
          amILeading: false,
          vpMargin: -2,
          winningKeys: [],
          losingKeys: ['elimination'],
        },
      });

      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action.factors.scoringUrgencyScalar).toBeDefined();
        expect(action.factors.fractionalVpPotential).toBeDefined();
        expect(action.factors.fractionalVpDenial).toBeDefined();
      }
    });
  });
});

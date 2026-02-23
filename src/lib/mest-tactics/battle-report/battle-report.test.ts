/**
 * Battle Report Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateBattleReport,
  createTurnEvent,
  createBattleStatisticsTracker,
  BattleStatisticsTracker,
} from './BattleReport';
import { createMissionSide, type MissionSide } from '../mission/MissionSide';
import { buildAssembly, buildProfile, GameSize } from '../mission/assembly-builder';

describe('Battle Report', () => {
  describe('Turn Event Creation', () => {
    it('should create model KO event', () => {
      const event = createTurnEvent(
        'model_ko',
        'Warrior-1 is KO\'d',
        3,
        1,
        { sideId: 'Alpha', characterId: 'Warrior-1' }
      );

      expect(event.type).toBe('model_ko');
      expect(event.description).toContain('KO');
      expect(event.turn).toBe(3);
      expect(event.round).toBe(1);
      expect(event.sideId).toBe('Alpha');
      expect(event.characterId).toBe('Warrior-1');
    });

    it('should create bottle test event', () => {
      const event = createTurnEvent(
        'bottle_test',
        'Alpha failed Bottle Test',
        5,
        2,
        { sideId: 'Alpha', data: { roll: 2, target: 4 } }
      );

      expect(event.type).toBe('bottle_test');
      expect(event.data?.roll).toBe(2);
    });

    it('should create end game die event', () => {
      const event = createTurnEvent(
        'end_game_die',
        'End game die rolled: 3 - Game Over!',
        10,
        1,
        { data: { roll: 3 } }
      );

      expect(event.type).toBe('end_game_die');
      expect(event.turn).toBe(10);
    });
  });

  describe('Battle Statistics Tracker', () => {
    let tracker: BattleStatisticsTracker;

    beforeEach(() => {
      tracker = createBattleStatisticsTracker();
    });

    it('should track moves', () => {
      tracker.recordAction('move');
      tracker.recordAction('move');
      tracker.recordAction('move');

      const stats = tracker.getStatistics();
      expect(stats.totalMoves).toBe(3);
      expect(stats.totalActions).toBe(3);
    });

    it('should track close combat', () => {
      tracker.recordAction('close_combat');
      tracker.recordAction('close_combat');

      const stats = tracker.getStatistics();
      expect(stats.totalCloseCombats).toBe(2);
      expect(stats.totalAttacks).toBe(2);
      expect(stats.totalActions).toBe(2);
    });

    it('should track ranged combat', () => {
      tracker.recordAction('ranged_combat');
      tracker.recordAction('ranged_combat');
      tracker.recordAction('ranged_combat');

      const stats = tracker.getStatistics();
      expect(stats.totalRangedCombats).toBe(3);
      expect(stats.totalAttacks).toBe(3);
    });

    it('should track wounds', () => {
      tracker.recordWound();
      tracker.recordWound();
      tracker.recordWound();

      const stats = tracker.getStatistics();
      expect(stats.totalWoundsGenerated).toBe(3);
    });

    it('should track KO models by side', () => {
      tracker.recordKO('Alpha');
      tracker.recordKO('Alpha');
      tracker.recordKO('Bravo');

      const stats = tracker.getStatistics();
      expect(stats.modelsKOd.find(k => k.sideId === 'Alpha')?.count).toBe(2);
      expect(stats.modelsKOd.find(k => k.sideId === 'Bravo')?.count).toBe(1);
    });

    it('should track eliminations by wounds', () => {
      tracker.recordElimination('Alpha', false);
      tracker.recordElimination('Alpha', false);

      const stats = tracker.getStatistics();
      expect(stats.modelsEliminatedByWounds.find(e => e.sideId === 'Alpha')?.count).toBe(2);
    });

    it('should track eliminations by fear', () => {
      tracker.recordElimination('Bravo', true);

      const stats = tracker.getStatistics();
      expect(stats.modelsEliminatedByFear.find(e => e.sideId === 'Bravo')?.count).toBe(1);
    });

    it('should track bottle tests', () => {
      tracker.recordBottleTest(false);
      tracker.recordBottleTest(true);
      tracker.recordBottleTest(false);

      const stats = tracker.getStatistics();
      expect(stats.bottleTestsPerformed).toBe(3);
      expect(stats.bottleTestsFailed).toBe(1);
    });

    it('should track end game die rolls', () => {
      tracker.recordEndGameDie();
      tracker.recordEndGameDie();

      const stats = tracker.getStatistics();
      expect(stats.endGameDieRolls).toBe(2);
    });

    it('should update turn and round', () => {
      tracker.updateTurn(5, 2);

      const stats = tracker.getStatistics();
      expect(stats.totalTurns).toBe(5);
      expect(stats.totalRounds).toBe(2);
    });

    it('should track complete battle statistics', () => {
      // Simulate a complete battle
      tracker.updateTurn(10, 1);
      
      for (let i = 0; i < 50; i++) tracker.recordAction('move');
      for (let i = 0; i < 20; i++) tracker.recordAction('close_combat');
      for (let i = 0; i < 15; i++) tracker.recordAction('ranged_combat');
      for (let i = 0; i < 30; i++) tracker.recordWound();
      
      tracker.recordKO('Alpha');
      tracker.recordKO('Bravo');
      tracker.recordElimination('Alpha', false);
      tracker.recordElimination('Bravo', true);
      
      tracker.recordBottleTest(false);
      tracker.recordBottleTest(true);
      
      tracker.recordEndGameDie();
      tracker.recordEndGameDie();

      const stats = tracker.getStatistics();
      expect(stats.totalActions).toBe(85);
      expect(stats.totalMoves).toBe(50);
      expect(stats.totalCloseCombats).toBe(20);
      expect(stats.totalRangedCombats).toBe(15);
      expect(stats.totalWoundsGenerated).toBe(30);
      expect(stats.modelsKOd.length).toBe(2);
      expect(stats.modelsEliminatedByWounds.length).toBe(1);
      expect(stats.modelsEliminatedByFear.length).toBe(1);
      expect(stats.bottleTestsPerformed).toBe(2);
      expect(stats.endGameDieRolls).toBe(2);
    });
  });

  describe('Battle Report Generation', () => {
    it('should generate complete battle report structure', () => {
      // Create test sides
      const profile1 = buildProfile('Average', {
        secondaryArchetypeNames: [],
        itemNames: [],
      });
      const profile2 = buildProfile('Veteran', {
        secondaryArchetypeNames: [],
        itemNames: [],
      });

      const assembly1 = buildAssembly('Alpha Assembly', [profile1, profile1]);
      const assembly2 = buildAssembly('Bravo Assembly', [profile2, profile2]);

      const side1 = createMissionSide('Alpha', [assembly1]);
      const side2 = createMissionSide('Bravo', [assembly2]);

      // Create mock mission state
      const missionState = {
        missionId: 'QAI_11',
        missionName: 'Elimination',
        turn: 10,
        round: 1,
        ended: true,
        endReason: 'End game die roll',
        sides: [],
        customState: {},
      };

      // Create mock score result
      const scoreResult = {
        winner: 'Alpha',
        keysToVictory: [
          { key: 'Elimination', vpAwarded: 2, sideId: 'Alpha', turn: 10 },
        ],
        sideScores: [],
      };

      // Create turn summaries
      const turnSummaries = [
        {
          turn: 1,
          round: 1,
          initiativeWinner: 'Alpha',
          initiativePointsAwarded: [
            { sideId: 'Alpha', points: 3 },
            { sideId: 'Bravo', points: 1 },
          ],
          events: [
            createTurnEvent('model_ko', 'Warrior-1 KO\'d', 1, 1, { sideId: 'Bravo' }),
          ],
          endOfTurnState: {
            modelsRemaining: [
              { sideId: 'Alpha', count: 2 },
              { sideId: 'Bravo', count: 1 },
            ],
            bottleTestPerformed: false,
            bottleTestFailed: [],
          },
        },
      ];

      // Create statistics
      const tracker = createBattleStatisticsTracker();
      tracker.updateTurn(10, 1);
      for (let i = 0; i < 100; i++) tracker.recordAction('move');
      for (let i = 0; i < 30; i++) tracker.recordAction('close_combat');
      tracker.recordWound();
      tracker.recordWound();
      tracker.recordKO('Bravo');
      tracker.recordElimination('Bravo', false);
      tracker.recordBottleTest(false);
      tracker.recordEndGameDie();

      const statistics = tracker.getStatistics();

      // Create configuration
      const configuration = {
        gameSize: GameSize.SMALL,
        battlefield: {
          width: 24,
          height: 24,
          terrainCount: 5,
        },
        maxTurns: 10,
        endGameTriggerTurn: 10,
        endGameDieRolled: true,
        endGameDieResult: 3,
      };

      // Generate report
      const report = generateBattleReport(
        [side1, side2],
        missionState as any,
        scoreResult as any,
        turnSummaries,
        statistics,
        configuration
      );

      // Verify structure
      expect(report.metadata.generatedAt).toBeDefined();
      expect(report.metadata.formatVersion).toBe('1.0.0');
      expect(report.metadata.battleId).toBeDefined();
      
      expect(report.configuration.gameSize).toBe(GameSize.SMALL);
      expect(report.configuration.battlefield.width).toBe(24);
      
      expect(report.sides.length).toBe(2);
      expect(report.sides[0].name).toBe('Alpha');
      expect(report.sides[1].name).toBe('Bravo');
      
      expect(report.mission.missionId).toBe('QAI_11');
      expect(report.mission.missionName).toBe('Elimination');
      
      expect(report.turnSummary.length).toBe(1);
      expect(report.turnSummary[0].turn).toBe(1);
      
      expect(report.statistics.totalActions).toBe(130);
      expect(report.statistics.totalMoves).toBe(100);
      expect(report.statistics.totalCloseCombats).toBe(30);
      
      expect(report.outcome.winnerName).toBe('Alpha');
      expect(report.outcome.endReason).toBe('End game die roll');
      expect(report.outcome.vpStandings.length).toBe(2);
    });

    it('should generate unique battle IDs', () => {
      const profile = buildProfile('Average', {
        secondaryArchetypeNames: [],
        itemNames: [],
      });
      const assembly = buildAssembly('Test', [profile]);
      const side = createMissionSide('Alpha', [assembly]);

      const report1 = generateBattleReport(
        [side],
        { missionId: 'test', turn: 1, round: 1, ended: false, sides: [], customState: {} } as any,
        { keysToVictory: [], sideScores: [] } as any,
        [],
        createBattleStatisticsTracker().getStatistics(),
        {
          gameSize: GameSize.SMALL,
          battlefield: { width: 24, height: 24, terrainCount: 0 },
          maxTurns: 10,
          endGameTriggerTurn: 10,
          endGameDieRolled: false,
        }
      );

      const report2 = generateBattleReport(
        [side],
        { missionId: 'test', turn: 1, round: 1, ended: false, sides: [], customState: {} } as any,
        { keysToVictory: [], sideScores: [] } as any,
        [],
        createBattleStatisticsTracker().getStatistics(),
        {
          gameSize: GameSize.SMALL,
          battlefield: { width: 24, height: 24, terrainCount: 0 },
          maxTurns: 10,
          endGameTriggerTurn: 10,
          endGameDieRolled: false,
        }
      );

      // IDs should be different (different timestamps)
      expect(report1.metadata.battleId).toBeDefined();
      expect(report2.metadata.battleId).toBeDefined();
    });
  });
});

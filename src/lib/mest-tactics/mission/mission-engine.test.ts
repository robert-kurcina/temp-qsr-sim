import { describe, it, expect, beforeEach } from 'vitest';
import { MissionEngine } from './mission-engine';
import { MissionConfig, GameSize } from '../missions/mission-config';
import { buildOpposingSides } from './MissionSideBuilder';

describe('MissionEngine', () => {
  let engine: MissionEngine;
  let sides: ReturnType<typeof buildOpposingSides>;

  beforeEach(() => {
    sides = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 2 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 2 }]
    );

    const config = MissionEngine.createEliminationConfig();
    engine = MissionEngine.fromConfig(config);
    engine.initialize([sides.sideA, sides.sideB]);
  });

  describe('initialization', () => {
    it('should initialize with sides', () => {
      expect(engine.hasEnded()).toBe(false);
      expect(engine.getVP(sides.sideA.id)).toBe(0);
      expect(engine.getVP(sides.sideB.id)).toBe(0);
    });

    it('should create zones from config', () => {
      // Elimination has no zones by default
      expect(engine.getZones().length).toBe(0);
    });

    it('should validate balance on creation', () => {
      const report = engine.getBalanceReport();
      expect(report).toContain('Balance Score');
    });
  });

  describe('scoring', () => {
    it('should award VP for model elimination', () => {
      const results = engine.onModelEliminated(sides.sideB.id, sides.sideA.id);

      expect(results.length).toBeGreaterThan(0);
      expect(engine.getVP(sides.sideA.id)).toBeGreaterThan(0);
    });

    it('should not award VP for self-elimination', () => {
      const results = engine.onModelEliminated(sides.sideA.id, sides.sideA.id);

      expect(results.length).toBe(0);
    });

    it('should track VP standings', () => {
      engine.onModelEliminated(sides.sideB.id, sides.sideA.id);
      engine.onModelEliminated(sides.sideB.id, sides.sideA.id);

      const standings = engine.getVPStandings();

      expect(standings[0].sideId).toBe(sides.sideA.id);
      expect(standings[0].vp).toBeGreaterThan(0);
    });
  });

  describe('victory conditions', () => {
    it('should detect elimination victory', () => {
      // Eliminate all Side B models
      sides.sideB.members.forEach(m => {
        m.status = 'Eliminated' as any;
      });

      engine.start();
      const victory = engine.checkVictory();

      expect(victory).toBeDefined();
      expect(victory?.winner).toBe(sides.sideA.id);
    });

    it('should not end prematurely', () => {
      engine.start();
      const victory = engine.checkVictory();

      expect(victory).toBeUndefined();
      expect(engine.hasEnded()).toBe(false);
    });
  });

  describe('turn processing', () => {
    it('should start at turn 1', () => {
      engine.start();
      expect(engine.getCurrentTurn()).toBe(1);
    });

    it('should advance turns', () => {
      engine.start();
      engine.nextTurn();

      expect(engine.getCurrentTurn()).toBe(2);
    });

    it('should process end of turn scoring', () => {
      engine.start();
      const { scoringResults } = engine.endTurn();

      // Elimination has no turn-end scoring by default
      expect(scoringResults.length).toBe(0);
    });
  });

  describe('zone control', () => {
    it('should update zone control', () => {
      const config: MissionConfig = {
        id: 'QAI_TEST',
        name: 'Test',
        description: 'Test mission',
        sides: { min: 2, max: 2 },
        defaultGameSize: GameSize.SMALL,
        battlefield: {
          zones: [{ type: 'poi', count: 3 }],
        },
        victoryConditions: [{ type: 'dominance', threshold: 3 }],
        scoringRules: [{ trigger: 'turn.end.zone_control', vp: 1 }],
        turnLimit: 10,
        endGameDieRoll: true,
        endGameDieStart: 6,
      };

      const testEngine = MissionEngine.fromConfig(config);
      testEngine.initialize([sides.sideA, sides.sideB]);

      const zones = testEngine.getZones();
      expect(zones.length).toBe(3);

      testEngine.updateZoneControl(zones[0].id, sides.sideA.id);
      
      const updatedZones = testEngine.getZones();
      expect(updatedZones[0].controller).toBe(sides.sideA.id);
    });
  });

  describe('balance validation', () => {
    it('should flag low victory threshold', () => {
      const config: MissionConfig = {
        id: 'QAI_TEST',
        name: 'Test',
        description: 'Test mission with low threshold',
        sides: { min: 2, max: 2 },
        defaultGameSize: GameSize.SMALL,
        victoryConditions: [{ type: 'dominance', threshold: 1 }],
        scoringRules: [{ trigger: 'turn.end', vp: 1 }],
        turnLimit: 10,
        endGameDieRoll: true,
        endGameDieStart: 6,
      };

      const testEngine = MissionEngine.fromConfig(config);
      const report = testEngine.getBalanceReport();

      expect(report).toContain('too low');
    });

    it('should flag high VP per turn', () => {
      const config: MissionConfig = {
        id: 'QAI_TEST',
        name: 'Test',
        description: 'Test mission with high VP',
        sides: { min: 2, max: 2 },
        defaultGameSize: GameSize.SMALL,
        victoryConditions: [{ type: 'dominance', threshold: 5 }],
        scoringRules: [
          { trigger: 'turn.end', vp: 10 },
          { trigger: 'turn.end.zone_control', vp: 5 },
        ],
        battlefield: {
          zones: [{ type: 'poi', count: 5 }],
        },
        turnLimit: 10,
        endGameDieRoll: true,
        endGameDieStart: 6,
      };

      const testEngine = MissionEngine.fromConfig(config);
      const report = testEngine.getBalanceReport();

      expect(report).toContain('too high');
    });
  });
});

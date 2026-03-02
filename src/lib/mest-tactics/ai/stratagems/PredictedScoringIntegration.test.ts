import { describe, it, expect } from 'vitest';
import {
  buildScoringContext,
  calculateScoringModifiers,
  combineModifiers,
  getScoringAdvice,
  type MissionVPConfig,
} from './PredictedScoringIntegration';
import { calculateStratagemModifiers, TacticalDoctrine } from './AIStratagems';
import { createKeyScore } from '../../mission/MissionSide';

// Default mission config for tests (Elimination mission)
const DEFAULT_MISSION_CONFIG: MissionVPConfig = {
  totalVPPool: 5,
  hasRPToVPConversion: false,
  currentTurn: 3,
  maxTurns: 10,
};

describe('Predicted Scoring Integration', () => {
  describe('buildScoringContext', () => {
    it('should build context when leading', () => {
      const myScores = {
        elimination: createKeyScore(0, 1, 50),
        dominance: createKeyScore(0, 2, 100),
      };
      const opponentScores = {
        elimination: createKeyScore(0, 0, 0),
        dominance: createKeyScore(0, 1, 50),
      };

      const context = buildScoringContext(myScores, opponentScores, DEFAULT_MISSION_CONFIG);

      expect(context.amILeading).toBe(true);
      expect(context.vpMargin).toBeGreaterThan(0);
      expect(context.winningKeys).toContain('elimination');
      expect(context.winningKeys).toContain('dominance');
      expect(context.losingKeys).toHaveLength(0);
    });

    it('should build context when trailing', () => {
      const myScores = {
        elimination: createKeyScore(0, 0, 0),
      };
      const opponentScores = {
        elimination: createKeyScore(0, 1, 100),
      };

      const context = buildScoringContext(myScores, opponentScores, DEFAULT_MISSION_CONFIG);

      expect(context.amILeading).toBe(false);
      expect(context.vpMargin).toBeLessThan(0);
      expect(context.winningKeys).toHaveLength(0);
      expect(context.losingKeys).toContain('elimination');
    });

    it('should handle empty scores', () => {
      const context = buildScoringContext({}, {}, DEFAULT_MISSION_CONFIG);

      expect(context.amILeading).toBe(false);
      expect(context.vpMargin).toBe(0);
    });

    it('should calculate vpDeficitPercent correctly when trailing', () => {
      // totalVPPool=10, I have 0, opponent has 8, remaining = 2
      // I need 8 VP to catch up, but only 2 VP remaining = 400% deficit
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 0, 0) },
        { elimination: createKeyScore(0, 8, 100) },
        missionConfig
      );

      expect(context.vpDeficitPercent).toBeGreaterThanOrEqual(1.0); // 400% = impossible to catch up
    });

    it('should calculate remainingVP correctly', () => {
      // totalVPPool=10, max predicted is 6, remaining = 4
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 6, 80) },
        { elimination: createKeyScore(0, 3, 50) },
        missionConfig
      );

      expect(context.remainingVP).toBe(4); // 10 - 6 = 4
    });
  });

  describe('calculateScoringModifiers', () => {
    it('should boost defense when leading comfortably', () => {
      // Leading by enough that opponent needs 75%+ of remaining VP to catch up
      // totalVPPool=10, I have 7, opponent has 2, remaining = 3
      // Opponent needs 5 VP to catch up, but only 3 VP remaining = 167% deficit
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 7, 90) },
        { elimination: createKeyScore(0, 2, 80) },
        missionConfig
      );

      const modifiers = calculateScoringModifiers(context);

      expect(modifiers.defenseMultiplier).toBeGreaterThan(1.0);
      expect(modifiers.playForTime).toBe(true);
      expect(modifiers.riskMultiplier).toBeLessThan(1.0);
    });

    it('should boost aggression when trailing badly', () => {
      // Trailing so badly that I need 100%+ of remaining VP to catch up
      // totalVPPool=10, I have 0, opponent has 8, remaining = 2
      // I need 8 VP to catch up, but only 2 VP remaining = 400% deficit
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 0, 0) },
        { elimination: createKeyScore(0, 8, 100) },
        missionConfig
      );

      const modifiers = calculateScoringModifiers(context);

      expect(modifiers.desperateMode).toBe(true);
      expect(modifiers.aggressionMultiplier).toBeGreaterThan(1.0);
      expect(modifiers.riskMultiplier).toBeGreaterThan(1.0);
      expect(modifiers.waitBonus).toBeLessThan(0);
    });

    it('should encourage objective focus when losing key', () => {
      const context = buildScoringContext(
        { dominance: createKeyScore(0, 0, 0) },
        { dominance: createKeyScore(0, 2, 100) },
        DEFAULT_MISSION_CONFIG
      );

      const modifiers = calculateScoringModifiers(context);

      expect(modifiers.objectiveMultiplier).toBeGreaterThan(1.0);
    });

    it('should provide wait bonus when ahead', () => {
      // Leading by enough to get wait bonus (25%+ opponent deficit)
      // totalVPPool=10, I have 6, opponent has 3, remaining = 4
      // Opponent needs 3 VP to catch up, 4 VP remaining = 75% deficit
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 6, 80) },
        { elimination: createKeyScore(0, 3, 50) },
        missionConfig
      );

      const modifiers = calculateScoringModifiers(context);

      expect(modifiers.waitBonus).toBeGreaterThan(0);
    });
  });

  describe('combineModifiers', () => {
    it('should combine stratagem and scoring modifiers', () => {
      const stratagem = calculateStratagemModifiers(TacticalDoctrine.Operative);
      const scoring = {
        aggressionMultiplier: 1.5,
        defenseMultiplier: 0.7,
        objectiveMultiplier: 1.3,
        riskMultiplier: 1.5,
        waitBonus: -2,
        playForTime: false,
        desperateMode: true,
      };

      const combined = combineModifiers(stratagem, scoring);

      // Desperate mode should increase aggression
      expect(combined.meleePreference).toBeGreaterThan(stratagem.meleePreference);
      expect(combined.riskTolerance).toBeGreaterThan(stratagem.riskTolerance);
      // Desperate mode increases charge bonus
      expect(combined.chargeBonus).toBeGreaterThan(stratagem.chargeBonus);
    });

    it('should respect play-for-time when leading', () => {
      const stratagem = calculateStratagemModifiers(TacticalDoctrine.Watchman);
      const scoring = {
        aggressionMultiplier: 0.7,
        defenseMultiplier: 1.3,
        objectiveMultiplier: 0.8,
        riskMultiplier: 0.7,
        waitBonus: 2,
        playForTime: true,
        desperateMode: false,
      };

      const combined = combineModifiers(stratagem, scoring);

      // Play for time increases retreat threshold
      expect(combined.retreatThreshold).toBeGreaterThan(stratagem.retreatThreshold);
    });
  });

  describe('getScoringAdvice', () => {
    it('should advise defensive play when leading', () => {
      // totalVPPool=10, I have 7, opponent has 2, remaining = 3
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 7, 90) },
        { elimination: createKeyScore(0, 2, 50) },
        missionConfig
      );

      const advice = getScoringAdvice(context);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('defensive') || a.includes('lead'))).toBe(true);
    });

    it('should advise aggressive play when trailing', () => {
      // totalVPPool=10, I have 0, opponent has 8, remaining = 2
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 0, 0) },
        { elimination: createKeyScore(0, 8, 100) },
        missionConfig
      );

      const advice = getScoringAdvice(context);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('aggressive') || a.includes('catch up'))).toBe(true);
    });

    it('should provide key-specific advice', () => {
      const context = buildScoringContext(
        { dominance: createKeyScore(0, 0, 0) },
        { dominance: createKeyScore(0, 2, 100) },
        DEFAULT_MISSION_CONFIG
      );

      const advice = getScoringAdvice(context);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('dominance') || a.includes('zone'))).toBe(true);
    });
  });
});

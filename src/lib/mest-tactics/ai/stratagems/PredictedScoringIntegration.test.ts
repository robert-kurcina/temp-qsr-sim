import { describe, it, expect } from 'vitest';
import {
  buildScoringContext,
  calculateScoringModifiers,
  combineModifiers,
  getScoringAdvice,
} from './PredictedScoringIntegration';
import { calculateStratagemModifiers, TacticalDoctrine } from './AIStratagems';
import { createKeyScore } from '../../mission/MissionSide';

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

      const context = buildScoringContext(myScores, opponentScores);

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

      const context = buildScoringContext(myScores, opponentScores);

      expect(context.amILeading).toBe(false);
      expect(context.vpMargin).toBeLessThan(0);
      expect(context.winningKeys).toHaveLength(0);
      expect(context.losingKeys).toContain('elimination');
    });

    it('should handle empty scores', () => {
      const context = buildScoringContext({}, {});

      expect(context.amILeading).toBe(false);
      expect(context.vpMargin).toBe(0);
      expect(context.winningKeys).toHaveLength(0);
      expect(context.losingKeys).toHaveLength(0);
    });
  });

  describe('calculateScoringModifiers', () => {
    it('should boost defense when leading comfortably', () => {
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 4, 100) },
        { elimination: createKeyScore(0, 1, 50) }
      );

      const modifiers = calculateScoringModifiers(context);

      expect(modifiers.defenseMultiplier).toBeGreaterThan(1.0);
      expect(modifiers.playForTime).toBe(true);
      expect(modifiers.riskMultiplier).toBeLessThan(1.0);
    });

    it('should boost aggression when trailing badly', () => {
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 0, 0) },
        { elimination: createKeyScore(0, 5, 100) }
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
        { dominance: createKeyScore(0, 2, 100) }
      );

      const modifiers = calculateScoringModifiers(context);

      expect(modifiers.objectiveMultiplier).toBeGreaterThan(1.0);
    });

    it('should provide wait bonus when ahead', () => {
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 3, 80) },
        { elimination: createKeyScore(0, 1, 50) }
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
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 4, 90) },
        { elimination: createKeyScore(0, 1, 50) }
      );

      const advice = getScoringAdvice(context);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('defensive') || a.includes('lead'))).toBe(true);
    });

    it('should advise aggressive play when trailing', () => {
      const context = buildScoringContext(
        { elimination: createKeyScore(0, 0, 0) },
        { elimination: createKeyScore(0, 5, 100) }
      );

      const advice = getScoringAdvice(context);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('risk') || a.includes('deficit') || a.includes('aggressive'))).toBe(true);
    });

    it('should provide key-specific advice', () => {
      const context = buildScoringContext(
        { dominance: createKeyScore(0, 0, 0) },
        { dominance: createKeyScore(0, 2, 100) }
      );

      const advice = getScoringAdvice(context);

      expect(advice.some(a => a.includes('zone') || a.includes('objective'))).toBe(true);
    });
  });
});

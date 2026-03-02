import { describe, it, expect, beforeEach } from 'vitest';
import { createMissionSide, updatePredictedScoring, getPredictedVp, getPredictedRp, getKeyScores, getKeyScore, calculateConfidence, createKeyScore } from './MissionSide';
import { buildOpposingSides } from './MissionSideBuilder';
import { ModelSlotStatus } from './MissionSide';
import { createEliminationMission } from '../missions/elimination-manager';

describe('Predicted Scoring System', () => {
  describe('calculateConfidence', () => {
    it('should return 0.5 when both values are zero', () => {
      expect(calculateConfidence(0, 0)).toBe(0.5);
    });

    it('should return 1.0 when opponent has zero', () => {
      expect(calculateConfidence(100, 0)).toBe(1.0);
    });

    it('should return 0.0 when self has zero', () => {
      expect(calculateConfidence(0, 100)).toBe(0.0);
    });

    it('should calculate confidence based on ratio', () => {
      // 100 vs 50 = 1 - 0.5 = 0.5 confidence
      expect(calculateConfidence(100, 50)).toBe(0.5);
      // 100 vs 10 = 1 - 0.1 = 0.9 confidence
      expect(calculateConfidence(100, 10)).toBeCloseTo(0.9, 5);
      // 100 vs 90 = 1 - 0.9 = 0.1 confidence
      expect(calculateConfidence(100, 90)).toBeCloseTo(0.1, 5);
    });

    it('should clamp confidence to 0-1 range', () => {
      expect(calculateConfidence(50, 100)).toBe(0); // Would be negative
      expect(calculateConfidence(100, 50)).toBe(0.5);
    });
  });

  describe('createKeyScore', () => {
    it('should create KeyScore with calculated confidence', () => {
      const score = createKeyScore(0, 100, 50);
      expect(score.current).toBe(0);
      expect(score.predicted).toBe(100);
      expect(score.leadMargin).toBe(50);
      expect(score.confidence).toBe(0.5); // 100 vs 50 (opponent best)
    });
  });

  describe('MissionSide predicted scoring', () => {
    let side: ReturnType<typeof createMissionSide>;

    beforeEach(() => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 3 }]
      );
      side = result.sideA;
    });

    it('should initialize with zero predicted scores', () => {
      expect(side.state.predictedVp).toBe(0);
      expect(side.state.predictedRp).toBe(0);
      expect(side.state.keyScores).toEqual({});
    });

    it('should update predicted scores', () => {
      const keyScores = {
        elimination: createKeyScore(0, 1, 50),
        bottled: createKeyScore(0, 1, 1),
      };

      updatePredictedScoring(side, 2, 1, keyScores);

      expect(getPredictedVp(side)).toBe(2);
      expect(getPredictedRp(side)).toBe(1);
      expect(getKeyScores(side)).toEqual(keyScores);
    });

    it('should get individual key scores', () => {
      const keyScores = {
        elimination: createKeyScore(0, 1, 50),
      };

      updatePredictedScoring(side, 1, 0, keyScores);

      expect(getKeyScore(side, 'elimination')).toEqual(keyScores.elimination);
      expect(getKeyScore(side, 'bottled')).toBeUndefined();
    });
  });

  describe('EliminationMissionManager predicted scoring', () => {
    it('should calculate predicted scoring with key breakdown', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 6 }]
      );

      const manager = createEliminationMission([result.sideA, result.sideB]);

      // Mark some Side B models as KO'd (counts toward elimination scoring)
      result.sideB.members[0].status = ModelSlotStatus.KO;
      result.sideB.members[1].status = ModelSlotStatus.KO;

      const predicted = manager.calculatePredictedScoring();

      // Side A should have elimination VP (Side B has KO'd models)
      expect(predicted.sideScores[result.sideA.id].predictedVp).toBeGreaterThan(0.5);
      expect(predicted.sideScores[result.sideA.id].keyScores['elimination']).toBeDefined();

      // Side A should have outnumbered VP (3 vs 6 = 2:1 ratio)
      expect(predicted.sideScores[result.sideA.id].keyScores['outnumbered']).toBeDefined();
      // FRACTIONAL: 2:1 ratio = 1.0 VP
      expect(predicted.sideScores[result.sideA.id].keyScores['outnumbered']?.predicted).toBeGreaterThanOrEqual(0.8);
    });

    it('should calculate confidence metrics', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 3 }]
      );

      const manager = createEliminationMission([result.sideA, result.sideB]);

      // Side A eliminates more BP
      manager.processModelElimination('model-1', result.sideB.id, result.sideA.id, 100);
      manager.processModelElimination('model-2', result.sideA.id, result.sideB.id, 50);

      const predicted = manager.calculatePredictedScoring();

      // Side A should have higher confidence (leading in elimination)
      const sideAConfidence = predicted.sideScores[result.sideA.id].keyScores['elimination']?.confidence ?? 0;
      const sideBConfidence = predicted.sideScores[result.sideB.id].keyScores['elimination']?.confidence ?? 0;

      expect(sideAConfidence).toBeGreaterThan(sideBConfidence);
    });

    it('should handle bottled out detection', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 3 }]
      );

      const manager = createEliminationMission([result.sideA, result.sideB]);

      // Mark all Side B models as eliminated (bottled out)
      result.sideB.members.forEach(m => m.status = ModelSlotStatus.Eliminated);

      const predicted = manager.calculatePredictedScoring();

      // Side A should get bottled VP (FRACTIONAL: 0.5-1.0 based on ratio)
      expect(predicted.sideScores[result.sideA.id].keyScores['bottled']?.predicted).toBeGreaterThanOrEqual(0.8);
      expect(predicted.sideScores[result.sideA.id].keyScores['bottled']?.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });
});

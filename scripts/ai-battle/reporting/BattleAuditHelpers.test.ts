import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { ModelStateAudit, ModelUsageStats } from '../../shared/BattleReportTypes';
import {
  buildUsageMetrics,
  createModelEffect,
  createMovementVector,
  sanitizeForAudit,
  toOpposedTestAudit,
} from './BattleAuditHelpers';

function createUsageStats(overrides: Partial<ModelUsageStats> = {}): ModelUsageStats {
  return {
    modelId: 'm-1',
    modelName: 'Model One',
    side: 'Alpha',
    pathLength: 0,
    moveActions: 0,
    waitChoicesGiven: 0,
    waitAttempts: 0,
    waitSuccesses: 0,
    detectAttempts: 0,
    detectSuccesses: 0,
    hideAttempts: 0,
    hideSuccesses: 0,
    reactChoiceWindows: 0,
    reactChoicesGiven: 0,
    reactAttempts: 0,
    reactSuccesses: 0,
    ...overrides,
  };
}

const BASE_STATE: ModelStateAudit = {
  wounds: 0,
  delayTokens: 0,
  fearTokens: 0,
  isKOd: false,
  isEliminated: false,
  isHidden: false,
  isWaiting: false,
  isAttentive: true,
  isOrdered: false,
};

describe('BattleAuditHelpers', () => {
  it('computes usage summary from per-model usage map', () => {
    const usage = new Map<Character, ModelUsageStats>([
      [{} as Character, createUsageStats({ modelId: 'a', pathLength: 6, waitSuccesses: 1 })],
      [{} as Character, createUsageStats({ modelId: 'b', pathLength: 0, hideSuccesses: 1, reactSuccesses: 1 })],
      [{} as Character, createUsageStats({ modelId: 'c', pathLength: 2, detectSuccesses: 1 })],
    ]);

    const summary = buildUsageMetrics(usage);

    expect(summary.modelCount).toBe(3);
    expect(summary.modelsMoved).toBe(2);
    expect(summary.totalPathLength).toBe(8);
    expect(summary.averagePathLengthPerMovedModel).toBe(4);
    expect(summary.averagePathLengthPerModel).toBeCloseTo(8 / 3, 6);
    expect(summary.modelsUsedWait).toBe(1);
    expect(summary.modelsUsedDetect).toBe(1);
    expect(summary.modelsUsedHide).toBe(1);
    expect(summary.modelsUsedReact).toBe(1);
    expect(summary.topPathModels?.[0]?.modelId).toBe('a');
  });

  it('builds movement vectors with sampled points and distance', () => {
    const vector = createMovementVector({ x: 0, y: 0 }, { x: 3, y: 4 }, 1);
    expect(vector.distanceMu).toBe(5);
    expect(vector.sampledPoints?.[0]).toEqual({ x: 0, y: 0 });
    expect(vector.sampledPoints?.[vector.sampledPoints.length - 1]).toEqual({ x: 3, y: 4 });
  });

  it('extracts opposed test audit from nested result payload', () => {
    const result = toOpposedTestAudit({
      result: {
        hitTestResult: {
          pass: true,
          score: 2,
          participant1Score: 5,
          participant2Score: 3,
          p1Rolls: [6, 4, 1],
          p2Rolls: [5, 2, 1],
          finalPools: { p1: 4, p2: 3 },
        },
      },
    });
    expect(result).toEqual({
      pass: true,
      score: 2,
      participant1Score: 5,
      participant2Score: 3,
      p1Rolls: [6, 4, 1],
      p2Rolls: [5, 2, 1],
      finalPools: { p1: 4, p2: 3 },
    });
  });

  it('builds model effect only when state changed', () => {
    const unchanged = createModelEffect(
      {
        id: 'm-1',
        profile: { name: 'Model One' },
      } as Character,
      'self',
      BASE_STATE,
      { ...BASE_STATE },
      new Map([['m-1', 'Alpha']])
    );
    expect(unchanged).toBeNull();

    const changed = createModelEffect(
      {
        id: 'm-1',
        profile: { name: 'Model One' },
      } as Character,
      'self',
      BASE_STATE,
      { ...BASE_STATE, wounds: 1 },
      new Map([['m-1', 'Alpha']])
    );
    expect(changed?.changed).toContain('wounds');
    expect(changed?.side).toBe('Alpha');
  });

  it('sanitizes circular objects safely', () => {
    const input: Record<string, unknown> = { type: 'root' };
    input.self = input;

    const sanitized = sanitizeForAudit(input, {
      snapshotModelState: () => BASE_STATE,
      resolveSideName: () => undefined,
    }) as Record<string, unknown>;

    expect(sanitized.type).toBe('root');
    expect(sanitized.self).toBe('[circular]');
  });
});

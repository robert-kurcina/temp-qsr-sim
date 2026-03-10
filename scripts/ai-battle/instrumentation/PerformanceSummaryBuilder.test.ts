import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { CharacterAI } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import type { BattlePerformanceSummary } from '../../shared/BattleReportTypes';
import {
  aggregateMinimaxLiteCacheStats,
  attachMinimaxPerformanceCaches,
} from './PerformanceSummaryBuilder';

function createSummary(): BattlePerformanceSummary {
  return {
    elapsedMs: 10,
    activationsProcessed: 2,
    heartbeatEveryActivations: 1,
    activationLatency: {
      avgMs: 1,
      p50Ms: 1,
      p95Ms: 2,
      maxMs: 3,
    },
    phases: {},
    turns: [],
    slowestActivations: [],
  };
}

function createMockController(stats: unknown): CharacterAI {
  return {
    getMinimaxLiteCacheStats: () => stats,
  } as CharacterAI;
}

describe('PerformanceSummaryBuilder', () => {
  it('aggregates minimax cache stats across controllers', () => {
    const controllers = new Map<string, CharacterAI>([
      ['a', createMockController({
        size: 5,
        maxSize: 1000,
        hits: 20,
        misses: 10,
        hitRate: 0.6666,
        nodeEvaluations: 50,
        patchTransitions: { scrum: 2 },
        patchGraph: {
          size: 3,
          maxSize: 500,
          hits: 4,
          misses: 2,
          hitRate: 0.6666,
          evictions: 1,
          neighborhoodGraphSize: 2,
          neighborhoodGraphMaxSize: 400,
          neighborhoodGraphHits: 3,
          neighborhoodGraphMisses: 1,
          neighborhoodGraphHitRate: 0.75,
          neighborhoodGraphEvictions: 0,
        },
      })],
      ['b', createMockController({
        size: 8,
        maxSize: 1000,
        hits: 10,
        misses: 10,
        hitRate: 0.5,
        nodeEvaluations: 30,
        patchTransitions: { scrum: 1, lane: 5 },
        patchGraph: {
          size: 5,
          maxSize: 500,
          hits: 2,
          misses: 6,
          hitRate: 0.25,
          evictions: 2,
          neighborhoodGraphSize: 4,
          neighborhoodGraphMaxSize: 400,
          neighborhoodGraphHits: 1,
          neighborhoodGraphMisses: 3,
          neighborhoodGraphHitRate: 0.25,
          neighborhoodGraphEvictions: 1,
        },
      })],
    ]);

    const aggregated = aggregateMinimaxLiteCacheStats(controllers)!;

    expect(aggregated.controllers).toBe(2);
    expect(aggregated.controllersWithSamples).toBe(2);
    expect(aggregated.hits).toBe(30);
    expect(aggregated.misses).toBe(20);
    expect(aggregated.hitRate).toBe(0.6);
    expect(aggregated.avgHitRate).toBe(0.5833);
    expect(aggregated.nodeEvaluations).toBe(80);
    expect(aggregated.patchTransitions).toEqual({ scrum: 3, lane: 5 });
    expect(aggregated.patchGraph?.hits).toBe(6);
    expect(aggregated.patchGraph?.misses).toBe(8);
    expect(aggregated.patchGraph?.neighborhoodGraphHits).toBe(4);
    expect(aggregated.patchGraph?.neighborhoodGraphMisses).toBe(4);
  });

  it('attaches minimax cache summary to performance payload', () => {
    const summary = createSummary();
    const battlefield = new Battlefield(12, 12);
    const controllers = new Map<string, CharacterAI>([
      ['a', createMockController({
        size: 1,
        maxSize: 10,
        hits: 1,
        misses: 1,
        hitRate: 0.5,
        nodeEvaluations: 10,
        patchTransitions: {},
        patchGraph: {
          size: 0,
          maxSize: 5,
          hits: 0,
          misses: 1,
          hitRate: 0,
          evictions: 0,
          neighborhoodGraphSize: 0,
          neighborhoodGraphMaxSize: 5,
          neighborhoodGraphHits: 0,
          neighborhoodGraphMisses: 1,
          neighborhoodGraphHitRate: 0,
          neighborhoodGraphEvictions: 0,
        },
      })],
    ]);

    const enriched = attachMinimaxPerformanceCaches(summary, battlefield, controllers)!;
    expect(enriched.caches?.los).toBeDefined();
    expect(enriched.caches?.pathfinding).toBeDefined();
    expect(enriched.caches?.minimaxLite?.controllers).toBe(1);
  });
});

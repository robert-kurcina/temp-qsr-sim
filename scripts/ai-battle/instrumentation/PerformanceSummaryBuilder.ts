import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { PathfindingEngine } from '../../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import { CharacterAI } from '../../../src/lib/mest-tactics/ai/core/CharacterAI';
import type { BattlePerformanceSummary } from '../../shared/BattleReportTypes';

type MinimaxLiteSummary = NonNullable<NonNullable<BattlePerformanceSummary['caches']>['minimaxLite']>;

export function aggregateMinimaxLiteCacheStats(
  aiControllers: Map<string, CharacterAI>
): MinimaxLiteSummary | undefined {
  let controllers = 0;
  let controllersWithSamples = 0;
  let hits = 0;
  let misses = 0;
  let nodeEvaluations = 0;
  let totalSize = 0;
  let totalMaxSize = 0;
  let hitRateSum = 0;
  let patchGraphHits = 0;
  let patchGraphMisses = 0;
  let patchGraphEvictions = 0;
  let patchGraphTotalSize = 0;
  let patchGraphTotalMaxSize = 0;
  let patchGraphHitRateSum = 0;
  let patchNeighborhoodHits = 0;
  let patchNeighborhoodMisses = 0;
  let patchNeighborhoodEvictions = 0;
  let patchNeighborhoodTotalSize = 0;
  let patchNeighborhoodTotalMaxSize = 0;
  let patchNeighborhoodHitRateSum = 0;
  const patchTransitions: Record<string, number> = {};

  for (const aiController of aiControllers.values()) {
    const stats = aiController.getMinimaxLiteCacheStats();
    controllers += 1;
    hits += Number(stats.hits ?? 0);
    misses += Number(stats.misses ?? 0);
    nodeEvaluations += Number(stats.nodeEvaluations ?? 0);
    totalSize += Number(stats.size ?? 0);
    totalMaxSize += Number(stats.maxSize ?? 0);
    if ((Number(stats.hits ?? 0) + Number(stats.misses ?? 0)) > 0) {
      controllersWithSamples += 1;
    }
    hitRateSum += Number(stats.hitRate ?? 0);
    patchGraphHits += Number(stats.patchGraph?.hits ?? 0);
    patchGraphMisses += Number(stats.patchGraph?.misses ?? 0);
    patchGraphEvictions += Number(stats.patchGraph?.evictions ?? 0);
    patchGraphTotalSize += Number(stats.patchGraph?.size ?? 0);
    patchGraphTotalMaxSize += Number(stats.patchGraph?.maxSize ?? 0);
    patchGraphHitRateSum += Number(stats.patchGraph?.hitRate ?? 0);
    patchNeighborhoodHits += Number(stats.patchGraph?.neighborhoodGraphHits ?? 0);
    patchNeighborhoodMisses += Number(stats.patchGraph?.neighborhoodGraphMisses ?? 0);
    patchNeighborhoodEvictions += Number(stats.patchGraph?.neighborhoodGraphEvictions ?? 0);
    patchNeighborhoodTotalSize += Number(stats.patchGraph?.neighborhoodGraphSize ?? 0);
    patchNeighborhoodTotalMaxSize += Number(stats.patchGraph?.neighborhoodGraphMaxSize ?? 0);
    patchNeighborhoodHitRateSum += Number(stats.patchGraph?.neighborhoodGraphHitRate ?? 0);
    for (const [transition, count] of Object.entries(stats.patchTransitions ?? {})) {
      patchTransitions[transition] = (patchTransitions[transition] ?? 0) + (Number(count) || 0);
    }
  }

  if (controllers === 0) {
    return undefined;
  }

  const total = hits + misses;
  const patchGraphTotal = patchGraphHits + patchGraphMisses;
  const patchNeighborhoodTotal = patchNeighborhoodHits + patchNeighborhoodMisses;
  return {
    controllers,
    controllersWithSamples,
    hits,
    misses,
    hitRate: total > 0 ? Number((hits / total).toFixed(4)) : 0,
    avgHitRate: Number((hitRateSum / Math.max(1, controllers)).toFixed(4)),
    nodeEvaluations,
    avgNodeEvaluationsPerController: Number((nodeEvaluations / Math.max(1, controllers)).toFixed(2)),
    totalSize,
    totalMaxSize,
    patchTransitions,
    patchGraph: {
      hits: patchGraphHits,
      misses: patchGraphMisses,
      hitRate: patchGraphTotal > 0 ? Number((patchGraphHits / patchGraphTotal).toFixed(4)) : 0,
      avgHitRate: Number((patchGraphHitRateSum / Math.max(1, controllers)).toFixed(4)),
      evictions: patchGraphEvictions,
      totalSize: patchGraphTotalSize,
      totalMaxSize: patchGraphTotalMaxSize,
      neighborhoodGraphHits: patchNeighborhoodHits,
      neighborhoodGraphMisses: patchNeighborhoodMisses,
      neighborhoodGraphHitRate: patchNeighborhoodTotal > 0
        ? Number((patchNeighborhoodHits / patchNeighborhoodTotal).toFixed(4))
        : 0,
      neighborhoodGraphAvgHitRate: Number((patchNeighborhoodHitRateSum / Math.max(1, controllers)).toFixed(4)),
      neighborhoodGraphEvictions: patchNeighborhoodEvictions,
      neighborhoodGraphTotalSize: patchNeighborhoodTotalSize,
      neighborhoodGraphTotalMaxSize: patchNeighborhoodTotalMaxSize,
    },
  };
}

export function attachMinimaxPerformanceCaches(
  summary: BattlePerformanceSummary | undefined,
  battlefield?: Battlefield,
  aiControllers?: Map<string, CharacterAI>
): BattlePerformanceSummary | undefined {
  if (!summary || !aiControllers || aiControllers.size === 0) {
    return summary;
  }

  const minimaxStats = aggregateMinimaxLiteCacheStats(aiControllers);
  if (!minimaxStats) {
    return summary;
  }

  const los = summary.caches?.los ?? (battlefield ? battlefield.getLosCacheStats() : undefined);
  const pathfinding = summary.caches?.pathfinding ?? (battlefield ? new PathfindingEngine(battlefield).getCacheStats() : undefined);
  if (!los || !pathfinding) {
    return summary;
  }

  summary.caches = {
    ...(summary.caches ?? {}),
    los,
    pathfinding,
    minimaxLite: minimaxStats,
  };
  return summary;
}

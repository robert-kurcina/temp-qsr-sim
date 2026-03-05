/**
 * Environment Configuration
 *
 * Environment variable handling and performance gate configuration.
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { ValidationAggregateReport } from '../validation/ValidationMetrics';

// ============================================================================
// Performance Gate Configuration
// ============================================================================

export const DENSITY_BUCKET_LABELS = ['0-24', '25-49', '50-74', '75-99', '100'] as const;

export const DEFAULT_PERF_GATE_THRESHOLDS = {
  turn1ElapsedMsMax: 120_000,
  activationP95MsMax: 8_000,
  minLosCacheHitRate: 0.75,
  minPathCacheHitRate: 0.35,
  minGridCacheHitRate: 0.50,
};

export type PerformanceGateThresholds = {
  turn1ElapsedMsMax: number;
  activationP95MsMax: number;
  minLosCacheHitRate: number;
  minPathCacheHitRate: number;
  minGridCacheHitRate: number;
};

export type PerformanceGateContext = {
  missionId: string;
  gameSize: GameSize;
  densityRatio: number;
};

const DENSITY_BUCKET_GATE_THRESHOLDS: PerformanceGateThresholds[] = [
  { turn1ElapsedMsMax: 80_000, activationP95MsMax: 4_500, minLosCacheHitRate: 0.52, minPathCacheHitRate: 0.42, minGridCacheHitRate: 0.95 },
  { turn1ElapsedMsMax: 100_000, activationP95MsMax: 6_000, minLosCacheHitRate: 0.54, minPathCacheHitRate: 0.43, minGridCacheHitRate: 0.95 },
  { turn1ElapsedMsMax: 120_000, activationP95MsMax: 8_000, minLosCacheHitRate: 0.50, minPathCacheHitRate: 0.41, minGridCacheHitRate: 0.95 },
  { turn1ElapsedMsMax: 145_000, activationP95MsMax: 10_000, minLosCacheHitRate: 0.46, minPathCacheHitRate: 0.38, minGridCacheHitRate: 0.95 },
  { turn1ElapsedMsMax: 170_000, activationP95MsMax: 12_000, minLosCacheHitRate: 0.44, minPathCacheHitRate: 0.36, minGridCacheHitRate: 0.95 },
];

const GAME_SIZE_LATENCY_FACTORS: Record<GameSize, number> = {
  VERY_SMALL: 0.35,
  SMALL: 0.5,
  MEDIUM: 0.7,
  LARGE: 0.85,
  VERY_LARGE: 1.0,
};

const GAME_SIZE_CACHE_HIT_FACTORS: Record<GameSize, number> = {
  VERY_SMALL: 1.05,
  SMALL: 1.0,
  MEDIUM: 0.75,
  LARGE: 0.45,
  VERY_LARGE: 0.10,
};

const MISSION_LATENCY_FACTORS: Record<string, number> = {
  QAI_18: 1.1,
  QAI_20: 1.15,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Read positive number from environment variable with fallback
 */
export function readPositiveNumberEnv(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Clamp number to min/max range
 */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolve density bucket index from density ratio
 */
export function resolveDensityBucketIndex(densityRatio: number): number {
  const clamped = clampNumber(Math.round(densityRatio), 0, 100);
  return Math.min(DENSITY_BUCKET_LABELS.length - 1, Math.floor(clamped / 25));
}

/**
 * Resolve density bucket label from index
 */
export function resolveDensityBucketLabel(index: number): string {
  return DENSITY_BUCKET_LABELS[clampNumber(index, 0, DENSITY_BUCKET_LABELS.length - 1)];
}

/**
 * Derive performance gate thresholds based on context
 */
export function derivePerformanceGateThresholds(context: PerformanceGateContext): {
  thresholds: PerformanceGateThresholds;
  densityBucket: string;
  densityBucketIndex: number;
} {
  const densityBucketIndex = resolveDensityBucketIndex(context.densityRatio);
  const densityBucket = resolveDensityBucketLabel(densityBucketIndex);
  const baseByDensity = DENSITY_BUCKET_GATE_THRESHOLDS[densityBucketIndex] ?? DEFAULT_PERF_GATE_THRESHOLDS;
  const sizeLatencyFactor = GAME_SIZE_LATENCY_FACTORS[context.gameSize] ?? 1;
  const missionLatencyFactor = MISSION_LATENCY_FACTORS[context.missionId] ?? 1;
  const latencyFactor = sizeLatencyFactor * missionLatencyFactor;
  const cacheHitFactor = GAME_SIZE_CACHE_HIT_FACTORS[context.gameSize] ?? 1;

  const thresholds: PerformanceGateThresholds = {
    turn1ElapsedMsMax: Math.round(baseByDensity.turn1ElapsedMsMax * latencyFactor),
    activationP95MsMax: Math.round(baseByDensity.activationP95MsMax * latencyFactor),
    minLosCacheHitRate: Number(clampNumber(baseByDensity.minLosCacheHitRate * cacheHitFactor, 0.02, 0.98).toFixed(4)),
    minPathCacheHitRate: Number(clampNumber(baseByDensity.minPathCacheHitRate * cacheHitFactor, 0.01, 0.95).toFixed(4)),
    minGridCacheHitRate: Number(clampNumber(baseByDensity.minGridCacheHitRate, 0.50, 0.995).toFixed(4)),
  };
  return {
    thresholds,
    densityBucket,
    densityBucketIndex,
  };
}

/**
 * Build validation performance gates from run reports
 */
export function buildValidationPerformanceGates(
  runReports: ValidationAggregateReport['runReports'],
  totalRuns: number,
  context: PerformanceGateContext
): ValidationAggregateReport['performanceGates'] {
  const derived = derivePerformanceGateThresholds(context);
  const thresholds = {
    turn1ElapsedMsMax: readPositiveNumberEnv('AI_BATTLE_GATE_TURN1_MS', derived.thresholds.turn1ElapsedMsMax),
    activationP95MsMax: readPositiveNumberEnv('AI_BATTLE_GATE_ACT_P95_MS', derived.thresholds.activationP95MsMax),
    minLosCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_LOS_HIT_MIN', derived.thresholds.minLosCacheHitRate),
    minPathCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_PATH_HIT_MIN', derived.thresholds.minPathCacheHitRate),
    minGridCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_GRID_HIT_MIN', derived.thresholds.minGridCacheHitRate),
  };

  const runsWithPerf = runReports.filter(
    (run): run is ValidationAggregateReport['runReports'][number] & { performance: any } =>
    Boolean(run.performance)
  );
  const runsEvaluated = runsWithPerf.length;
  if (runsEvaluated === 0) {
    return {
      enabled: true,
      runsEvaluated,
      profile: {
        missionId: context.missionId,
        gameSize: context.gameSize,
        densityRatio: context.densityRatio,
        densityBucket: derived.densityBucket,
        densityBucketIndex: derived.densityBucketIndex,
      },
      thresholds,
      observed: {
        avgTurn1ElapsedMs: null,
        avgActivationP95Ms: null,
        avgLosCacheHitRate: null,
        avgPathCacheHitRate: null,
        avgGridCacheHitRate: null,
      },
      pass: {
        turn1Elapsed: null,
        activationP95: null,
        losCacheHitRate: null,
        pathCacheHitRate: null,
        gridCacheHitRate: null,
        overall: null,
      },
    };
  }

  const turn1Times = runsWithPerf
    .map(run => run.performance.turns.find((turn: any) => turn.turn === 1)?.elapsedMs)
    .filter((value): value is number => Number.isFinite(value));
  const activationP95 = runsWithPerf.map(run => run.performance.activationLatency.p95Ms);

  let losHitSum = 0;
  let losHitCount = 0;
  let pathHitSum = 0;
  let pathHitCount = 0;
  let gridHitSum = 0;
  let gridHitCount = 0;
  for (const run of runsWithPerf) {
    const cache = run.performance.caches;
    if (!cache) continue;
    const losTotal = cache.los.hits + cache.los.misses;
    const pathTotal = cache.pathfinding.pathHits + cache.pathfinding.pathMisses;
    const gridTotal = cache.pathfinding.gridHits + cache.pathfinding.gridMisses;
    if (losTotal > 0) {
      losHitSum += safeRate(cache.los.hits, losTotal);
      losHitCount += 1;
    }
    if (pathTotal > 0) {
      pathHitSum += safeRate(cache.pathfinding.pathHits, pathTotal);
      pathHitCount += 1;
    }
    if (gridTotal > 0) {
      gridHitSum += safeRate(cache.pathfinding.gridHits, gridTotal);
      gridHitCount += 1;
    }
  }

  const observed = {
    avgTurn1ElapsedMs: turn1Times.length > 0
      ? Number((turn1Times.reduce((sum, value) => sum + value, 0) / turn1Times.length).toFixed(2))
      : null,
    avgActivationP95Ms: activationP95.length > 0
      ? Number((activationP95.reduce((sum, value) => sum + value, 0) / activationP95.length).toFixed(2))
      : null,
    avgLosCacheHitRate: losHitCount > 0 ? Number((losHitSum / losHitCount).toFixed(4)) : null,
    avgPathCacheHitRate: pathHitCount > 0 ? Number((pathHitSum / pathHitCount).toFixed(4)) : null,
    avgGridCacheHitRate: gridHitCount > 0 ? Number((gridHitSum / gridHitCount).toFixed(4)) : null,
  };

  const pass = {
    turn1Elapsed: observed.avgTurn1ElapsedMs !== null
      ? observed.avgTurn1ElapsedMs <= thresholds.turn1ElapsedMsMax
      : null,
    activationP95: observed.avgActivationP95Ms !== null
      ? observed.avgActivationP95Ms <= thresholds.activationP95MsMax
      : null,
    losCacheHitRate: observed.avgLosCacheHitRate !== null
      ? observed.avgLosCacheHitRate >= thresholds.minLosCacheHitRate
      : null,
    pathCacheHitRate: observed.avgPathCacheHitRate !== null
      ? observed.avgPathCacheHitRate >= thresholds.minPathCacheHitRate
      : null,
    gridCacheHitRate: observed.avgGridCacheHitRate !== null
      ? observed.avgGridCacheHitRate >= thresholds.minGridCacheHitRate
      : null,
    overall: null as boolean | null,
  };

  const gateValues = [
    pass.turn1Elapsed,
    pass.activationP95,
    pass.losCacheHitRate,
    pass.pathCacheHitRate,
    pass.gridCacheHitRate,
  ];
  const resolvedGates = gateValues.filter((value): value is boolean => value !== null);
  pass.overall = resolvedGates.length > 0 ? resolvedGates.every(Boolean) : null;

  return {
    enabled: true,
    runsEvaluated: Math.min(runsEvaluated, totalRuns),
    profile: {
      missionId: context.missionId,
      gameSize: context.gameSize,
      densityRatio: context.densityRatio,
      densityBucket: derived.densityBucket,
      densityBucketIndex: derived.densityBucketIndex,
    },
    thresholds,
    observed,
    pass,
  };
}

/**
 * Calculate rate safely (returns 0 if denominator is 0)
 */
function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

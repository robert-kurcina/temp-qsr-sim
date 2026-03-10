/**
 * Environment Configuration
 *
 * Environment variable handling and performance gate configuration.
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { ValidationAggregateReport } from '../validation/ValidationMetrics';
import { aiBattleTuning } from './EnvGateTuningConfig';

export type GameSizeLike = GameSize | keyof typeof GameSize;

// ============================================================================
// Performance Gate Configuration
// ============================================================================

export const DENSITY_BUCKET_LABELS: readonly string[] = aiBattleTuning.performance.densityBucketLabels;

export const DEFAULT_PERF_GATE_THRESHOLDS = aiBattleTuning.performance.defaultThresholds;

export type PerformanceGateThresholds = {
  turn1ElapsedMsMax: number;
  activationP95MsMax: number;
  minLosCacheHitRate: number;
  minPathCacheHitRate: number;
  minGridCacheHitRate: number;
  minMinimaxLiteCacheHitRate: number;
  minMinimaxPatchCacheHitRate: number;
};

export type PerformanceGateContext = {
  missionId: string;
  gameSize: GameSizeLike;
  densityRatio: number;
};

export type PassivenessGateThresholds = {
  maxPassiveActionRatio: number;
  maxDetectHideActionRatio: number;
  maxWaitActionRatio: number;
};

export type CombatActivityGateThresholds = {
  minAttackActionRatio: number;
  minRunsWithCombatRate: number;
  maxZeroAttackRunRate: number;
};

export type PressureContinuityGateThresholds = {
  minRunsWithDataRate: number;
  minSignatureCoverageRate: number;
  maxCombinedBreakRate: number;
  maxLaneBreakRate: number;
  maxScrumBreakRate: number;
};

export type AttackGateTelemetryGateThresholds = {
  minTelemetrySamplesPerRun: number;
  minImmediateHighOpportunityCount: number;
  minImmediateHighConversionRate: number;
  minPressureOpportunityGateApplyRate: number;
};

export type PassivenessGateContext = {
  missionId: string;
  gameSize: GameSizeLike;
  densityRatio: number;
};

export type CombatActivityGateContext = {
  missionId: string;
  gameSize: GameSizeLike;
  densityRatio: number;
};

export type PressureContinuityGateContext = {
  missionId: string;
  gameSize: GameSizeLike;
  densityRatio: number;
};

export type AttackGateTelemetryGateContext = {
  missionId: string;
  gameSize: GameSizeLike;
  densityRatio: number;
};

const DENSITY_BUCKET_GATE_THRESHOLDS: PerformanceGateThresholds[] =
  aiBattleTuning.performance.densityBucketThresholds;

const GAME_SIZE_LATENCY_FACTORS: Record<GameSize, number> =
  aiBattleTuning.performance.factors.gameSizeLatency;

const GAME_SIZE_CACHE_HIT_FACTORS: Record<GameSize, number> =
  aiBattleTuning.performance.factors.gameSizeCacheHit;

const GAME_SIZE_PATH_CACHE_HIT_FACTORS: Record<GameSize, number> =
  aiBattleTuning.performance.factors.gameSizePathCacheHit;

const GAME_SIZE_MINIMAX_CACHE_HIT_FACTORS: Record<GameSize, number> =
  aiBattleTuning.performance.factors.gameSizeMinimaxCacheHit;

const MISSION_LATENCY_FACTORS: Record<string, number> =
  aiBattleTuning.performance.factors.missionLatency;

const DEFAULT_COMBAT_ACTIVITY_GATE_THRESHOLDS: CombatActivityGateThresholds =
  aiBattleTuning.combatActivity.defaultThresholds;

const MISSION_COMBAT_ACTIVITY_BASE: Record<string, CombatActivityGateThresholds> =
  aiBattleTuning.combatActivity.missionBase;

const COMBAT_ACTIVITY_MIN_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.combatActivity.minGameSizeFactors;

const COMBAT_ACTIVITY_MAX_ZERO_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.combatActivity.maxZeroGameSizeFactors;

const COMBAT_ACTIVITY_MIN_DENSITY_FACTORS: number[] =
  aiBattleTuning.combatActivity.minDensityFactors;

const COMBAT_ACTIVITY_MAX_ZERO_DENSITY_FACTORS: number[] =
  aiBattleTuning.combatActivity.maxZeroDensityFactors;

const DEFAULT_PRESSURE_CONTINUITY_GATE_THRESHOLDS: PressureContinuityGateThresholds =
  aiBattleTuning.pressureContinuity.defaultThresholds;

const MISSION_PRESSURE_CONTINUITY_BASE: Record<string, PressureContinuityGateThresholds> =
  aiBattleTuning.pressureContinuity.missionBase;

const PRESSURE_CONTINUITY_MIN_COVERAGE_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.pressureContinuity.minCoverageGameSizeFactors;

const PRESSURE_CONTINUITY_MAX_BREAK_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.pressureContinuity.maxBreakGameSizeFactors;

const PRESSURE_CONTINUITY_MIN_DATA_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.pressureContinuity.minDataGameSizeFactors;

const PRESSURE_CONTINUITY_MIN_COVERAGE_DENSITY_FACTORS: number[] =
  aiBattleTuning.pressureContinuity.minCoverageDensityFactors;

const PRESSURE_CONTINUITY_MAX_BREAK_DENSITY_FACTORS: number[] =
  aiBattleTuning.pressureContinuity.maxBreakDensityFactors;

const PRESSURE_CONTINUITY_MIN_DATA_DENSITY_FACTORS: number[] =
  aiBattleTuning.pressureContinuity.minDataDensityFactors;

const DEFAULT_ATTACK_GATE_TELEMETRY_THRESHOLDS: AttackGateTelemetryGateThresholds =
  aiBattleTuning.attackGateTelemetry.defaultThresholds;

const MISSION_ATTACK_GATE_TELEMETRY_BASE: Record<string, AttackGateTelemetryGateThresholds> =
  aiBattleTuning.attackGateTelemetry.missionBase;

const ATTACK_GATE_TELEMETRY_SAMPLE_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.attackGateTelemetry.sampleGameSizeFactors;

const ATTACK_GATE_TELEMETRY_RATE_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.attackGateTelemetry.rateGameSizeFactors;

const ATTACK_GATE_TELEMETRY_SAMPLE_DENSITY_FACTORS: number[] =
  aiBattleTuning.attackGateTelemetry.sampleDensityFactors;

const ATTACK_GATE_TELEMETRY_RATE_DENSITY_FACTORS: number[] =
  aiBattleTuning.attackGateTelemetry.rateDensityFactors;

const DEFAULT_PASSIVENESS_GATE_THRESHOLDS: PassivenessGateThresholds =
  aiBattleTuning.passiveness.defaultThresholds;

const MISSION_PASSIVENESS_BASE: Record<string, PassivenessGateThresholds> =
  aiBattleTuning.passiveness.missionBase;

const PASSIVENESS_GAME_SIZE_FACTORS: Record<GameSize, number> =
  aiBattleTuning.passiveness.gameSizeFactors;

const PASSIVENESS_DENSITY_FACTORS: number[] =
  aiBattleTuning.passiveness.densityFactors;

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
 * Normalize game size input (enum member or enum-key string) to canonical GameSize.
 */
export function normalizeGameSize(gameSize: GameSizeLike): GameSize {
  const raw = String(gameSize);
  const enumValue = (GameSize as unknown as Record<string, string>)[raw] ?? raw;
  if ((Object.values(GameSize) as string[]).includes(enumValue)) {
    return enumValue as GameSize;
  }
  throw new Error(`Unsupported game size: ${raw}`);
}

/**
 * Derive performance gate thresholds based on context
 */
export function derivePerformanceGateThresholds(context: PerformanceGateContext): {
  thresholds: PerformanceGateThresholds;
  densityBucket: string;
  densityBucketIndex: number;
} {
  const gameSize = normalizeGameSize(context.gameSize);
  const densityBucketIndex = resolveDensityBucketIndex(context.densityRatio);
  const densityBucket = resolveDensityBucketLabel(densityBucketIndex);
  const baseByDensity = DENSITY_BUCKET_GATE_THRESHOLDS[densityBucketIndex] ?? DEFAULT_PERF_GATE_THRESHOLDS;
  const sizeLatencyFactor = GAME_SIZE_LATENCY_FACTORS[gameSize] ?? 1;
  const missionLatencyFactor = MISSION_LATENCY_FACTORS[context.missionId] ?? 1;
  const latencyFactor = sizeLatencyFactor * missionLatencyFactor;
  const cacheHitFactor = GAME_SIZE_CACHE_HIT_FACTORS[gameSize] ?? 1;
  const pathCacheHitFactor = GAME_SIZE_PATH_CACHE_HIT_FACTORS[gameSize] ?? cacheHitFactor;
  const minimaxCacheHitFactor = GAME_SIZE_MINIMAX_CACHE_HIT_FACTORS[gameSize] ?? cacheHitFactor;

  const thresholds: PerformanceGateThresholds = {
    turn1ElapsedMsMax: Math.round(baseByDensity.turn1ElapsedMsMax * latencyFactor),
    activationP95MsMax: Math.round(baseByDensity.activationP95MsMax * latencyFactor),
    minLosCacheHitRate: Number(clampNumber(baseByDensity.minLosCacheHitRate * cacheHitFactor, 0.02, 0.98).toFixed(4)),
    minPathCacheHitRate: Number(clampNumber(baseByDensity.minPathCacheHitRate * pathCacheHitFactor, 0.01, 0.95).toFixed(4)),
    minGridCacheHitRate: Number(clampNumber(baseByDensity.minGridCacheHitRate, 0.50, 0.995).toFixed(4)),
    minMinimaxLiteCacheHitRate: Number(clampNumber(baseByDensity.minMinimaxLiteCacheHitRate * minimaxCacheHitFactor, 0.01, 0.7).toFixed(4)),
    minMinimaxPatchCacheHitRate: Number(clampNumber(baseByDensity.minMinimaxPatchCacheHitRate * cacheHitFactor, 0.05, 0.95).toFixed(4)),
  };
  return {
    thresholds,
    densityBucket,
    densityBucketIndex,
  };
}

/**
 * Derive passiveness gate thresholds based on mission/size/density context.
 */
export function derivePassivenessGateThresholds(context: PassivenessGateContext): {
  thresholds: PassivenessGateThresholds;
  densityBucket: string;
  densityBucketIndex: number;
} {
  const gameSize = normalizeGameSize(context.gameSize);
  const densityBucketIndex = resolveDensityBucketIndex(context.densityRatio);
  const densityBucket = resolveDensityBucketLabel(densityBucketIndex);
  const base = MISSION_PASSIVENESS_BASE[context.missionId] ?? DEFAULT_PASSIVENESS_GATE_THRESHOLDS;
  const sizeFactor = PASSIVENESS_GAME_SIZE_FACTORS[gameSize] ?? 1;
  const densityFactor = PASSIVENESS_DENSITY_FACTORS[densityBucketIndex] ?? 1;
  const factor = sizeFactor * densityFactor;

  const thresholds: PassivenessGateThresholds = {
    maxPassiveActionRatio: Number(clampNumber(base.maxPassiveActionRatio * factor, 0.10, 0.995).toFixed(4)),
    maxDetectHideActionRatio: Number(clampNumber(base.maxDetectHideActionRatio * factor, 0.05, 0.98).toFixed(4)),
    maxWaitActionRatio: Number(clampNumber(base.maxWaitActionRatio * factor, 0.02, 0.95).toFixed(4)),
  };
  return {
    thresholds,
    densityBucket,
    densityBucketIndex,
  };
}

/**
 * Derive combat activity gate thresholds based on mission/size/density context.
 */
export function deriveCombatActivityGateThresholds(context: CombatActivityGateContext): {
  thresholds: CombatActivityGateThresholds;
  densityBucket: string;
  densityBucketIndex: number;
} {
  const gameSize = normalizeGameSize(context.gameSize);
  const densityBucketIndex = resolveDensityBucketIndex(context.densityRatio);
  const densityBucket = resolveDensityBucketLabel(densityBucketIndex);
  const base = MISSION_COMBAT_ACTIVITY_BASE[context.missionId] ?? DEFAULT_COMBAT_ACTIVITY_GATE_THRESHOLDS;
  const minSizeFactor = COMBAT_ACTIVITY_MIN_GAME_SIZE_FACTORS[gameSize] ?? 1;
  const maxZeroSizeFactor = COMBAT_ACTIVITY_MAX_ZERO_GAME_SIZE_FACTORS[gameSize] ?? 1;
  const minDensityFactor = COMBAT_ACTIVITY_MIN_DENSITY_FACTORS[densityBucketIndex] ?? 1;
  const maxZeroDensityFactor = COMBAT_ACTIVITY_MAX_ZERO_DENSITY_FACTORS[densityBucketIndex] ?? 1;

  const thresholds: CombatActivityGateThresholds = {
    minAttackActionRatio: Number(
      clampNumber(base.minAttackActionRatio * minSizeFactor * minDensityFactor, 0, 0.95).toFixed(4)
    ),
    minRunsWithCombatRate: Number(
      clampNumber(base.minRunsWithCombatRate * minSizeFactor * minDensityFactor, 0, 1).toFixed(4)
    ),
    maxZeroAttackRunRate: Number(
      clampNumber(base.maxZeroAttackRunRate * maxZeroSizeFactor * maxZeroDensityFactor, 0, 1).toFixed(4)
    ),
  };
  return {
    thresholds,
    densityBucket,
    densityBucketIndex,
  };
}

/**
 * Derive pressure continuity gate thresholds based on mission/size/density context.
 */
export function derivePressureContinuityGateThresholds(context: PressureContinuityGateContext): {
  thresholds: PressureContinuityGateThresholds;
  densityBucket: string;
  densityBucketIndex: number;
} {
  const gameSize = normalizeGameSize(context.gameSize);
  const densityBucketIndex = resolveDensityBucketIndex(context.densityRatio);
  const densityBucket = resolveDensityBucketLabel(densityBucketIndex);
  const base = MISSION_PRESSURE_CONTINUITY_BASE[context.missionId] ?? DEFAULT_PRESSURE_CONTINUITY_GATE_THRESHOLDS;
  const minCoverageFactor =
    (PRESSURE_CONTINUITY_MIN_COVERAGE_GAME_SIZE_FACTORS[gameSize] ?? 1) *
    (PRESSURE_CONTINUITY_MIN_COVERAGE_DENSITY_FACTORS[densityBucketIndex] ?? 1);
  const maxBreakFactor =
    (PRESSURE_CONTINUITY_MAX_BREAK_GAME_SIZE_FACTORS[gameSize] ?? 1) *
    (PRESSURE_CONTINUITY_MAX_BREAK_DENSITY_FACTORS[densityBucketIndex] ?? 1);
  const minDataFactor =
    (PRESSURE_CONTINUITY_MIN_DATA_GAME_SIZE_FACTORS[gameSize] ?? 1) *
    (PRESSURE_CONTINUITY_MIN_DATA_DENSITY_FACTORS[densityBucketIndex] ?? 1);

  const thresholds: PressureContinuityGateThresholds = {
    minRunsWithDataRate: Number(clampNumber(base.minRunsWithDataRate * minDataFactor, 0, 1).toFixed(4)),
    minSignatureCoverageRate: Number(clampNumber(base.minSignatureCoverageRate * minCoverageFactor, 0.05, 1).toFixed(4)),
    maxCombinedBreakRate: Number(clampNumber(base.maxCombinedBreakRate * maxBreakFactor, 0, 1).toFixed(4)),
    maxLaneBreakRate: Number(clampNumber(base.maxLaneBreakRate * maxBreakFactor, 0, 1).toFixed(4)),
    maxScrumBreakRate: Number(clampNumber(base.maxScrumBreakRate * maxBreakFactor, 0, 1).toFixed(4)),
  };
  return {
    thresholds,
    densityBucket,
    densityBucketIndex,
  };
}

/**
 * Derive attack-gate telemetry thresholds based on mission/size/density context.
 */
export function deriveAttackGateTelemetryGateThresholds(context: AttackGateTelemetryGateContext): {
  thresholds: AttackGateTelemetryGateThresholds;
  densityBucket: string;
  densityBucketIndex: number;
} {
  const gameSize = normalizeGameSize(context.gameSize);
  const densityBucketIndex = resolveDensityBucketIndex(context.densityRatio);
  const densityBucket = resolveDensityBucketLabel(densityBucketIndex);
  const base = MISSION_ATTACK_GATE_TELEMETRY_BASE[context.missionId] ?? DEFAULT_ATTACK_GATE_TELEMETRY_THRESHOLDS;

  const sampleFactor =
    (ATTACK_GATE_TELEMETRY_SAMPLE_GAME_SIZE_FACTORS[gameSize] ?? 1) *
    (ATTACK_GATE_TELEMETRY_SAMPLE_DENSITY_FACTORS[densityBucketIndex] ?? 1);
  const rateFactor =
    (ATTACK_GATE_TELEMETRY_RATE_GAME_SIZE_FACTORS[gameSize] ?? 1) *
    (ATTACK_GATE_TELEMETRY_RATE_DENSITY_FACTORS[densityBucketIndex] ?? 1);

  const minImmediateHighOpportunityCount = Math.max(
    1,
    Math.round(base.minImmediateHighOpportunityCount * sampleFactor)
  );

  const thresholds: AttackGateTelemetryGateThresholds = {
    minTelemetrySamplesPerRun: Math.max(1, Math.round(base.minTelemetrySamplesPerRun * sampleFactor)),
    minImmediateHighOpportunityCount,
    minImmediateHighConversionRate: Number(clampNumber(base.minImmediateHighConversionRate * rateFactor, 0, 1).toFixed(4)),
    minPressureOpportunityGateApplyRate: Number(clampNumber(base.minPressureOpportunityGateApplyRate * rateFactor, 0, 1).toFixed(4)),
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
  const gameSize = normalizeGameSize(context.gameSize);
  const derived = derivePerformanceGateThresholds(context);
  const thresholds = {
    turn1ElapsedMsMax: readPositiveNumberEnv('AI_BATTLE_GATE_TURN1_MS', derived.thresholds.turn1ElapsedMsMax),
    activationP95MsMax: readPositiveNumberEnv('AI_BATTLE_GATE_ACT_P95_MS', derived.thresholds.activationP95MsMax),
    minLosCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_LOS_HIT_MIN', derived.thresholds.minLosCacheHitRate),
    minPathCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_PATH_HIT_MIN', derived.thresholds.minPathCacheHitRate),
    minGridCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_GRID_HIT_MIN', derived.thresholds.minGridCacheHitRate),
    minMinimaxLiteCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_MINIMAX_HIT_MIN', derived.thresholds.minMinimaxLiteCacheHitRate),
    minMinimaxPatchCacheHitRate: readPositiveNumberEnv('AI_BATTLE_GATE_MINIMAX_PATCH_HIT_MIN', derived.thresholds.minMinimaxPatchCacheHitRate),
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
        gameSize,
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
        avgMinimaxLiteCacheHitRate: null,
        avgMinimaxPatchCacheHitRate: null,
      },
      pass: {
        turn1Elapsed: null,
        activationP95: null,
        losCacheHitRate: null,
        pathCacheHitRate: null,
        gridCacheHitRate: null,
        minimaxLiteCacheHitRate: null,
        minimaxPatchCacheHitRate: null,
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
  let minimaxHitSum = 0;
  let minimaxHitCount = 0;
  let minimaxPatchHitSum = 0;
  let minimaxPatchHitCount = 0;
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
    const minimax = cache.minimaxLite;
    if (minimax) {
      const total = minimax.hits + minimax.misses;
      if (total > 0) {
        minimaxHitSum += safeRate(minimax.hits, total);
        minimaxHitCount += 1;
      }
      const patchCache = minimax.patchGraph;
      if (patchCache) {
        const patchTotal = patchCache.hits + patchCache.misses;
        if (patchTotal > 0) {
          minimaxPatchHitSum += safeRate(patchCache.hits, patchTotal);
          minimaxPatchHitCount += 1;
        }
      }
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
    avgMinimaxLiteCacheHitRate: minimaxHitCount > 0 ? Number((minimaxHitSum / minimaxHitCount).toFixed(4)) : null,
    avgMinimaxPatchCacheHitRate: minimaxPatchHitCount > 0 ? Number((minimaxPatchHitSum / minimaxPatchHitCount).toFixed(4)) : null,
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
    minimaxLiteCacheHitRate: observed.avgMinimaxLiteCacheHitRate !== null
      ? observed.avgMinimaxLiteCacheHitRate >= thresholds.minMinimaxLiteCacheHitRate
      : null,
    minimaxPatchCacheHitRate: observed.avgMinimaxPatchCacheHitRate !== null
      ? observed.avgMinimaxPatchCacheHitRate >= thresholds.minMinimaxPatchCacheHitRate
      : null,
    overall: null as boolean | null,
  };

  const gateValues = [
    pass.turn1Elapsed,
    pass.activationP95,
    pass.losCacheHitRate,
    pass.pathCacheHitRate,
    pass.gridCacheHitRate,
    pass.minimaxLiteCacheHitRate,
    pass.minimaxPatchCacheHitRate,
  ];
  const resolvedGates = gateValues.filter((value): value is boolean => value !== null);
  pass.overall = resolvedGates.length > 0 ? resolvedGates.every(Boolean) : null;

  return {
    enabled: true,
    runsEvaluated: Math.min(runsEvaluated, totalRuns),
    profile: {
      missionId: context.missionId,
      gameSize,
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

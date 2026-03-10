import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import rawAiBattleTuning from '../../../src/data/ai_battle_tuning.json';

type GameSizeFactorMap = Record<GameSize, number>;

interface PerformanceGateThresholdsTuning {
  turn1ElapsedMsMax: number;
  activationP95MsMax: number;
  minLosCacheHitRate: number;
  minPathCacheHitRate: number;
  minGridCacheHitRate: number;
  minMinimaxLiteCacheHitRate: number;
  minMinimaxPatchCacheHitRate: number;
}

interface PassivenessGateThresholdsTuning {
  maxPassiveActionRatio: number;
  maxDetectHideActionRatio: number;
  maxWaitActionRatio: number;
}

interface CombatActivityGateThresholdsTuning {
  minAttackActionRatio: number;
  minRunsWithCombatRate: number;
  maxZeroAttackRunRate: number;
}

interface PressureContinuityGateThresholdsTuning {
  minRunsWithDataRate: number;
  minSignatureCoverageRate: number;
  maxCombinedBreakRate: number;
  maxLaneBreakRate: number;
  maxScrumBreakRate: number;
}

interface AttackGateTelemetryGateThresholdsTuning {
  minTelemetrySamplesPerRun: number;
  minImmediateHighOpportunityCount: number;
  minImmediateHighConversionRate: number;
  minPressureOpportunityGateApplyRate: number;
}

interface ValidationRunnerTuningConfig {
  coordinatorTraceGates: {
    defaultMinRunCoverage: number;
    defaultMinTurnCoverage: number;
    defaultMinSideCoveragePerTurn: number;
  };
  combatActivityGates: {
    defaultMinTurnHorizonRatio: number;
  };
  passivenessGates: {
    defaultMinTurnHorizonRatio: number;
  };
  attackGateTelemetryGates: {
    defaultMinTurnHorizonRatio: number;
    minImmediateHighOpportunityCountFloor: number;
  };
}

interface AIBattleTuningConfig {
  version: number;
  categoryBlocks: {
    performance: {
      densityBucketLabels: string[];
      defaultThresholds: PerformanceGateThresholdsTuning;
      densityBucketThresholds: PerformanceGateThresholdsTuning[];
      factors: {
        gameSizeLatency: GameSizeFactorMap;
        gameSizeCacheHit: GameSizeFactorMap;
        gameSizePathCacheHit: GameSizeFactorMap;
        gameSizeMinimaxCacheHit: GameSizeFactorMap;
        missionLatency: Record<string, number>;
      };
    };
    passiveness: {
      defaultThresholds: PassivenessGateThresholdsTuning;
      missionBase: Record<string, PassivenessGateThresholdsTuning>;
      gameSizeFactors: GameSizeFactorMap;
      densityFactors: number[];
    };
    combatActivity: {
      defaultThresholds: CombatActivityGateThresholdsTuning;
      missionBase: Record<string, CombatActivityGateThresholdsTuning>;
      minGameSizeFactors: GameSizeFactorMap;
      maxZeroGameSizeFactors: GameSizeFactorMap;
      minDensityFactors: number[];
      maxZeroDensityFactors: number[];
    };
    pressureContinuity: {
      defaultThresholds: PressureContinuityGateThresholdsTuning;
      missionBase: Record<string, PressureContinuityGateThresholdsTuning>;
      minCoverageGameSizeFactors: GameSizeFactorMap;
      maxBreakGameSizeFactors: GameSizeFactorMap;
      minDataGameSizeFactors: GameSizeFactorMap;
      minCoverageDensityFactors: number[];
      maxBreakDensityFactors: number[];
      minDataDensityFactors: number[];
    };
    attackGateTelemetry: {
      defaultThresholds: AttackGateTelemetryGateThresholdsTuning;
      missionBase: Record<string, AttackGateTelemetryGateThresholdsTuning>;
      sampleGameSizeFactors: GameSizeFactorMap;
      rateGameSizeFactors: GameSizeFactorMap;
      sampleDensityFactors: number[];
      rateDensityFactors: number[];
    };
    validationRunner: ValidationRunnerTuningConfig;
  };
}

const GAME_SIZES = Object.values(GameSize) as GameSize[];

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid object at ${path}`);
  }
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid number at ${path}`);
  }
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid string array at ${path}`);
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      throw new Error(`Invalid string entry at ${path}[${index}]`);
    }
    return entry;
  });
}

function asNumberArray(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid number array at ${path}`);
  }
  return value.map((entry, index) => asFiniteNumber(entry, `${path}[${index}]`));
}

function asPerformanceThresholds(value: unknown, path: string): PerformanceGateThresholdsTuning {
  const source = asRecord(value, path);
  return {
    turn1ElapsedMsMax: asFiniteNumber(source['turn1ElapsedMsMax'], `${path}.turn1ElapsedMsMax`),
    activationP95MsMax: asFiniteNumber(source['activationP95MsMax'], `${path}.activationP95MsMax`),
    minLosCacheHitRate: asFiniteNumber(source['minLosCacheHitRate'], `${path}.minLosCacheHitRate`),
    minPathCacheHitRate: asFiniteNumber(source['minPathCacheHitRate'], `${path}.minPathCacheHitRate`),
    minGridCacheHitRate: asFiniteNumber(source['minGridCacheHitRate'], `${path}.minGridCacheHitRate`),
    minMinimaxLiteCacheHitRate: asFiniteNumber(source['minMinimaxLiteCacheHitRate'], `${path}.minMinimaxLiteCacheHitRate`),
    minMinimaxPatchCacheHitRate: asFiniteNumber(source['minMinimaxPatchCacheHitRate'], `${path}.minMinimaxPatchCacheHitRate`),
  };
}

function asPassivenessThresholds(value: unknown, path: string): PassivenessGateThresholdsTuning {
  const source = asRecord(value, path);
  return {
    maxPassiveActionRatio: asFiniteNumber(source['maxPassiveActionRatio'], `${path}.maxPassiveActionRatio`),
    maxDetectHideActionRatio: asFiniteNumber(source['maxDetectHideActionRatio'], `${path}.maxDetectHideActionRatio`),
    maxWaitActionRatio: asFiniteNumber(source['maxWaitActionRatio'], `${path}.maxWaitActionRatio`),
  };
}

function asCombatActivityThresholds(value: unknown, path: string): CombatActivityGateThresholdsTuning {
  const source = asRecord(value, path);
  return {
    minAttackActionRatio: asFiniteNumber(source['minAttackActionRatio'], `${path}.minAttackActionRatio`),
    minRunsWithCombatRate: asFiniteNumber(source['minRunsWithCombatRate'], `${path}.minRunsWithCombatRate`),
    maxZeroAttackRunRate: asFiniteNumber(source['maxZeroAttackRunRate'], `${path}.maxZeroAttackRunRate`),
  };
}

function asPressureContinuityThresholds(value: unknown, path: string): PressureContinuityGateThresholdsTuning {
  const source = asRecord(value, path);
  return {
    minRunsWithDataRate: asFiniteNumber(source['minRunsWithDataRate'], `${path}.minRunsWithDataRate`),
    minSignatureCoverageRate: asFiniteNumber(source['minSignatureCoverageRate'], `${path}.minSignatureCoverageRate`),
    maxCombinedBreakRate: asFiniteNumber(source['maxCombinedBreakRate'], `${path}.maxCombinedBreakRate`),
    maxLaneBreakRate: asFiniteNumber(source['maxLaneBreakRate'], `${path}.maxLaneBreakRate`),
    maxScrumBreakRate: asFiniteNumber(source['maxScrumBreakRate'], `${path}.maxScrumBreakRate`),
  };
}

function asAttackGateTelemetryThresholds(value: unknown, path: string): AttackGateTelemetryGateThresholdsTuning {
  const source = asRecord(value, path);
  return {
    minTelemetrySamplesPerRun: asFiniteNumber(source['minTelemetrySamplesPerRun'], `${path}.minTelemetrySamplesPerRun`),
    minImmediateHighOpportunityCount: asFiniteNumber(source['minImmediateHighOpportunityCount'], `${path}.minImmediateHighOpportunityCount`),
    minImmediateHighConversionRate: asFiniteNumber(source['minImmediateHighConversionRate'], `${path}.minImmediateHighConversionRate`),
    minPressureOpportunityGateApplyRate: asFiniteNumber(source['minPressureOpportunityGateApplyRate'], `${path}.minPressureOpportunityGateApplyRate`),
  };
}

function asGameSizeFactorMap(value: unknown, path: string): GameSizeFactorMap {
  const source = asRecord(value, path);
  const resolved = {} as GameSizeFactorMap;
  for (const size of GAME_SIZES) {
    resolved[size] = asFiniteNumber(source[size], `${path}.${size}`);
  }
  return resolved;
}

function asMissionNumberMap(value: unknown, path: string): Record<string, number> {
  const source = asRecord(value, path);
  const resolved: Record<string, number> = {};
  for (const [missionId, rawValue] of Object.entries(source)) {
    resolved[missionId] = asFiniteNumber(rawValue, `${path}.${missionId}`);
  }
  return resolved;
}

function asMissionThresholdMap<T>(
  value: unknown,
  path: string,
  parser: (entry: unknown, entryPath: string) => T
): Record<string, T> {
  const source = asRecord(value, path);
  const resolved: Record<string, T> = {};
  for (const [missionId, rawEntry] of Object.entries(source)) {
    resolved[missionId] = parser(rawEntry, `${path}.${missionId}`);
  }
  return resolved;
}

function asPerformanceThresholdArray(value: unknown, path: string): PerformanceGateThresholdsTuning[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid performance threshold array at ${path}`);
  }
  return value.map((entry, index) => asPerformanceThresholds(entry, `${path}[${index}]`));
}

function asValidationRunnerConfig(value: unknown, path: string): ValidationRunnerTuningConfig {
  const source = asRecord(value, path);
  const coordinatorTraceGates = asRecord(source['coordinatorTraceGates'], `${path}.coordinatorTraceGates`);
  const combatActivityGates = asRecord(source['combatActivityGates'], `${path}.combatActivityGates`);
  const passivenessGates = asRecord(source['passivenessGates'], `${path}.passivenessGates`);
  const attackGateTelemetryGates = asRecord(
    source['attackGateTelemetryGates'],
    `${path}.attackGateTelemetryGates`
  );
  return {
    coordinatorTraceGates: {
      defaultMinRunCoverage: asFiniteNumber(
        coordinatorTraceGates['defaultMinRunCoverage'],
        `${path}.coordinatorTraceGates.defaultMinRunCoverage`
      ),
      defaultMinTurnCoverage: asFiniteNumber(
        coordinatorTraceGates['defaultMinTurnCoverage'],
        `${path}.coordinatorTraceGates.defaultMinTurnCoverage`
      ),
      defaultMinSideCoveragePerTurn: asFiniteNumber(
        coordinatorTraceGates['defaultMinSideCoveragePerTurn'],
        `${path}.coordinatorTraceGates.defaultMinSideCoveragePerTurn`
      ),
    },
    combatActivityGates: {
      defaultMinTurnHorizonRatio: asFiniteNumber(
        combatActivityGates['defaultMinTurnHorizonRatio'],
        `${path}.combatActivityGates.defaultMinTurnHorizonRatio`
      ),
    },
    passivenessGates: {
      defaultMinTurnHorizonRatio: asFiniteNumber(
        passivenessGates['defaultMinTurnHorizonRatio'],
        `${path}.passivenessGates.defaultMinTurnHorizonRatio`
      ),
    },
    attackGateTelemetryGates: {
      defaultMinTurnHorizonRatio: asFiniteNumber(
        attackGateTelemetryGates['defaultMinTurnHorizonRatio'],
        `${path}.attackGateTelemetryGates.defaultMinTurnHorizonRatio`
      ),
      minImmediateHighOpportunityCountFloor: Math.max(
        0,
        Math.floor(
          asFiniteNumber(
            attackGateTelemetryGates['minImmediateHighOpportunityCountFloor'],
            `${path}.attackGateTelemetryGates.minImmediateHighOpportunityCountFloor`
          )
        )
      ),
    },
  };
}

function buildAiBattleTuningConfig(raw: unknown): AIBattleTuningConfig {
  const root = asRecord(raw, 'ai_battle_tuning');
  const categoryBlocks = asRecord(root['categoryBlocks'], 'ai_battle_tuning.categoryBlocks');

  const performance = asRecord(categoryBlocks['performance'], 'ai_battle_tuning.categoryBlocks.performance');
  const performanceFactors = asRecord(performance['factors'], 'ai_battle_tuning.categoryBlocks.performance.factors');

  const passiveness = asRecord(categoryBlocks['passiveness'], 'ai_battle_tuning.categoryBlocks.passiveness');
  const combatActivity = asRecord(categoryBlocks['combatActivity'], 'ai_battle_tuning.categoryBlocks.combatActivity');
  const pressureContinuity = asRecord(
    categoryBlocks['pressureContinuity'],
    'ai_battle_tuning.categoryBlocks.pressureContinuity'
  );
  const attackGateTelemetry = asRecord(
    categoryBlocks['attackGateTelemetry'],
    'ai_battle_tuning.categoryBlocks.attackGateTelemetry'
  );
  const validationRunner = asRecord(
    categoryBlocks['validationRunner'],
    'ai_battle_tuning.categoryBlocks.validationRunner'
  );

  return Object.freeze({
    version: Math.max(1, Math.trunc(asFiniteNumber(root['version'], 'ai_battle_tuning.version'))),
    categoryBlocks: {
      performance: {
        densityBucketLabels: asStringArray(
          performance['densityBucketLabels'],
          'ai_battle_tuning.categoryBlocks.performance.densityBucketLabels'
        ),
        defaultThresholds: asPerformanceThresholds(
          performance['defaultThresholds'],
          'ai_battle_tuning.categoryBlocks.performance.defaultThresholds'
        ),
        densityBucketThresholds: asPerformanceThresholdArray(
          performance['densityBucketThresholds'],
          'ai_battle_tuning.categoryBlocks.performance.densityBucketThresholds'
        ),
        factors: {
          gameSizeLatency: asGameSizeFactorMap(
            performanceFactors['gameSizeLatency'],
            'ai_battle_tuning.categoryBlocks.performance.factors.gameSizeLatency'
          ),
          gameSizeCacheHit: asGameSizeFactorMap(
            performanceFactors['gameSizeCacheHit'],
            'ai_battle_tuning.categoryBlocks.performance.factors.gameSizeCacheHit'
          ),
          gameSizePathCacheHit: asGameSizeFactorMap(
            performanceFactors['gameSizePathCacheHit'],
            'ai_battle_tuning.categoryBlocks.performance.factors.gameSizePathCacheHit'
          ),
          gameSizeMinimaxCacheHit: asGameSizeFactorMap(
            performanceFactors['gameSizeMinimaxCacheHit'],
            'ai_battle_tuning.categoryBlocks.performance.factors.gameSizeMinimaxCacheHit'
          ),
          missionLatency: asMissionNumberMap(
            performanceFactors['missionLatency'],
            'ai_battle_tuning.categoryBlocks.performance.factors.missionLatency'
          ),
        },
      },
      passiveness: {
        defaultThresholds: asPassivenessThresholds(
          passiveness['defaultThresholds'],
          'ai_battle_tuning.categoryBlocks.passiveness.defaultThresholds'
        ),
        missionBase: asMissionThresholdMap(
          passiveness['missionBase'],
          'ai_battle_tuning.categoryBlocks.passiveness.missionBase',
          asPassivenessThresholds
        ),
        gameSizeFactors: asGameSizeFactorMap(
          passiveness['gameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.passiveness.gameSizeFactors'
        ),
        densityFactors: asNumberArray(
          passiveness['densityFactors'],
          'ai_battle_tuning.categoryBlocks.passiveness.densityFactors'
        ),
      },
      combatActivity: {
        defaultThresholds: asCombatActivityThresholds(
          combatActivity['defaultThresholds'],
          'ai_battle_tuning.categoryBlocks.combatActivity.defaultThresholds'
        ),
        missionBase: asMissionThresholdMap(
          combatActivity['missionBase'],
          'ai_battle_tuning.categoryBlocks.combatActivity.missionBase',
          asCombatActivityThresholds
        ),
        minGameSizeFactors: asGameSizeFactorMap(
          combatActivity['minGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.combatActivity.minGameSizeFactors'
        ),
        maxZeroGameSizeFactors: asGameSizeFactorMap(
          combatActivity['maxZeroGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.combatActivity.maxZeroGameSizeFactors'
        ),
        minDensityFactors: asNumberArray(
          combatActivity['minDensityFactors'],
          'ai_battle_tuning.categoryBlocks.combatActivity.minDensityFactors'
        ),
        maxZeroDensityFactors: asNumberArray(
          combatActivity['maxZeroDensityFactors'],
          'ai_battle_tuning.categoryBlocks.combatActivity.maxZeroDensityFactors'
        ),
      },
      pressureContinuity: {
        defaultThresholds: asPressureContinuityThresholds(
          pressureContinuity['defaultThresholds'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.defaultThresholds'
        ),
        missionBase: asMissionThresholdMap(
          pressureContinuity['missionBase'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.missionBase',
          asPressureContinuityThresholds
        ),
        minCoverageGameSizeFactors: asGameSizeFactorMap(
          pressureContinuity['minCoverageGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.minCoverageGameSizeFactors'
        ),
        maxBreakGameSizeFactors: asGameSizeFactorMap(
          pressureContinuity['maxBreakGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.maxBreakGameSizeFactors'
        ),
        minDataGameSizeFactors: asGameSizeFactorMap(
          pressureContinuity['minDataGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.minDataGameSizeFactors'
        ),
        minCoverageDensityFactors: asNumberArray(
          pressureContinuity['minCoverageDensityFactors'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.minCoverageDensityFactors'
        ),
        maxBreakDensityFactors: asNumberArray(
          pressureContinuity['maxBreakDensityFactors'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.maxBreakDensityFactors'
        ),
        minDataDensityFactors: asNumberArray(
          pressureContinuity['minDataDensityFactors'],
          'ai_battle_tuning.categoryBlocks.pressureContinuity.minDataDensityFactors'
        ),
      },
      attackGateTelemetry: {
        defaultThresholds: asAttackGateTelemetryThresholds(
          attackGateTelemetry['defaultThresholds'],
          'ai_battle_tuning.categoryBlocks.attackGateTelemetry.defaultThresholds'
        ),
        missionBase: asMissionThresholdMap(
          attackGateTelemetry['missionBase'],
          'ai_battle_tuning.categoryBlocks.attackGateTelemetry.missionBase',
          asAttackGateTelemetryThresholds
        ),
        sampleGameSizeFactors: asGameSizeFactorMap(
          attackGateTelemetry['sampleGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.attackGateTelemetry.sampleGameSizeFactors'
        ),
        rateGameSizeFactors: asGameSizeFactorMap(
          attackGateTelemetry['rateGameSizeFactors'],
          'ai_battle_tuning.categoryBlocks.attackGateTelemetry.rateGameSizeFactors'
        ),
        sampleDensityFactors: asNumberArray(
          attackGateTelemetry['sampleDensityFactors'],
          'ai_battle_tuning.categoryBlocks.attackGateTelemetry.sampleDensityFactors'
        ),
        rateDensityFactors: asNumberArray(
          attackGateTelemetry['rateDensityFactors'],
          'ai_battle_tuning.categoryBlocks.attackGateTelemetry.rateDensityFactors'
        ),
      },
      validationRunner: asValidationRunnerConfig(
        validationRunner,
        'ai_battle_tuning.categoryBlocks.validationRunner'
      ),
    },
  });
}

export const aiBattleTuningConfig = buildAiBattleTuningConfig(rawAiBattleTuning);
export const aiBattleTuning = aiBattleTuningConfig.categoryBlocks;

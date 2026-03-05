/**
 * Validation Metrics
 *
 * Interfaces and helper functions for validation coverage and metrics tracking.
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition } from '../../../src/lib/mest-tactics/utils/visibility';
import { BattlefieldLosCacheStats } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { PathfindingCacheStats } from '../../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import type { BattlePerformanceSummary } from '../../shared/BattleReportTypes';

// ============================================================================
// Battle Statistics
// ============================================================================

export interface BattleStats {
  totalActions: number;
  moves: number;
  movesWhileWaiting: number;
  closeCombats: number;
  rangedCombats: number;
  disengages: number;
  waits: number;
  waitsSelectedPlanner: number;
  waitsSelectedUtility: number;
  waitChoicesGiven: number;
  waitChoicesTaken: number;
  waitChoicesSucceeded: number;
  waitMaintained: number;
  waitUpkeepPaid: number;
  detects: number;
  hides: number;
  reacts: number;
  reactChoiceWindows: number;
  reactChoicesGiven: number;
  reactChoicesTaken: number;
  waitTriggeredReacts: number;
  reactWoundsInflicted: number;
  waitReactWoundsInflicted: number;
  eliminations: number;
  kos: number;
  turnsCompleted: number;
  losChecks: number;
  lofChecks: number;
  totalPathLength: number;
  modelsMoved: number;
}

// ============================================================================
// Advanced Rule Metrics
// ============================================================================

export interface RuleTypeBreakdown {
  [type: string]: number;
}

export interface BonusActionMetrics {
  opportunities: number;
  optionsOffered: number;
  optionsAvailable: number;
  offeredByType: RuleTypeBreakdown;
  availableByType: RuleTypeBreakdown;
  executed: number;
  executedByType: RuleTypeBreakdown;
}

export interface PassiveOptionMetrics {
  opportunities: number;
  optionsOffered: number;
  optionsAvailable: number;
  offeredByType: RuleTypeBreakdown;
  availableByType: RuleTypeBreakdown;
  used: number;
  usedByType: RuleTypeBreakdown;
}

export interface SituationalModifierMetrics {
  testsObserved: number;
  modifiedTests: number;
  modifiersApplied: number;
  byType: RuleTypeBreakdown;
}

export interface AdvancedRuleMetrics {
  bonusActions: BonusActionMetrics;
  passiveOptions: PassiveOptionMetrics;
  situationalModifiers: SituationalModifierMetrics;
}

// ============================================================================
// Validation Coverage
// ============================================================================

export interface ValidationCoverage {
  movement: boolean;
  pathfinding: boolean;
  rangedCombat: boolean;
  closeCombat: boolean;
  react: boolean;
  wait: boolean;
  detect: boolean;
  los: boolean;
  lof: boolean;
}

// ============================================================================
// Validation Aggregate Report
// ============================================================================

export interface ValidationAggregateReport {
  missionId: string;
  gameSize: GameSize;
  densityRatio: number;
  tacticalDoctrine: string;
  sideDoctrines: Array<{
    sideName: string;
    tacticalDoctrine: TacticalDoctrine;
    loadoutProfile: 'default' | 'melee_only';
  }>;
  loadoutProfile: 'default' | 'melee_only';
  lighting: LightingCondition;
  visibilityOrMu: number;
  maxOrm: number;
  allowConcentrateRangeExtension: boolean;
  perCharacterFovLos: boolean;
  runs: number;
  baseSeed: number;
  winners: Record<string, number>;
  totals: BattleStats;
  averages: BattleStats;
  advancedRuleTotals: AdvancedRuleMetrics;
  advancedRuleAverages: AdvancedRuleMetrics;
  /** Union of runtime and probe coverage (legacy field). */
  coverage: ValidationCoverage;
  /** Coverage observed in actual battle runs only. */
  runtimeCoverage: ValidationCoverage;
  /** Coverage observed from synthetic mechanic probes only. */
  probeCoverage: ValidationCoverage;
  performanceGates?: {
    enabled: boolean;
    runsEvaluated: number;
    profile: {
      missionId: string;
      gameSize: GameSize;
      densityRatio: number;
      densityBucket: string;
      densityBucketIndex: number;
    };
    thresholds: {
      turn1ElapsedMsMax: number;
      activationP95MsMax: number;
      minLosCacheHitRate: number;
      minPathCacheHitRate: number;
      minGridCacheHitRate: number;
    };
    observed: {
      avgTurn1ElapsedMs: number | null;
      avgActivationP95Ms: number | null;
      avgLosCacheHitRate: number | null;
      avgPathCacheHitRate: number | null;
      avgGridCacheHitRate: number | null;
    };
    pass: {
      turn1Elapsed: boolean | null;
      activationP95: boolean | null;
      losCacheHitRate: boolean | null;
      pathCacheHitRate: boolean | null;
      gridCacheHitRate: boolean | null;
      overall: boolean | null;
    };
  };
  runReports: Array<{
    run: number;
    seed: number;
    winner: string;
    finalCounts: Array<{ name: string; remaining: number }>;
    stats: BattleStats;
    usage: {
      modelCount: number;
      modelsMoved: number;
      modelsUsedWait: number;
      modelsUsedDetect: number;
      modelsUsedHide: number;
      modelsUsedReact: number;
      totalPathLength: number;
      averagePathLengthPerMovedModel: number;
      averagePathLengthPerModel: number;
      topPathModels: Array<{
        modelId: string;
        modelName: string;
        side: string;
        pathLength: number;
        moveActions: number;
      }>;
    };
    missionRuntime?: {
      vpBySide: Record<string, number>;
      rpBySide: Record<string, number>;
      immediateWinnerSideId?: string;
    };
    nestedSections: any;
    advancedRules: AdvancedRuleMetrics;
    performance?: BattlePerformanceSummary;
  }>;
  generatedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate rate safely (returns 0 if denominator is 0)
 */
export function safeRate(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

/**
 * Create empty battle stats
 */
export function createEmptyStats(): BattleStats {
  return {
    totalActions: 0,
    moves: 0,
    movesWhileWaiting: 0,
    closeCombats: 0,
    rangedCombats: 0,
    disengages: 0,
    waits: 0,
    waitsSelectedPlanner: 0,
    waitsSelectedUtility: 0,
    waitChoicesGiven: 0,
    waitChoicesTaken: 0,
    waitChoicesSucceeded: 0,
    waitMaintained: 0,
    waitUpkeepPaid: 0,
    detects: 0,
    hides: 0,
    reacts: 0,
    reactChoiceWindows: 0,
    reactChoicesGiven: 0,
    reactChoicesTaken: 0,
    waitTriggeredReacts: 0,
    reactWoundsInflicted: 0,
    waitReactWoundsInflicted: 0,
    eliminations: 0,
    kos: 0,
    turnsCompleted: 0,
    losChecks: 0,
    lofChecks: 0,
    totalPathLength: 0,
    modelsMoved: 0,
  };
}

/**
 * Create empty advanced rule metrics
 */
export function createEmptyAdvancedRuleMetrics(): AdvancedRuleMetrics {
  return {
    bonusActions: {
      opportunities: 0,
      optionsOffered: 0,
      optionsAvailable: 0,
      offeredByType: {},
      availableByType: {},
      executed: 0,
      executedByType: {},
    },
    passiveOptions: {
      opportunities: 0,
      optionsOffered: 0,
      optionsAvailable: 0,
      offeredByType: {},
      availableByType: {},
      used: 0,
      usedByType: {},
    },
    situationalModifiers: {
      testsObserved: 0,
      modifiedTests: 0,
      modifiersApplied: 0,
      byType: {},
    },
  };
}

/**
 * Create empty validation coverage
 */
export function emptyCoverage(): ValidationCoverage {
  return {
    movement: false,
    pathfinding: false,
    rangedCombat: false,
    closeCombat: false,
    react: false,
    wait: false,
    detect: false,
    los: false,
    lof: false,
  };
}

/**
 * Derive coverage from battle stats
 */
export function baseCoverageFromStats(stats: BattleStats): ValidationCoverage {
  return {
    movement: stats.moves > 0,
    pathfinding: stats.moves > 0,
    rangedCombat: stats.rangedCombats > 0,
    closeCombat: stats.closeCombats > 0,
    react: stats.reacts > 0,
    wait: stats.waits > 0,
    detect: stats.detects > 0,
    los: stats.losChecks > 0,
    lof: stats.lofChecks > 0,
  };
}

/**
 * Merge coverage objects
 */
export function mergeCoverage(
  coverage: ValidationCoverage,
  patch: Partial<ValidationCoverage>
): ValidationCoverage {
  return {
    movement: coverage.movement || Boolean(patch.movement),
    pathfinding: coverage.pathfinding || Boolean(patch.pathfinding),
    rangedCombat: coverage.rangedCombat || Boolean(patch.rangedCombat),
    closeCombat: coverage.closeCombat || Boolean(patch.closeCombat),
    react: coverage.react || Boolean(patch.react),
    wait: coverage.wait || Boolean(patch.wait),
    detect: coverage.detect || Boolean(patch.detect),
    los: coverage.los || Boolean(patch.los),
    lof: coverage.lof || Boolean(patch.lof),
  };
}

/**
 * Accumulate stats from one battle into totals
 */
export function accumulateStats(total: BattleStats, add: BattleStats) {
  (Object.keys(total) as Array<keyof BattleStats>).forEach((key) => {
    total[key] += add[key];
  });
}

/**
 * Divide stats by number of runs to get averages
 */
export function divideStats(total: BattleStats, runs: number): BattleStats {
  const avg = createEmptyStats();
  (Object.keys(total) as Array<keyof BattleStats>).forEach((key) => {
    avg[key] = Number((total[key] / runs).toFixed(2));
  });
  return avg;
}

/**
 * Merge type breakdown objects
 */
export function mergeTypeBreakdown(total: RuleTypeBreakdown, add: RuleTypeBreakdown) {
  for (const [type, count] of Object.entries(add)) {
    total[type] = (total[type] ?? 0) + count;
  }
}

/**
 * Divide type breakdown by number of runs
 */
export function divideTypeBreakdown(total: RuleTypeBreakdown, runs: number): RuleTypeBreakdown {
  const avg: RuleTypeBreakdown = {};
  for (const [type, count] of Object.entries(total)) {
    avg[type] = Number((count / runs).toFixed(2));
  }
  return avg;
}

/**
 * Accumulate advanced rule metrics
 */
export function accumulateAdvancedRuleMetrics(total: AdvancedRuleMetrics, add: AdvancedRuleMetrics) {
  total.bonusActions.opportunities += add.bonusActions.opportunities;
  total.bonusActions.optionsOffered += add.bonusActions.optionsOffered;
  total.bonusActions.optionsAvailable += add.bonusActions.optionsAvailable;
  total.bonusActions.executed += add.bonusActions.executed;
  mergeTypeBreakdown(total.bonusActions.offeredByType, add.bonusActions.offeredByType);
  mergeTypeBreakdown(total.bonusActions.availableByType, add.bonusActions.availableByType);
  mergeTypeBreakdown(total.bonusActions.executedByType, add.bonusActions.executedByType);

  total.passiveOptions.opportunities += add.passiveOptions.opportunities;
  total.passiveOptions.optionsOffered += add.passiveOptions.optionsOffered;
  total.passiveOptions.optionsAvailable += add.passiveOptions.optionsAvailable;
  total.passiveOptions.used += add.passiveOptions.used;
  mergeTypeBreakdown(total.passiveOptions.offeredByType, add.passiveOptions.offeredByType);
  mergeTypeBreakdown(total.passiveOptions.availableByType, add.passiveOptions.availableByType);
  mergeTypeBreakdown(total.passiveOptions.usedByType, add.passiveOptions.usedByType);

  total.situationalModifiers.testsObserved += add.situationalModifiers.testsObserved;
  total.situationalModifiers.modifiedTests += add.situationalModifiers.modifiedTests;
  total.situationalModifiers.modifiersApplied += add.situationalModifiers.modifiersApplied;
  mergeTypeBreakdown(total.situationalModifiers.byType, add.situationalModifiers.byType);
}

/**
 * Divide advanced rule metrics by number of runs
 */
export function divideAdvancedRuleMetrics(total: AdvancedRuleMetrics, runs: number): AdvancedRuleMetrics {
  return {
    bonusActions: {
      opportunities: Number((total.bonusActions.opportunities / runs).toFixed(2)),
      optionsOffered: Number((total.bonusActions.optionsOffered / runs).toFixed(2)),
      optionsAvailable: Number((total.bonusActions.optionsAvailable / runs).toFixed(2)),
      offeredByType: divideTypeBreakdown(total.bonusActions.offeredByType, runs),
      availableByType: divideTypeBreakdown(total.bonusActions.availableByType, runs),
      executed: Number((total.bonusActions.executed / runs).toFixed(2)),
      executedByType: divideTypeBreakdown(total.bonusActions.executedByType, runs),
    },
    passiveOptions: {
      opportunities: Number((total.passiveOptions.opportunities / runs).toFixed(2)),
      optionsOffered: Number((total.passiveOptions.optionsOffered / runs).toFixed(2)),
      optionsAvailable: Number((total.passiveOptions.optionsAvailable / runs).toFixed(2)),
      offeredByType: divideTypeBreakdown(total.passiveOptions.offeredByType, runs),
      availableByType: divideTypeBreakdown(total.passiveOptions.availableByType, runs),
      used: Number((total.passiveOptions.used / runs).toFixed(2)),
      usedByType: divideTypeBreakdown(total.passiveOptions.usedByType, runs),
    },
    situationalModifiers: {
      testsObserved: Number((total.situationalModifiers.testsObserved / runs).toFixed(2)),
      modifiedTests: Number((total.situationalModifiers.modifiedTests / runs).toFixed(2)),
      modifiersApplied: Number((total.situationalModifiers.modifiersApplied / runs).toFixed(2)),
      byType: divideTypeBreakdown(total.situationalModifiers.byType, runs),
    },
  };
}

// ============================================================================
// Additional Types for AIBattleRunner
// ============================================================================

export interface SideSection {
  name: string;
  assemblies: AssemblySection[];
}

export interface AssemblySection {
  name: string;
  totalBP: number;
  characters: CharacterSection[];
}

export interface CharacterSection {
  id: string;
  name: string;
  profile: {
    name: string;
    archetype: string;
    attributes: Record<string, number>;
    finalAttributes: Record<string, number>;
    totalBp?: number;
    burdenTotal?: number;
    equipment: Array<{
      name: string;
      classification?: string;
      traits?: string[];
    }>;
  };
  startPosition?: { x: number; y: number };
  endPosition?: { x: number; y: number };
  state: ModelStateAudit;
}

export interface ModelStateAudit {
  wounds: number;
  delayTokens: number;
  fearTokens: number;
  isKOd: boolean;
  isEliminated: boolean;
  isHidden: boolean;
  isWaiting: boolean;
  isAttentive: boolean;
  isOrdered: boolean;
}

export interface ReactAuditResult {
  executed: boolean;
  reactor?: any;
  reactorWasWaiting?: boolean;
  choiceWindowOffered?: boolean;
  choicesGiven?: number;
  resultCode?: string;
  vector?: any;
  opposedTest?: any;
  details?: Record<string, unknown>;
  rawResult?: unknown;
}

// ============================================================================
// Context Modifier Keys
// ============================================================================

export const CONTEXT_MODIFIER_KEYS: Record<string, string> = {
  isCharge: 'charge',
  isDefending: 'defend',
  isOverreach: 'overreach',
  isSudden: 'sudden',
  hasSuddenness: 'suddenness',
  isConcentrating: 'concentrate',
  isFocusing: 'focus',
  isBlindAttack: 'blind_attack',
  assistingModels: 'assisting_models',
  outnumberAdvantage: 'outnumber_advantage',
  hasHighGround: 'high_ground',
  isCornered: 'cornered',
  isFlanked: 'flanked',
  orm: 'distance_orm',
  isPointBlank: 'point_blank',
  hasElevationAdvantage: 'elevation_advantage',
  obscuringModels: 'obscuring_models',
  isLeaning: 'leaning',
  isTargetLeaning: 'target_leaning',
  hasInterveningCover: 'intervening_cover',
  hasDirectCover: 'direct_cover',
  hasHardCover: 'hard_cover',
  isConfined: 'confined',
  blindersThrownPenalty: 'blinders_thrown_penalty',
  reactPenaltyBase: 'react_penalty',
  multipleAttackPenalty: 'multiple_attack_penalty',
  burstBonusBase: 'burst_bonus',
  handPenaltyBase: 'hand_penalty',
  sizeAdvantage: 'size_advantage',
  unarmedPenalty: 'unarmed_penalty',
  acrobaticBonus: 'acrobatic_bonus',
  elevationAdvantage: 'elevation_bonus',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute percentile from sorted values
 */
export function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const safePercentile = Math.max(0, Math.min(1, percentile));
  const index = (sortedValues.length - 1) * safePercentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] + ((sortedValues[upper] - sortedValues[lower]) * weight);
}

/**
 * Create seeded random function
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Create empty knowledge object for AI
 */
import type { CharacterKnowledge } from '../../../src/lib/mest-tactics/ai/core/AIController';

export function emptyKnowledge(turn: number): CharacterKnowledge {
  return {
    knownEnemies: new Map(),
    knownTerrain: new Map(),
    lastKnownPositions: new Map(),
    threatZones: [],
    safeZones: [],
    lastUpdated: turn,
  };
}

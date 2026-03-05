/**
 * Shared Battle Report Types
 * 
 * Common interfaces used across battle scripts for reporting and validation.
 * These types define the data contract for battle output.
 */

import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition } from '../../src/lib/mest-tactics/utils/visibility';
import { BattlefieldLosCacheStats } from '../../src/lib/mest-tactics/battlefield/Battlefield';
import { PathfindingCacheStats } from '../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import type { GameConfig, SideConfig } from '../ai-battle/AIBattleConfig';
import type { ModelStateAudit, OpposedTestAudit, AuditVector, ModelEffectAudit, ActionStepAudit as CoreActionStepAudit } from '../../src/lib/mest-tactics/audit/AuditService';

export type { GameConfig, SideConfig } from '../ai-battle/AIBattleConfig';

// Re-export audit types for scripts that need them
export type { ModelStateAudit, OpposedTestAudit, AuditVector, ModelEffectAudit };

// ============================================================================
// Battle Report Structure
// ============================================================================

export interface BattleReport {
  config: GameConfig;
  winner: string;
  finalCounts: Array<{ name: string; remaining: number }>;
  stats: BattleStats;
  missionRuntime?: {
    vpBySide: Record<string, number>;
    rpBySide: Record<string, number>;
    immediateWinnerSideId?: string;
    predictedScoring?: {
      bySide: Record<string, {
        predictedVp: number;
        predictedRp: number;
        keyScores: Record<string, {
          current: number;
          predicted: number;
          confidence: number;
          leadMargin: number;
        }>;
      }>;
    };
  };
  sideStrategies?: Record<string, {
    doctrine: string;
    advice: string[];
    context?: {
      amILeading: boolean;
      vpMargin: number;
      winningKeys: string[];
      losingKeys: string[];
    };
  }>;
  usage?: UsageMetrics;
  nestedSections: NestedSections;
  advancedRules: AdvancedRuleMetrics;
  log: BattleLogEntry[];
  audit?: BattleAuditTrace;
  performance?: BattlePerformanceSummary;
  seed?: number;
}

// ============================================================================
// Statistics & Metrics
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

export interface UsageMetrics {
  totalTokens: number;
  tokensPerActivation: number;
  decisionLatencyMs: number;
  // Backward compatibility properties
  modelCount?: number;
  modelsMoved?: number;
  modelsUsedWait?: number;
  modelsUsedDetect?: number;
  modelsUsedHide?: number;
  modelsUsedReact?: number;
  // Path tracking properties
  totalPathLength?: number;
  averagePathLengthPerMovedModel?: number;
  averagePathLengthPerModel?: number;
  topPathModels?: Array<{ modelId: string; pathLength: number }>;
}

/**
 * Per-model usage statistics tracking
 */
export interface ModelUsageStats {
  modelId: string;
  modelName: string;
  side?: string;
  pathLength: number;
  moveActions: number;
  waitChoicesGiven: number;
  waitAttempts: number;
  waitSuccesses: number;
  detectAttempts: number;
  detectSuccesses: number;
  hideAttempts: number;
  hideSuccesses: number;
  reactChoiceWindows: number;
  reactChoicesGiven: number;
  reactAttempts: number;
  reactSuccesses: number;
}

export interface NestedSections {
  melee: number;
  ranged: number;
  movement: number;
  tactical: number;
  support: number;
}

export interface RuleTypeBreakdown {
  [type: string]: number;
}

export interface AdvancedRuleMetrics {
  bonusActions: {
    opportunities: number;
    optionsOffered: number;
    optionsAvailable: number;
    offeredByType: RuleTypeBreakdown;
    availableByType: RuleTypeBreakdown;
    executed: number;
    executedByType: RuleTypeBreakdown;
  };
  passiveOptions: {
    opportunities: number;
    optionsOffered: number;
    optionsAvailable: number;
    offeredByType: RuleTypeBreakdown;
    availableByType: RuleTypeBreakdown;
    used: number;
    usedByType: RuleTypeBreakdown;
  };
  situationalModifiers: {
    testsObserved: number;
    modifiedTests: number;
    modifiersApplied: number;
    byType: RuleTypeBreakdown;
  };
}

export interface BattleLogEntry {
  turn: number;
  activation: number;
  sideName: string;
  modelName: string;
  action: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Audit Trace (for visual replay)
// ============================================================================

export interface BattleAuditTrace {
  version: '1.0';
  session: {
    missionId: string;
    missionName: string;
    seed?: number;
    lighting: LightingCondition;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
  };
  battlefield: {
    widthMu: number;
    heightMu: number;
    movementSampleStepMu: number;
    lofWidthMu: number;
    exportPath?: string; // Reference to battlefield.json
  };
  turns: TurnAudit[];
}

export interface TurnAudit {
  turn: number;
  activations: ActivationAudit[];
  sideSummaries: Array<{
    sideName: string;
    activeModelsStart: number;
    activeModelsEnd: number;
  }>;
}

export interface ActivationAudit {
  activationSequence: number;
  turn: number;
  sideIndex: number;
  sideName: string;
  modelId: string;
  modelName: string;
  initiative: number;
  apStart: number;
  apEnd: number;
  waitAtStart: boolean;
  waitMaintained: boolean;
  waitUpkeepPaid: boolean;
  delayTokensAtStart: number;
  delayTokensAfterUpkeep: number;
  steps: ActionStepAudit[];
  skippedReason?: string;
}

// Use the core ActionStepAudit from AuditService for full compatibility
export type ActionStepAudit = CoreActionStepAudit;

// ============================================================================
// Performance Metrics
// ============================================================================

export interface BattlePerformanceSummary {
  elapsedMs: number;
  activationsProcessed: number;
  heartbeatEveryActivations: number;
  activationLatency: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    maxMs: number;
  };
  phases: Record<string, PhaseTimingSummary>;
  turns: TurnTimingSummary[];
  slowestActivations: SlowActivationSummary[];
  caches?: {
    los: BattlefieldLosCacheStats;
    pathfinding: PathfindingCacheStats;
  };
}

export interface PhaseTimingSummary {
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
}

export interface TurnTimingSummary {
  turn: number;
  elapsedMs: number;
  activations: number;
}

export interface SlowActivationSummary {
  turn: number;
  sideName: string;
  modelId: string;
  modelName: string;
  elapsedMs: number;
  steps: number;
  // Backward compatibility property
  durationMs?: number;
}

// ============================================================================
// Validation Report Types
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
  coverage: ValidationCoverage;
  runtimeCoverage: ValidationCoverage;
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
      maxAvgMs: number;
      maxP95Ms: number;
      minHeartbeat: number;
    };
    results: {
      avgMs: number;
      p95Ms: number;
      heartbeat: number;
      passed: boolean;
      failures: string[];
    };
  };
}

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
  winnerReason?: 'mission_immediate' | 'mission_vp' | 'initiative_card' | 'remaining_models' | 'draw' | 'none';
  tieBreakMethod?: 'none' | 'initiative_card';
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
    pressureContinuityDiagnostics?: {
      scrum: {
        updates: number;
        signatureSamples: number;
        signatureMatches: number;
        signatureBreaks: number;
        missingSignatureUpdates: number;
        signatureCoverageRate: number;
        breakRate: number;
        matchRate: number;
      };
      lane: {
        updates: number;
        signatureSamples: number;
        signatureMatches: number;
        signatureBreaks: number;
        missingSignatureUpdates: number;
        signatureCoverageRate: number;
        breakRate: number;
        matchRate: number;
      };
      combined: {
        updates: number;
        signatureSamples: number;
        signatureMatches: number;
        signatureBreaks: number;
        missingSignatureUpdates: number;
        signatureCoverageRate: number;
        breakRate: number;
        matchRate: number;
      };
    };
    decisionTrace?: Array<{
      turn: number;
      sideId: string;
      doctrine: string;
      observations: {
        amILeading: boolean;
        vpMargin: number;
        winningKeys: string[];
        losingKeys: string[];
        topOpponentKeyPressure: Array<{
          key: string;
          predicted: number;
          confidence: number;
        }>;
        topTargetCommitments: Array<{
          targetId: string;
          score: number;
          attackerCount: number;
        }>;
        topScrumContinuity: Array<{
          targetId: string;
          score: number;
          attackerCount: number;
        }>;
        topLanePressure: Array<{
          targetId: string;
          score: number;
          attackerCount: number;
        }>;
        fractionalPotential?: {
          myVpPotential: number;
          opponentVpPotential: number;
          potentialDelta: number;
          urgency: number;
        };
      };
      response: {
        priority: string;
        advice: string[];
        focusTargets: string[];
        potentialDirective?: string;
        pressureDirective?: string;
      };
    }>;
  }>;
  usage?: UsageMetrics;
  nestedSections: NestedSections;
  advancedRules: AdvancedRuleMetrics;
  log: BattleLogEntry[];
  entities?: BattleEntityManifest;
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
  /** Decision samples that reported AI decisionTelemetry payloads. */
  decisionTelemetrySamples?: number;
  /** Number of decisions where attack gate overrode passive preference. */
  attackGateAppliedDecisions?: number;
  /** Attack-gate decisions caused by immediate-high attack window. */
  attackGateImmediateHighApplied?: number;
  /** Attack-gate decisions caused by directive attack window. */
  attackGateDirectiveApplied?: number;
  /** Decision telemetry attack opportunity grade counters. */
  attackOpportunityImmediateHigh?: number;
  attackOpportunityImmediateLow?: number;
  attackOpportunitySetup?: number;
  attackOpportunityNone?: number;
  /** Combat efficacy counters. */
  hitTestsAttempted?: number;
  hitTestsPassed?: number;
  hitTestsFailed?: number;
  damageTestsAttempted?: number;
  damageTestsPassed?: number;
  damageTestsFailed?: number;
  /** Positive token/state assignments observed during combat resolution steps. */
  woundsAssigned?: number;
  fearAssigned?: number;
  delayAssigned?: number;
  /** Assignments attributable to damage resolution (QSR wound/stun damage effects). */
  damageWoundsAssigned?: number;
  damageFearAssigned?: number;
  damageDelayAssigned?: number;
  /** Delay assigned from non-damage sources (for example Defend/Take Cover/passive or maneuver effects). */
  passiveOrOtherDelayAssigned?: number;
  /** Fear-test telemetry for Wound-triggered checks. */
  fearTestsFromWoundsTriggered?: number;
  fearTestsFromWoundsRequired?: number;
  fearTestsFromWoundsAttempted?: number;
  fearTestsFromWoundsPassed?: number;
  fearTestsFromWoundsFailed?: number;
  fearTestsFromWoundsSkipped?: number;
  fearTestsFromWoundsSkippedAlreadyDisordered?: number;
  fearTestsFromWoundsSkippedEngagedNotDistracted?: number;
  fearTestsFromWoundsSkippedAlreadyTestedThisTurn?: number;
  fearTestsFromWoundsSkippedImmuneToFear?: number;
  fearTestsFromWoundsSkippedMoraleExempt?: number;
  /** Fear tokens generated by wound-triggered fear checks before KO/elimination cleanup. */
  fearTestsFromWoundsFearAdded?: number;
  /** Failed wound-triggered fear checks that generated zero fear tokens. */
  fearTestsFromWoundsFailedNoFearAdded?: number;
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
    rejectedByReason: RuleTypeBreakdown;
    rejectedByReasonByTurn: Record<string, RuleTypeBreakdown>;
    rejectedStatusByType: RuleTypeBreakdown;
    prefilteredByReason: RuleTypeBreakdown;
    prefilteredByReasonByTurn: Record<string, RuleTypeBreakdown>;
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

export interface BattleEntitySide {
  id: string;
  name: string;
  sideIndex: number;
  tacticalDoctrine?: string;
  assemblyIds: string[];
  totalBp: number;
}

export interface BattleEntityAssembly {
  id: string;
  name: string;
  sideId: string;
  sideName: string;
  sideIndex: number;
  members: string[];
  totalBp: number;
}

export interface BattleEntityLoadout {
  id: string;
  techAge?: string;
  itemNames: string[];
  weapons: string[];
  armors: string[];
  gear: string[];
  hasShield: boolean;
  totalBp: number;
}

export interface BattleEntityProfile {
  id: string;
  name: string;
  archetype?: string;
  loadoutId: string;
  totalBp?: number;
}

export interface BattleEntityCharacter {
  id: string;
  name: string;
  sideId: string;
  sideName: string;
  sideIndex: number;
  assemblyId: string;
  assemblyName: string;
  assemblyIndex: number;
  profileId: string;
  loadoutId: string;
  totalBp?: number;
}

export interface BattleEntityManifest {
  version: '1.0';
  sides: BattleEntitySide[];
  assemblies: BattleEntityAssembly[];
  characters: BattleEntityCharacter[];
  profiles: BattleEntityProfile[];
  loadouts: BattleEntityLoadout[];
  byModelId: Record<string, {
    sideId: string;
    sideName: string;
    sideIndex: number;
    assemblyId: string;
    assemblyName: string;
    profileId: string;
    loadoutId: string;
    characterId: string;
    paths?: {
      sides: string;
      assemblies: string;
      characters: string;
      profiles: string;
      loadouts: string;
      modelIndex: string;
      index: string;
    };
  }>;
  exportPaths?: {
    index?: string;
    sides?: string;
    assemblies?: string;
    characters?: string;
    profiles?: string;
    loadouts?: string;
    modelIndex?: string;
  };
}

export interface BattleCombatMetricsAudit {
  hitTests: {
    attempts: number;
    passes: number;
    fails: number;
    passRate: number;
  };
  damageTests: {
    attempts: number;
    passes: number;
    fails: number;
    passRate: number;
  };
  assignments: {
    wounds: number;
    fear: number;
    delay: number;
  };
  damageAssignments?: {
    wounds: number;
    fear: number;
    delay: number;
  };
  combinedCombatFearAssigned?: number;
  passiveOrOtherDelay?: number;
  fearFromWounds?: {
    triggered: number;
    required: number;
    attempted: number;
    passed: number;
    failed: number;
    skipped: number;
    fearAdded: number;
    failedNoFearAdded: number;
  };
  passiveUsageByType: RuleTypeBreakdown;
  situationalModifiersByType: RuleTypeBreakdown;
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
  entities?: BattleEntityManifest;
  combatMetrics?: BattleCombatMetricsAudit;
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
  coordinatorDecisions?: Array<{
    sideId: string;
    doctrine: string;
    trace: {
      turn: number;
      sideId: string;
      doctrine: string;
      observations: {
        amILeading: boolean;
        vpMargin: number;
        winningKeys: string[];
        losingKeys: string[];
        topOpponentKeyPressure: Array<{
          key: string;
          predicted: number;
          confidence: number;
        }>;
        topTargetCommitments: Array<{
          targetId: string;
          score: number;
          attackerCount: number;
        }>;
        topScrumContinuity: Array<{
          targetId: string;
          score: number;
          attackerCount: number;
        }>;
        topLanePressure: Array<{
          targetId: string;
          score: number;
          attackerCount: number;
        }>;
        fractionalPotential?: {
          myVpPotential: number;
          opponentVpPotential: number;
          potentialDelta: number;
          urgency: number;
        };
      };
      response: {
        priority: string;
        advice: string[];
        focusTargets: string[];
        potentialDirective?: string;
        pressureDirective?: string;
      };
    };
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
    minimaxLite?: {
      controllers: number;
      controllersWithSamples: number;
      hits: number;
      misses: number;
      hitRate: number;
      avgHitRate: number;
      nodeEvaluations: number;
      avgNodeEvaluationsPerController: number;
      totalSize: number;
      totalMaxSize: number;
      patchTransitions: Record<string, number>;
      patchGraph?: {
        hits: number;
        misses: number;
        hitRate: number;
        avgHitRate: number;
        evictions: number;
        totalSize: number;
        totalMaxSize: number;
        neighborhoodGraphHits?: number;
        neighborhoodGraphMisses?: number;
        neighborhoodGraphHitRate?: number;
        neighborhoodGraphAvgHitRate?: number;
        neighborhoodGraphEvictions?: number;
        neighborhoodGraphTotalSize?: number;
        neighborhoodGraphTotalMaxSize?: number;
      };
    };
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

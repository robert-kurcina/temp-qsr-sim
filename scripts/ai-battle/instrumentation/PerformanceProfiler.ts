/**
 * Performance Profiler
 *
 * Handles performance timing, profiling, and latency tracking for AI battles.
 * Extracted from AIBattleRunner.ts to reduce module size and improve maintainability.
 */

import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { PathfindingEngine } from '../../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine';
import { computePercentile } from '../validation/ValidationMetrics';
import type {
  BattlePerformanceSummary,
  PhaseTimingSummary,
  TurnTimingSummary,
  SlowActivationSummary,
} from '../shared/BattleReportTypes';

export interface PerformanceProfilerConfig {
  /** Enable detailed performance profiling */
  profilingEnabled: boolean;
  /** Enable progress logging to console */
  progressEnabled: boolean;
  /** Log every activation's timing */
  progressEachActivation: boolean;
  /** Log heartbeat every N activations */
  heartbeatEveryActivations: number;
}

export interface ActivationTimingEntry {
  turn: number;
  sideName: string;
  modelName: string;
  elapsedMs: number;
}

/**
 * Performance Profiler Class
 * 
 * Manages all performance timing and profiling for AI battles.
 * Tracks phase durations, activation latencies, and cache statistics.
 */
export class PerformanceProfiler {
  private config: PerformanceProfilerConfig;
  private runStartMs: number = 0;
  private phases: Record<string, { count: number; totalMs: number; maxMs: number }> = {};
  private turns: TurnTimingSummary[] = [];
  private slowestActivations: SlowActivationSummary[] = [];
  private activationSamplesMs: number[] = [];
  private activationsProcessed: number = 0;

  constructor(config?: Partial<PerformanceProfilerConfig>) {
    this.config = {
      profilingEnabled: false,
      progressEnabled: false,
      progressEachActivation: false,
      heartbeatEveryActivations: 25,
      ...config,
    };
  }

  // ============================================================================
  // Initialization & Configuration
  // ============================================================================

  /**
   * Configure profiler from environment variables
   */
  setupFromEnvironment(forceProfiling: boolean = false): void {
    this.config.profilingEnabled =
      forceProfiling ||
      process.env.AI_BATTLE_PROFILE === '1' ||
      process.env.AI_BATTLE_PROGRESS === '1';
    this.config.progressEnabled = process.env.AI_BATTLE_PROGRESS === '1';
    this.config.progressEachActivation = process.env.AI_BATTLE_PROGRESS_EACH_ACTIVATION === '1';
    
    const rawHeartbeat = Number.parseInt(process.env.AI_BATTLE_HEARTBEAT_EVERY ?? '', 10);
    if (Number.isFinite(rawHeartbeat) && rawHeartbeat > 0) {
      this.config.heartbeatEveryActivations = rawHeartbeat;
    }
    
    this.startTiming();
  }

  /**
   * Start timing the battle run
   */
  startTiming(): void {
    this.runStartMs = Date.now();
  }

  /**
   * Get elapsed time since start in milliseconds
   */
  getElapsedMs(): number {
    return Date.now() - this.runStartMs;
  }

  // ============================================================================
  // Phase Timing
  // ============================================================================

  /**
   * Record duration for a named phase
   */
  recordPhaseDuration(phase: string, elapsedMs: number): void {
    if (!this.config.profilingEnabled) return;
    
    const safeElapsedMs = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const bucket = this.phases[phase] ?? { count: 0, totalMs: 0, maxMs: 0 };
    bucket.count += 1;
    bucket.totalMs += safeElapsedMs;
    bucket.maxMs = Math.max(bucket.maxMs, safeElapsedMs);
    this.phases[phase] = bucket;
  }

  /**
   * Wrap a synchronous function with phase timing
   */
  withPhaseTiming<T>(phase: string, fn: () => T): T {
    const startedMs = Date.now();
    try {
      return fn();
    } finally {
      this.recordPhaseDuration(phase, Date.now() - startedMs);
    }
  }

  /**
   * Wrap an async function with phase timing
   */
  async withAsyncPhaseTiming<T>(phase: string, fn: () => Promise<T>): Promise<T> {
    const startedMs = Date.now();
    try {
      return await fn();
    } finally {
      this.recordPhaseDuration(phase, Date.now() - startedMs);
    }
  }

  // ============================================================================
  // Activation Timing
  // ============================================================================

  /**
   * Record a slow activation for later analysis
   */
  recordSlowActivation(entry: SlowActivationSummary): void {
    if (!this.config.profilingEnabled) return;
    
    this.slowestActivations.push(entry);
    this.slowestActivations.sort((a, b) => b.elapsedMs - a.elapsedMs);
    if (this.slowestActivations.length > 10) {
      this.slowestActivations.length = 10;
    }
  }

  /**
   * Sample activation latency for statistical analysis
   */
  sampleActivationLatency(elapsedMs: number): void {
    if (!this.config.profilingEnabled) return;
    this.activationSamplesMs.push(elapsedMs);
  }

  /**
   * Increment activation counter
   */
  incrementActivationsProcessed(): void {
    this.activationsProcessed += 1;
  }

  /**
   * Get total activations processed
   */
  getActivationsProcessed(): number {
    return this.activationsProcessed;
  }

  /**
   * Check if heartbeat should be logged for this activation
   */
  shouldLogHeartbeat(): boolean {
    if (!this.config.progressEnabled) return false;
    return this.activationsProcessed % this.config.heartbeatEveryActivations === 0;
  }

  /**
   * Log activation heartbeat to console
   */
  logHeartbeat(
    turn: number,
    sideName: string,
    modelName: string,
    elapsedMs: number
  ): void {
    if (!this.shouldLogHeartbeat()) return;
    
    const elapsedRunMs = this.getElapsedMs();
    console.log(
      `[PROFILE] act=${this.activationsProcessed} turn=${turn} side=${sideName} model=${modelName} activationMs=${elapsedMs.toFixed(1)} totalMs=${elapsedRunMs}`
    );
  }

  /**
   * Check if progress should be logged for each activation
   */
  shouldLogEachActivation(): boolean {
    return this.config.progressEachActivation;
  }

  // ============================================================================
  // Turn Timing
  // ============================================================================

  /**
   * Record turn timing summary
   */
  recordTurnTiming(turn: TurnTimingSummary): void {
    if (!this.config.profilingEnabled) return;
    this.turns.push(turn);
  }

  // ============================================================================
  // Performance Summary
  // ============================================================================

  /**
   * Build complete performance summary for battle report
   */
  buildPerformanceSummary(battlefield?: Battlefield): BattlePerformanceSummary | undefined {
    if (!this.config.profilingEnabled) return undefined;

    const phases: Record<string, PhaseTimingSummary> = {};
    for (const [phase, stats] of Object.entries(this.phases)) {
      phases[phase] = {
        count: stats.count,
        totalMs: Number(stats.totalMs.toFixed(2)),
        avgMs: Number((stats.totalMs / Math.max(1, stats.count)).toFixed(2)),
        maxMs: Number(stats.maxMs.toFixed(2)),
      };
    }

    const activationSamples = this.activationSamplesMs
      .filter(sample => Number.isFinite(sample) && sample >= 0)
      .slice()
      .sort((a, b) => a - b);
    
    const activationSampleCount = activationSamples.length;
    const activationSum = activationSamples.reduce((sum, value) => sum + value, 0);
    
    const activationLatency = {
      avgMs: Number((activationSampleCount > 0 ? activationSum / activationSampleCount : 0).toFixed(2)),
      p50Ms: Number(computePercentile(activationSamples, 0.5).toFixed(2)),
      p95Ms: Number(computePercentile(activationSamples, 0.95).toFixed(2)),
      maxMs: Number((activationSampleCount > 0 ? activationSamples[activationSampleCount - 1] : 0).toFixed(2)),
    };

    const summary: BattlePerformanceSummary = {
      elapsedMs: Number((this.getElapsedMs()).toFixed(2)),
      activationsProcessed: this.activationsProcessed,
      heartbeatEveryActivations: this.config.heartbeatEveryActivations,
      activationLatency,
      phases,
      turns: this.turns,
      slowestActivations: this.slowestActivations,
    };

    if (battlefield) {
      const los = battlefield.getLosCacheStats();
      const pathfinding = new PathfindingEngine(battlefield).getCacheStats();
      summary.caches = { los, pathfinding };
    }

    return summary;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get current profiler configuration
   */
  getConfig(): PerformanceProfilerConfig {
    return { ...this.config };
  }

  /**
   * Get phase timing statistics
   */
  getPhaseStats(): Record<string, { count: number; totalMs: number; maxMs: number }> {
    return { ...this.phases };
  }

  /**
   * Get slowest activations
   */
  getSlowestActivations(): SlowActivationSummary[] {
    return [...this.slowestActivations];
  }

  /**
   * Get turn timing summaries
   */
  getTurnTimings(): TurnTimingSummary[] {
    return [...this.turns];
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset all profiler state
   */
  reset(): void {
    this.runStartMs = 0;
    this.phases = {};
    this.turns = [];
    this.slowestActivations = [];
    this.activationSamplesMs = [];
    this.activationsProcessed = 0;
  }
}

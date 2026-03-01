/**
 * Performance Instrumentation
 *
 * Performance profiling and timing utilities for AI battles.
 * Tracks phase durations, activation times, and identifies bottlenecks.
 */

import type { BattlePerformanceSummary, PhaseTimingSummary, TurnTimingSummary, SlowActivationSummary } from '../../shared/BattleReportTypes';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';

export interface PerformanceConfig {
  profilingEnabled: boolean;
  progressEnabled: boolean;
  progressEachActivation: boolean;
  heartbeatEveryActivations: number;
}

export interface PerformanceState {
  runStartMs: number;
  phases: Record<string, { count: number; totalMs: number; maxMs: number }>;
  turns: TurnTimingSummary[];
  slowestActivations: SlowActivationSummary[];
  activationSamplesMs: number[];
  activationsProcessed: number;
}

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  profilingEnabled: false,
  progressEnabled: false,
  progressEachActivation: false,
  heartbeatEveryActivations: 25,
};

export function createPerformanceState(): PerformanceState {
  return {
    runStartMs: 0,
    phases: {},
    turns: [],
    slowestActivations: [],
    activationSamplesMs: [],
    activationsProcessed: 0,
  };
}

export function setupPerformanceInstrumentation(
  state: PerformanceState,
  config: PerformanceConfig,
  forceProfiling: boolean = false
): void {
  state.runStartMs = Date.now();
  state.phases = {};
  state.turns = [];
  state.slowestActivations = [];
  state.activationSamplesMs = [];
  state.activationsProcessed = 0;
  
  if (forceProfiling) {
    config.profilingEnabled = true;
  }
}

export function recordPhaseDuration(
  state: PerformanceState,
  phase: string,
  elapsedMs: number
): void {
  if (!state.phases[phase]) {
    state.phases[phase] = { count: 0, totalMs: 0, maxMs: 0 };
  }
  const phaseStats = state.phases[phase];
  phaseStats.count++;
  phaseStats.totalMs += elapsedMs;
  phaseStats.maxMs = Math.max(phaseStats.maxMs, elapsedMs);
}

export function withPhaseTiming<T>(
  state: PerformanceState,
  phase: string,
  fn: () => T
): T {
  const start = Date.now();
  try {
    return fn();
  } finally {
    const elapsed = Date.now() - start;
    recordPhaseDuration(state, phase, elapsed);
  }
}

export async function withAsyncPhaseTiming<T>(
  state: PerformanceState,
  phase: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const elapsed = Date.now() - start;
    recordPhaseDuration(state, phase, elapsed);
  }
}

export function recordSlowActivation(
  state: PerformanceState,
  entry: SlowActivationSummary,
  maxSamples: number = 20
): void {
  state.slowestActivations.push(entry);
  state.slowestActivations.sort((a, b) => b.durationMs - a.durationMs);
  if (state.slowestActivations.length > maxSamples) {
    state.slowestActivations = state.slowestActivations.slice(0, maxSamples);
  }
}

export function recordActivationDuration(
  state: PerformanceState,
  durationMs: number
): void {
  state.activationsProcessed++;
  state.activationSamplesMs.push(durationMs);
  
  // Keep only recent samples for memory efficiency
  const maxSamples = 1000;
  if (state.activationSamplesMs.length > maxSamples) {
    state.activationSamplesMs = state.activationSamplesMs.slice(-maxSamples);
  }
}

export function recordTurnTiming(
  state: PerformanceState,
  turn: number,
  durationMs: number,
  activations: number,
  slowestActivationMs: number
): void {
  state.turns.push({
    turn,
    durationMs,
    activations,
    slowestActivationMs,
  });
}

export function buildPerformanceSummary(
  state: PerformanceState,
  config: PerformanceConfig,
  battlefield?: Battlefield
): BattlePerformanceSummary | undefined {
  if (!config.profilingEnabled) {
    return undefined;
  }

  const totalMs = Date.now() - state.runStartMs;
  const phaseSummaries: PhaseTimingSummary[] = Object.entries(state.phases).map(
    ([phase, stats]) => ({
      phase,
      count: stats.count,
      totalMs: stats.totalMs,
      avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
      maxMs: stats.maxMs,
    })
  );

  return {
    totalMs,
    activationsProcessed: state.activationsProcessed,
    avgActivationMs:
      state.activationSamplesMs.length > 0
        ? Math.round(
            state.activationSamplesMs.reduce((a, b) => a + b, 0) /
              state.activationSamplesMs.length
          )
        : 0,
    turns: state.turns,
    phases: phaseSummaries,
    slowestActivations: state.slowestActivations,
    battlefieldSize: battlefield
      ? `${battlefield.width}x${battlefield.height}`
      : 'Unknown',
  };
}

export function shouldLogHeartbeat(
  state: PerformanceState,
  config: PerformanceConfig
): boolean {
  if (!config.progressEnabled) {
    return false;
  }
  return state.activationsProcessed % config.heartbeatEveryActivations === 0;
}

export function logProgress(
  turn: number,
  activation: number,
  characterName: string,
  sideName: string
): void {
  console.log(`  Turn ${turn}, Activation ${activation}: ${sideName} - ${characterName}`);
}

export function logHeartbeat(activationsProcessed: number): void {
  console.log(`[Progress] ${activationsProcessed} activations processed`);
}

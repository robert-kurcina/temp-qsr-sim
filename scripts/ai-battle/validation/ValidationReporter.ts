/**
 * Validation Reporter
 *
 * Formats and writes validation aggregate reports.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ValidationAggregateReport,
  CombatEfficacySummary,
  ScoringSummary,
} from './ValidationMetrics';
import { safeRate, createEmptyAdvancedRuleMetrics } from './ValidationMetrics';
import type { BattlePerformanceSummary } from '../../shared/BattleReportTypes';

/**
 * Format type breakdown lines for display
 */
function formatTypeBreakdownLines(
  breakdown: Record<string, number>,
  indent: string = '    '
): string[] {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return [`${indent}none`];
  }
  return entries.map(([type, count]) => `${indent}${type}: ${count}`);
}

function formatTurnBucketBreakdownLines(
  breakdownByTurn: Record<string, Record<string, number>>,
  indent: string = '    '
): string[] {
  if (!breakdownByTurn || Object.keys(breakdownByTurn).length === 0) {
    return [`${indent}none`];
  }
  const preferredOrder = ['T1', 'T2', 'T3+', 'unknown'];
  const allBuckets = Object.keys(breakdownByTurn);
  const orderedBuckets = [
    ...preferredOrder.filter(bucket => allBuckets.includes(bucket)),
    ...allBuckets.filter(bucket => !preferredOrder.includes(bucket)).sort(),
  ];
  const lines: string[] = [];
  for (const bucket of orderedBuckets) {
    lines.push(`${indent}${bucket}:`);
    lines.push(...formatTypeBreakdownLines(breakdownByTurn[bucket] ?? {}, `${indent}  `));
  }
  return lines;
}

function deriveCombatEfficacySummary(report: ValidationAggregateReport): CombatEfficacySummary {
  if (report.combatEfficacy) {
    return report.combatEfficacy;
  }
  const hitAttempts = Number(report.totals.hitTestsAttempted ?? 0);
  const hitPasses = Number(report.totals.hitTestsPassed ?? 0);
  const damageAttempts = Number(report.totals.damageTestsAttempted ?? 0);
  const damagePasses = Number(report.totals.damageTestsPassed ?? 0);
  const totalAssignments = {
    wounds: Number(report.totals.woundsAssigned ?? 0),
    fear: Number(report.totals.fearAssigned ?? 0),
    delay: Number(report.totals.delayAssigned ?? 0),
  };
  const damageAssignments = {
    wounds: Number(report.totals.damageWoundsAssigned ?? totalAssignments.wounds),
    fear: Number(report.totals.damageFearAssigned ?? totalAssignments.fear),
    delay: Number(report.totals.damageDelayAssigned ?? totalAssignments.delay),
  };
  const passiveOrOtherDelay = Number(
    report.totals.passiveOrOtherDelayAssigned ?? Math.max(0, totalAssignments.delay - damageAssignments.delay)
  );
  return {
    hitTests: {
      attempts: hitAttempts,
      passes: hitPasses,
      fails: Number(report.totals.hitTestsFailed ?? Math.max(0, hitAttempts - hitPasses)),
      passRate: safeRate(hitPasses, hitAttempts),
    },
    damageTests: {
      attempts: damageAttempts,
      passes: damagePasses,
      fails: Number(report.totals.damageTestsFailed ?? Math.max(0, damageAttempts - damagePasses)),
      passRate: safeRate(damagePasses, damageAttempts),
    },
    damageAssignments,
    passiveOrOtherDelay,
    assignments: totalAssignments,
  };
}

function deriveScoringSummary(report: ValidationAggregateReport): ScoringSummary {
  if (report.scoringSummary) {
    return report.scoringSummary;
  }

  const sideTotals = new Map<string, { totalVp: number; totalRp: number }>();
  for (const run of report.runReports) {
    const vpBySide = run.missionRuntime?.vpBySide ?? {};
    const rpBySide = run.missionRuntime?.rpBySide ?? {};
    for (const [sideId, value] of Object.entries(vpBySide)) {
      const entry = sideTotals.get(sideId) ?? { totalVp: 0, totalRp: 0 };
      entry.totalVp += Number(value ?? 0);
      sideTotals.set(sideId, entry);
    }
    for (const [sideId, value] of Object.entries(rpBySide)) {
      const entry = sideTotals.get(sideId) ?? { totalVp: 0, totalRp: 0 };
      entry.totalRp += Number(value ?? 0);
      sideTotals.set(sideId, entry);
    }
  }

  return {
    sideScores: Array.from(sideTotals.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sideId, totals]) => ({
        sideId,
        totalVp: Number(totals.totalVp.toFixed(2)),
        averageVp: Number((totals.totalVp / Math.max(1, report.runs)).toFixed(2)),
        totalRp: Number(totals.totalRp.toFixed(2)),
        averageRp: Number((totals.totalRp / Math.max(1, report.runs)).toFixed(2)),
        keys: [],
      })),
  };
}

/**
 * Format validation aggregate report to human-readable text
 */
export function formatValidationAggregateReportHumanReadable(report: ValidationAggregateReport): string {
  const advanced = report.advancedRuleTotals ?? createEmptyAdvancedRuleMetrics();
  const combatEfficacy = deriveCombatEfficacySummary(report);
  const scoringSummary = deriveScoringSummary(report);
  const waitTakeRate = safeRate(report.totals.waitChoicesTaken, report.totals.waitChoicesGiven);
  const waitSuccessRate = safeRate(report.totals.waitChoicesSucceeded, report.totals.waitChoicesTaken);
  const reactTakeRate = safeRate(report.totals.reactChoicesTaken, report.totals.reactChoiceWindows);
  const reactOptionSelectionRate = safeRate(report.totals.reactChoicesTaken, report.totals.reactChoicesGiven);
  const waitReactPerSuccessfulWait = safeRate(report.totals.waitTriggeredReacts, report.totals.waitChoicesSucceeded);
  const decisionTelemetrySamples = report.totals.decisionTelemetrySamples ?? 0;
  const attackGateAppliedDecisions = report.totals.attackGateAppliedDecisions ?? 0;
  const attackGateImmediateHighApplied = report.totals.attackGateImmediateHighApplied ?? 0;
  const attackGateDirectiveApplied = report.totals.attackGateDirectiveApplied ?? 0;
  const attackGateAppliedRate = safeRate(attackGateAppliedDecisions, decisionTelemetrySamples);
  const attackOpportunityImmediateHigh = report.totals.attackOpportunityImmediateHigh ?? 0;
  const attackOpportunityImmediateLow = report.totals.attackOpportunityImmediateLow ?? 0;
  const attackOpportunitySetup = report.totals.attackOpportunitySetup ?? 0;
  const attackOpportunityNone = report.totals.attackOpportunityNone ?? 0;
  const fearTestsFromWoundsTriggered = report.totals.fearTestsFromWoundsTriggered ?? 0;
  const fearTestsFromWoundsRequired = report.totals.fearTestsFromWoundsRequired ?? 0;
  const fearTestsFromWoundsAttempted = report.totals.fearTestsFromWoundsAttempted ?? 0;
  const fearTestsFromWoundsPassed = report.totals.fearTestsFromWoundsPassed ?? 0;
  const fearTestsFromWoundsFailed = report.totals.fearTestsFromWoundsFailed ?? 0;
  const fearTestsFromWoundsSkipped = report.totals.fearTestsFromWoundsSkipped ?? 0;
  const fearTestsFromWoundsSkippedAlreadyDisordered = report.totals.fearTestsFromWoundsSkippedAlreadyDisordered ?? 0;
  const fearTestsFromWoundsSkippedEngagedNotDistracted = report.totals.fearTestsFromWoundsSkippedEngagedNotDistracted ?? 0;
  const fearTestsFromWoundsSkippedAlreadyTestedThisTurn = report.totals.fearTestsFromWoundsSkippedAlreadyTestedThisTurn ?? 0;
  const fearTestsFromWoundsSkippedImmuneToFear = report.totals.fearTestsFromWoundsSkippedImmuneToFear ?? 0;
  const fearTestsFromWoundsSkippedMoraleExempt = report.totals.fearTestsFromWoundsSkippedMoraleExempt ?? 0;
  const fearTestsFromWoundsFearAdded = report.totals.fearTestsFromWoundsFearAdded ?? 0;
  const fearTestsFromWoundsFailedNoFearAdded = report.totals.fearTestsFromWoundsFailedNoFearAdded ?? 0;
  const combinedCombatFearAssigned =
    combatEfficacy.damageAssignments.fear + fearTestsFromWoundsFearAdded;

  const lines: string[] = [];
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('📊 VALIDATION REPORT');
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📋 Mission: ${report.missionId}`);
  lines.push(`📏 Game Size: ${report.gameSize}`);
  lines.push(`🌲 Terrain Density: ${report.densityRatio}%`);
  lines.push(`💡 Lighting: ${report.lighting} (Visibility OR ${report.visibilityOrMu} MU)`);
  lines.push(`⚔️  Doctrine: ${report.tacticalDoctrine}`);
  if (Array.isArray(report.sideDoctrines) && report.sideDoctrines.length > 0) {
    for (const sideDoctrine of report.sideDoctrines) {
      lines.push(`  ${sideDoctrine.sideName}: ${sideDoctrine.tacticalDoctrine}`);
    }
  }
  lines.push(`🧰 Loadout: ${report.loadoutProfile}`);
  lines.push(`🎲 Runs: ${report.runs} (base seed ${report.baseSeed})`);
  lines.push('');
  lines.push('🏆 RESULTS');
  lines.push(`  Winners: ${JSON.stringify(report.winners)}`);
  if (scoringSummary.sideScores.length > 0) {
    lines.push('  Mission Scoring:');
    for (const sideScore of scoringSummary.sideScores) {
      lines.push(
        `    ${sideScore.sideId}: VP total=${sideScore.totalVp.toFixed(2)} avg=${sideScore.averageVp.toFixed(2)}, RP total=${sideScore.totalRp.toFixed(2)} avg=${sideScore.averageRp.toFixed(2)}`
      );
      const scoredKeys = sideScore.keys.filter(key => key.runsScored > 0);
      if (scoredKeys.length === 0) {
        lines.push('      Keys scored: none');
      } else {
        lines.push(
          `      Keys scored: ${scoredKeys
            .map(key => `${key.key}=${key.totalCurrent.toFixed(2)} (${key.runsScored}/${report.runs} runs)`)
            .join(', ')}`
        );
      }
    }
  }
  lines.push(
    `  Combat Efficacy (Hit): ${(combatEfficacy.hitTests.passRate * 100).toFixed(1)}% (${combatEfficacy.hitTests.passes}/${combatEfficacy.hitTests.attempts})`
  );
  lines.push(
    `  Combat Efficacy (Damage): ${(combatEfficacy.damageTests.passRate * 100).toFixed(1)}% (${combatEfficacy.damageTests.passes}/${combatEfficacy.damageTests.attempts})`
  );
  lines.push(
    `  Damage-Test Assignments (W/F/D): ${combatEfficacy.damageAssignments.wounds}/${combatEfficacy.damageAssignments.fear}/${combatEfficacy.damageAssignments.delay}`
  );
  lines.push(
    `  Combat-Caused Fear Tokens (Damage + Wound-Fear): ${combinedCombatFearAssigned} (${combatEfficacy.damageAssignments.fear} + ${fearTestsFromWoundsFearAdded})`
  );
  lines.push(`  Combat Delay (Passive/Other): ${combatEfficacy.passiveOrOtherDelay}`);
  lines.push(
    `  Fear Tests (Wound Trigger): triggered=${fearTestsFromWoundsTriggered}, required=${fearTestsFromWoundsRequired}, attempted=${fearTestsFromWoundsAttempted}, pass=${fearTestsFromWoundsPassed}, fail=${fearTestsFromWoundsFailed}, skipped=${fearTestsFromWoundsSkipped}`
  );
  lines.push(
    `    Wound-Fear Added (Pre-KO Cleanup, non-damage): ${fearTestsFromWoundsFearAdded}, failed_no_fear=${fearTestsFromWoundsFailedNoFearAdded}`
  );
  lines.push(
    `    Skips: disordered=${fearTestsFromWoundsSkippedAlreadyDisordered}, engaged_not_distracted=${fearTestsFromWoundsSkippedEngagedNotDistracted}, already_tested=${fearTestsFromWoundsSkippedAlreadyTestedThisTurn}, immune=${fearTestsFromWoundsSkippedImmuneToFear}, morale_exempt=${fearTestsFromWoundsSkippedMoraleExempt}`
  );
  lines.push(`  Turns Completed: ${report.totals.turnsCompleted}`);
  lines.push(`  Total Actions: ${report.totals.totalActions}`);
  lines.push(`  Moves: ${report.totals.moves}`);
  lines.push(`  Moves While Waiting: ${report.totals.movesWhileWaiting}`);
  lines.push(`  Ranged Combats: ${report.totals.rangedCombats}`);
  lines.push(`  Close Combats: ${report.totals.closeCombats}`);
  lines.push(`  Waits Selected (Planner): ${report.totals.waitsSelectedPlanner}`);
  lines.push(`  Waits Selected (Utility): ${report.totals.waitsSelectedUtility}`);
  lines.push(`  Wait Choices Given: ${report.totals.waitChoicesGiven}`);
  lines.push(`  Wait Choices Taken: ${report.totals.waitChoicesTaken}`);
  lines.push(`  Wait Choices Succeeded: ${report.totals.waitChoicesSucceeded}`);
  lines.push(`  Wait Take Rate: ${(waitTakeRate * 100).toFixed(1)}%`);
  lines.push(`  Wait Success Rate: ${(waitSuccessRate * 100).toFixed(1)}%`);
  lines.push(`  Wait Maintained: ${report.totals.waitMaintained}`);
  lines.push(`  Wait Upkeep Paid: ${report.totals.waitUpkeepPaid}`);
  lines.push(`  React Choice Windows: ${report.totals.reactChoiceWindows}`);
  lines.push(`  React Choices Given: ${report.totals.reactChoicesGiven}`);
  lines.push(`  React Choices Taken: ${report.totals.reactChoicesTaken}`);
  lines.push(`  React Take Rate: ${(reactTakeRate * 100).toFixed(1)}%`);
  lines.push(`  React Option Selection Rate: ${(reactOptionSelectionRate * 100).toFixed(1)}%`);
  lines.push(`  Wait->React Triggers: ${report.totals.waitTriggeredReacts}`);
  lines.push(`  Wait->React per Successful Wait: ${waitReactPerSuccessfulWait.toFixed(2)}x`);
  lines.push(`  React Wounds Inflicted: ${report.totals.reactWoundsInflicted}`);
  lines.push(`  Wait->React Wounds Inflicted: ${report.totals.waitReactWoundsInflicted}`);
  lines.push(`  KO's: ${report.totals.kos}`);
  lines.push(`  Eliminations: ${report.totals.eliminations}`);
  lines.push(`  Decision Telemetry Samples: ${decisionTelemetrySamples}`);
  if (decisionTelemetrySamples > 0) {
    lines.push(`  Attack Gate Applied: ${attackGateAppliedDecisions} (${(attackGateAppliedRate * 100).toFixed(1)}%)`);
    lines.push(`  Attack Gate Reasons: immediate_high=${attackGateImmediateHighApplied}, directive_window=${attackGateDirectiveApplied}`);
    lines.push(
      `  Attack Opportunity Grades: immediate_high=${attackOpportunityImmediateHigh}, immediate_low=${attackOpportunityImmediateLow}, setup=${attackOpportunitySetup}, none=${attackOpportunityNone}`
    );
  }

  const runPerf = report.runReports
    .map(run => run.performance)
    .filter((value): value is BattlePerformanceSummary => Boolean(value));
  if (runPerf.length > 0) {
    const avgElapsed = runPerf.reduce((sum, perf) => sum + perf.elapsedMs, 0) / runPerf.length;
    const avgActivations = runPerf.reduce((sum, perf) => sum + perf.activationsProcessed, 0) / runPerf.length;
    const avgActivationP95 = runPerf.reduce(
      (sum, perf) => sum + (perf.activationLatency?.p95Ms ?? 0),
      0
    ) / runPerf.length;
    lines.push(`  Avg Run Elapsed: ${avgElapsed.toFixed(2)} ms`);
    lines.push(`  Avg Activations Processed: ${avgActivations.toFixed(2)}`);
    lines.push(`  Avg Activation P95: ${avgActivationP95.toFixed(2)} ms`);

    const perfWithCache = runPerf.filter(perf => Boolean(perf.caches));
    if (perfWithCache.length > 0) {
      const losHits = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.los.hits ?? 0), 0);
      const losMisses = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.los.misses ?? 0), 0);
      const pathHits = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.pathfinding.pathHits ?? 0), 0);
      const pathMisses = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.pathfinding.pathMisses ?? 0), 0);
      const gridHits = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.pathfinding.gridHits ?? 0), 0);
      const gridMisses = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.pathfinding.gridMisses ?? 0), 0);
      const minimaxHits = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.hits ?? 0), 0);
      const minimaxMisses = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.misses ?? 0), 0);
      const minimaxNodes = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.nodeEvaluations ?? 0), 0);
      const patchGraphHits = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.patchGraph?.hits ?? 0), 0);
      const patchGraphMisses = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.patchGraph?.misses ?? 0), 0);
      const patchNeighborhoodHits = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.patchGraph?.neighborhoodGraphHits ?? 0), 0);
      const patchNeighborhoodMisses = perfWithCache.reduce((sum, perf) => sum + (perf.caches?.minimaxLite?.patchGraph?.neighborhoodGraphMisses ?? 0), 0);
      const minimaxTransitions: Record<string, number> = {};
      for (const perf of perfWithCache) {
        for (const [transition, count] of Object.entries(perf.caches?.minimaxLite?.patchTransitions ?? {})) {
          minimaxTransitions[transition] = (minimaxTransitions[transition] ?? 0) + (Number(count) || 0);
        }
      }
      const losTotal = losHits + losMisses;
      const pathTotal = pathHits + pathMisses;
      const gridTotal = gridHits + gridMisses;
      const minimaxTotal = minimaxHits + minimaxMisses;
      const patchGraphTotal = patchGraphHits + patchGraphMisses;
      const patchNeighborhoodTotal = patchNeighborhoodHits + patchNeighborhoodMisses;
      lines.push(
        `  Avg LOS Cache Hit Rate: ${losTotal > 0 ? ((losHits / losTotal) * 100).toFixed(1) : '0.0'}% (${losHits}/${losTotal})`
      );
      lines.push(
        `  Avg Path Cache Hit Rate: ${pathTotal > 0 ? ((pathHits / pathTotal) * 100).toFixed(1) : '0.0'}% (${pathHits}/${pathTotal})`
      );
      lines.push(
        `  Avg Grid Cache Hit Rate: ${gridTotal > 0 ? ((gridHits / gridTotal) * 100).toFixed(1) : '0.0'}% (${gridHits}/${gridTotal})`
      );
      lines.push(
        `  Avg Minimax Cache Hit Rate: ${minimaxTotal > 0 ? ((minimaxHits / minimaxTotal) * 100).toFixed(1) : '0.0'}% (${minimaxHits}/${minimaxTotal})`
      );
      lines.push(
        `  Avg Minimax Node Evaluations: ${(minimaxNodes / Math.max(1, perfWithCache.length)).toFixed(2)}`
      );
      if (patchGraphTotal > 0) {
        lines.push(
          `  Avg Minimax Patch Cache Hit Rate: ${((patchGraphHits / patchGraphTotal) * 100).toFixed(1)}% (${patchGraphHits}/${patchGraphTotal})`
        );
      }
      if (patchNeighborhoodTotal > 0) {
        lines.push(
          `  Avg Minimax Patch Neighborhood Cache Hit Rate: ${((patchNeighborhoodHits / patchNeighborhoodTotal) * 100).toFixed(1)}% (${patchNeighborhoodHits}/${patchNeighborhoodTotal})`
        );
      }
      const topTransitions = Object.entries(minimaxTransitions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      if (topTransitions.length > 0) {
        lines.push(
          `  Top Minimax Patch Transitions: ${topTransitions.map(([transition, count]) => `${transition}=${count}`).join(', ')}`
        );
      }
    }
  }

  if (report.performanceGates?.enabled) {
    lines.push('');
    lines.push('🚦 PERFORMANCE GATES');
    lines.push(`  Runs Evaluated: ${report.performanceGates.runsEvaluated}/${report.runs}`);
    lines.push(
      `  Profile: mission=${report.performanceGates.profile.missionId}, size=${report.performanceGates.profile.gameSize}, density=${report.performanceGates.profile.densityRatio}% (bucket ${report.performanceGates.profile.densityBucket})`
    );
    if (report.performanceGates.pass.overall === null) {
      lines.push('  Status: n/a (no profiled runs)');
    } else {
      lines.push(`  Status: ${report.performanceGates.pass.overall ? 'PASS' : 'FAIL'}`);
      lines.push(
        `  Turn 1 Elapsed <= ${report.performanceGates.thresholds.turn1ElapsedMsMax} ms: ${report.performanceGates.pass.turn1Elapsed ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgTurn1ElapsedMs?.toFixed(2) ?? 'n/a'})`
      );
      lines.push(
        `  Activation P95 <= ${report.performanceGates.thresholds.activationP95MsMax} ms: ${report.performanceGates.pass.activationP95 ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgActivationP95Ms?.toFixed(2) ?? 'n/a'})`
      );
      lines.push(
        `  LOS cache hit >= ${(report.performanceGates.thresholds.minLosCacheHitRate * 100).toFixed(1)}%: ${report.performanceGates.pass.losCacheHitRate ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgLosCacheHitRate !== null ? (report.performanceGates.observed.avgLosCacheHitRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Path cache hit >= ${(report.performanceGates.thresholds.minPathCacheHitRate * 100).toFixed(1)}%: ${report.performanceGates.pass.pathCacheHitRate ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgPathCacheHitRate !== null ? (report.performanceGates.observed.avgPathCacheHitRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Grid cache hit >= ${(report.performanceGates.thresholds.minGridCacheHitRate * 100).toFixed(1)}%: ${report.performanceGates.pass.gridCacheHitRate ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgGridCacheHitRate !== null ? (report.performanceGates.observed.avgGridCacheHitRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Minimax cache hit >= ${(report.performanceGates.thresholds.minMinimaxLiteCacheHitRate * 100).toFixed(1)}%: ${report.performanceGates.pass.minimaxLiteCacheHitRate ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgMinimaxLiteCacheHitRate !== null ? (report.performanceGates.observed.avgMinimaxLiteCacheHitRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Minimax patch cache hit >= ${(report.performanceGates.thresholds.minMinimaxPatchCacheHitRate * 100).toFixed(1)}%: ${report.performanceGates.pass.minimaxPatchCacheHitRate ? 'PASS' : 'FAIL'} (avg=${report.performanceGates.observed.avgMinimaxPatchCacheHitRate !== null ? (report.performanceGates.observed.avgMinimaxPatchCacheHitRate * 100).toFixed(1) : 'n/a'}%)`
      );
    }
  }

  if (report.coordinatorTraceGates?.enabled) {
    lines.push('');
    lines.push('🧠 COORDINATOR TRACE GATES');
    lines.push(`  Runs Evaluated: ${report.coordinatorTraceGates.runsEvaluated}/${report.runs}`);
    if (report.coordinatorTraceGates.pass.overall === null) {
      lines.push('  Status: n/a (no audit turn traces)');
    } else {
      lines.push(`  Status: ${report.coordinatorTraceGates.pass.overall ? 'PASS' : 'FAIL'}`);
      lines.push(
        `  Run coverage >= ${(report.coordinatorTraceGates.thresholds.minRunCoverage * 100).toFixed(1)}%: ${report.coordinatorTraceGates.pass.runCoverage ? 'PASS' : 'FAIL'} (avg=${report.coordinatorTraceGates.observed.runCoverage !== null ? (report.coordinatorTraceGates.observed.runCoverage * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Turn coverage >= ${(report.coordinatorTraceGates.thresholds.minTurnCoverage * 100).toFixed(1)}%: ${report.coordinatorTraceGates.pass.turnCoverage ? 'PASS' : 'FAIL'} (avg=${report.coordinatorTraceGates.observed.avgTurnCoverage !== null ? (report.coordinatorTraceGates.observed.avgTurnCoverage * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Side coverage/turn >= ${(report.coordinatorTraceGates.thresholds.minSideCoveragePerTurn * 100).toFixed(1)}%: ${report.coordinatorTraceGates.pass.sideCoveragePerTurn ? 'PASS' : 'FAIL'} (avg=${report.coordinatorTraceGates.observed.avgSideCoveragePerTurn !== null ? (report.coordinatorTraceGates.observed.avgSideCoveragePerTurn * 100).toFixed(1) : 'n/a'}%)`
      );
    }
  }

  if (report.pressureContinuityDiagnostics) {
    lines.push('');
    lines.push('🔀 PRESSURE CONTINUITY DIAGNOSTICS');
    lines.push(`  Runs Evaluated: ${report.pressureContinuityDiagnostics.runsEvaluated}/${report.runs}`);
    lines.push(`  Runs With Data: ${report.pressureContinuityDiagnostics.runsWithData}/${report.pressureContinuityDiagnostics.runsEvaluated}`);
    lines.push(
      `  Scrum break-rate avg: ${report.pressureContinuityDiagnostics.observed.avgScrumBreakRate !== null ? (report.pressureContinuityDiagnostics.observed.avgScrumBreakRate * 100).toFixed(1) : 'n/a'}%`
    );
    lines.push(
      `  Lane break-rate avg: ${report.pressureContinuityDiagnostics.observed.avgLaneBreakRate !== null ? (report.pressureContinuityDiagnostics.observed.avgLaneBreakRate * 100).toFixed(1) : 'n/a'}%`
    );
    lines.push(
      `  Combined break-rate avg: ${report.pressureContinuityDiagnostics.observed.avgCombinedBreakRate !== null ? (report.pressureContinuityDiagnostics.observed.avgCombinedBreakRate * 100).toFixed(1) : 'n/a'}%`
    );
    lines.push(
      `  Signature coverage avg: ${report.pressureContinuityDiagnostics.observed.avgSignatureCoverageRate !== null ? (report.pressureContinuityDiagnostics.observed.avgSignatureCoverageRate * 100).toFixed(1) : 'n/a'}%`
    );
    lines.push(
      `  Avg breaks/run: ${report.pressureContinuityDiagnostics.observed.avgBreaksPerRun !== null ? report.pressureContinuityDiagnostics.observed.avgBreaksPerRun.toFixed(2) : 'n/a'}`
    );
    lines.push(
      `  Avg signature samples/run: ${report.pressureContinuityDiagnostics.observed.avgSignatureSamplesPerRun !== null ? report.pressureContinuityDiagnostics.observed.avgSignatureSamplesPerRun.toFixed(2) : 'n/a'}`
    );
  }

  if (report.pressureContinuityGates?.enabled) {
    lines.push('');
    lines.push('🧷 PRESSURE CONTINUITY GATES');
    lines.push(`  Runs Evaluated: ${report.pressureContinuityGates.runsEvaluated}/${report.runs}`);
    lines.push(
      `  Profile: mission=${report.pressureContinuityGates.profile.missionId}, size=${report.pressureContinuityGates.profile.gameSize}, density=${report.pressureContinuityGates.profile.densityRatio}% (bucket ${report.pressureContinuityGates.profile.densityBucket})`
    );
    if (report.pressureContinuityGates.pass.overall === null) {
      lines.push('  Status: n/a (no continuity samples)');
    } else {
      lines.push(`  Status: ${report.pressureContinuityGates.pass.overall ? 'PASS' : 'FAIL'}`);
      lines.push(
        `  Runs with data >= ${(report.pressureContinuityGates.thresholds.minRunsWithDataRate * 100).toFixed(1)}%: ${report.pressureContinuityGates.pass.runsWithDataRate === null ? 'n/a' : report.pressureContinuityGates.pass.runsWithDataRate ? 'PASS' : 'FAIL'} (avg=${report.pressureContinuityGates.observed.runsWithDataRate !== null ? (report.pressureContinuityGates.observed.runsWithDataRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Signature coverage >= ${(report.pressureContinuityGates.thresholds.minSignatureCoverageRate * 100).toFixed(1)}%: ${report.pressureContinuityGates.pass.signatureCoverageRate === null ? 'n/a' : report.pressureContinuityGates.pass.signatureCoverageRate ? 'PASS' : 'FAIL'} (avg=${report.pressureContinuityGates.observed.avgSignatureCoverageRate !== null ? (report.pressureContinuityGates.observed.avgSignatureCoverageRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Combined break-rate <= ${(report.pressureContinuityGates.thresholds.maxCombinedBreakRate * 100).toFixed(1)}%: ${report.pressureContinuityGates.pass.combinedBreakRate === null ? 'n/a' : report.pressureContinuityGates.pass.combinedBreakRate ? 'PASS' : 'FAIL'} (avg=${report.pressureContinuityGates.observed.avgCombinedBreakRate !== null ? (report.pressureContinuityGates.observed.avgCombinedBreakRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Lane break-rate <= ${(report.pressureContinuityGates.thresholds.maxLaneBreakRate * 100).toFixed(1)}%: ${report.pressureContinuityGates.pass.laneBreakRate === null ? 'n/a' : report.pressureContinuityGates.pass.laneBreakRate ? 'PASS' : 'FAIL'} (avg=${report.pressureContinuityGates.observed.avgLaneBreakRate !== null ? (report.pressureContinuityGates.observed.avgLaneBreakRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Scrum break-rate <= ${(report.pressureContinuityGates.thresholds.maxScrumBreakRate * 100).toFixed(1)}%: ${report.pressureContinuityGates.pass.scrumBreakRate === null ? 'n/a' : report.pressureContinuityGates.pass.scrumBreakRate ? 'PASS' : 'FAIL'} (avg=${report.pressureContinuityGates.observed.avgScrumBreakRate !== null ? (report.pressureContinuityGates.observed.avgScrumBreakRate * 100).toFixed(1) : 'n/a'}%)`
      );
    }
  }

  if (report.combatActivityGates?.enabled) {
    lines.push('');
    lines.push('⚔️ COMBAT ACTIVITY GATES');
    lines.push(`  Runs Evaluated: ${report.combatActivityGates.runsEvaluated}/${report.runs}`);
    lines.push(
      `  Profile: mission=${report.combatActivityGates.profile.missionId}, size=${report.combatActivityGates.profile.gameSize}, density=${report.combatActivityGates.profile.densityRatio}% (bucket ${report.combatActivityGates.profile.densityBucket})`
    );
    lines.push(
      `  Horizon: ${report.combatActivityGates.profile.maxTurns}/${report.combatActivityGates.profile.configuredMaxTurns} turns (${(report.combatActivityGates.profile.horizonRatio * 100).toFixed(1)}%)`
    );
    if (report.combatActivityGates.pass.overall === null) {
      lines.push(`  Status: n/a (${report.combatActivityGates.skippedReason ?? 'no run combat metrics'})`);
    } else {
      lines.push(`  Status: ${report.combatActivityGates.pass.overall ? 'PASS' : 'FAIL'}`);
      lines.push(
        `  Turn horizon >= ${(report.combatActivityGates.thresholds.minTurnHorizonRatio * 100).toFixed(1)}%: PASS`
      );
      lines.push(
        `  Attack action ratio (combat runs) >= ${(report.combatActivityGates.thresholds.minAttackActionRatio * 100).toFixed(1)}%: ${report.combatActivityGates.pass.attackActionRatio === null ? 'n/a' : report.combatActivityGates.pass.attackActionRatio ? 'PASS' : 'FAIL'} (avg=${report.combatActivityGates.observed.avgAttackActionRatio !== null ? (report.combatActivityGates.observed.avgAttackActionRatio * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Runs with combat >= ${(report.combatActivityGates.thresholds.minRunsWithCombatRate * 100).toFixed(1)}%: ${report.combatActivityGates.pass.runsWithCombatRate === null ? 'n/a' : report.combatActivityGates.pass.runsWithCombatRate ? 'PASS' : 'FAIL'} (avg=${report.combatActivityGates.observed.runsWithCombatRate !== null ? (report.combatActivityGates.observed.runsWithCombatRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Zero-attack runs <= ${(report.combatActivityGates.thresholds.maxZeroAttackRunRate * 100).toFixed(1)}%: ${report.combatActivityGates.pass.zeroAttackRunRate === null ? 'n/a' : report.combatActivityGates.pass.zeroAttackRunRate ? 'PASS' : 'FAIL'} (avg=${report.combatActivityGates.observed.zeroAttackRunRate !== null ? (report.combatActivityGates.observed.zeroAttackRunRate * 100).toFixed(1) : 'n/a'}%)`
      );
    }
  }

  if (report.passivenessGates?.enabled) {
    lines.push('');
    lines.push('🧊 PASSIVENESS GATES');
    lines.push(`  Runs Evaluated: ${report.passivenessGates.runsEvaluated}/${report.runs}`);
    lines.push(
      `  Profile: mission=${report.passivenessGates.profile.missionId}, size=${report.passivenessGates.profile.gameSize}, density=${report.passivenessGates.profile.densityRatio}% (bucket ${report.passivenessGates.profile.densityBucket})`
    );
    if (report.passivenessGates.pass.overall === null) {
      lines.push(`  Status: n/a (${report.passivenessGates.skippedReason ?? 'no run passiveness metrics'})`);
    } else {
      lines.push(`  Status: ${report.passivenessGates.pass.overall ? 'PASS' : 'FAIL'}`);
      lines.push(
        `  Passive action ratio <= ${(report.passivenessGates.thresholds.maxPassiveActionRatio * 100).toFixed(1)}%: ${report.passivenessGates.pass.passiveActionRatio === null ? 'n/a' : report.passivenessGates.pass.passiveActionRatio ? 'PASS' : 'FAIL'} (avg=${report.passivenessGates.observed.avgPassiveActionRatio !== null ? (report.passivenessGates.observed.avgPassiveActionRatio * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Detect+Hide action ratio <= ${(report.passivenessGates.thresholds.maxDetectHideActionRatio * 100).toFixed(1)}%: ${report.passivenessGates.pass.detectHideActionRatio === null ? 'n/a' : report.passivenessGates.pass.detectHideActionRatio ? 'PASS' : 'FAIL'} (avg=${report.passivenessGates.observed.avgDetectHideActionRatio !== null ? (report.passivenessGates.observed.avgDetectHideActionRatio * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Wait action ratio <= ${(report.passivenessGates.thresholds.maxWaitActionRatio * 100).toFixed(1)}%: ${report.passivenessGates.pass.waitActionRatio === null ? 'n/a' : report.passivenessGates.pass.waitActionRatio ? 'PASS' : 'FAIL'} (avg=${report.passivenessGates.observed.avgWaitActionRatio !== null ? (report.passivenessGates.observed.avgWaitActionRatio * 100).toFixed(1) : 'n/a'}%)`
      );
    }
  }

  if (report.attackGateTelemetryGates?.enabled) {
    lines.push('');
    lines.push('🗡️ ATTACK-GATE TELEMETRY GATES');
    lines.push(`  Runs Evaluated: ${report.attackGateTelemetryGates.runsEvaluated}/${report.runs}`);
    lines.push(
      `  Profile: mission=${report.attackGateTelemetryGates.profile.missionId}, size=${report.attackGateTelemetryGates.profile.gameSize}, density=${report.attackGateTelemetryGates.profile.densityRatio}% (bucket ${report.attackGateTelemetryGates.profile.densityBucket})`
    );
    lines.push(
      `  Horizon: ${report.attackGateTelemetryGates.profile.maxTurns}/${report.attackGateTelemetryGates.profile.configuredMaxTurns} turns (${(report.attackGateTelemetryGates.profile.horizonRatio * 100).toFixed(1)}%)`
    );
    if (report.attackGateTelemetryGates.pass.overall === null) {
      lines.push(`  Status: n/a (${report.attackGateTelemetryGates.skippedReason ?? 'no telemetry/opportunity samples'})`);
    } else {
      lines.push(`  Status: ${report.attackGateTelemetryGates.pass.overall ? 'PASS' : 'FAIL'}`);
      lines.push(
        `  Telemetry samples/run >= ${report.attackGateTelemetryGates.thresholds.minTelemetrySamplesPerRun.toFixed(2)}: ${report.attackGateTelemetryGates.pass.telemetrySamples === null ? 'n/a' : report.attackGateTelemetryGates.pass.telemetrySamples ? 'PASS' : 'FAIL'} (avg=${report.attackGateTelemetryGates.observed.avgTelemetrySamplesPerRun !== null ? report.attackGateTelemetryGates.observed.avgTelemetrySamplesPerRun.toFixed(2) : 'n/a'})`
      );
      lines.push(
        `  Immediate-high conversion >= ${(report.attackGateTelemetryGates.thresholds.minImmediateHighConversionRate * 100).toFixed(1)}% (min opportunities ${report.attackGateTelemetryGates.thresholds.minImmediateHighOpportunityCount}): ${report.attackGateTelemetryGates.pass.immediateHighConversion === null ? 'n/a' : report.attackGateTelemetryGates.pass.immediateHighConversion ? 'PASS' : 'FAIL'} (total opportunities=${report.attackGateTelemetryGates.observed.totalImmediateHighOpportunities}, avg=${report.attackGateTelemetryGates.observed.immediateHighConversionRate !== null ? (report.attackGateTelemetryGates.observed.immediateHighConversionRate * 100).toFixed(1) : 'n/a'}%)`
      );
      lines.push(
        `  Pressure-opportunity apply rate >= ${(report.attackGateTelemetryGates.thresholds.minPressureOpportunityGateApplyRate * 100).toFixed(1)}%: ${report.attackGateTelemetryGates.pass.pressureOpportunityApplyRate === null ? 'n/a' : report.attackGateTelemetryGates.pass.pressureOpportunityApplyRate ? 'PASS' : 'FAIL'} (total opportunities=${report.attackGateTelemetryGates.observed.totalPressureOpportunities}, avg=${report.attackGateTelemetryGates.observed.pressureOpportunityGateApplyRate !== null ? (report.attackGateTelemetryGates.observed.pressureOpportunityGateApplyRate * 100).toFixed(1) : 'n/a'}%)`
      );
    }
  }

  lines.push('');
  lines.push('⚡ BONUS ACTIONS');
  lines.push(`  Opportunities: ${advanced.bonusActions.opportunities}`);
  lines.push(`  Options Offered: ${advanced.bonusActions.optionsOffered}`);
  lines.push(`  Options Available: ${advanced.bonusActions.optionsAvailable}`);
  lines.push(`  Executed: ${advanced.bonusActions.executed}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.bonusActions.availableByType, '    '));
  lines.push('  Executed By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.bonusActions.executedByType, '    '));
  lines.push('');
  lines.push('🛡️  PASSIVE OPTIONS');
  lines.push(`  Opportunities: ${advanced.passiveOptions.opportunities}`);
  lines.push(`  Options Offered: ${advanced.passiveOptions.optionsOffered}`);
  lines.push(`  Options Available: ${advanced.passiveOptions.optionsAvailable}`);
  lines.push(`  Used: ${advanced.passiveOptions.used}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.availableByType, '    '));
  lines.push('  Rejected By Reason:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.rejectedByReason, '    '));
  lines.push('  Rejected By Reason (Turn Buckets):');
  lines.push(...formatTurnBucketBreakdownLines(advanced.passiveOptions.rejectedByReasonByTurn, '    '));
  lines.push('  Status-Gated Windows By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.rejectedStatusByType, '    '));
  lines.push('  Prefiltered By Reason:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.prefilteredByReason, '    '));
  lines.push('  Prefiltered By Reason (Turn Buckets):');
  lines.push(...formatTurnBucketBreakdownLines(advanced.passiveOptions.prefilteredByReasonByTurn, '    '));
  lines.push('  Used By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.passiveOptions.usedByType, '    '));
  lines.push('');
  lines.push('🎯 SITUATIONAL MODIFIERS');
  lines.push(`  Tests Observed: ${advanced.situationalModifiers.testsObserved}`);
  lines.push(`  Modified Tests: ${advanced.situationalModifiers.modifiedTests}`);
  lines.push(`  Modifiers Applied: ${advanced.situationalModifiers.modifiersApplied}`);
  const leanUses = (advanced.situationalModifiers.byType.leaning ?? 0)
    + (advanced.situationalModifiers.byType.detect_lean ?? 0);
  lines.push(`  Lean Uses: ${leanUses}`);
  lines.push('  Breakdown By Type:');
  lines.push(...formatTypeBreakdownLines(advanced.situationalModifiers.byType, '    '));

  if (report.runReports.length > 0) {
    lines.push('');
    lines.push('🧱 NESTED SECTIONS (RUN 1)');
    const nested = report.runReports[0].nestedSections ?? {
      sides: [],
      battlefieldLayout: {
        widthMu: 0,
        heightMu: 0,
        densityRatio: report.densityRatio,
        terrainFeatures: [],
        deployments: [],
      },
    };
    lines.push(`  Side Count: ${nested.sides.length}`);
    for (const side of nested.sides) {
      lines.push(`  Side: ${side.name}`);
      for (const assembly of side.assemblies) {
        lines.push(`    Assembly: ${assembly.name} (${assembly.characters.length} characters)`);
      }
    }
    lines.push('  Battlefield Layout:');
    lines.push(`    Size: ${nested.battlefieldLayout.widthMu}x${nested.battlefieldLayout.heightMu} MU`);
    lines.push(`    Density: ${nested.battlefieldLayout.densityRatio}%`);
    lines.push(`    Terrain Features: ${nested.battlefieldLayout.terrainFeatures.length}`);
    lines.push(`    Deployments: ${nested.battlefieldLayout.deployments.length}`);
  }

  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

/**
 * Write validation report to JSON file
 */
export function writeValidationReport(report: ValidationAggregateReport): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const missionSlug = String(report.missionId || 'mission')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const outputPath = join(outputDir, `${missionSlug}-validation-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

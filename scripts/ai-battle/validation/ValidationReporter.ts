/**
 * Validation Reporter
 *
 * Formats and writes validation aggregate reports.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ValidationAggregateReport } from './ValidationMetrics';
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

/**
 * Format validation aggregate report to human-readable text
 */
export function formatValidationAggregateReportHumanReadable(report: ValidationAggregateReport): string {
  const advanced = report.advancedRuleTotals ?? createEmptyAdvancedRuleMetrics();
  const waitTakeRate = safeRate(report.totals.waitChoicesTaken, report.totals.waitChoicesGiven);
  const waitSuccessRate = safeRate(report.totals.waitChoicesSucceeded, report.totals.waitChoicesTaken);
  const reactTakeRate = safeRate(report.totals.reactChoicesTaken, report.totals.reactChoiceWindows);
  const reactOptionSelectionRate = safeRate(report.totals.reactChoicesTaken, report.totals.reactChoicesGiven);
  const waitReactPerSuccessfulWait = safeRate(report.totals.waitTriggeredReacts, report.totals.waitChoicesSucceeded);

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
      const losTotal = losHits + losMisses;
      const pathTotal = pathHits + pathMisses;
      const gridTotal = gridHits + gridMisses;
      lines.push(
        `  Avg LOS Cache Hit Rate: ${losTotal > 0 ? ((losHits / losTotal) * 100).toFixed(1) : '0.0'}% (${losHits}/${losTotal})`
      );
      lines.push(
        `  Avg Path Cache Hit Rate: ${pathTotal > 0 ? ((pathHits / pathTotal) * 100).toFixed(1) : '0.0'}% (${pathHits}/${pathTotal})`
      );
      lines.push(
        `  Avg Grid Cache Hit Rate: ${gridTotal > 0 ? ((gridHits / gridTotal) * 100).toFixed(1) : '0.0'}% (${gridHits}/${gridTotal})`
      );
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

/**
 * Battle Report Formatter
 * 
 * Formats battle reports into human-readable text output.
 */

import type { BattleReport, BattleStats, AdvancedRuleMetrics, UsageMetrics } from '../../shared/BattleReportTypes';
import { GAME_SIZE_CONFIG } from '../AIBattleConfig';

/**
 * Calculate rate safely (returns 0 if denominator is 0)
 */
function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Create empty advanced rule metrics
 */
function createEmptyAdvancedRuleMetrics(): AdvancedRuleMetrics {
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
 * Format path leaders (top models by path length)
 */
function formatPathLeaders(topPathModels: Array<{ modelId: string; modelName: string; pathLength: number }>): string {
  if (!topPathModels || topPathModels.length === 0) {
    return '    none';
  }
  return topPathModels
    .slice(0, 5)
    .map(m => `    - ${m.modelName} (${m.modelId}): ${m.pathLength.toFixed(2)} MU`)
    .join('\n');
}

/**
 * Format type breakdown lines
 */
function formatTypeBreakdownLines(
  breakdown: Record<string, number>,
  indent: string = '  '
): string[] {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return [`${indent}none`];
  }
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  return entries.map(([type, count]) => `${indent}${type}: ${count}`);
}

/**
 * Format battle report to human-readable text
 */
export function formatBattleReportHumanReadable(report: BattleReport): string {
  const fallbackUsage: UsageMetrics = {
    totalTokens: 0,
    tokensPerActivation: 0,
    decisionLatencyMs: 0,
    modelCount: report.finalCounts.reduce((sum, side) => sum + side.remaining, 0),
    modelsMoved: (report.stats as any).modelsMoved ?? 0,
    modelsUsedWait: 0,
    modelsUsedDetect: 0,
    modelsUsedHide: 0,
    modelsUsedReact: 0,
    totalPathLength: (report.stats as any).totalPathLength ?? 0,
    averagePathLengthPerMovedModel: 0,
    averagePathLengthPerModel: 0,
    topPathModels: [],
  };
  const usage = report.usage ?? fallbackUsage;
  const advancedRules = report.advancedRules ?? createEmptyAdvancedRuleMetrics();
  const nestedSections = (report as any).nestedSections ?? {
    sides: [],
    battlefieldLayout: {
      widthMu: report.config.battlefieldWidth,
      heightMu: report.config.battlefieldHeight,
      densityRatio: report.config.densityRatio,
      terrainFeatures: [],
      deployments: [],
    },
  };

  // Calculate averages if needed
  const usageAny = usage as any;
  if (usageAny.averagePathLengthPerMovedModel === 0 && usageAny.modelsMoved > 0) {
    usageAny.averagePathLengthPerMovedModel = usageAny.totalPathLength / usageAny.modelsMoved;
  }
  if (usageAny.averagePathLengthPerModel === 0 && usageAny.modelCount > 0) {
    usageAny.averagePathLengthPerModel = usageAny.totalPathLength / usageAny.modelCount;
  }

  // Calculate rates
  const stats = report.stats as any;
  const waitTakeRate = safeRate(stats.waitChoicesTaken ?? 0, stats.waitChoicesGiven ?? 0);
  const waitSuccessRate = safeRate(stats.waitChoicesSucceeded ?? 0, stats.waitChoicesTaken ?? 0);
  const reactTakeRate = safeRate(stats.reactChoicesTaken ?? 0, stats.reactChoiceWindows ?? 0);
  const reactOptionSelectionRate = safeRate(stats.reactChoicesTaken ?? 0, stats.reactChoicesGiven ?? 0);
  const waitReactPerSuccessfulWait = safeRate(stats.waitTriggeredReacts ?? 0, stats.waitChoicesSucceeded ?? 0);
  const decisionTelemetrySamples = stats.decisionTelemetrySamples ?? 0;
  const attackGateAppliedDecisions = stats.attackGateAppliedDecisions ?? 0;
  const attackGateImmediateHighApplied = stats.attackGateImmediateHighApplied ?? 0;
  const attackGateDirectiveApplied = stats.attackGateDirectiveApplied ?? 0;
  const attackGateAppliedRate = safeRate(attackGateAppliedDecisions, decisionTelemetrySamples);
  const attackOpportunityImmediateHigh = stats.attackOpportunityImmediateHigh ?? 0;
  const attackOpportunityImmediateLow = stats.attackOpportunityImmediateLow ?? 0;
  const attackOpportunitySetup = stats.attackOpportunitySetup ?? 0;
  const attackOpportunityNone = stats.attackOpportunityNone ?? 0;
  const hitTestsAttempted = stats.hitTestsAttempted ?? 0;
  const hitTestsPassed = stats.hitTestsPassed ?? 0;
  const damageTestsAttempted = stats.damageTestsAttempted ?? 0;
  const damageTestsPassed = stats.damageTestsPassed ?? 0;
  const totalWoundsAssigned = stats.woundsAssigned ?? 0;
  const totalFearAssigned = stats.fearAssigned ?? 0;
  const totalDelayAssigned = stats.delayAssigned ?? 0;
  const damageWoundsAssigned = stats.damageWoundsAssigned ?? totalWoundsAssigned;
  const damageFearAssigned = stats.damageFearAssigned ?? totalFearAssigned;
  const damageDelayAssigned = stats.damageDelayAssigned ?? totalDelayAssigned;
  const passiveOrOtherDelayAssigned =
    stats.passiveOrOtherDelayAssigned ?? Math.max(0, totalDelayAssigned - damageDelayAssigned);

  const lines: string[] = [];
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('📊 BATTLE REPORT');
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`📋 Mission: ${report.config.missionName}`);
  lines.push(`📏 Game Size: ${GAME_SIZE_CONFIG[report.config.gameSize].name}`);
  lines.push(`🗺️  Battlefield: ${report.config.battlefieldWidth}×${report.config.battlefieldHeight} MU`);
  lines.push(`🌲 Terrain Density: ${report.config.densityRatio}%`);
  lines.push(`💡 Lighting: ${(report.config.lighting as any).name || report.config.lighting} (Visibility OR ${report.config.visibilityOrMu} MU)`);
  lines.push(`🎲 Seed: ${report.seed ?? 'n/a'}`);
  lines.push(`⏱️  Turns Completed: ${stats.turnsCompleted ?? 0}/${report.config.maxTurns}`);
  lines.push('');
  lines.push('🏆 RESULT');
  lines.push(`  Winner: ${report.winner}!`);
  if (report.winnerReason) {
    lines.push(`  Winner Reason: ${report.winnerReason}`);
  }
  if (report.tieBreakMethod && report.tieBreakMethod !== 'none') {
    lines.push(`  Tie-Break Method: ${report.tieBreakMethod}`);
  }
  
  if (report.missionRuntime) {
    lines.push('  Mission VP:');
    const vpEntries = Object.entries(report.missionRuntime.vpBySide);
    if (vpEntries.length === 0) {
      lines.push('    none');
    } else {
      vpEntries
        .sort((a, b) => b[1] - a[1])
        .forEach(([sideId, vp]) => {
          lines.push(`    ${sideId}: VP ${vp}, RP ${report.missionRuntime?.rpBySide?.[sideId] ?? 0}`);
        });
    }
    if (report.missionRuntime.immediateWinnerSideId) {
      lines.push(`  Mission Immediate Winner: ${report.missionRuntime.immediateWinnerSideId}`);
    }
    const predictedBySide = report.missionRuntime.predictedScoring?.bySide ?? {};
    if (Object.keys(predictedBySide).length > 0) {
      lines.push('  Key Scores (Current):');
      Object.entries(predictedBySide)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([sideId, sidePrediction]) => {
          const scoredKeys = Object.entries(sidePrediction.keyScores ?? {})
            .map(([key, value]) => ({ key, current: Number(value?.current ?? 0) }))
            .filter(entry => Number.isFinite(entry.current))
            .sort((left, right) => right.current - left.current || left.key.localeCompare(right.key));
          if (scoredKeys.length === 0) {
            lines.push(`    ${sideId}: none`);
            return;
          }
          lines.push(
            `    ${sideId}: ${scoredKeys.map(entry => `${entry.key}=${entry.current.toFixed(2)}`).join(', ')}`
          );
        });
    }
  }
  
  lines.push('  Final Model Counts:');
  report.finalCounts.forEach(fc => {
    lines.push(`    ${fc.name}: ${fc.remaining} remaining`);
  });
  lines.push('');

  if (report.sideStrategies && Object.keys(report.sideStrategies).length > 0) {
    lines.push('🧠 SIDE COORDINATOR STRATEGIES');
    for (const [sideId, strategy] of Object.entries(report.sideStrategies)) {
      lines.push(`  ${sideId}: doctrine=${strategy.doctrine}`);
      if (strategy.context) {
        lines.push(
          `    Context: leading=${strategy.context.amILeading} vpMargin=${strategy.context.vpMargin} winningKeys=[${strategy.context.winningKeys.join(', ')}] losingKeys=[${strategy.context.losingKeys.join(', ')}]`
        );
      }
      if (strategy.advice?.length) {
        lines.push(`    Advice: ${strategy.advice.join(' | ')}`);
      }
      if (strategy.pressureContinuityDiagnostics) {
        const scrum = strategy.pressureContinuityDiagnostics.scrum;
        const lane = strategy.pressureContinuityDiagnostics.lane;
        const combined = strategy.pressureContinuityDiagnostics.combined;
        lines.push(
          `    Pressure Continuity: breakRate scrum=${(scrum.breakRate * 100).toFixed(1)}% lane=${(lane.breakRate * 100).toFixed(1)}% combined=${(combined.breakRate * 100).toFixed(1)}%`
        );
        lines.push(
          `    Signature Coverage: scrum=${(scrum.signatureCoverageRate * 100).toFixed(1)}% lane=${(lane.signatureCoverageRate * 100).toFixed(1)}% combined=${(combined.signatureCoverageRate * 100).toFixed(1)}%`
        );
      }
      const latestTrace = strategy.decisionTrace && strategy.decisionTrace.length > 0
        ? strategy.decisionTrace[strategy.decisionTrace.length - 1]
        : undefined;
      if (latestTrace) {
        lines.push(
          `    Trace@T${latestTrace.turn}: priority=${latestTrace.response.priority} focus=[${latestTrace.response.focusTargets.join(', ')}]`
        );
        if (latestTrace.response.potentialDirective) {
          lines.push(`    Potential Directive: ${latestTrace.response.potentialDirective}`);
        }
        if (latestTrace.response.pressureDirective) {
          lines.push(`    Pressure Directive: ${latestTrace.response.pressureDirective}`);
        }
        if (latestTrace.observations.topOpponentKeyPressure.length > 0) {
          const pressure = latestTrace.observations.topOpponentKeyPressure
            .map(entry => `${entry.key}:${entry.predicted.toFixed(2)}@${entry.confidence.toFixed(2)}`)
            .join(', ');
          lines.push(`    Opponent Pressure: ${pressure}`);
        }
        if (latestTrace.observations.topScrumContinuity.length > 0) {
          const scrum = latestTrace.observations.topScrumContinuity
            .map(entry => `${entry.targetId}:${entry.score.toFixed(2)}(${entry.attackerCount})`)
            .join(', ');
          lines.push(`    Scrum Continuity: ${scrum}`);
        }
        if (latestTrace.observations.topLanePressure.length > 0) {
          const lane = latestTrace.observations.topLanePressure
            .map(entry => `${entry.targetId}:${entry.score.toFixed(2)}(${entry.attackerCount})`)
            .join(', ');
          lines.push(`    Lane Pressure: ${lane}`);
        }
        if (latestTrace.observations.fractionalPotential) {
          const p = latestTrace.observations.fractionalPotential;
          lines.push(
            `    Fractional Potential: my=${p.myVpPotential.toFixed(2)} opp=${p.opponentVpPotential.toFixed(2)} delta=${p.potentialDelta.toFixed(2)} urgency=${p.urgency.toFixed(2)}`
          );
        }
      }
    }
    lines.push('');
  }
  
  lines.push('📈 ACTION TOTALS');
  lines.push(`  Total Actions: ${stats.totalActions ?? 0}`);
  lines.push(`  Moves: ${stats.moves ?? 0}`);
  lines.push(`  Moves While Waiting: ${stats.movesWhileWaiting ?? 0}`);
  lines.push(`  Close Combats: ${stats.closeCombats ?? 0}`);
  lines.push(`  Ranged Combats: ${stats.rangedCombats ?? 0}`);
  lines.push(`  Disengages: ${stats.disengages ?? 0}`);
  lines.push(`  Waits: ${stats.waits ?? 0}`);
  lines.push(`  Waits Selected (Planner): ${stats.waitsSelectedPlanner ?? 0}`);
  lines.push(`  Waits Selected (Utility): ${stats.waitsSelectedUtility ?? 0}`);
  lines.push(`  Wait Choices Given: ${stats.waitChoicesGiven ?? 0}`);
  lines.push(`  Wait Choices Taken: ${stats.waitChoicesTaken ?? 0}`);
  lines.push(`  Wait Choices Succeeded: ${stats.waitChoicesSucceeded ?? 0}`);
  lines.push(`  Wait Take Rate: ${(waitTakeRate * 100).toFixed(1)}%`);
  lines.push(`  Wait Success Rate: ${(waitSuccessRate * 100).toFixed(1)}%`);
  lines.push(`  Wait Maintained: ${stats.waitMaintained ?? 0}`);
  lines.push(`  Wait Upkeep Paid: ${stats.waitUpkeepPaid ?? 0}`);
  lines.push(`  Detects: ${stats.detects ?? 0}`);
  lines.push(`  Hides: ${stats.hides ?? 0}`);
  lines.push(`  Reacts: ${stats.reacts ?? 0}`);
  lines.push(`  React Choice Windows: ${stats.reactChoiceWindows ?? 0}`);
  lines.push(`  React Choices Given: ${stats.reactChoicesGiven ?? 0}`);
  lines.push(`  React Choices Taken: ${stats.reactChoicesTaken ?? 0}`);
  lines.push(`  React Take Rate: ${(reactTakeRate * 100).toFixed(1)}%`);
  lines.push(`  React Option Selection Rate: ${(reactOptionSelectionRate * 100).toFixed(1)}%`);
  lines.push(`  Wait->React Triggers: ${stats.waitTriggeredReacts ?? 0}`);
  lines.push(`  Wait->React per Successful Wait: ${waitReactPerSuccessfulWait.toFixed(2)}x`);
  lines.push(`  Wait->React Wounds Inflicted: ${stats.waitReactWoundsInflicted ?? 0}`);
  lines.push(`  React Wounds Inflicted: ${stats.reactWoundsInflicted ?? 0}`);
  lines.push(`  LOS Checks: ${stats.losChecks ?? 0}`);
  lines.push(`  LOF Checks: ${stats.lofChecks ?? 0}`);
  lines.push(`  Eliminations: ${stats.eliminations ?? 0}`);
  lines.push(`  KO's: ${stats.kos ?? 0}`);
  lines.push(`  Hit Tests: ${(safeRate(hitTestsPassed, hitTestsAttempted) * 100).toFixed(1)}% (${hitTestsPassed}/${hitTestsAttempted})`);
  lines.push(`  Damage Tests: ${(safeRate(damageTestsPassed, damageTestsAttempted) * 100).toFixed(1)}% (${damageTestsPassed}/${damageTestsAttempted})`);
  lines.push(`  Combat Assignments (Damage W/F/D): ${damageWoundsAssigned}/${damageFearAssigned}/${damageDelayAssigned}`);
  lines.push(`  Combat Delay (Passive/Other): ${passiveOrOtherDelayAssigned}`);
  lines.push(`  Combat Assignments (All W/F/D): ${totalWoundsAssigned}/${totalFearAssigned}/${totalDelayAssigned}`);
  lines.push(`  Decision Telemetry Samples: ${decisionTelemetrySamples}`);
  if (decisionTelemetrySamples > 0) {
    lines.push(`  Attack Gate Applied: ${attackGateAppliedDecisions} (${(attackGateAppliedRate * 100).toFixed(1)}%)`);
    lines.push(`  Attack Gate Reasons: immediate_high=${attackGateImmediateHighApplied}, directive_window=${attackGateDirectiveApplied}`);
    lines.push(
      `  Attack Opportunity Grades: immediate_high=${attackOpportunityImmediateHigh}, immediate_low=${attackOpportunityImmediateLow}, setup=${attackOpportunitySetup}, none=${attackOpportunityNone}`
    );
  }
  lines.push('');
  
  lines.push('📐 MOVEMENT & USAGE');
  lines.push(`  Path Length (total): ${usageAny.totalPathLength?.toFixed(2) ?? '0.00'} MU`);
  lines.push(`  Path Length (avg per moved model): ${usageAny.averagePathLengthPerMovedModel?.toFixed(2) ?? '0.00'} MU`);
  lines.push(`  Path Length (avg per model): ${usageAny.averagePathLengthPerModel?.toFixed(2) ?? '0.00'} MU`);
  lines.push(`  Models that moved: ${usageAny.modelsMoved ?? 0}/${usageAny.modelCount ?? 0}`);
  lines.push(`  Models that used Hidden: ${usageAny.modelsUsedHide ?? 0}/${usageAny.modelCount ?? 0}`);
  lines.push(`  Models that used Detect: ${usageAny.modelsUsedDetect ?? 0}/${usageAny.modelCount ?? 0}`);
  lines.push(`  Models that used Wait: ${usageAny.modelsUsedWait ?? 0}/${usageAny.modelCount ?? 0}`);
  lines.push(`  Models that used React: ${usageAny.modelsUsedReact ?? 0}/${usageAny.modelCount ?? 0}`);
  lines.push('  Top Path Length Models:');
  lines.push(formatPathLeaders(usageAny.topPathModels ?? []));
  lines.push('');
  
  lines.push('⚡ BONUS ACTIONS');
  lines.push(`  Opportunities: ${advancedRules.bonusActions.opportunities}`);
  lines.push(`  Options Offered: ${advancedRules.bonusActions.optionsOffered}`);
  lines.push(`  Options Available: ${advancedRules.bonusActions.optionsAvailable}`);
  lines.push(`  Executed: ${advancedRules.bonusActions.executed}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.bonusActions.availableByType, '    '));
  lines.push('  Executed By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.bonusActions.executedByType, '    '));
  lines.push('');
  
  lines.push('🛡️  PASSIVE OPTIONS');
  lines.push(`  Opportunities: ${advancedRules.passiveOptions.opportunities}`);
  lines.push(`  Options Offered: ${advancedRules.passiveOptions.optionsOffered}`);
  lines.push(`  Options Available: ${advancedRules.passiveOptions.optionsAvailable}`);
  lines.push(`  Used: ${advancedRules.passiveOptions.used}`);
  lines.push('  Available By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.passiveOptions.availableByType, '    '));
  lines.push('  Used By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.passiveOptions.usedByType, '    '));
  lines.push('');
  
  lines.push('🎯 SITUATIONAL MODIFIERS');
  lines.push(`  Tests Observed: ${advancedRules.situationalModifiers.testsObserved}`);
  lines.push(`  Modified Tests: ${advancedRules.situationalModifiers.modifiedTests}`);
  lines.push(`  Modifiers Applied: ${advancedRules.situationalModifiers.modifiersApplied}`);
  const leanUses = (advancedRules.situationalModifiers.byType.leaning ?? 0) +
    (advancedRules.situationalModifiers.byType.detect_lean ?? 0);
  lines.push(`  Lean Uses: ${leanUses}`);
  lines.push('  Breakdown By Type:');
  lines.push(...formatTypeBreakdownLines(advancedRules.situationalModifiers.byType, '    '));
  lines.push('');
  
  // Performance metrics (if available)
  if ((report as any).performance) {
    const perf = (report as any).performance;
    const activationLatency = perf.activationLatency ?? {
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      maxMs: 0,
    };
    lines.push('⏱️  PERFORMANCE');
    lines.push(`  Elapsed: ${perf.elapsedMs?.toFixed(2) ?? '0.00'} ms`);
    lines.push(`  Activations Processed: ${perf.activationsProcessed ?? 0}`);
    lines.push(
      `  Activation Latency: avg=${activationLatency.avgMs.toFixed(2)}ms p50=${activationLatency.p50Ms.toFixed(2)}ms p95=${activationLatency.p95Ms.toFixed(2)}ms max=${activationLatency.maxMs.toFixed(2)}ms`
    );
    lines.push(`  Heartbeat Every N Activations: ${perf.heartbeatEveryActivations ?? 0}`);
    lines.push('  Phase Timings:');
    const phaseEntries = Object.entries(perf.phases ?? {})
      .sort((a: any, b: any) => b[1].totalMs - a[1].totalMs);
    if (phaseEntries.length === 0) {
      lines.push('    none');
    } else {
      phaseEntries.forEach(([phase, stats]: [string, any]) => {
        lines.push(
          `    ${phase}: total=${stats.totalMs.toFixed(2)}ms avg=${stats.avgMs.toFixed(2)}ms max=${stats.maxMs.toFixed(2)}ms count=${stats.count}`
        );
      });
    }
    lines.push('  Slowest Activations:');
    if (!perf.slowestActivations || perf.slowestActivations.length === 0) {
      lines.push('    none');
    } else {
      perf.slowestActivations.forEach((entry: any) => {
        lines.push(
          `    turn=${entry.turn} side=${entry.sideName} model=${entry.modelName} ms=${entry.elapsedMs.toFixed(2)} steps=${entry.steps}`
        );
      });
    }
    if (perf.caches) {
      const los = perf.caches.los;
      const path = perf.caches.pathfinding;
      const losTotal = los.hits + los.misses;
      const pathTotal = path.pathHits + path.pathMisses;
      const gridTotal = path.gridHits + path.gridMisses;
      lines.push('  Cache Stats:');
      lines.push(
        `    LOS cache: hits=${los.hits} misses=${los.misses} hitRate=${losTotal > 0 ? ((los.hits / losTotal) * 100).toFixed(1) : '0.0'}% size=${los.size}/${los.maxSize}`
      );
      lines.push(
        `    Path cache: hits=${path.pathHits} misses=${path.pathMisses} hitRate=${pathTotal > 0 ? ((path.pathHits / pathTotal) * 100).toFixed(1) : '0.0'}% size=${path.pathCacheSize}/${path.pathCacheMaxSize}`
      );
      lines.push(
        `    Grid cache: hits=${path.gridHits} misses=${path.gridMisses} hitRate=${gridTotal > 0 ? ((path.gridHits / gridTotal) * 100).toFixed(1) : '0.0'}% size=${path.gridCacheSize}/${path.gridCacheMaxSize}`
      );
      const minimax = perf.caches.minimaxLite;
      if (minimax) {
        const minimaxTotal = minimax.hits + minimax.misses;
        lines.push(
          `    Minimax cache: hits=${minimax.hits} misses=${minimax.misses} hitRate=${minimaxTotal > 0 ? ((minimax.hits / minimaxTotal) * 100).toFixed(1) : '0.0'}% size=${minimax.totalSize}/${minimax.totalMaxSize} controllers=${minimax.controllersWithSamples}/${minimax.controllers}`
        );
        lines.push(
          `    Minimax nodes: total=${minimax.nodeEvaluations} avg/controller=${minimax.avgNodeEvaluationsPerController.toFixed(2)}`
        );
        const patchGraph = minimax.patchGraph;
        if (patchGraph) {
          const patchTotal = patchGraph.hits + patchGraph.misses;
          lines.push(
            `    Minimax patch cache: hits=${patchGraph.hits} misses=${patchGraph.misses} hitRate=${patchTotal > 0 ? ((patchGraph.hits / patchTotal) * 100).toFixed(1) : '0.0'}% size=${patchGraph.totalSize}/${patchGraph.totalMaxSize} evictions=${patchGraph.evictions}`
          );
          const neighborhoodTotal = Number(patchGraph.neighborhoodGraphHits ?? 0) + Number(patchGraph.neighborhoodGraphMisses ?? 0);
          if (neighborhoodTotal > 0) {
            lines.push(
              `    Minimax patch neighborhoods: hits=${patchGraph.neighborhoodGraphHits} misses=${patchGraph.neighborhoodGraphMisses} hitRate=${((Number(patchGraph.neighborhoodGraphHits ?? 0) / neighborhoodTotal) * 100).toFixed(1)}% size=${patchGraph.neighborhoodGraphTotalSize ?? 0}/${patchGraph.neighborhoodGraphTotalMaxSize ?? 0} evictions=${patchGraph.neighborhoodGraphEvictions ?? 0}`
            );
          }
        }
        const topTransitions = Object.entries(minimax.patchTransitions ?? {})
          .map(([key, count]) => [key, Number(count) || 0] as const)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4);
        if (topTransitions.length > 0) {
          lines.push(
            `    Minimax patch transitions: ${topTransitions.map(([key, count]) => `${key}=${count}`).join(', ')}`
          );
        }
      }
    }
    lines.push('');
  }
  
  lines.push('🧱 NESTED SECTIONS');
  lines.push(`  Side Count: ${nestedSections.sides?.length ?? 0}`);
  for (const side of nestedSections.sides ?? []) {
    lines.push(`  Side: ${side.name}`);
    for (const assembly of side.assemblies ?? []) {
      lines.push(`    Assembly: ${assembly.name} (${assembly.characters?.length ?? 0} characters)`);
      for (const character of assembly.characters ?? []) {
        lines.push(`      Character: ${character.name}`);
        lines.push(`        Profile: ${character.profile?.archetype ?? 'unknown'}`);
      }
    }
  }
  lines.push('  Battlefield Layout:');
  lines.push(`    Size: ${nestedSections.battlefieldLayout?.widthMu ?? 0}x${nestedSections.battlefieldLayout?.heightMu ?? 0} MU`);
  lines.push(`    Density: ${nestedSections.battlefieldLayout?.densityRatio ?? 0}%`);
  lines.push(`    Terrain Features: ${nestedSections.battlefieldLayout?.terrainFeatures?.length ?? 0}`);
  lines.push(`    Deployments: ${nestedSections.battlefieldLayout?.deployments?.length ?? 0}`);
  lines.push('');
  lines.push('════════════════════════════════════════════════════════════');
  return lines.join('\n');
}

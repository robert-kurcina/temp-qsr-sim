/**
 * Validation Benchmark Summary
 *
 * Aggregates validation JSON reports and prints threshold suggestions
 * for combat-activity, passiveness, and pressure-continuity gates
 * by mission/size/density profile.
 *
 * Usage:
 *   npx tsx scripts/ai-battle/validation/BenchmarkSummary.ts
 *   npx tsx scripts/ai-battle/validation/BenchmarkSummary.ts generated/ai-battle-reports
 *   npx tsx scripts/ai-battle/validation/BenchmarkSummary.ts --min-horizon 0.5 generated/ai-battle-reports
 *   npx tsx scripts/ai-battle/validation/BenchmarkSummary.ts path/to/report.json path/to/dir
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { ValidationAggregateReport } from './ValidationMetrics';
import { GAME_SIZE_CONFIG } from '../AIBattleConfig';

type ProfileSample = {
  attackActionRatio?: number;
  runsWithCombatRate?: number;
  zeroAttackRunRate?: number;
  passiveActionRatio?: number;
  detectHideActionRatio?: number;
  waitActionRatio?: number;
  continuityDataRunRate?: number;
  continuitySignatureCoverageRate?: number;
  continuityCombinedBreakRate?: number;
  continuityLaneBreakRate?: number;
  continuityScrumBreakRate?: number;
};

type ProfileAccumulator = {
  missionId: string;
  gameSize: string;
  densityBucket: string;
  densityRatioAvg: number;
  reports: number;
  runs: number;
  samples: ProfileSample[];
};

const DEFAULT_INPUT_DIR = 'generated/ai-battle-reports';
const DENSITY_BUCKET_LABELS = ['0-24', '25-49', '50-74', '75-99', '100'] as const;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveDensityBucketLabel(densityRatio: number): string {
  const clamped = clampNumber(Math.round(densityRatio), 0, 100);
  const index = Math.min(DENSITY_BUCKET_LABELS.length - 1, Math.floor(clamped / 25));
  return DENSITY_BUCKET_LABELS[index];
}

function walkJsonFiles(pathname: string, out: string[]): void {
  if (!existsSync(pathname)) {
    return;
  }
  const stat = statSync(pathname);
  if (stat.isFile()) {
    if (extname(pathname).toLowerCase() === '.json') {
      out.push(pathname);
    }
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  for (const entry of readdirSync(pathname, { withFileTypes: true })) {
    const child = join(pathname, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(child, out);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
      out.push(child);
    }
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const clamped = clampNumber(p, 0, 1);
  const rank = clamped * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const weight = rank - low;
  return sorted[low] + (sorted[high] - sorted[low]) * weight;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPct(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

function formatFrac(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return 'n/a';
  return value.toFixed(4);
}

function parseValidationReport(pathname: string): ValidationAggregateReport | null {
  try {
    const raw = readFileSync(pathname, 'utf-8');
    const parsed = JSON.parse(raw) as ValidationAggregateReport;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.runReports)) return null;
    if (typeof parsed.missionId !== 'string' || typeof parsed.gameSize !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function computeRunSamplesFromReport(report: ValidationAggregateReport): ProfileSample[] {
  const runReports = Array.isArray(report.runReports) ? report.runReports : [];
  if (runReports.length === 0) {
    return [];
  }

  const samples: ProfileSample[] = [];

  for (const run of runReports) {
    const stats = (run as any).stats ?? {};
    const totalActions = Math.max(0, Number(stats.totalActions ?? 0));
    const attackActions = Math.max(
      0,
      Number(stats.rangedCombats ?? 0) + Number(stats.closeCombats ?? 0)
    );
    const hasCombat = attackActions > 0 ? 1 : 0;

    const detects = Math.max(0, Number(stats.detects ?? 0));
    const hides = Math.max(0, Number(stats.hides ?? 0));
    const waits = Math.max(0, Number(stats.waits ?? 0));
    const detectHideActions = detects + hides;
    const passiveActions = detectHideActions + waits;
    const pressureContinuity = (run as any).pressureContinuity;
    const continuityDataRunRate = pressureContinuity && typeof pressureContinuity === 'object' && typeof pressureContinuity.hasData === 'boolean'
      ? (pressureContinuity.hasData ? 1 : 0)
      : undefined;
    const continuitySignatureCoverageRate = isFiniteNumber(pressureContinuity?.signatureCoverageRate)
      ? pressureContinuity.signatureCoverageRate
      : undefined;
    const continuityCombinedBreakRate = isFiniteNumber(pressureContinuity?.combinedBreakRate)
      ? pressureContinuity.combinedBreakRate
      : undefined;
    const continuityLaneBreakRate = isFiniteNumber(pressureContinuity?.laneBreakRate)
      ? pressureContinuity.laneBreakRate
      : undefined;
    const continuityScrumBreakRate = isFiniteNumber(pressureContinuity?.scrumBreakRate)
      ? pressureContinuity.scrumBreakRate
      : undefined;

    samples.push({
      attackActionRatio: totalActions > 0 ? attackActions / totalActions : 0,
      runsWithCombatRate: hasCombat,
      zeroAttackRunRate: 1 - hasCombat,
      passiveActionRatio: totalActions > 0 ? passiveActions / totalActions : 0,
      detectHideActionRatio: totalActions > 0 ? detectHideActions / totalActions : 0,
      waitActionRatio: totalActions > 0 ? waits / totalActions : 0,
      continuityDataRunRate,
      continuitySignatureCoverageRate,
      continuityCombinedBreakRate,
      continuityLaneBreakRate,
      continuityScrumBreakRate,
    });
  }

  return samples;
}

function resolveReportHorizonRatio(report: ValidationAggregateReport): number | undefined {
  const explicit = report.combatActivityGates?.profile.horizonRatio
    ?? report.passivenessGates?.profile.horizonRatio;
  if (isFiniteNumber(explicit)) {
    return clampNumber(explicit, 0, 1);
  }

  const sizeConfig = GAME_SIZE_CONFIG[report.gameSize as keyof typeof GAME_SIZE_CONFIG];
  const configuredMaxTurns = Number(sizeConfig?.maxTurns ?? 0);
  if (!Number.isFinite(configuredMaxTurns) || configuredMaxTurns <= 0) {
    return undefined;
  }

  const runReports = Array.isArray(report.runReports) ? report.runReports : [];
  const completedTurns = runReports
    .map(run => Number((run as any).stats?.turnsCompleted ?? 0))
    .filter(value => Number.isFinite(value) && value > 0);
  if (completedTurns.length === 0) {
    return undefined;
  }

  const avgTurns = completedTurns.reduce((sum, value) => sum + value, 0) / completedTurns.length;
  return clampNumber(avgTurns / configuredMaxTurns, 0, 1);
}

function addSample(acc: ProfileAccumulator, sample: ProfileSample): void {
  acc.samples.push(sample);
}

function valuesForMetric(samples: ProfileSample[], selector: (sample: ProfileSample) => number | undefined): number[] {
  return samples.map(selector).filter(isFiniteNumber);
}

function printProfileSummary(acc: ProfileAccumulator): void {
  const attackRatios = valuesForMetric(
    acc.samples,
    sample => sample.runsWithCombatRate === 1 ? sample.attackActionRatio : undefined
  );
  const combatRates = valuesForMetric(acc.samples, sample => sample.runsWithCombatRate);
  const zeroAttackRates = valuesForMetric(acc.samples, sample => sample.zeroAttackRunRate);
  const passiveRatios = valuesForMetric(acc.samples, sample => sample.passiveActionRatio);
  const detectHideRatios = valuesForMetric(acc.samples, sample => sample.detectHideActionRatio);
  const waitRatios = valuesForMetric(acc.samples, sample => sample.waitActionRatio);
  const continuityDataRates = valuesForMetric(acc.samples, sample => sample.continuityDataRunRate);
  const continuityCoverageRates = valuesForMetric(acc.samples, sample => sample.continuitySignatureCoverageRate);
  const continuityCombinedBreakRates = valuesForMetric(acc.samples, sample => sample.continuityCombinedBreakRate);
  const continuityLaneBreakRates = valuesForMetric(acc.samples, sample => sample.continuityLaneBreakRate);
  const continuityScrumBreakRates = valuesForMetric(acc.samples, sample => sample.continuityScrumBreakRate);

  const attackP25 = percentile(attackRatios, 0.25);
  const combatP25 = percentile(combatRates, 0.25);
  const zeroAttackP75 = percentile(zeroAttackRates, 0.75);
  const passiveP75 = percentile(passiveRatios, 0.75);
  const detectHideP75 = percentile(detectHideRatios, 0.75);
  const waitP75 = percentile(waitRatios, 0.75);
  const continuityCoverageP25 = percentile(continuityCoverageRates, 0.25);
  const continuityCombinedBreakP75 = percentile(continuityCombinedBreakRates, 0.75);
  const continuityLaneBreakP75 = percentile(continuityLaneBreakRates, 0.75);
  const continuityScrumBreakP75 = percentile(continuityScrumBreakRates, 0.75);
  const combatMean = mean(combatRates);
  const zeroAttackMean = mean(zeroAttackRates);
  const passiveMean = mean(passiveRatios);
  const detectHideMean = mean(detectHideRatios);
  const waitMean = mean(waitRatios);
  const continuityDataMean = mean(continuityDataRates);
  const continuityCoverageMean = mean(continuityCoverageRates);
  const continuityCombinedBreakMean = mean(continuityCombinedBreakRates);
  const continuityLaneBreakMean = mean(continuityLaneBreakRates);
  const continuityScrumBreakMean = mean(continuityScrumBreakRates);

  const suggestedAttackRatio = attackP25;
  const suggestedRunsWithCombatRate = isFiniteNumber(combatP25) && combatP25 > 0
    ? combatP25
    : isFiniteNumber(combatMean)
      ? clampNumber(combatMean - 0.05, 0, 1)
      : null;
  const suggestedZeroAttackRunRate = isFiniteNumber(zeroAttackP75) && zeroAttackP75 < 1
    ? zeroAttackP75
    : isFiniteNumber(zeroAttackMean)
      ? clampNumber(zeroAttackMean + 0.05, 0, 1)
      : null;
  const suggestedPassiveRatio = isFiniteNumber(passiveP75) && passiveP75 > 0
    ? passiveP75
    : isFiniteNumber(passiveMean)
      ? clampNumber(passiveMean + 0.02, 0, 1)
      : null;
  const suggestedDetectHideRatio = isFiniteNumber(detectHideP75) && detectHideP75 > 0
    ? detectHideP75
    : isFiniteNumber(detectHideMean)
      ? clampNumber(detectHideMean + 0.02, 0, 1)
      : null;
  const suggestedWaitRatio = isFiniteNumber(waitP75) && waitP75 > 0
    ? waitP75
    : isFiniteNumber(waitMean)
      ? clampNumber(waitMean + 0.02, 0, 1)
      : null;
  const suggestedContinuityDataRate = isFiniteNumber(continuityDataMean)
    ? clampNumber(continuityDataMean - 0.05, 0, 1)
    : null;
  const suggestedContinuityCoverageRate = isFiniteNumber(continuityCoverageP25) && continuityCoverageP25 > 0
    ? continuityCoverageP25
    : isFiniteNumber(continuityCoverageMean)
      ? clampNumber(continuityCoverageMean - 0.05, 0, 1)
      : null;
  const suggestedContinuityCombinedBreakRate = isFiniteNumber(continuityCombinedBreakP75)
    ? continuityCombinedBreakP75
    : isFiniteNumber(continuityCombinedBreakMean)
      ? clampNumber(continuityCombinedBreakMean + 0.05, 0, 1)
      : null;
  const suggestedContinuityLaneBreakRate = isFiniteNumber(continuityLaneBreakP75)
    ? continuityLaneBreakP75
    : isFiniteNumber(continuityLaneBreakMean)
      ? clampNumber(continuityLaneBreakMean + 0.05, 0, 1)
      : null;
  const suggestedContinuityScrumBreakRate = isFiniteNumber(continuityScrumBreakP75)
    ? continuityScrumBreakP75
    : isFiniteNumber(continuityScrumBreakMean)
      ? clampNumber(continuityScrumBreakMean + 0.05, 0, 1)
      : null;

  console.log('');
  console.log(`Profile: mission=${acc.missionId}, size=${acc.gameSize}, density=${acc.densityBucket} (avg ${acc.densityRatioAvg.toFixed(1)}%)`);
  console.log(`  Reports: ${acc.reports}, Runs: ${acc.runs}`);
  console.log('  Observed:');
  console.log(`    attack ratio (combat runs) p25=${formatPct(attackP25)}; runs-with-combat p25=${formatPct(combatP25)}; zero-attack p75=${formatPct(zeroAttackP75)}`);
  console.log(`    passive ratio p75=${formatPct(passiveP75)}; detect+hide p75=${formatPct(detectHideP75)}; wait p75=${formatPct(waitP75)}`);
  console.log(
    `    continuity data-rate mean=${formatPct(continuityDataMean)}; signature coverage p25=${formatPct(continuityCoverageP25)}`
  );
  console.log(
    `    continuity break-rate p75: combined=${formatPct(continuityCombinedBreakP75)} lane=${formatPct(continuityLaneBreakP75)} scrum=${formatPct(continuityScrumBreakP75)}`
  );
  console.log('  Suggested Env Thresholds:');
  console.log(`    AI_BATTLE_MIN_ATTACK_ACTION_RATIO=${formatFrac(suggestedAttackRatio)}`);
  console.log(`    AI_BATTLE_MIN_RUNS_WITH_COMBAT_RATE=${formatFrac(suggestedRunsWithCombatRate)}`);
  console.log(`    AI_BATTLE_MAX_ZERO_ATTACK_RUN_RATE=${formatFrac(suggestedZeroAttackRunRate)}`);
  console.log(`    AI_BATTLE_MAX_PASSIVE_ACTION_RATIO=${formatFrac(suggestedPassiveRatio)}`);
  console.log(`    AI_BATTLE_MAX_DETECT_HIDE_ACTION_RATIO=${formatFrac(suggestedDetectHideRatio)}`);
  console.log(`    AI_BATTLE_MAX_WAIT_ACTION_RATIO=${formatFrac(suggestedWaitRatio)}`);
  console.log(`    AI_BATTLE_CONTINUITY_MIN_DATA_RUN_RATE=${formatFrac(suggestedContinuityDataRate)}`);
  console.log(`    AI_BATTLE_CONTINUITY_MIN_SIGNATURE_COVERAGE=${formatFrac(suggestedContinuityCoverageRate)}`);
  console.log(`    AI_BATTLE_CONTINUITY_MAX_COMBINED_BREAK_RATE=${formatFrac(suggestedContinuityCombinedBreakRate)}`);
  console.log(`    AI_BATTLE_CONTINUITY_MAX_LANE_BREAK_RATE=${formatFrac(suggestedContinuityLaneBreakRate)}`);
  console.log(`    AI_BATTLE_CONTINUITY_MAX_SCRUM_BREAK_RATE=${formatFrac(suggestedContinuityScrumBreakRate)}`);
}

function main(): void {
  const rawArgs = process.argv.slice(2);
  const inputs: string[] = [];
  let minHorizonRatio = 0.85;
  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--min-horizon' && rawArgs[i + 1]) {
      const parsed = Number.parseFloat(rawArgs[i + 1]);
      if (Number.isFinite(parsed)) {
        minHorizonRatio = clampNumber(parsed, 0, 1);
      }
      i += 1;
      continue;
    }
    inputs.push(arg);
  }

  const roots = inputs.length > 0
    ? inputs.map(input => resolve(input))
    : [resolve(DEFAULT_INPUT_DIR)];
  const files: string[] = [];
  for (const root of roots) {
    walkJsonFiles(root, files);
  }

  const validationReports = files
    .filter(pathname => pathname.toLowerCase().includes('validation'))
    .map(pathname => ({ pathname, report: parseValidationReport(pathname) }))
    .filter((entry): entry is { pathname: string; report: ValidationAggregateReport } => Boolean(entry.report));

  if (validationReports.length === 0) {
    console.log('No validation aggregate reports found.');
    process.exitCode = 1;
    return;
  }

  const groups = new Map<string, ProfileAccumulator>();
  let skippedByHorizon = 0;
  for (const { report } of validationReports) {
    const horizonRatio = resolveReportHorizonRatio(report);
    if (isFiniteNumber(horizonRatio) && horizonRatio < minHorizonRatio) {
      skippedByHorizon += 1;
      continue;
    }

    const densityBucket = report.passivenessGates?.profile.densityBucket
      ?? report.performanceGates?.profile.densityBucket
      ?? resolveDensityBucketLabel(report.densityRatio);
    const key = `${report.missionId}|${report.gameSize}|${densityBucket}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        missionId: report.missionId,
        gameSize: String(report.gameSize),
        densityBucket,
        densityRatioAvg: 0,
        reports: 0,
        runs: 0,
        samples: [],
      };
      groups.set(key, acc);
    }
    acc.reports += 1;
    acc.densityRatioAvg += report.densityRatio;
    const runSamples = computeRunSamplesFromReport(report);
    acc.runs += runSamples.length;
    for (const sample of runSamples) {
      addSample(acc, sample);
    }
  }

  for (const acc of groups.values()) {
    acc.densityRatioAvg = acc.reports > 0 ? acc.densityRatioAvg / acc.reports : 0;
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const left = `${a.missionId}|${a.gameSize}|${a.densityBucket}`;
    const right = `${b.missionId}|${b.gameSize}|${b.densityBucket}`;
    return left.localeCompare(right);
  });

  const includedReports = sortedGroups.reduce((sum, group) => sum + group.reports, 0);
  console.log(
    `Calibration summary from ${includedReports}/${validationReports.length} validation report(s) (min horizon ${(minHorizonRatio * 100).toFixed(1)}%, skipped ${skippedByHorizon}).`
  );
  if (sortedGroups.length === 0) {
    console.log('No reports met the horizon filter. Lower --min-horizon or generate full-horizon validations.');
    process.exitCode = 1;
    return;
  }
  for (const acc of sortedGroups) {
    printProfileSummary(acc);
  }
}

main();

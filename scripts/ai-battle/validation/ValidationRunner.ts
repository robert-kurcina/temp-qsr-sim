/**
 * Validation Runner
 *
 * Runs validation batches and mechanic probes for AI battle testing.
 */

import { readFileSync } from 'node:fs';
import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine, deriveDoctrineAIPressure } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition, getVisibilityOrForLighting } from '../../../src/lib/mest-tactics/utils/visibility';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { buildAssembly, buildProfile } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { LOFOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOFOperations';
import type { GameConfig } from '../../shared/BattleReportTypes';
import { GAME_SIZE_CONFIG } from '../AIBattleConfig';
import { AIBattleRunner } from '../AIBattleRunner';
import type {
  ValidationAggregateReport,
  ValidationCoverage,
  BattleStats,
  AdvancedRuleMetrics,
  CombatEfficacySummary,
  ScoringSummary,
  SideScoreSummary,
  KeyScoreSummary,
} from './ValidationMetrics';
import {
  createEmptyStats,
  createEmptyAdvancedRuleMetrics,
  emptyCoverage,
  baseCoverageFromStats,
  mergeCoverage,
  accumulateStats,
  accumulateAdvancedRuleMetrics,
  divideStats,
  divideAdvancedRuleMetrics,
  safeRate,
} from './ValidationMetrics';
import { writeValidationReport } from './ValidationReporter';
import {
  buildValidationPerformanceGates,
  deriveAttackGateTelemetryGateThresholds,
  deriveCombatActivityGateThresholds,
  derivePressureContinuityGateThresholds,
  derivePassivenessGateThresholds,
} from '../cli/EnvConfig';
import { aiBattleTuning } from '../cli/EnvGateTuningConfig';
import { parseMissionIdArg } from '../cli/ArgParser';
import { resolveMissionName } from '../../shared/MissionCatalog';

const validationRunnerTuning = aiBattleTuning.validationRunner;

/**
 * Map tactical doctrine to AI config
 */
function doctrineToAIConfig(doctrine: TacticalDoctrine): { aggression: number; caution: number } {
  const pressure = deriveDoctrineAIPressure(doctrine, {
    hasMeleeWeapons: true,
    hasRangedWeapons: true,
  });
  return {
    aggression: pressure.aggression ?? 0.5,
    caution: pressure.caution ?? 0.5,
  };
}

function parseFractionalThreshold(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

function parseNonNegativeThreshold(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, parsed);
}

function toSafeNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

function buildCombatEfficacyFromStats(stats: Partial<BattleStats>): CombatEfficacySummary {
  const hitAttempts = toSafeNonNegativeNumber(stats.hitTestsAttempted);
  const hitPasses = toSafeNonNegativeNumber(stats.hitTestsPassed);
  const hitFails = toSafeNonNegativeNumber(
    stats.hitTestsFailed ?? Math.max(0, hitAttempts - hitPasses)
  );
  const damageAttempts = toSafeNonNegativeNumber(stats.damageTestsAttempted);
  const damagePasses = toSafeNonNegativeNumber(stats.damageTestsPassed);
  const damageFails = toSafeNonNegativeNumber(
    stats.damageTestsFailed ?? Math.max(0, damageAttempts - damagePasses)
  );
  return {
    hitTests: {
      attempts: hitAttempts,
      passes: hitPasses,
      fails: hitFails,
      passRate: safeRate(hitPasses, hitAttempts),
    },
    damageTests: {
      attempts: damageAttempts,
      passes: damagePasses,
      fails: damageFails,
      passRate: safeRate(damagePasses, damageAttempts),
    },
    assignments: {
      wounds: toSafeNonNegativeNumber(stats.woundsAssigned),
      fear: toSafeNonNegativeNumber(stats.fearAssigned),
      delay: toSafeNonNegativeNumber(stats.delayAssigned),
    },
  };
}

function computeRunCombatEfficacyMetrics(
  report: Awaited<ReturnType<AIBattleRunner['runBattle']>>
): CombatEfficacySummary {
  return buildCombatEfficacyFromStats(report.stats as Partial<BattleStats>);
}

function buildAggregateCombatEfficacy(
  totals: BattleStats
): CombatEfficacySummary {
  return buildCombatEfficacyFromStats(totals);
}

function buildScoringSummary(
  runReports: ValidationAggregateReport['runReports'],
  runs: number
): ScoringSummary {
  type MutableKeySummary = {
    runsObserved: number;
    runsScored: number;
    totalCurrent: number;
    totalPredicted: number;
    totalConfidence: number;
    totalLeadMargin: number;
  };
  type MutableSideSummary = {
    totalVp: number;
    totalRp: number;
    keys: Map<string, MutableKeySummary>;
  };
  const sideMap = new Map<string, MutableSideSummary>();
  const ensureSide = (sideId: string): MutableSideSummary => {
    const existing = sideMap.get(sideId);
    if (existing) {
      return existing;
    }
    const created: MutableSideSummary = {
      totalVp: 0,
      totalRp: 0,
      keys: new Map<string, MutableKeySummary>(),
    };
    sideMap.set(sideId, created);
    return created;
  };

  for (const run of runReports) {
    const missionRuntime = run.missionRuntime;
    const vpBySide = missionRuntime?.vpBySide ?? {};
    const rpBySide = missionRuntime?.rpBySide ?? {};
    for (const [sideId, vp] of Object.entries(vpBySide)) {
      const side = ensureSide(sideId);
      side.totalVp += toSafeNonNegativeNumber(vp);
    }
    for (const [sideId, rp] of Object.entries(rpBySide)) {
      const side = ensureSide(sideId);
      side.totalRp += toSafeNonNegativeNumber(rp);
    }

    const predictedBySide = missionRuntime?.predictedScoring?.bySide ?? {};
    for (const [sideId, sidePrediction] of Object.entries(predictedBySide)) {
      const side = ensureSide(sideId);
      const keyScores = sidePrediction?.keyScores ?? {};
      for (const [key, score] of Object.entries(keyScores)) {
        const existingKey = side.keys.get(key) ?? {
          runsObserved: 0,
          runsScored: 0,
          totalCurrent: 0,
          totalPredicted: 0,
          totalConfidence: 0,
          totalLeadMargin: 0,
        };
        const current = Number(score?.current ?? 0);
        const predicted = Number(score?.predicted ?? 0);
        const confidence = Number(score?.confidence ?? 0);
        const leadMargin = Number(score?.leadMargin ?? 0);
        existingKey.runsObserved += 1;
        existingKey.totalCurrent += Number.isFinite(current) ? current : 0;
        existingKey.totalPredicted += Number.isFinite(predicted) ? predicted : 0;
        existingKey.totalConfidence += Number.isFinite(confidence) ? confidence : 0;
        existingKey.totalLeadMargin += Number.isFinite(leadMargin) ? leadMargin : 0;
        if ((Number.isFinite(current) ? current : 0) > 0) {
          existingKey.runsScored += 1;
        }
        side.keys.set(key, existingKey);
      }
    }
  }

  const sideScores: SideScoreSummary[] = Array.from(sideMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sideId, side]): SideScoreSummary => {
      const keys: KeyScoreSummary[] = Array.from(side.keys.entries())
        .map(([key, summary]): KeyScoreSummary => {
          const divisor = Math.max(1, summary.runsObserved);
          return {
            key,
            runsObserved: summary.runsObserved,
            runsScored: summary.runsScored,
            totalCurrent: Number(summary.totalCurrent.toFixed(2)),
            averageCurrent: Number((summary.totalCurrent / divisor).toFixed(2)),
            totalPredicted: Number(summary.totalPredicted.toFixed(2)),
            averagePredicted: Number((summary.totalPredicted / divisor).toFixed(2)),
            averageConfidence: Number((summary.totalConfidence / divisor).toFixed(3)),
            averageLeadMargin: Number((summary.totalLeadMargin / divisor).toFixed(2)),
          };
        })
        .filter(summary => summary.runsScored > 0 || summary.totalPredicted > 0)
        .sort((left, right) => {
          if (right.totalCurrent !== left.totalCurrent) {
            return right.totalCurrent - left.totalCurrent;
          }
          return right.totalPredicted - left.totalPredicted;
        });

      return {
        sideId,
        totalVp: Number(side.totalVp.toFixed(2)),
        averageVp: Number((side.totalVp / Math.max(1, runs)).toFixed(2)),
        totalRp: Number(side.totalRp.toFixed(2)),
        averageRp: Number((side.totalRp / Math.max(1, runs)).toFixed(2)),
        keys,
      };
    });

  return { sideScores };
}

function formatRunScoringSummary(
  report: Awaited<ReturnType<AIBattleRunner['runBattle']>>
): string {
  const vpBySide = report.missionRuntime?.vpBySide ?? {};
  const rpBySide = report.missionRuntime?.rpBySide ?? {};
  const predictedBySide = report.missionRuntime?.predictedScoring?.bySide ?? {};
  const formatSideScoreMap = (values: Record<string, number>) => {
    const entries = Object.entries(values);
    if (entries.length === 0) return 'n/a';
    return entries
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sideId, value]) => `${sideId}=${Number(value ?? 0).toFixed(2)}`)
      .join(', ');
  };
  const keySummary = Object.entries(predictedBySide)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sideId, sidePrediction]) => {
      const scoredKeys = Object.entries(sidePrediction?.keyScores ?? {})
        .map(([key, score]) => ({ key, current: Number(score?.current ?? 0) }))
        .filter(entry => Number.isFinite(entry.current) && entry.current > 0)
        .sort((left, right) => right.current - left.current)
        .map(entry => `${entry.key}=${entry.current.toFixed(2)}`);
      return `${sideId}[${scoredKeys.length > 0 ? scoredKeys.join(', ') : 'none'}]`;
    })
    .join(' | ');
  return `vp(${formatSideScoreMap(vpBySide)}) rp(${formatSideScoreMap(rpBySide)}) keys(${keySummary || 'n/a'})`;
}

/**
 * Ensure equipment array is properly set on profile
 */
function ensureEquipment(profile: ReturnType<typeof buildProfile>) {
  if (!profile.equipment && profile.items) {
    profile.equipment = profile.items;
  }
  if (Array.isArray(profile.items)) {
    profile.items = profile.items.filter(Boolean);
  }
  if (Array.isArray(profile.equipment)) {
    profile.equipment = profile.equipment.filter(Boolean);
  }
}

/**
 * Run mechanic probes to test individual game mechanics
 */
export function runMechanicProbes(): Partial<ValidationCoverage> {
  try {
    const attackerProfile = buildProfile('Veteran', { itemNames: ['Bow, Long'] });
    const defenderProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    const reactorProfile = buildProfile('Veteran', { itemNames: ['Bow, Long'] });
    const activeProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    [attackerProfile, defenderProfile, reactorProfile, activeProfile].forEach(ensureEquipment);

    const assembly = buildAssembly('Probe Assembly', [
      attackerProfile,
      defenderProfile,
      reactorProfile,
      activeProfile,
    ]);
    const [attacker, defender, reactor, active] = assembly.characters;
    if (!attacker || !defender || !reactor || !active) {
      return {};
    }

    const battlefield = new Battlefield(12, 12);
    battlefield.placeCharacter(attacker, { x: 2, y: 2 });
    battlefield.placeCharacter(defender, { x: 8, y: 2 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    battlefield.placeCharacter(active, { x: 6, y: 6 });

    const manager = new GameManager([attacker, defender, reactor, active], battlefield);
    const coverage: Partial<ValidationCoverage> = {};

    manager.beginActivation(attacker);
    const moved = manager.executeMove(attacker, { x: 4, y: 2 });
    coverage.movement = moved.moved;
    coverage.pathfinding = moved.moved;
    manager.endActivation(attacker);

    manager.beginActivation(active);
    const waited = manager.executeWait(active, {
      spendAp: true,
      opponents: [attacker, defender, reactor],
      visibilityOrMu: 16,
      allowRevealReposition: false,
    });
    coverage.wait = waited.success;
    manager.endActivation(active);

    defender.state.isHidden = true;
    const detect = manager.attemptDetect(attacker, defender, [defender]);
    coverage.detect = detect.success;

    const attackerPos = battlefield.getCharacterPosition(attacker);
    const defenderPos = battlefield.getCharacterPosition(defender);
    if (attackerPos && defenderPos) {
      coverage.los = battlefield.hasLineOfSight(attackerPos, defenderPos);
      const alongLof = LOFOperations.getModelsAlongLOF(
        attackerPos,
        defenderPos,
        battlefield.getModelBlockers([attacker.id, defender.id]).map(model => ({
          id: model.id,
          position: model.position,
          baseDiameter: model.baseDiameter,
        })),
        { lofWidth: 1 }
      );
      coverage.lof = Array.isArray(alongLof);
    }

    const rangedWeaponPool = (attacker.profile.equipment || attacker.profile.items || []).filter(Boolean);
    const rangedWeapon = rangedWeaponPool.find(i =>
      i?.classification === 'Bow' ||
      i?.classification === 'Thrown' ||
      i?.classification === 'Range' ||
      i?.classification === 'Firearm'
    ) || rangedWeaponPool[0];
    if (rangedWeapon) {
      const ranged = manager.executeRangedAttack(attacker, defender, rangedWeapon, { orm: 4 });
      coverage.rangedCombat = Boolean(ranged.result);
    }

    battlefield.moveCharacter(active, { x: 3, y: 6 });
    reactor.state.isWaiting = true;
    const reactWeapon = (reactor.profile.equipment || reactor.profile.items || [])[0];
    if (reactWeapon) {
      const react = manager.executeStandardReact(reactor, active, reactWeapon);
      coverage.react = react.executed;
    }

    battlefield.moveCharacter(defender, { x: 5, y: 2 });
    const meleeWeapon = (defender.profile.equipment || defender.profile.items || [])[0];
    if (meleeWeapon) {
      const close = manager.executeCloseCombatAttack(attacker, defender, meleeWeapon, {
        isCharge: false,
      } as any);
      coverage.closeCombat = Boolean(close.result);
    }

    return coverage;
  } catch {
    return {};
  }
}

function computeCoordinatorTraceRunMetrics(report: Awaited<ReturnType<AIBattleRunner['runBattle']>>): {
  hasTrace: boolean;
  turnsWithTrace: number;
  totalTurns: number;
  turnCoverage: number | null;
  avgSideCoveragePerTurn: number | null;
} {
  const turns = report.audit?.turns ?? [];
  if (turns.length > 0) {
    const totalTurns = turns.length;
    let turnsWithTrace = 0;
    let sideCoverageAccum = 0;
    let sideCoverageSamples = 0;

    for (const turn of turns) {
      const expectedSides = Array.isArray(turn.sideSummaries) ? turn.sideSummaries.length : 0;
      const observedSides = Array.isArray(turn.coordinatorDecisions) ? turn.coordinatorDecisions.length : 0;
      if (observedSides > 0) {
        turnsWithTrace += 1;
      }
      if (expectedSides > 0) {
        sideCoverageAccum += Math.max(0, Math.min(1, observedSides / expectedSides));
        sideCoverageSamples += 1;
      }
    }

    return {
      hasTrace: turnsWithTrace > 0,
      turnsWithTrace,
      totalTurns,
      turnCoverage: turnsWithTrace / totalTurns,
      avgSideCoveragePerTurn: sideCoverageSamples > 0 ? sideCoverageAccum / sideCoverageSamples : null,
    };
  }

  // Validation runs often skip full audit payloads for performance; fall back to side-strategy traces.
  const sideStrategies = report.sideStrategies ?? {};
  const expectedSides = Object.keys(sideStrategies).length;
  const turnToSideTrace = new Map<number, Set<string>>();
  let maxTraceTurn = 0;

  for (const [sideId, strategy] of Object.entries(sideStrategies)) {
    const traceEntries = Array.isArray((strategy as any)?.decisionTrace)
      ? ((strategy as any).decisionTrace as Array<{ turn?: unknown }>)
      : [];
    for (const entry of traceEntries) {
      const turn = Number(entry?.turn);
      if (!Number.isFinite(turn) || turn <= 0) continue;
      const normalizedTurn = Math.floor(turn);
      maxTraceTurn = Math.max(maxTraceTurn, normalizedTurn);
      const sideSet = turnToSideTrace.get(normalizedTurn) ?? new Set<string>();
      sideSet.add(sideId);
      turnToSideTrace.set(normalizedTurn, sideSet);
    }
  }

  const statsTurnsCompleted = Number((report.stats as any)?.turnsCompleted ?? 0);
  const totalTurns = Math.max(maxTraceTurn, Number.isFinite(statsTurnsCompleted) ? statsTurnsCompleted : 0);
  if (totalTurns <= 0 || expectedSides <= 0) {
    return {
      hasTrace: false,
      turnsWithTrace: 0,
      totalTurns: 0,
      turnCoverage: null,
      avgSideCoveragePerTurn: null,
    };
  }

  let turnsWithTrace = 0;
  let sideCoverageAccum = 0;
  let sideCoverageSamples = 0;
  for (let turn = 1; turn <= totalTurns; turn++) {
    const observedSides = turnToSideTrace.get(turn)?.size ?? 0;
    if (observedSides > 0) {
      turnsWithTrace += 1;
    }
    sideCoverageAccum += Math.max(0, Math.min(1, observedSides / expectedSides));
    sideCoverageSamples += 1;
  }

  return {
    hasTrace: turnsWithTrace > 0,
    turnsWithTrace,
    totalTurns,
    turnCoverage: turnsWithTrace / totalTurns,
    avgSideCoveragePerTurn: sideCoverageSamples > 0 ? sideCoverageAccum / sideCoverageSamples : null,
  };
}

function computePressureContinuityRunMetrics(report: Awaited<ReturnType<AIBattleRunner['runBattle']>>): {
  hasData: boolean;
  sideCount: number;
  scrumBreakRate: number | null;
  laneBreakRate: number | null;
  combinedBreakRate: number | null;
  signatureCoverageRate: number | null;
  totalBreaks: number;
  totalSignatureSamples: number;
  totalUpdates: number;
} {
  const sideStrategies = report.sideStrategies ?? {};
  const diagnostics = Object.values(sideStrategies)
    .map((strategy: any) => strategy?.pressureContinuityDiagnostics)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (diagnostics.length === 0) {
    return {
      hasData: false,
      sideCount: 0,
      scrumBreakRate: null,
      laneBreakRate: null,
      combinedBreakRate: null,
      signatureCoverageRate: null,
      totalBreaks: 0,
      totalSignatureSamples: 0,
      totalUpdates: 0,
    };
  }

  let scrumBreaks = 0;
  let scrumSamples = 0;
  let scrumUpdates = 0;
  let laneBreaks = 0;
  let laneSamples = 0;
  let laneUpdates = 0;

  for (const entry of diagnostics) {
    scrumBreaks += Number(entry.scrum?.signatureBreaks ?? 0);
    scrumSamples += Number(entry.scrum?.signatureSamples ?? 0);
    scrumUpdates += Number(entry.scrum?.updates ?? 0);
    laneBreaks += Number(entry.lane?.signatureBreaks ?? 0);
    laneSamples += Number(entry.lane?.signatureSamples ?? 0);
    laneUpdates += Number(entry.lane?.updates ?? 0);
  }

  const totalBreaks = scrumBreaks + laneBreaks;
  const totalSignatureSamples = scrumSamples + laneSamples;
  const totalUpdates = scrumUpdates + laneUpdates;
  return {
    hasData: totalUpdates > 0,
    sideCount: diagnostics.length,
    scrumBreakRate: scrumSamples > 0 ? scrumBreaks / scrumSamples : null,
    laneBreakRate: laneSamples > 0 ? laneBreaks / laneSamples : null,
    combinedBreakRate: totalSignatureSamples > 0 ? totalBreaks / totalSignatureSamples : null,
    signatureCoverageRate: totalUpdates > 0 ? totalSignatureSamples / totalUpdates : null,
    totalBreaks,
    totalSignatureSamples,
    totalUpdates,
  };
}

function computeCombatActivityRunMetrics(report: Awaited<ReturnType<AIBattleRunner['runBattle']>>): {
  attackActions: number;
  totalActions: number;
  attackActionRatio: number | null;
  hasCombat: boolean;
} {
  const stats = report.stats as any;
  const closeCombats = Number(stats.closeCombats ?? 0);
  const rangedCombats = Number(stats.rangedCombats ?? 0);
  const attackActions = Math.max(0, closeCombats + rangedCombats);
  const totalActions = Math.max(0, Number(stats.totalActions ?? 0));
  return {
    attackActions,
    totalActions,
    attackActionRatio: totalActions > 0 ? attackActions / totalActions : null,
    hasCombat: attackActions > 0,
  };
}

function computePassivenessRunMetrics(report: Awaited<ReturnType<AIBattleRunner['runBattle']>>): {
  passiveActions: number;
  detectHideActions: number;
  waitActions: number;
  totalActions: number;
  passiveActionRatio: number | null;
  detectHideActionRatio: number | null;
  waitActionRatio: number | null;
} {
  const stats = report.stats as any;
  const detects = Math.max(0, Number(stats.detects ?? 0));
  const hides = Math.max(0, Number(stats.hides ?? 0));
  const waits = Math.max(0, Number(stats.waits ?? 0));
  const totalActions = Math.max(0, Number(stats.totalActions ?? 0));
  const detectHideActions = detects + hides;
  const passiveActions = detectHideActions + waits;
  return {
    passiveActions,
    detectHideActions,
    waitActions: waits,
    totalActions,
    passiveActionRatio: totalActions > 0 ? passiveActions / totalActions : null,
    detectHideActionRatio: totalActions > 0 ? detectHideActions / totalActions : null,
    waitActionRatio: totalActions > 0 ? waits / totalActions : null,
  };
}

function computeAttackGateTelemetryRunMetrics(report: Awaited<ReturnType<AIBattleRunner['runBattle']>>): {
  telemetrySamples: number;
  immediateHighOpportunities: number;
  immediateLowOpportunities: number;
  pressureOpportunities: number;
  gateApplied: number;
  gateImmediateHighApplied: number;
  gateDirectiveApplied: number;
  immediateHighConversionRate: number | null;
  pressureOpportunityGateApplyRate: number | null;
} {
  const stats = report.stats as any;
  const telemetrySamples = Math.max(0, Number(stats.decisionTelemetrySamples ?? 0));
  const immediateHighOpportunities = Math.max(0, Number(stats.attackOpportunityImmediateHigh ?? 0));
  const immediateLowOpportunities = Math.max(0, Number(stats.attackOpportunityImmediateLow ?? 0));
  const pressureOpportunities = immediateHighOpportunities + immediateLowOpportunities;
  const gateApplied = Math.max(0, Number(stats.attackGateAppliedDecisions ?? 0));
  const gateImmediateHighApplied = Math.max(0, Number(stats.attackGateImmediateHighApplied ?? 0));
  const gateDirectiveApplied = Math.max(0, Number(stats.attackGateDirectiveApplied ?? 0));
  return {
    telemetrySamples,
    immediateHighOpportunities,
    immediateLowOpportunities,
    pressureOpportunities,
    gateApplied,
    gateImmediateHighApplied,
    gateDirectiveApplied,
    immediateHighConversionRate: immediateHighOpportunities > 0
      ? gateImmediateHighApplied / immediateHighOpportunities
      : null,
    pressureOpportunityGateApplyRate: pressureOpportunities > 0
      ? gateApplied / pressureOpportunities
      : null,
  };
}

function buildCoordinatorTraceGates(
  runReports: ValidationAggregateReport['runReports'],
  runs: number
): ValidationAggregateReport['coordinatorTraceGates'] {
  const enabled = process.env.AI_BATTLE_COORDINATOR_TRACE_GATES !== '0';
  const minRunCoverage = parseFractionalThreshold(
    process.env.AI_BATTLE_COORD_TRACE_MIN_RUN_COVERAGE,
    validationRunnerTuning.coordinatorTraceGates.defaultMinRunCoverage
  );
  const minTurnCoverage = parseFractionalThreshold(
    process.env.AI_BATTLE_COORD_TRACE_MIN_TURN_COVERAGE,
    validationRunnerTuning.coordinatorTraceGates.defaultMinTurnCoverage
  );
  const minSideCoveragePerTurn = parseFractionalThreshold(
    process.env.AI_BATTLE_COORD_TRACE_MIN_SIDE_COVERAGE,
    validationRunnerTuning.coordinatorTraceGates.defaultMinSideCoveragePerTurn
  );

  const traceRuns = runReports
    .map(run => run.coordinatorTrace)
    .filter((trace): trace is NonNullable<typeof trace> => Boolean(trace));

  const runsEvaluated = traceRuns.length;
  const runCoverage = runsEvaluated > 0
    ? traceRuns.filter(trace => trace.hasTrace).length / runsEvaluated
    : null;
  const turnCoverageSamples = traceRuns
    .map(trace => trace.turnCoverage)
    .filter((value): value is number => Number.isFinite(value));
  const avgTurnCoverage = turnCoverageSamples.length > 0
    ? turnCoverageSamples.reduce((sum, value) => sum + value, 0) / turnCoverageSamples.length
    : null;
  const sideCoverageSamples = traceRuns
    .map(trace => trace.avgSideCoveragePerTurn)
    .filter((value): value is number => Number.isFinite(value));
  const avgSideCoveragePerTurn = sideCoverageSamples.length > 0
    ? sideCoverageSamples.reduce((sum, value) => sum + value, 0) / sideCoverageSamples.length
    : null;

  const runCoveragePass = runCoverage === null ? null : runCoverage >= minRunCoverage;
  const turnCoveragePass = avgTurnCoverage === null ? null : avgTurnCoverage >= minTurnCoverage;
  const sideCoveragePass = avgSideCoveragePerTurn === null ? null : avgSideCoveragePerTurn >= minSideCoveragePerTurn;
  const overall = [runCoveragePass, turnCoveragePass, sideCoveragePass].every(pass => pass === true)
    ? true
    : [runCoveragePass, turnCoveragePass, sideCoveragePass].some(pass => pass === false)
      ? false
      : null;

  return {
    enabled,
    runsEvaluated,
    thresholds: {
      minRunCoverage,
      minTurnCoverage,
      minSideCoveragePerTurn,
    },
    observed: {
      runCoverage,
      avgTurnCoverage,
      avgSideCoveragePerTurn,
    },
    pass: {
      runCoverage: runCoveragePass,
      turnCoverage: turnCoveragePass,
      sideCoveragePerTurn: sideCoveragePass,
      overall,
    },
  };
}

function buildCombatActivityGates(
  runReports: ValidationAggregateReport['runReports'],
  runs: number,
  context: {
    missionId: string;
    gameSize: GameSize;
    densityRatio: number;
    maxTurns: number;
    configuredMaxTurns: number;
  }
): ValidationAggregateReport['combatActivityGates'] {
  const { missionId, gameSize, densityRatio, maxTurns, configuredMaxTurns } = context;
  const enabled = process.env.AI_BATTLE_COMBAT_ACTIVITY_GATES !== '0';
  const derived = deriveCombatActivityGateThresholds({ missionId, gameSize, densityRatio });
  const minTurnHorizonRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_COMBAT_ACTIVITY_MIN_TURN_RATIO,
    validationRunnerTuning.combatActivityGates.defaultMinTurnHorizonRatio
  );
  const minAttackActionRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_MIN_ATTACK_ACTION_RATIO,
    derived.thresholds.minAttackActionRatio
  );
  const minRunsWithCombatRate = parseFractionalThreshold(
    process.env.AI_BATTLE_MIN_RUNS_WITH_COMBAT_RATE,
    derived.thresholds.minRunsWithCombatRate
  );
  const maxZeroAttackRunRate = parseFractionalThreshold(
    process.env.AI_BATTLE_MAX_ZERO_ATTACK_RUN_RATE,
    derived.thresholds.maxZeroAttackRunRate
  );
  const horizonRatioRaw = configuredMaxTurns > 0 ? maxTurns / configuredMaxTurns : 1;
  const horizonRatio = Math.max(0, Math.min(1, horizonRatioRaw));
  const meetsHorizon = horizonRatio >= minTurnHorizonRatio;

  const combatRuns = runReports
    .map(run => run.combatActivity)
    .filter((combat): combat is NonNullable<typeof combat> => Boolean(combat));
  const runsEvaluated = combatRuns.length;
  const ratioSamples = combatRuns
    .filter(run => run.hasCombat)
    .map(run => run.attackActionRatio)
    .filter((ratio): ratio is number => Number.isFinite(ratio));
  const avgAttackActionRatio = ratioSamples.length > 0
    ? ratioSamples.reduce((sum, ratio) => sum + ratio, 0) / ratioSamples.length
    : null;
  const runsWithCombatRate = runsEvaluated > 0
    ? combatRuns.filter(run => run.hasCombat).length / runsEvaluated
    : null;
  const zeroAttackRunRate = runsWithCombatRate === null ? null : 1 - runsWithCombatRate;

  const attackRatioPass = !meetsHorizon
    ? null
    : avgAttackActionRatio === null
      ? null
      : avgAttackActionRatio >= minAttackActionRatio;
  const runsWithCombatPass = !meetsHorizon
    ? null
    : runsWithCombatRate === null
      ? null
      : runsWithCombatRate >= minRunsWithCombatRate;
  const zeroAttackPass = !meetsHorizon
    ? null
    : zeroAttackRunRate === null
      ? null
      : zeroAttackRunRate <= maxZeroAttackRunRate;
  const overall = [attackRatioPass, runsWithCombatPass, zeroAttackPass].every(pass => pass === true)
    ? true
    : [attackRatioPass, runsWithCombatPass, zeroAttackPass].some(pass => pass === false)
      ? false
      : null;
  const skippedReason = !meetsHorizon
    ? `insufficient turn horizon (${maxTurns}/${configuredMaxTurns} turns; min ${(minTurnHorizonRatio * 100).toFixed(1)}%)`
    : undefined;

  return {
    enabled,
    runsEvaluated,
    profile: {
      missionId,
      gameSize,
      densityRatio,
      densityBucket: derived.densityBucket,
      densityBucketIndex: derived.densityBucketIndex,
      maxTurns,
      configuredMaxTurns,
      horizonRatio,
    },
    thresholds: {
      minTurnHorizonRatio,
      minAttackActionRatio,
      minRunsWithCombatRate,
      maxZeroAttackRunRate,
    },
    observed: {
      avgAttackActionRatio,
      runsWithCombatRate,
      zeroAttackRunRate,
    },
    skippedReason,
    pass: {
      attackActionRatio: attackRatioPass,
      runsWithCombatRate: runsWithCombatPass,
      zeroAttackRunRate: zeroAttackPass,
      overall,
    },
  };
}

function buildPassivenessGates(
  runReports: ValidationAggregateReport['runReports'],
  runs: number,
  context: {
    missionId: string;
    gameSize: GameSize;
    densityRatio: number;
    maxTurns: number;
    configuredMaxTurns: number;
  }
): ValidationAggregateReport['passivenessGates'] {
  const { missionId, gameSize, densityRatio, maxTurns, configuredMaxTurns } = context;
  const enabled = process.env.AI_BATTLE_PASSIVENESS_GATES !== '0';
  const derived = derivePassivenessGateThresholds({ missionId, gameSize, densityRatio });
  const minTurnHorizonRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_PASSIVE_MIN_TURN_RATIO,
    validationRunnerTuning.passivenessGates.defaultMinTurnHorizonRatio
  );
  const maxPassiveActionRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_MAX_PASSIVE_ACTION_RATIO,
    derived.thresholds.maxPassiveActionRatio
  );
  const maxDetectHideActionRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_MAX_DETECT_HIDE_ACTION_RATIO,
    derived.thresholds.maxDetectHideActionRatio
  );
  const maxWaitActionRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_MAX_WAIT_ACTION_RATIO,
    derived.thresholds.maxWaitActionRatio
  );

  const horizonRatioRaw = configuredMaxTurns > 0 ? maxTurns / configuredMaxTurns : 1;
  const horizonRatio = Math.max(0, Math.min(1, horizonRatioRaw));
  const meetsHorizon = horizonRatio >= minTurnHorizonRatio;

  const passiveRuns = runReports
    .map(run => run.passiveness)
    .filter((passive): passive is NonNullable<typeof passive> => Boolean(passive));
  const runsEvaluated = passiveRuns.length;

  const passiveRatioSamples = passiveRuns
    .map(run => run.passiveActionRatio)
    .filter((value): value is number => Number.isFinite(value));
  const detectHideRatioSamples = passiveRuns
    .map(run => run.detectHideActionRatio)
    .filter((value): value is number => Number.isFinite(value));
  const waitRatioSamples = passiveRuns
    .map(run => run.waitActionRatio)
    .filter((value): value is number => Number.isFinite(value));

  const avgPassiveActionRatio = passiveRatioSamples.length > 0
    ? passiveRatioSamples.reduce((sum, value) => sum + value, 0) / passiveRatioSamples.length
    : null;
  const avgDetectHideActionRatio = detectHideRatioSamples.length > 0
    ? detectHideRatioSamples.reduce((sum, value) => sum + value, 0) / detectHideRatioSamples.length
    : null;
  const avgWaitActionRatio = waitRatioSamples.length > 0
    ? waitRatioSamples.reduce((sum, value) => sum + value, 0) / waitRatioSamples.length
    : null;

  const passiveRatioPass = !meetsHorizon
    ? null
    : avgPassiveActionRatio === null
      ? null
      : avgPassiveActionRatio <= maxPassiveActionRatio;
  const detectHideRatioPass = !meetsHorizon
    ? null
    : avgDetectHideActionRatio === null
      ? null
      : avgDetectHideActionRatio <= maxDetectHideActionRatio;
  const waitRatioPass = !meetsHorizon
    ? null
    : avgWaitActionRatio === null
      ? null
      : avgWaitActionRatio <= maxWaitActionRatio;
  const overall = [passiveRatioPass, detectHideRatioPass, waitRatioPass].every(pass => pass === true)
    ? true
    : [passiveRatioPass, detectHideRatioPass, waitRatioPass].some(pass => pass === false)
      ? false
      : null;

  const skippedReason = !meetsHorizon
    ? `insufficient turn horizon (${maxTurns}/${configuredMaxTurns} turns; min ${(minTurnHorizonRatio * 100).toFixed(1)}%)`
    : undefined;

  return {
    enabled,
    runsEvaluated,
    profile: {
      missionId,
      gameSize,
      densityRatio,
      densityBucket: derived.densityBucket,
      densityBucketIndex: derived.densityBucketIndex,
      maxTurns,
      configuredMaxTurns,
      horizonRatio,
    },
    thresholds: {
      minTurnHorizonRatio,
      maxPassiveActionRatio,
      maxDetectHideActionRatio,
      maxWaitActionRatio,
    },
    observed: {
      avgPassiveActionRatio,
      avgDetectHideActionRatio,
      avgWaitActionRatio,
    },
    skippedReason,
    pass: {
      passiveActionRatio: passiveRatioPass,
      detectHideActionRatio: detectHideRatioPass,
      waitActionRatio: waitRatioPass,
      overall,
    },
  };
}

function buildAttackGateTelemetryGates(
  runReports: ValidationAggregateReport['runReports'],
  runs: number,
  context: {
    missionId: string;
    gameSize: GameSize;
    densityRatio: number;
    maxTurns: number;
    configuredMaxTurns: number;
  }
): ValidationAggregateReport['attackGateTelemetryGates'] {
  const { missionId, gameSize, densityRatio, maxTurns, configuredMaxTurns } = context;
  const enabled = process.env.AI_BATTLE_ATTACK_GATE_TELEMETRY_GATES !== '0';
  const derived = deriveAttackGateTelemetryGateThresholds({ missionId, gameSize, densityRatio });
  const minTurnHorizonRatio = parseFractionalThreshold(
    process.env.AI_BATTLE_ATTACK_GATE_MIN_TURN_RATIO,
    validationRunnerTuning.attackGateTelemetryGates.defaultMinTurnHorizonRatio
  );
  const minTelemetrySamplesPerRun = parseNonNegativeThreshold(
    process.env.AI_BATTLE_ATTACK_GATE_MIN_SAMPLES_PER_RUN,
    derived.thresholds.minTelemetrySamplesPerRun
  );
  const minImmediateHighOpportunityCount = Math.max(
    validationRunnerTuning.attackGateTelemetryGates.minImmediateHighOpportunityCountFloor,
    Math.round(parseNonNegativeThreshold(
      process.env.AI_BATTLE_ATTACK_GATE_MIN_IMMEDIATE_HIGH_COUNT,
      derived.thresholds.minImmediateHighOpportunityCount
    ))
  );
  const minImmediateHighConversionRate = parseFractionalThreshold(
    process.env.AI_BATTLE_ATTACK_GATE_MIN_IMMEDIATE_HIGH_CONVERSION,
    derived.thresholds.minImmediateHighConversionRate
  );
  const minPressureOpportunityGateApplyRate = parseFractionalThreshold(
    process.env.AI_BATTLE_ATTACK_GATE_MIN_PRESSURE_APPLY_RATE,
    derived.thresholds.minPressureOpportunityGateApplyRate
  );

  const horizonRatioRaw = configuredMaxTurns > 0 ? maxTurns / configuredMaxTurns : 1;
  const horizonRatio = Math.max(0, Math.min(1, horizonRatioRaw));
  const meetsHorizon = horizonRatio >= minTurnHorizonRatio;

  const telemetryRuns = runReports
    .map(run => run.attackGateTelemetry)
    .filter((telemetry): telemetry is NonNullable<typeof telemetry> => Boolean(telemetry));
  const runsEvaluated = telemetryRuns.length;
  const totalTelemetrySamples = telemetryRuns.reduce((sum, run) => sum + Math.max(0, Number(run.telemetrySamples ?? 0)), 0);
  const avgTelemetrySamplesPerRun = runsEvaluated > 0 ? totalTelemetrySamples / runsEvaluated : null;
  const totalImmediateHighOpportunities = telemetryRuns.reduce(
    (sum, run) => sum + Math.max(0, Number(run.immediateHighOpportunities ?? 0)),
    0
  );
  const totalImmediateLowOpportunities = telemetryRuns.reduce(
    (sum, run) => sum + Math.max(0, Number(run.immediateLowOpportunities ?? 0)),
    0
  );
  const totalPressureOpportunities = totalImmediateHighOpportunities + totalImmediateLowOpportunities;
  const totalGateImmediateHighApplied = telemetryRuns.reduce(
    (sum, run) => sum + Math.max(0, Number(run.gateImmediateHighApplied ?? 0)),
    0
  );
  const totalGateDirectiveApplied = telemetryRuns.reduce(
    (sum, run) => sum + Math.max(0, Number(run.gateDirectiveApplied ?? 0)),
    0
  );
  const totalGateApplied = telemetryRuns.reduce(
    (sum, run) => sum + Math.max(0, Number(run.gateApplied ?? 0)),
    0
  );
  const immediateHighConversionRate = totalImmediateHighOpportunities > 0
    ? totalGateImmediateHighApplied / totalImmediateHighOpportunities
    : null;
  const pressureOpportunityGateApplyRate = totalPressureOpportunities > 0
    ? totalGateApplied / totalPressureOpportunities
    : null;

  const telemetrySamplesPass = !meetsHorizon
    ? null
    : avgTelemetrySamplesPerRun === null
      ? null
      : avgTelemetrySamplesPerRun >= minTelemetrySamplesPerRun;
  const immediateHighConversionPass = !meetsHorizon
    ? null
    : totalImmediateHighOpportunities < minImmediateHighOpportunityCount
      ? null
      : immediateHighConversionRate === null
        ? null
        : immediateHighConversionRate >= minImmediateHighConversionRate;
  const pressureOpportunityPass = !meetsHorizon
    ? null
    : totalPressureOpportunities === 0
      ? null
      : pressureOpportunityGateApplyRate === null
        ? null
        : pressureOpportunityGateApplyRate >= minPressureOpportunityGateApplyRate;

  const overall = [telemetrySamplesPass, immediateHighConversionPass, pressureOpportunityPass].every(pass => pass === true)
    ? true
    : [telemetrySamplesPass, immediateHighConversionPass, pressureOpportunityPass].some(pass => pass === false)
      ? false
      : null;
  const skippedReason = !meetsHorizon
    ? `insufficient turn horizon (${maxTurns}/${configuredMaxTurns} turns; min ${(minTurnHorizonRatio * 100).toFixed(1)}%)`
    : [telemetrySamplesPass, immediateHighConversionPass, pressureOpportunityPass].every(pass => pass === null)
      ? 'no telemetry/opportunity samples'
      : undefined;

  return {
    enabled,
    runsEvaluated: Math.min(runsEvaluated, runs),
    profile: {
      missionId,
      gameSize,
      densityRatio,
      densityBucket: derived.densityBucket,
      densityBucketIndex: derived.densityBucketIndex,
      maxTurns,
      configuredMaxTurns,
      horizonRatio,
    },
    thresholds: {
      minTurnHorizonRatio,
      minTelemetrySamplesPerRun,
      minImmediateHighOpportunityCount,
      minImmediateHighConversionRate,
      minPressureOpportunityGateApplyRate,
    },
    observed: {
      avgTelemetrySamplesPerRun,
      totalTelemetrySamples,
      totalImmediateHighOpportunities,
      totalImmediateLowOpportunities,
      totalPressureOpportunities,
      totalGateImmediateHighApplied,
      totalGateDirectiveApplied,
      totalGateApplied,
      immediateHighConversionRate,
      pressureOpportunityGateApplyRate,
    },
    skippedReason,
    pass: {
      telemetrySamples: telemetrySamplesPass,
      immediateHighConversion: immediateHighConversionPass,
      pressureOpportunityApplyRate: pressureOpportunityPass,
      overall,
    },
  };
}

function buildPressureContinuityDiagnostics(
  runReports: ValidationAggregateReport['runReports']
): ValidationAggregateReport['pressureContinuityDiagnostics'] {
  const continuityRuns = runReports
    .map(run => run.pressureContinuity)
    .filter((continuity): continuity is NonNullable<typeof continuity> => Boolean(continuity));
  const runsEvaluated = continuityRuns.length;
  const runsWithData = continuityRuns.filter(run => run.hasData).length;
  const scrumBreakSamples = continuityRuns
    .map(run => run.scrumBreakRate)
    .filter((value): value is number => Number.isFinite(value));
  const laneBreakSamples = continuityRuns
    .map(run => run.laneBreakRate)
    .filter((value): value is number => Number.isFinite(value));
  const combinedBreakSamples = continuityRuns
    .map(run => run.combinedBreakRate)
    .filter((value): value is number => Number.isFinite(value));
  const coverageSamples = continuityRuns
    .map(run => run.signatureCoverageRate)
    .filter((value): value is number => Number.isFinite(value));
  const breakTotals = continuityRuns.map(run => Number(run.totalBreaks ?? 0));
  const signatureSampleTotals = continuityRuns.map(run => Number(run.totalSignatureSamples ?? 0));

  const average = (values: number[]): number | null =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  return {
    runsEvaluated,
    runsWithData,
    observed: {
      avgScrumBreakRate: average(scrumBreakSamples),
      avgLaneBreakRate: average(laneBreakSamples),
      avgCombinedBreakRate: average(combinedBreakSamples),
      avgSignatureCoverageRate: average(coverageSamples),
      avgBreaksPerRun: average(breakTotals),
      avgSignatureSamplesPerRun: average(signatureSampleTotals),
    },
  };
}

function buildPressureContinuityGates(
  runReports: ValidationAggregateReport['runReports'],
  runs: number,
  context: {
    missionId: string;
    gameSize: GameSize;
    densityRatio: number;
  }
): ValidationAggregateReport['pressureContinuityGates'] {
  const { missionId, gameSize, densityRatio } = context;
  const enabled = process.env.AI_BATTLE_PRESSURE_CONTINUITY_GATES !== '0';
  const derived = derivePressureContinuityGateThresholds({ missionId, gameSize, densityRatio });
  const minRunsWithDataRate = parseFractionalThreshold(
    process.env.AI_BATTLE_CONTINUITY_MIN_DATA_RUN_RATE,
    derived.thresholds.minRunsWithDataRate
  );
  const minSignatureCoverageRate = parseFractionalThreshold(
    process.env.AI_BATTLE_CONTINUITY_MIN_SIGNATURE_COVERAGE,
    derived.thresholds.minSignatureCoverageRate
  );
  const maxCombinedBreakRate = parseFractionalThreshold(
    process.env.AI_BATTLE_CONTINUITY_MAX_COMBINED_BREAK_RATE,
    derived.thresholds.maxCombinedBreakRate
  );
  const maxLaneBreakRate = parseFractionalThreshold(
    process.env.AI_BATTLE_CONTINUITY_MAX_LANE_BREAK_RATE,
    derived.thresholds.maxLaneBreakRate
  );
  const maxScrumBreakRate = parseFractionalThreshold(
    process.env.AI_BATTLE_CONTINUITY_MAX_SCRUM_BREAK_RATE,
    derived.thresholds.maxScrumBreakRate
  );

  const continuityRuns = runReports
    .map(run => run.pressureContinuity)
    .filter((continuity): continuity is NonNullable<typeof continuity> => Boolean(continuity));
  const runsEvaluated = continuityRuns.length;
  const runsWithDataRate = runsEvaluated > 0
    ? continuityRuns.filter(run => run.hasData).length / runsEvaluated
    : null;
  const average = (values: Array<number | null | undefined>): number | null => {
    const filtered = values.filter((value): value is number => Number.isFinite(value));
    return filtered.length > 0 ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : null;
  };
  const avgSignatureCoverageRate = average(continuityRuns.map(run => run.signatureCoverageRate));
  const avgCombinedBreakRate = average(continuityRuns.map(run => run.combinedBreakRate));
  const avgLaneBreakRate = average(continuityRuns.map(run => run.laneBreakRate));
  const avgScrumBreakRate = average(continuityRuns.map(run => run.scrumBreakRate));
  const hasContinuitySamples =
    avgSignatureCoverageRate !== null ||
    avgCombinedBreakRate !== null ||
    avgLaneBreakRate !== null ||
    avgScrumBreakRate !== null;

  const runsWithDataRatePass = !hasContinuitySamples || runsWithDataRate === null
    ? null
    : runsWithDataRate >= minRunsWithDataRate;
  const signatureCoverageRatePass = avgSignatureCoverageRate === null ? null : avgSignatureCoverageRate >= minSignatureCoverageRate;
  const combinedBreakRatePass = avgCombinedBreakRate === null ? null : avgCombinedBreakRate <= maxCombinedBreakRate;
  const laneBreakRatePass = avgLaneBreakRate === null ? null : avgLaneBreakRate <= maxLaneBreakRate;
  const scrumBreakRatePass = avgScrumBreakRate === null ? null : avgScrumBreakRate <= maxScrumBreakRate;
  const overall = [
    runsWithDataRatePass,
    signatureCoverageRatePass,
    combinedBreakRatePass,
    laneBreakRatePass,
    scrumBreakRatePass,
  ].every(pass => pass === true)
    ? true
    : [
      runsWithDataRatePass,
      signatureCoverageRatePass,
      combinedBreakRatePass,
      laneBreakRatePass,
      scrumBreakRatePass,
    ].some(pass => pass === false)
      ? false
      : null;

  return {
    enabled,
    runsEvaluated: Math.min(runsEvaluated, runs),
    profile: {
      missionId,
      gameSize,
      densityRatio,
      densityBucket: derived.densityBucket,
      densityBucketIndex: derived.densityBucketIndex,
    },
    thresholds: {
      minRunsWithDataRate,
      minSignatureCoverageRate,
      maxCombinedBreakRate,
      maxLaneBreakRate,
      maxScrumBreakRate,
    },
    observed: {
      runsWithDataRate,
      avgSignatureCoverageRate,
      avgCombinedBreakRate,
      avgLaneBreakRate,
      avgScrumBreakRate,
    },
    pass: {
      runsWithDataRate: runsWithDataRatePass,
      signatureCoverageRate: signatureCoverageRatePass,
      combinedBreakRate: combinedBreakRatePass,
      laneBreakRate: laneBreakRatePass,
      scrumBreakRate: scrumBreakRatePass,
      overall,
    },
  };
}

/**
 * Run validation batch - executes multiple battle runs and aggregates results
 */
export async function runValidationBatch(
  gameSize: GameSize = GameSize.VERY_LARGE,
  densityRatio: number = 50,
  runs: number = 3,
  baseSeed: number = 424242,
  lighting: LightingCondition = 'Day, Clear',
  sideDoctrines: [TacticalDoctrine, TacticalDoctrine] = [TacticalDoctrine.Operative, TacticalDoctrine.Operative],
  loadoutProfile: 'default' | 'melee_only' = 'default',
  missionId: string = 'QAI_11',
  initiativeCardTieBreakerOnTie?: boolean,
  initiativeCardHolderSideId?: string
) {
  if (runs < 1) {
    throw new Error('Validation runs must be >= 1.');
  }

  const winners: Record<string, number> = {};
  const totals = createEmptyStats();
  const advancedRuleTotals = createEmptyAdvancedRuleMetrics();
  const runReports: ValidationAggregateReport['runReports'] = [];
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const doctrineAlpha = sideDoctrines[0];
  const doctrineBravo = sideDoctrines[1];
  const doctrineConfigAlpha = doctrineToAIConfig(doctrineAlpha);
  const doctrineConfigBravo = doctrineToAIConfig(doctrineBravo);
  const doctrineLabel = doctrineAlpha === doctrineBravo ? doctrineAlpha : `${doctrineAlpha} vs ${doctrineBravo}`;
  const resolvedMissionId = parseMissionIdArg(missionId, 'QAI_11');
  const missionName = resolveMissionName(resolvedMissionId);
  const configuredMaxTurns = GAME_SIZE_CONFIG[gameSize].maxTurns;
  const maxTurnsOverride = Number.parseInt(process.env.AI_BATTLE_MAX_TURNS ?? '', 10);
  const maxTurns = Number.isFinite(maxTurnsOverride) && maxTurnsOverride > 0
    ? Math.min(configuredMaxTurns, maxTurnsOverride)
    : configuredMaxTurns;
  const baseConfig: GameConfig = {
    missionId: resolvedMissionId,
    missionName,
    gameSize,
    battlefieldWidth: GAME_SIZE_CONFIG[gameSize].battlefieldWidth,
    battlefieldHeight: GAME_SIZE_CONFIG[gameSize].battlefieldHeight,
    maxTurns,
    endGameTurn: Math.min(GAME_SIZE_CONFIG[gameSize].endGameTurn, maxTurns),
    sides: [
      {
        name: 'Alpha',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: doctrineAlpha,
        loadoutProfile,
        assemblyName: 'Alpha Assembly',
        aggression: doctrineConfigAlpha.aggression ?? 0.5,
        caution: doctrineConfigAlpha.caution ?? 0.5,
      },
      {
        name: 'Bravo',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: doctrineBravo,
        loadoutProfile,
        assemblyName: 'Bravo Assembly',
        aggression: doctrineConfigBravo.aggression ?? 0.5,
        caution: doctrineConfigBravo.caution ?? 0.5,
      },
    ],
    densityRatio,
    lighting,
    visibilityOrMu,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    allowWaitAction: false,
    allowHideAction: false,
    initiativeCardTieBreakerOnTie,
    initiativeCardHolderSideId,
    verbose: false,
  };
  const validationForceProfiling = process.env.AI_BATTLE_VALIDATION_PROFILE !== '0';

  console.log(`\nRunning ${runs} validation battle(s) for ${missionName} (${resolvedMissionId}, ${gameSize})...`);
  if (maxTurns !== configuredMaxTurns) {
    console.log(`  Max turns override: ${maxTurns}/${configuredMaxTurns}`);
  }
  console.log(`  Doctrine: ${doctrineLabel}`);
  console.log(`    Alpha: ${doctrineAlpha}`);
  console.log(`    Bravo: ${doctrineBravo}`);
  console.log(`  Loadout Profile: ${loadoutProfile}`);
  if (initiativeCardTieBreakerOnTie !== undefined) {
    const holderLabel = initiativeCardHolderSideId ? ` (holder=${initiativeCardHolderSideId})` : '';
    console.log(`  Initiative Card Tie-Breaker: ${initiativeCardTieBreakerOnTie ? 'enabled' : 'disabled'}${holderLabel}`);
  }
  console.log(`  Profiling: ${validationForceProfiling ? 'enabled' : 'disabled (AI_BATTLE_VALIDATION_PROFILE=0)'}`);
  for (let i = 0; i < runs; i++) {
    const seed = baseSeed + i;
    const runner = new AIBattleRunner();
    const report = await runner.runBattle(baseConfig, {
      seed,
      suppressOutput: true,
      forceProfiling: validationForceProfiling,
    });
    const runCombatEfficacy = computeRunCombatEfficacyMetrics(report);
    const runScoringSummary = formatRunScoringSummary(report);
    winners[report.winner] = (winners[report.winner] ?? 0) + 1;
    accumulateStats(totals, report.stats);
    accumulateAdvancedRuleMetrics(advancedRuleTotals, report.advancedRules);
    runReports.push({
      run: i + 1,
      seed,
      winner: report.winner,
      winnerReason: report.winnerReason,
      tieBreakMethod: report.tieBreakMethod,
      finalCounts: report.finalCounts,
      stats: report.stats,
      usage: {
        modelCount: report.usage?.modelCount ?? 0,
        modelsMoved: report.usage?.modelsMoved ?? 0,
        modelsUsedWait: report.usage?.modelsUsedWait ?? 0,
        modelsUsedDetect: report.usage?.modelsUsedDetect ?? 0,
        modelsUsedHide: report.usage?.modelsUsedHide ?? 0,
        modelsUsedReact: report.usage?.modelsUsedReact ?? 0,
        totalPathLength: report.usage?.totalPathLength ?? 0,
        averagePathLengthPerMovedModel: report.usage?.averagePathLengthPerMovedModel ?? 0,
        averagePathLengthPerModel: report.usage?.averagePathLengthPerModel ?? 0,
        topPathModels: (report.usage?.topPathModels ?? []).map((m: any) => ({
          modelId: m.modelId,
          modelName: m.modelName ?? '',
          side: m.side ?? '',
          pathLength: m.pathLength,
          moveActions: m.moveActions ?? 0,
        })),
      },
      missionRuntime: report.missionRuntime,
      nestedSections: report.nestedSections,
      advancedRules: report.advancedRules,
      performance: report.performance,
      coordinatorTrace: computeCoordinatorTraceRunMetrics(report),
      pressureContinuity: computePressureContinuityRunMetrics(report),
      combatActivity: computeCombatActivityRunMetrics(report),
      passiveness: computePassivenessRunMetrics(report),
      attackGateTelemetry: computeAttackGateTelemetryRunMetrics(report),
      combatEfficacy: runCombatEfficacy,
    });
    const elapsedLabel = report.performance ? `, elapsedMs=${report.performance.elapsedMs.toFixed(2)}` : '';
    console.log(
      `  Run ${i + 1}/${runs}: winner=${report.winner}, moves=${report.stats.moves}, ranged=${report.stats.rangedCombats}, close=${report.stats.closeCombats}, path=${(report.usage?.totalPathLength ?? 0).toFixed(2)}, hit=${(runCombatEfficacy.hitTests.passRate * 100).toFixed(1)}% (${runCombatEfficacy.hitTests.passes}/${runCombatEfficacy.hitTests.attempts}), damage=${(runCombatEfficacy.damageTests.passRate * 100).toFixed(1)}% (${runCombatEfficacy.damageTests.passes}/${runCombatEfficacy.damageTests.attempts}), assigned(w/f/d)=${runCombatEfficacy.assignments.wounds}/${runCombatEfficacy.assignments.fear}/${runCombatEfficacy.assignments.delay}, ${runScoringSummary}${elapsedLabel}`
    );
  }

  const runtimeCoverage = baseCoverageFromStats(totals);
  const probeCoverage = mergeCoverage(emptyCoverage(), runMechanicProbes());
  const coverage = mergeCoverage(runtimeCoverage, probeCoverage);
  const performanceGates = buildValidationPerformanceGates(runReports, runs, {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
  });
  const coordinatorTraceGates = buildCoordinatorTraceGates(runReports, runs);
  const pressureContinuityDiagnostics = buildPressureContinuityDiagnostics(runReports);
  const pressureContinuityGates = buildPressureContinuityGates(runReports, runs, {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
  });
  const combatActivityGates = buildCombatActivityGates(runReports, runs, {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
    maxTurns,
    configuredMaxTurns,
  });
  const passivenessGates = buildPassivenessGates(runReports, runs, {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
    maxTurns,
    configuredMaxTurns,
  });
  const attackGateTelemetryGates = buildAttackGateTelemetryGates(runReports, runs, {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
    maxTurns,
    configuredMaxTurns,
  });
  const scoringSummary = buildScoringSummary(runReports, runs);
  const combatEfficacy = buildAggregateCombatEfficacy(totals);

  const aggregateReport: ValidationAggregateReport = {
    missionId: resolvedMissionId,
    gameSize,
    densityRatio,
    tacticalDoctrine: doctrineLabel,
    sideDoctrines: [
      { sideName: 'Alpha', tacticalDoctrine: doctrineAlpha, loadoutProfile },
      { sideName: 'Bravo', tacticalDoctrine: doctrineBravo, loadoutProfile },
    ],
    loadoutProfile,
    lighting,
    visibilityOrMu,
    maxOrm: baseConfig.maxOrm,
    allowConcentrateRangeExtension: baseConfig.allowConcentrateRangeExtension,
    perCharacterFovLos: baseConfig.perCharacterFovLos,
    runs,
    baseSeed,
    winners,
    totals,
    averages: divideStats(totals, runs),
    scoringSummary,
    combatEfficacy,
    advancedRuleTotals,
    advancedRuleAverages: divideAdvancedRuleMetrics(advancedRuleTotals, runs),
    coverage,
    runtimeCoverage,
    probeCoverage,
    performanceGates,
    coordinatorTraceGates,
    pressureContinuityDiagnostics,
    pressureContinuityGates,
    combatActivityGates,
    passivenessGates,
    attackGateTelemetryGates,
    runReports,
    generatedAt: new Date().toISOString(),
  };

  const outputPath = writeValidationReport(aggregateReport);
  console.log('\nValidation aggregate:');
  console.log(`  Winners: ${JSON.stringify(winners)}`);
  console.log(`  Runtime Coverage: ${JSON.stringify(runtimeCoverage)}`);
  console.log(`  Probe Coverage: ${JSON.stringify(probeCoverage)}`);
  console.log(`  Combined Coverage: ${JSON.stringify(coverage)}`);
  console.log(`  Bonus Actions: offered=${advancedRuleTotals.bonusActions.optionsOffered}, executed=${advancedRuleTotals.bonusActions.executed}`);
  console.log(`  Passive Options: offered=${advancedRuleTotals.passiveOptions.optionsOffered}, used=${advancedRuleTotals.passiveOptions.used}`);
  console.log(`  Situational Modifiers: tests=${advancedRuleTotals.situationalModifiers.testsObserved}, applied=${advancedRuleTotals.situationalModifiers.modifiersApplied}`);
  console.log(
    `  Wait Efficacy: given=${totals.waitChoicesGiven}, taken=${totals.waitChoicesTaken}, success=${totals.waitChoicesSucceeded}, takeRate=${(safeRate(totals.waitChoicesTaken, totals.waitChoicesGiven) * 100).toFixed(1)}%, successRate=${(safeRate(totals.waitChoicesSucceeded, totals.waitChoicesTaken) * 100).toFixed(1)}%`
  );
  console.log(
    `  React Efficacy: windows=${totals.reactChoiceWindows}, choices=${totals.reactChoicesGiven}, taken=${totals.reactChoicesTaken}, takeRate=${(safeRate(totals.reactChoicesTaken, totals.reactChoiceWindows) * 100).toFixed(1)}%, optionSelectRate=${(safeRate(totals.reactChoicesTaken, totals.reactChoicesGiven) * 100).toFixed(1)}%, waitReact=${totals.waitTriggeredReacts}, waitReactWounds=${totals.waitReactWoundsInflicted.toFixed(2)}`
  );
  console.log(
    `  Combat Efficacy: hit=${(combatEfficacy.hitTests.passRate * 100).toFixed(1)}% (${combatEfficacy.hitTests.passes}/${combatEfficacy.hitTests.attempts}), damage=${(combatEfficacy.damageTests.passRate * 100).toFixed(1)}% (${combatEfficacy.damageTests.passes}/${combatEfficacy.damageTests.attempts}), assigned(w/f/d)=${combatEfficacy.assignments.wounds}/${combatEfficacy.assignments.fear}/${combatEfficacy.assignments.delay}`
  );
  if (scoringSummary.sideScores.length > 0) {
    console.log('  Mission Scoring:');
    for (const sideScore of scoringSummary.sideScores) {
      console.log(
        `    ${sideScore.sideId}: VP total=${sideScore.totalVp.toFixed(2)} avg=${sideScore.averageVp.toFixed(2)}, RP total=${sideScore.totalRp.toFixed(2)} avg=${sideScore.averageRp.toFixed(2)}`
      );
      const scoredKeys = sideScore.keys.filter(key => key.runsScored > 0);
      if (scoredKeys.length === 0) {
        console.log('      Keys scored: none');
      } else {
        console.log(
          `      Keys scored: ${scoredKeys
            .map(key => `${key.key}=${key.totalCurrent.toFixed(2)} (${key.runsScored}/${runs} runs)`)
            .join(', ')}`
        );
      }
    }
  }
  const telemetrySamples = totals.decisionTelemetrySamples ?? 0;
  if (telemetrySamples > 0) {
    const gateApplied = totals.attackGateAppliedDecisions ?? 0;
    const gateRate = safeRate(gateApplied, telemetrySamples);
    console.log(
      `  Attack Gate Telemetry: samples=${telemetrySamples}, applied=${gateApplied}, applyRate=${(gateRate * 100).toFixed(1)}%, reasons(immediate_high=${totals.attackGateImmediateHighApplied ?? 0}, directive_window=${totals.attackGateDirectiveApplied ?? 0}), grades(high=${totals.attackOpportunityImmediateHigh ?? 0}, low=${totals.attackOpportunityImmediateLow ?? 0}, setup=${totals.attackOpportunitySetup ?? 0}, none=${totals.attackOpportunityNone ?? 0})`
    );
  }
  console.log(`  Lighting: ${lighting} (Visibility OR ${visibilityOrMu} MU)`);
  console.log(`  Doctrine: ${doctrineLabel}`);
  console.log(`    Alpha: ${doctrineAlpha}`);
  console.log(`    Bravo: ${doctrineBravo}`);
  console.log(`  Loadout Profile: ${loadoutProfile}`);
  if (performanceGates && performanceGates.enabled) {
    console.log(
      `  Gate Profile: mission=${performanceGates.profile.missionId}, size=${performanceGates.profile.gameSize}, density=${performanceGates.profile.densityRatio}% (bucket ${performanceGates.profile.densityBucket})`
    );
    if (performanceGates.pass.overall === null) {
      console.log('  Performance Gates: n/a (no profiled runs)');
    } else {
      console.log(`  Performance Gates: ${performanceGates.pass.overall ? 'PASS' : 'FAIL'}`);
      console.log(
        `    Turn 1 avg=${performanceGates.observed.avgTurn1ElapsedMs?.toFixed(2) ?? 'n/a'}ms (<= ${performanceGates.thresholds.turn1ElapsedMsMax}ms): ${performanceGates.pass.turn1Elapsed ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Activation p95 avg=${performanceGates.observed.avgActivationP95Ms?.toFixed(2) ?? 'n/a'}ms (<= ${performanceGates.thresholds.activationP95MsMax}ms): ${performanceGates.pass.activationP95 ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    LOS cache avg=${performanceGates.observed.avgLosCacheHitRate !== null ? (performanceGates.observed.avgLosCacheHitRate * 100).toFixed(1) : 'n/a'}% (>= ${(performanceGates.thresholds.minLosCacheHitRate * 100).toFixed(1)}%): ${performanceGates.pass.losCacheHitRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Path cache avg=${performanceGates.observed.avgPathCacheHitRate !== null ? (performanceGates.observed.avgPathCacheHitRate * 100).toFixed(1) : 'n/a'}% (>= ${(performanceGates.thresholds.minPathCacheHitRate * 100).toFixed(1)}%): ${performanceGates.pass.pathCacheHitRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Grid cache avg=${performanceGates.observed.avgGridCacheHitRate !== null ? (performanceGates.observed.avgGridCacheHitRate * 100).toFixed(1) : 'n/a'}% (>= ${(performanceGates.thresholds.minGridCacheHitRate * 100).toFixed(1)}%): ${performanceGates.pass.gridCacheHitRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Minimax cache avg=${performanceGates.observed.avgMinimaxLiteCacheHitRate !== null ? (performanceGates.observed.avgMinimaxLiteCacheHitRate * 100).toFixed(1) : 'n/a'}% (>= ${(performanceGates.thresholds.minMinimaxLiteCacheHitRate * 100).toFixed(1)}%): ${performanceGates.pass.minimaxLiteCacheHitRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Minimax patch cache avg=${performanceGates.observed.avgMinimaxPatchCacheHitRate !== null ? (performanceGates.observed.avgMinimaxPatchCacheHitRate * 100).toFixed(1) : 'n/a'}% (>= ${(performanceGates.thresholds.minMinimaxPatchCacheHitRate * 100).toFixed(1)}%): ${performanceGates.pass.minimaxPatchCacheHitRate ? 'PASS' : 'FAIL'}`
      );
    }
  }
  if (coordinatorTraceGates && coordinatorTraceGates.enabled) {
    if (coordinatorTraceGates.pass.overall === null) {
      console.log('  Coordinator Trace Gates: n/a (no audit turn traces)');
    } else {
      console.log(`  Coordinator Trace Gates: ${coordinatorTraceGates.pass.overall ? 'PASS' : 'FAIL'}`);
      console.log(
        `    Run coverage avg=${coordinatorTraceGates.observed.runCoverage !== null ? (coordinatorTraceGates.observed.runCoverage * 100).toFixed(1) : 'n/a'}% (>= ${(coordinatorTraceGates.thresholds.minRunCoverage * 100).toFixed(1)}%): ${coordinatorTraceGates.pass.runCoverage ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Turn coverage avg=${coordinatorTraceGates.observed.avgTurnCoverage !== null ? (coordinatorTraceGates.observed.avgTurnCoverage * 100).toFixed(1) : 'n/a'}% (>= ${(coordinatorTraceGates.thresholds.minTurnCoverage * 100).toFixed(1)}%): ${coordinatorTraceGates.pass.turnCoverage ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Side coverage/turn avg=${coordinatorTraceGates.observed.avgSideCoveragePerTurn !== null ? (coordinatorTraceGates.observed.avgSideCoveragePerTurn * 100).toFixed(1) : 'n/a'}% (>= ${(coordinatorTraceGates.thresholds.minSideCoveragePerTurn * 100).toFixed(1)}%): ${coordinatorTraceGates.pass.sideCoveragePerTurn ? 'PASS' : 'FAIL'}`
      );
    }
  }
  if (pressureContinuityDiagnostics && pressureContinuityDiagnostics.runsEvaluated > 0) {
    console.log('  Pressure Continuity Diagnostics:');
    console.log(
      `    Runs with data: ${pressureContinuityDiagnostics.runsWithData}/${pressureContinuityDiagnostics.runsEvaluated}`
    );
    console.log(
      `    Scrum break-rate avg=${pressureContinuityDiagnostics.observed.avgScrumBreakRate !== null ? (pressureContinuityDiagnostics.observed.avgScrumBreakRate * 100).toFixed(1) : 'n/a'}%`
    );
    console.log(
      `    Lane break-rate avg=${pressureContinuityDiagnostics.observed.avgLaneBreakRate !== null ? (pressureContinuityDiagnostics.observed.avgLaneBreakRate * 100).toFixed(1) : 'n/a'}%`
    );
    console.log(
      `    Combined break-rate avg=${pressureContinuityDiagnostics.observed.avgCombinedBreakRate !== null ? (pressureContinuityDiagnostics.observed.avgCombinedBreakRate * 100).toFixed(1) : 'n/a'}%`
    );
    console.log(
      `    Signature coverage avg=${pressureContinuityDiagnostics.observed.avgSignatureCoverageRate !== null ? (pressureContinuityDiagnostics.observed.avgSignatureCoverageRate * 100).toFixed(1) : 'n/a'}%`
    );
  }
  if (pressureContinuityGates && pressureContinuityGates.enabled) {
    if (pressureContinuityGates.pass.overall === null) {
      console.log('  Pressure Continuity Gates: n/a (no continuity samples)');
    } else {
      console.log(`  Pressure Continuity Gates: ${pressureContinuityGates.pass.overall ? 'PASS' : 'FAIL'}`);
      console.log(
        `    Gate profile: mission=${pressureContinuityGates.profile.missionId}, size=${pressureContinuityGates.profile.gameSize}, density=${pressureContinuityGates.profile.densityRatio}% (bucket ${pressureContinuityGates.profile.densityBucket})`
      );
      console.log(
        `    Runs with data avg=${pressureContinuityGates.observed.runsWithDataRate !== null ? (pressureContinuityGates.observed.runsWithDataRate * 100).toFixed(1) : 'n/a'}% (>= ${(pressureContinuityGates.thresholds.minRunsWithDataRate * 100).toFixed(1)}%): ${pressureContinuityGates.pass.runsWithDataRate === null ? 'n/a' : pressureContinuityGates.pass.runsWithDataRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Signature coverage avg=${pressureContinuityGates.observed.avgSignatureCoverageRate !== null ? (pressureContinuityGates.observed.avgSignatureCoverageRate * 100).toFixed(1) : 'n/a'}% (>= ${(pressureContinuityGates.thresholds.minSignatureCoverageRate * 100).toFixed(1)}%): ${pressureContinuityGates.pass.signatureCoverageRate === null ? 'n/a' : pressureContinuityGates.pass.signatureCoverageRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Combined break-rate avg=${pressureContinuityGates.observed.avgCombinedBreakRate !== null ? (pressureContinuityGates.observed.avgCombinedBreakRate * 100).toFixed(1) : 'n/a'}% (<= ${(pressureContinuityGates.thresholds.maxCombinedBreakRate * 100).toFixed(1)}%): ${pressureContinuityGates.pass.combinedBreakRate === null ? 'n/a' : pressureContinuityGates.pass.combinedBreakRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Lane break-rate avg=${pressureContinuityGates.observed.avgLaneBreakRate !== null ? (pressureContinuityGates.observed.avgLaneBreakRate * 100).toFixed(1) : 'n/a'}% (<= ${(pressureContinuityGates.thresholds.maxLaneBreakRate * 100).toFixed(1)}%): ${pressureContinuityGates.pass.laneBreakRate === null ? 'n/a' : pressureContinuityGates.pass.laneBreakRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Scrum break-rate avg=${pressureContinuityGates.observed.avgScrumBreakRate !== null ? (pressureContinuityGates.observed.avgScrumBreakRate * 100).toFixed(1) : 'n/a'}% (<= ${(pressureContinuityGates.thresholds.maxScrumBreakRate * 100).toFixed(1)}%): ${pressureContinuityGates.pass.scrumBreakRate === null ? 'n/a' : pressureContinuityGates.pass.scrumBreakRate ? 'PASS' : 'FAIL'}`
      );
    }
  }
  if (combatActivityGates && combatActivityGates.enabled) {
    if (combatActivityGates.pass.overall === null) {
      console.log(`  Combat Activity Gates: n/a (${combatActivityGates.skippedReason ?? 'no run combat metrics'})`);
    } else {
      console.log(`  Combat Activity Gates: ${combatActivityGates.pass.overall ? 'PASS' : 'FAIL'}`);
      console.log(
        `    Gate profile: mission=${combatActivityGates.profile.missionId}, size=${combatActivityGates.profile.gameSize}, density=${combatActivityGates.profile.densityRatio}% (bucket ${combatActivityGates.profile.densityBucket})`
      );
      console.log(
        `    Turn horizon=${combatActivityGates.profile.maxTurns}/${combatActivityGates.profile.configuredMaxTurns} (${(combatActivityGates.profile.horizonRatio * 100).toFixed(1)}%, min ${(combatActivityGates.thresholds.minTurnHorizonRatio * 100).toFixed(1)}%)`
      );
      console.log(
        `    Attack action ratio (combat runs) avg=${combatActivityGates.observed.avgAttackActionRatio !== null ? (combatActivityGates.observed.avgAttackActionRatio * 100).toFixed(1) : 'n/a'}% (>= ${(combatActivityGates.thresholds.minAttackActionRatio * 100).toFixed(1)}%): ${combatActivityGates.pass.attackActionRatio === null ? 'n/a' : combatActivityGates.pass.attackActionRatio ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Runs with combat avg=${combatActivityGates.observed.runsWithCombatRate !== null ? (combatActivityGates.observed.runsWithCombatRate * 100).toFixed(1) : 'n/a'}% (>= ${(combatActivityGates.thresholds.minRunsWithCombatRate * 100).toFixed(1)}%): ${combatActivityGates.pass.runsWithCombatRate === null ? 'n/a' : combatActivityGates.pass.runsWithCombatRate ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Zero-attack runs avg=${combatActivityGates.observed.zeroAttackRunRate !== null ? (combatActivityGates.observed.zeroAttackRunRate * 100).toFixed(1) : 'n/a'}% (<= ${(combatActivityGates.thresholds.maxZeroAttackRunRate * 100).toFixed(1)}%): ${combatActivityGates.pass.zeroAttackRunRate === null ? 'n/a' : combatActivityGates.pass.zeroAttackRunRate ? 'PASS' : 'FAIL'}`
      );
    }
  }
  if (passivenessGates && passivenessGates.enabled) {
    if (passivenessGates.pass.overall === null) {
      console.log(`  Passiveness Gates: n/a (${passivenessGates.skippedReason ?? 'no run passiveness metrics'})`);
    } else {
      console.log(`  Passiveness Gates: ${passivenessGates.pass.overall ? 'PASS' : 'FAIL'}`);
      console.log(
        `    Gate profile: mission=${passivenessGates.profile.missionId}, size=${passivenessGates.profile.gameSize}, density=${passivenessGates.profile.densityRatio}% (bucket ${passivenessGates.profile.densityBucket})`
      );
      console.log(
        `    Passive action ratio avg=${passivenessGates.observed.avgPassiveActionRatio !== null ? (passivenessGates.observed.avgPassiveActionRatio * 100).toFixed(1) : 'n/a'}% (<= ${(passivenessGates.thresholds.maxPassiveActionRatio * 100).toFixed(1)}%): ${passivenessGates.pass.passiveActionRatio === null ? 'n/a' : passivenessGates.pass.passiveActionRatio ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Detect+Hide action ratio avg=${passivenessGates.observed.avgDetectHideActionRatio !== null ? (passivenessGates.observed.avgDetectHideActionRatio * 100).toFixed(1) : 'n/a'}% (<= ${(passivenessGates.thresholds.maxDetectHideActionRatio * 100).toFixed(1)}%): ${passivenessGates.pass.detectHideActionRatio === null ? 'n/a' : passivenessGates.pass.detectHideActionRatio ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Wait action ratio avg=${passivenessGates.observed.avgWaitActionRatio !== null ? (passivenessGates.observed.avgWaitActionRatio * 100).toFixed(1) : 'n/a'}% (<= ${(passivenessGates.thresholds.maxWaitActionRatio * 100).toFixed(1)}%): ${passivenessGates.pass.waitActionRatio === null ? 'n/a' : passivenessGates.pass.waitActionRatio ? 'PASS' : 'FAIL'}`
      );
    }
  }
  if (attackGateTelemetryGates && attackGateTelemetryGates.enabled) {
    if (attackGateTelemetryGates.pass.overall === null) {
      console.log(`  Attack Gate Telemetry Gates: n/a (${attackGateTelemetryGates.skippedReason ?? 'no telemetry/opportunity samples'})`);
    } else {
      console.log(`  Attack Gate Telemetry Gates: ${attackGateTelemetryGates.pass.overall ? 'PASS' : 'FAIL'}`);
      console.log(
        `    Gate profile: mission=${attackGateTelemetryGates.profile.missionId}, size=${attackGateTelemetryGates.profile.gameSize}, density=${attackGateTelemetryGates.profile.densityRatio}% (bucket ${attackGateTelemetryGates.profile.densityBucket})`
      );
      console.log(
        `    Turn horizon=${attackGateTelemetryGates.profile.maxTurns}/${attackGateTelemetryGates.profile.configuredMaxTurns} (${(attackGateTelemetryGates.profile.horizonRatio * 100).toFixed(1)}%, min ${(attackGateTelemetryGates.thresholds.minTurnHorizonRatio * 100).toFixed(1)}%)`
      );
      console.log(
        `    Telemetry samples/run avg=${attackGateTelemetryGates.observed.avgTelemetrySamplesPerRun !== null ? attackGateTelemetryGates.observed.avgTelemetrySamplesPerRun.toFixed(2) : 'n/a'} (>= ${attackGateTelemetryGates.thresholds.minTelemetrySamplesPerRun.toFixed(2)}): ${attackGateTelemetryGates.pass.telemetrySamples === null ? 'n/a' : attackGateTelemetryGates.pass.telemetrySamples ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Immediate-high opportunities total=${attackGateTelemetryGates.observed.totalImmediateHighOpportunities} (min ${attackGateTelemetryGates.thresholds.minImmediateHighOpportunityCount}) conversion avg=${attackGateTelemetryGates.observed.immediateHighConversionRate !== null ? (attackGateTelemetryGates.observed.immediateHighConversionRate * 100).toFixed(1) : 'n/a'}% (>= ${(attackGateTelemetryGates.thresholds.minImmediateHighConversionRate * 100).toFixed(1)}%): ${attackGateTelemetryGates.pass.immediateHighConversion === null ? 'n/a' : attackGateTelemetryGates.pass.immediateHighConversion ? 'PASS' : 'FAIL'}`
      );
      console.log(
        `    Pressure-opportunity apply avg=${attackGateTelemetryGates.observed.pressureOpportunityGateApplyRate !== null ? (attackGateTelemetryGates.observed.pressureOpportunityGateApplyRate * 100).toFixed(1) : 'n/a'}% (>= ${(attackGateTelemetryGates.thresholds.minPressureOpportunityGateApplyRate * 100).toFixed(1)}%): ${attackGateTelemetryGates.pass.pressureOpportunityApplyRate === null ? 'n/a' : attackGateTelemetryGates.pass.pressureOpportunityApplyRate ? 'PASS' : 'FAIL'}`
      );
    }
  }
  console.log(`  Report: ${outputPath}`);
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    performanceGates &&
    performanceGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    coordinatorTraceGates &&
    coordinatorTraceGates.enabled &&
    coordinatorTraceGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    pressureContinuityGates &&
    pressureContinuityGates.enabled &&
    pressureContinuityGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    combatActivityGates &&
    combatActivityGates.enabled &&
    combatActivityGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    passivenessGates &&
    passivenessGates.enabled &&
    passivenessGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    attackGateTelemetryGates &&
    attackGateTelemetryGates.enabled &&
    attackGateTelemetryGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
}

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
import type { GameConfig } from '../shared/BattleReportTypes';
import { GAME_SIZE_CONFIG } from '../AIBattleConfig';
import { AIBattleRunner } from '../AIBattleRunner';
import type { ValidationAggregateReport, ValidationCoverage, BattleStats, AdvancedRuleMetrics } from './ValidationMetrics';
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
import { buildValidationPerformanceGates } from '../cli/EnvConfig';
import { parseMissionIdArg } from '../cli/ArgParser';

// Mission name lookup
const MISSION_NAME_BY_ID: Record<string, string> = {
  QAI_11: 'Elimination',
  QAI_12: 'Convergence',
  QAI_13: 'Assault',
  QAI_14: 'Dominion',
  QAI_15: 'Recovery',
  QAI_16: 'Escort',
  QAI_17: 'Triumvirate',
  QAI_18: 'Stealth',
  QAI_19: 'Defiance',
  QAI_20: 'Breach',
};

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
    const attackerProfile = buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A'] });
    const defenderProfile = buildProfile('Average', { itemNames: ['Sword, Broad'] });
    const reactorProfile = buildProfile('Veteran', { itemNames: ['Rifle, Light, Semi/A'] });
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
        isDefending: false,
        isCharge: false,
      });
      coverage.closeCombat = Boolean(close.result);
    }

    return coverage;
  } catch {
    return {};
  }
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
  missionId: string = 'QAI_11'
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
  const missionName = MISSION_NAME_BY_ID[resolvedMissionId] ?? resolvedMissionId;
  const configuredMaxTurns = GAME_SIZE_CONFIG[gameSize].maxTurns;
  const maxTurnsOverride = Number.parseInt(process.env.AI_BATTLE_MAX_TURNS ?? '', 10);
  const maxTurns = Number.isFinite(maxTurnsOverride) && maxTurnsOverride > 0
    ? Math.min(configuredMaxTurns, maxTurnsOverride)
    : configuredMaxTurns;
  const baseConfig: GameConfig = {
    missionId: resolvedMissionId,
    missionName,
    gameSize,
    battlefieldSize: GAME_SIZE_CONFIG[gameSize].battlefieldSize,
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
  console.log(`  Profiling: ${validationForceProfiling ? 'enabled' : 'disabled (AI_BATTLE_VALIDATION_PROFILE=0)'}`);
  for (let i = 0; i < runs; i++) {
    const seed = baseSeed + i;
    const runner = new AIBattleRunner();
    const report = await runner.runBattle(baseConfig, {
      seed,
      suppressOutput: true,
      forceProfiling: validationForceProfiling,
    });
    winners[report.winner] = (winners[report.winner] ?? 0) + 1;
    accumulateStats(totals, report.stats);
    accumulateAdvancedRuleMetrics(advancedRuleTotals, report.advancedRules);
    runReports.push({
      run: i + 1,
      seed,
      winner: report.winner,
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
        topPathModels: report.usage?.topPathModels ?? [],
      },
      missionRuntime: report.missionRuntime,
      nestedSections: report.nestedSections,
      advancedRules: report.advancedRules,
      performance: report.performance,
    });
    const elapsedLabel = report.performance ? `, elapsedMs=${report.performance.elapsedMs.toFixed(2)}` : '';
    console.log(
      `  Run ${i + 1}/${runs}: winner=${report.winner}, moves=${report.stats.moves}, ranged=${report.stats.rangedCombats}, close=${report.stats.closeCombats}, path=${(report.usage?.totalPathLength ?? 0).toFixed(2)}${elapsedLabel}`
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
    advancedRuleTotals,
    advancedRuleAverages: divideAdvancedRuleMetrics(advancedRuleTotals, runs),
    coverage,
    runtimeCoverage,
    probeCoverage,
    performanceGates,
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
  console.log(`  Lighting: ${lighting} (Visibility OR ${visibilityOrMu} MU)`);
  console.log(`  Doctrine: ${doctrineLabel}`);
  console.log(`    Alpha: ${doctrineAlpha}`);
  console.log(`    Bravo: ${doctrineBravo}`);
  console.log(`  Loadout Profile: ${loadoutProfile}`);
  if (performanceGates.enabled) {
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
    }
  }
  console.log(`  Report: ${outputPath}`);
  if (
    process.env.AI_BATTLE_ENFORCE_GATES === '1' &&
    performanceGates.pass.overall === false
  ) {
    process.exitCode = 1;
  }
}

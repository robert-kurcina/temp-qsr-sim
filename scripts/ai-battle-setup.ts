/**
 * AI Battle Setup CLI
 *
 * Interactive command-line tool for setting up and running AI-only game sessions.
 * Prompts for mission selection, game size, AI configuration, and tactical doctrines.
 *
 * Usage:
 *   npm run sim -- quick                 # Quick battle with defaults
 *   npm run sim -- interactive           # Interactive setup
 *   npm run sim -- render-report <report.json>  # Render JSON battle report
 *   npm run sim -- validate VERY_LARGE 50 3 424242 # Validation batch
 *   npm run sim -- quick VERY_LARGE 50   # Quick battle with size and density
 */

import { readFileSync } from 'node:fs';
import { GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition } from '../src/lib/mest-tactics/utils/visibility';
import type { BattleReport } from './shared/BattleReportTypes';
import type { ValidationAggregateReport } from './ai-battle/validation/ValidationMetrics';
import { AIBattleRunner } from './ai-battle/AIBattleRunner';
import { AIBattleSetup } from './ai-battle/interactive-setup';
import { formatBattleReportHumanReadable } from './ai-battle/reporting/BattleReportFormatter';
import { writeBattleArtifacts } from './ai-battle/reporting/BattleReportWriter';
import { formatValidationAggregateReportHumanReadable } from './ai-battle/validation/ValidationReporter';
import { runValidationBatch } from './ai-battle/validation/ValidationRunner';
import {
  parseLightingArg,
  parseLoadoutProfileArg,
  parseDoctrineArg,
  parseDoctrinePairArgs,
  parseMissionIdArg,
  parseGameSizeArg,
  parsePositiveIntArg,
} from './ai-battle/cli/ArgParser';
import { parseAiBattleCliArgs, resolveQuickBattleCliDefaults } from './ai-battle/cli/SetupCliParser';
import { GAME_SIZE_CONFIG } from './ai-battle/AIBattleConfig';
import { getDefaultSimpleBattlefieldPath } from './shared/BattlefieldPaths';
import { resolveMissionName } from './shared/MissionCatalog';

// ============================================================================
// CLI Entry Points
// ============================================================================

async function runInteractive() {
  const setup = new AIBattleSetup();
  const runner = new AIBattleRunner();

  try {
    const config = await setup.runInteractiveSetup();
    setup.close();

    const report = await runner.runBattle(config);
    const artifacts = writeBattleArtifacts(report);
    console.log(`📁 JSON Report: ${artifacts.reportPath}`);

    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    setup.close();
    process.exit(1);
  }
}

async function runQuickBattle(
  gameSize: GameSize = GameSize.VERY_SMALL,
  missionId: string = 'QAI_11',
  densityRatio: number = 50,
  lighting: LightingCondition = 'Day, Clear',
  enableAudit: boolean = false,
  enableViewer: boolean = false,
  seed?: number,
  battlefieldPath?: string,
  initiativeCardTieBreakerOnTie?: boolean,
  initiativeCardHolderSideId?: string
) {
  const { getVisibilityOrForLighting } = await import('../src/lib/mest-tactics/utils/visibility');
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const resolvedMissionId = parseMissionIdArg(missionId, 'QAI_11');

  const resolvedBattlefieldPath = battlefieldPath ?? getDefaultSimpleBattlefieldPath(gameSize);
  const config = {
    missionId: resolvedMissionId,
    missionName: resolveMissionName(resolvedMissionId),
    gameSize,
    battlefieldWidth: GAME_SIZE_CONFIG[gameSize].battlefieldWidth,
    battlefieldHeight: GAME_SIZE_CONFIG[gameSize].battlefieldHeight,
    maxTurns: GAME_SIZE_CONFIG[gameSize].maxTurns,
    endGameTurn: GAME_SIZE_CONFIG[gameSize].endGameTurn,
    sides: [
      {
        name: 'Alpha',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Alpha Assembly',
      },
      {
        name: 'Bravo',
        bp: GAME_SIZE_CONFIG[gameSize].bpPerSide[1],
        modelCount: GAME_SIZE_CONFIG[gameSize].modelsPerSide[1],
        tacticalDoctrine: TacticalDoctrine.Operative,
        assemblyName: 'Bravo Assembly',
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
    verbose: true,
    seed,
    audit: enableAudit,
    viewer: enableViewer,
    battlefieldPath: resolvedBattlefieldPath ?? undefined,
    initiativeCardTieBreakerOnTie,
    initiativeCardHolderSideId,
  };

  const runner = new AIBattleRunner();

  try {
    const report = await runner.runBattle(config);
    const artifacts = writeBattleArtifacts(report, {
      audit: enableAudit || enableViewer,
      viewer: enableViewer,
    });
    console.log(`📁 JSON Report: ${artifacts.reportPath}`);

    if (artifacts.auditPath) {
      console.log(`🎬 Visual Audit: ${artifacts.auditPath}`);
    }
    if (artifacts.viewerPath) {
      console.log(`📺 HTML Viewer: ${artifacts.viewerPath}`);
      console.log(`\n💡 Open in browser: open ${artifacts.viewerPath}`);
    }

    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    process.exit(1);
  }
}

function renderBattleReportFile(reportPath: string) {
  const jsonText = readFileSync(reportPath, 'utf-8');
  const parsed = JSON.parse(jsonText) as BattleReport | ValidationAggregateReport;
  const isValidationAggregate =
    typeof (parsed as ValidationAggregateReport).runs === 'number' &&
    Array.isArray((parsed as ValidationAggregateReport).runReports) &&
    Boolean((parsed as ValidationAggregateReport).totals);
  if (isValidationAggregate) {
    console.log(`\n${formatValidationAggregateReportHumanReadable(parsed as ValidationAggregateReport)}\n`);
  } else {
    console.log(`\n${formatBattleReportHumanReadable(parsed as BattleReport)}\n`);
  }
}

// Main entry point
const args = process.argv.slice(2);
const parsedCli = parseAiBattleCliArgs(args);
const positionalArgs = parsedCli.positionalArgs;

if (parsedCli.command === 'interactive') {
  runInteractive();
} else if (parsedCli.command === 'render-report') {
  const reportPath = positionalArgs[1];
  if (!reportPath) {
    console.error('Missing report path. Usage: npm run sim -- render-report generated/ai-battle-reports/<file>.json');
    process.exit(1);
  }
  try {
    renderBattleReportFile(reportPath);
  } catch (error) {
    console.error('\n❌ Report rendering failed with error:');
    console.error(error);
    process.exit(1);
  }
} else if (parsedCli.command === 'validate') {
  const sizeArg = (positionalArgs[1] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(positionalArgs[2], 10);
  const runsParsed = parseInt(positionalArgs[3], 10);
  const seedParsed = parseInt(positionalArgs[4], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const runsArg = Number.isFinite(runsParsed) ? runsParsed : 3;
  const seedArg = Number.isFinite(seedParsed) ? seedParsed : 424242;
  const lighting = parseLightingArg(positionalArgs[5]);
  const loadoutProfile = parseLoadoutProfileArg(positionalArgs[6]);
  const doctrinePair = parseDoctrinePairArgs(
    positionalArgs[7],
    positionalArgs[8],
    loadoutProfile === 'melee_only' ? TacticalDoctrine.Juggernaut : TacticalDoctrine.Operative
  );
  const missionId = parseMissionIdArg(positionalArgs[9], parseMissionIdArg(positionalArgs[8], 'QAI_11'));
  const gameSize = parseGameSizeArg(sizeArg);
  const {
    initiativeCardTieBreakerOnTie,
    initiativeCardHolderSideId,
  } = parsedCli.flags;
  runValidationBatch(
    gameSize,
    densityArg,
    runsArg,
    seedArg,
    lighting,
    doctrinePair,
    loadoutProfile,
    missionId,
    initiativeCardTieBreakerOnTie,
    initiativeCardHolderSideId
  ).catch((error) => {
    console.error('\n❌ Validation failed with error:');
    console.error(error);
    process.exit(1);
  });
} else if (parsedCli.command === 'help') {
  console.log(`
AI Battle Setup - MEST Tactics

Usage:
  npm run sim -- quick                 # Quick battle (VERY_SMALL, density 50)
  npm run sim -- interactive
  npm run sim -- render-report REPORT_PATH
  npm run sim -- validate SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA[,DOCTRINE_BRAVO]] [MISSION_ID]
  npm run sim -- validate SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA] [DOCTRINE_BRAVO] [MISSION_ID]
  npm run sim -- quick SIZE DENSITY [LIGHTING]    # Quick battle with custom params

Visual Audit Options:
  npm run sim -- quick --audit         # Enable audit capture
  npm run sim -- quick --viewer        # Generate HTML viewer
  npm run sim -- quick --audit --viewer --seed 12345  # Audit + viewer with seed
  npm run sim -- quick very-small --audit --viewer  # VERY_SMALL with viewer
  npm run sim -- quick VERY_SMALL 0 --battlefield data/battlefields/default/simple/VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json
  npm run sim -- quick --initiative-card-holder Alpha
  npm run sim -- quick --no-initiative-card-tiebreak

Tie-Break Options (quick/validate):
  --initiative-card-holder <SIDE_ID>
  --initiative-card-tiebreak
  --no-initiative-card-tiebreak

Game Sizes: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE
Lighting: DAY (default) | TWILIGHT
Loadout Profile: DEFAULT (default) | MELEE_ONLY
Doctrine: Any tactical doctrine id (default: OPERATIVE, or JUGGERNAUT for MELEE_ONLY)

Examples:
  npm run sim -- quick VERY_LARGE 50   # Large battle, 50% terrain
  npm run sim -- quick VERY_LARGE 50 TWILIGHT
  npm run sim -- quick SMALL 30        # Small battle, 30% terrain
  npm run sim -- quick very-small --audit --viewer  # Quick battle with visual audit
  npm run sim -- quick --audit --viewer --seed 424242  # Audit with reproducible seed
  npm run sim -- validate SMALL 50 1 424242 DAY MELEE_ONLY
  npm run sim -- validate SMALL 50 1 424242 DAY MELEE_ONLY juggernaut
  npm run sim -- validate SMALL 50 1 424242 DAY DEFAULT operative,watchman QAI_11
  npm run sim -- validate SMALL 50 1 424242 DAY DEFAULT operative watchman QAI_20
  npm run sim -- render-report generated/ai-battle-reports/battle-report-<ts>.json
  npm run sim -- validate VERY_LARGE 50 5 424242 TWILIGHT
  npm run sim -- quick VERY_SMALL 0 --battlefield data/battlefields/default/simple/VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json
`);
} else {
  const quickDefaults = resolveQuickBattleCliDefaults(positionalArgs);
  const lighting = parseLightingArg(quickDefaults.lightingArg);
  const gameSize = parseGameSizeArg(quickDefaults.sizeArg);
  const {
    enableAudit,
    enableViewer,
    seed,
    battlefieldPath,
    initiativeCardTieBreakerOnTie,
    initiativeCardHolderSideId,
  } = parsedCli.flags;
  runQuickBattle(
    gameSize,
    'QAI_11',
    quickDefaults.densityArg,
    lighting,
    enableAudit,
    enableViewer,
    seed,
    battlefieldPath,
    initiativeCardTieBreakerOnTie,
    initiativeCardHolderSideId
  );
}

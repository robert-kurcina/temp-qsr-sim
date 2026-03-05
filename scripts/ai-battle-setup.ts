/**
 * AI Battle Setup CLI
 *
 * Interactive command-line tool for setting up and running AI-only game sessions.
 * Prompts for mission selection, game size, AI configuration, and tactical doctrines.
 *
 * Usage:
 *   npm run ai-battle                    # Quick battle with defaults
 *   npm run ai-battle -- -i              # Interactive setup
 *   npm run ai-battle -- -r <report.json># Render JSON battle report
 *   npm run ai-battle -- -v VERY_LARGE 50 3 424242 # Validation batch
 *   npm run ai-battle -- VERY_LARGE 50   # Quick battle with size and density
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
import { writeSingleBattleReport, writeVisualAuditReport, writeBattleReportViewer } from './ai-battle/reporting/BattleReportWriter';
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
import { GAME_SIZE_CONFIG } from './ai-battle/AIBattleConfig';

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
    const reportPath = writeSingleBattleReport(report);
    console.log(`📁 JSON Report: ${reportPath}`);

    console.log('✅ Battle completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Battle failed with error:');
    console.error(error);
    setup.close();
    process.exit(1);
  }
}

async function runQuickBattle(
  gameSize: GameSize = GameSize.VERY_LARGE,
  missionId: string = 'QAI_11',
  densityRatio: number = 50,
  lighting: LightingCondition = 'Day, Clear',
  enableAudit: boolean = false,
  enableViewer: boolean = false,
  seed?: number
) {
  const { getVisibilityOrForLighting } = await import('../src/lib/mest-tactics/utils/visibility');
  const visibilityOrMu = getVisibilityOrForLighting(lighting);
  const resolvedMissionId = parseMissionIdArg(missionId, 'QAI_11');

  const config = {
    missionId: resolvedMissionId,
    missionName: MISSION_NAME_BY_ID[resolvedMissionId] ?? resolvedMissionId,
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
    verbose: true,
    seed,
    audit: enableAudit,
    viewer: enableViewer,
  };

  const runner = new AIBattleRunner();

  try {
    const report = await runner.runBattle(config);
    const reportPath = writeSingleBattleReport(report);
    console.log(`📁 JSON Report: ${reportPath}`);

    if (enableAudit || enableViewer) {
      const auditPath = writeVisualAuditReport(report);
      console.log(`🎬 Visual Audit: ${auditPath}`);

      if (enableViewer) {
        const viewerPath = writeBattleReportViewer(report);
        console.log(`📺 HTML Viewer: ${viewerPath}`);
        console.log(`\n💡 Open in browser: open ${viewerPath}`);
      }
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

// Parse flags first (before extracting positional arguments)
let enableAudit = false;
let enableViewer = false;
let seedValue: number | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--audit') {
    enableAudit = true;
  } else if (args[i] === '--viewer') {
    enableViewer = true;
  } else if (args[i] === '--seed' && args[i + 1]) {
    seedValue = parseInt(args[i + 1], 10);
    i++;
  }
}

// Extract positional arguments (skip flags)
const positionalArgs = args.filter(arg => !arg.startsWith('--'));
const command = positionalArgs[0];

if (command === '--interactive' || command === '-i') {
  runInteractive();
} else if (command === '--render-report' || command === '-r') {
  const reportPath = args[1];
  if (!reportPath) {
    console.error('Missing report path. Usage: npm run ai-battle -- -r generated/ai-battle-reports/<file>.json');
    process.exit(1);
  }
  try {
    renderBattleReportFile(reportPath);
  } catch (error) {
    console.error('\n❌ Report rendering failed with error:');
    console.error(error);
    process.exit(1);
  }
} else if (command === '--validate' || command === '-v') {
  const sizeArg = (args[1] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(args[2], 10);
  const runsParsed = parseInt(args[3], 10);
  const seedParsed = parseInt(args[4], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const runsArg = Number.isFinite(runsParsed) ? runsParsed : 3;
  const seedArg = Number.isFinite(seedParsed) ? seedParsed : 424242;
  const lighting = parseLightingArg(args[5]);
  const loadoutProfile = parseLoadoutProfileArg(args[6]);
  const doctrinePair = parseDoctrinePairArgs(
    args[7],
    args[8],
    loadoutProfile === 'melee_only' ? TacticalDoctrine.Juggernaut : TacticalDoctrine.Operative
  );
  const missionId = parseMissionIdArg(args[9], parseMissionIdArg(args[8], 'QAI_11'));
  const gameSize = parseGameSizeArg(sizeArg);
  runValidationBatch(gameSize, densityArg, runsArg, seedArg, lighting, doctrinePair, loadoutProfile, missionId).catch((error) => {
    console.error('\n❌ Validation failed with error:');
    console.error(error);
    process.exit(1);
  });
} else if (command === '--help' || command === '-h') {
  console.log(`
AI Battle Setup - MEST Tactics

Usage:
  npm run ai-battle                    # Quick battle (VERY_LARGE, density 50)
  npm run ai-battle -- -i              # Interactive setup
  npm run ai-battle -- -r REPORT_PATH
  npm run ai-battle -- -v SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA[,DOCTRINE_BRAVO]] [MISSION_ID]
  npm run ai-battle -- -v SIZE DENSITY RUNS SEED [LIGHTING] [LOADOUT_PROFILE] [DOCTRINE_ALPHA] [DOCTRINE_BRAVO] [MISSION_ID]
  npm run ai-battle -- SIZE DENSITY [LIGHTING]    # Quick battle with custom params

Visual Audit Options:
  npm run ai-battle -- --audit         # Enable audit capture
  npm run ai-battle -- --viewer        # Generate HTML viewer
  npm run ai-battle -- --audit --viewer --seed 12345  # Audit + viewer with seed
  npm run ai-battle -- very-small --audit --viewer  # VERY_SMALL with viewer

Game Sizes: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE
Lighting: DAY (default) | TWILIGHT
Loadout Profile: DEFAULT (default) | MELEE_ONLY
Doctrine: Any tactical doctrine id (default: OPERATIVE, or JUGGERNAUT for MELEE_ONLY)

Examples:
  npm run ai-battle -- VERY_LARGE 50   # Large battle, 50% terrain
  npm run ai-battle -- VERY_LARGE 50 TWILIGHT
  npm run ai-battle -- SMALL 30        # Small battle, 30% terrain
  npm run ai-battle -- very-small --audit --viewer  # Quick battle with visual audit
  npm run ai-battle -- --audit --viewer --seed 424242  # Audit with reproducible seed
  npm run ai-battle -- -v SMALL 50 1 424242 DAY MELEE_ONLY
  npm run ai-battle -- -v SMALL 50 1 424242 DAY MELEE_ONLY juggernaut
  npm run ai-battle -- -v SMALL 50 1 424242 DAY DEFAULT operative,watchman QAI_11
  npm run ai-battle -- -v SMALL 50 1 424242 DAY DEFAULT operative watchman QAI_20
  npm run ai-battle -- -r generated/ai-battle-reports/battle-report-<ts>.json
  npm run ai-battle -- -v VERY_LARGE 50 5 424242 TWILIGHT
`);
} else {
  // Default: run quick battle with VERY_LARGE and density 50
  const sizeArg = (positionalArgs[0] || 'VERY_LARGE').toUpperCase();
  const densityParsed = parseInt(positionalArgs[1], 10);
  const densityArg = Number.isFinite(densityParsed) ? densityParsed : 50;
  const lighting = parseLightingArg(positionalArgs[2]);
  const gameSize = parseGameSizeArg(sizeArg);
  runQuickBattle(gameSize, 'QAI_11', densityArg, lighting, enableAudit, enableViewer, seedValue);
}

#!/usr/bin/env node
/**
 * Battle Runner CLI
 *
 * Unified battle runner for MEST Tactics AI vs AI battles.
 *
 * Usage:
 *   npx tsx scripts/run-battles/                    # Run default VERY_SMALL battle
 *   npx tsx scripts/run-battles/ --config small     # Run specific config
 *   npx tsx scripts/run-battles/ --config-file path/to/config.json  # Custom JSON config
 *   npx tsx scripts/run-battles/ --help             # Show help
 */

import { readFileSync } from 'node:fs';
import { runBattle, type BattleRunnerConfig as BattleConfig } from './battle-runner';
import { VERY_SMALL_CONFIG } from './configs/very-small';
import { LIGHTING_PRESETS } from './lighting-presets';
import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { InstrumentationGrade } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';

// ============================================================================
// Config Loader
// ============================================================================

const CONFIGS: Record<string, () => Promise<BattleConfig>> = {
  'very-small': async () => (await import('./configs/very-small')).VERY_SMALL_CONFIG,
  'small': async () => (await import('./configs/small')).SMALL_CONFIG,
  'medium': async () => (await import('./configs/medium')).MEDIUM_CONFIG,
  'large': async () => (await import('./configs/large')).LARGE_CONFIG,
  'very-large': async () => (await import('./configs/very-large')).VERY_LARGE_CONFIG,
  'convergence-3side': async () => (await import('./configs/convergence-3side')).CONVERGENCE_3SIDE_CONFIG,
  'trinity': async () => (await import('./configs/trinity')).TRINITY_CONFIG,
  'trinity-4side': async () => (await import('./configs/trinity-4side')).TRINITY_4SIDE_CONFIG,
  'ai-stress-test': async () => (await import('./configs/ai-stress-test')).AI_STRESS_TEST_CONFIG,
};

// ============================================================================
// CLI Parser
// ============================================================================

function printHelp() {
  console.log(`
Battle Runner - AI vs AI Battle Simulation

Usage:
  npx tsx scripts/run-battles/ [options]

Options:
  --config <name>          Battle configuration preset
                           Options: very-small, small, medium, large, very-large,
                                    convergence-3side, trinity, trinity-4side, ai-stress-test
                           Default: very-small

  --config-file <path>     Custom JSON configuration file path
                           Overrides --config option

  --gameSize <size>        Game size (overrides config)
                           Options: VERY_SMALL, SMALL, MEDIUM, LARGE, VERY_LARGE

  --mission <id>           Mission ID (overrides config)
                           Options: QAI_11, QAI_12, QAI_13, QAI_14, QAI_15,
                                    QAI_16, QAI_17, QAI_18, QAI_19, QAI_20

  --terrain <density>      Terrain density percentage 0-100 (overrides config)

  --lighting <preset>      Lighting preset (overrides config)
                           Options: "Day, Clear", "Day, Hazy", "Twilight, Clear",
                                    "Night, Full Moon", "Night, Half Moon", "Pitch-black"

  --instrumentation <0-5>  Instrumentation detail level (overrides config)
                           0=None, 1=Summary, 2=By Action, 3=With Tests,
                           4=With Dice, 5=Full Detail

  --output <format>        Output format
                           Options: console, json, both
                           Default: console

  --seed <number>          Random seed for reproducible battles

  --audit                  Enable visual audit capture (generates audit.json)
  --viewer                 Generate HTML battle report viewer (implies --audit)

  --help                   Show this help message

Examples:
  # Default VERY_SMALL battle (QAI_11 Elimination)
  npx tsx scripts/run-battles/

  # SMALL battle
  npx tsx scripts/run-battles/ --config small

  # Custom MEDIUM battle with night lighting
  npx tsx scripts/run-battles/ --gameSize MEDIUM --lighting "Night, Full Moon"

  # QAI_12 Convergence mission
  npx tsx scripts/run-battles/ --mission QAI_12

  # Full detail instrumentation with JSON output
  npx tsx scripts/run-battles/ --instrumentation 5 --output json

  # Custom JSON configuration file
  npx tsx scripts/run-battles/ --config-file my-battle.json

  # Reproducible battle with seed
  npx tsx scripts/run-battles/ --seed 424242

  # VERY_SMALL battle with visual audit
  npx tsx scripts/run-battles/ --config very-small --audit --viewer
`);
}

type OutputFormat = 'console' | 'json' | 'both';

interface ParseResult {
  configName: string;
  configFile?: string;
  overrides: Partial<BattleConfig>;
  outputFormat: OutputFormat;
}

async function parseArgs(): Promise<ParseResult> {
  const args = process.argv.slice(2);
  let configName = 'very-small';
  let configFile: string | undefined;
  const overrides: Partial<BattleConfig> = {};
  let outputFormat: OutputFormat = 'console';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--config':
        configName = value;
        i++;
        break;
      case '--config-file':
        configFile = value;
        i++;
        break;
      case '--gameSize':
        overrides.gameSize = GameSize[value as keyof typeof GameSize];
        i++;
        break;
      case '--mission':
        overrides.missionId = value;
        i++;
        break;
      case '--terrain':
        // Convert percentage (0-100) to decimal (0.0-1.0)
        overrides.terrainDensity = parseInt(value, 10) / 100;
        i++;
        break;
      case '--lighting':
        overrides.lighting = LIGHTING_PRESETS[value];
        i++;
        break;
      case '--instrumentation':
        overrides.instrumentationGrade = parseInt(value, 10) as InstrumentationGrade;
        i++;
        break;
      case '--output':
        if (value === 'console' || value === 'json' || value === 'both') {
          outputFormat = value;
        } else {
          console.error(`Invalid output format: ${value}. Use: console, json, both`);
          process.exit(1);
        }
        i++;
        break;
      case '--seed':
        overrides.seed = parseInt(value, 10);
        i++;
        break;
      case '--audit':
        overrides.audit = true;
        break;
      case '--viewer':
        overrides.viewer = true;
        overrides.audit = true; // viewer implies audit
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return { configName, configFile, overrides, outputFormat };
}

// ============================================================================
// Main Entry Point
// ============================================================================

function loadJsonConfig(filePath: string): BattleConfig {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as BattleConfig;
    return config;
  } catch (error) {
    console.error(`Failed to load config file: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  try {
    const { configName, configFile, overrides, outputFormat } = await parseArgs();

    // Load config
    let config: BattleConfig;
    if (configFile) {
      config = loadJsonConfig(configFile);
    } else {
      const configLoader = CONFIGS[configName];
      if (!configLoader) {
        console.error(`Unknown configuration: ${configName}`);
        console.error(`Available configs: ${Object.keys(CONFIGS).join(', ')}`);
        process.exit(1);
      }
      config = await configLoader();
    }

    // Apply overrides
    config = {
      ...config,
      ...overrides,
    };

    // Run battle
    const runner = new (await import('./battle-runner')).BattleRunner(config);
    const result = await runner.run();

    // Output results based on format
    if (outputFormat === 'json' || outputFormat === 'both') {
      console.log('\n--- JSON OUTPUT ---');
      const jsonOutput = JSON.stringify({
        battleId: result.battleId,
        config: result.config,
        turnsPlayed: result.turnsPlayed,
        gameEnded: result.gameEnded,
        endGameReason: result.endGameReason,
        vpBySide: result.vpBySide,
        winnerSide: result.winnerSide,
        stats: result.stats,
        keys: result.keys,
        log: result.log, // Include full battle log with initiative tracking (grade 2+)
      }, null, 2);
      console.log(jsonOutput);
      if (outputFormat === 'json') {
        return;
      }
    }

    if (outputFormat === 'console' || outputFormat === 'both') {
      // Print final result
      console.log('═══════════════════════════════════════');
      console.log('🏆 FINAL RESULT');
      console.log('═══════════════════════════════════════');
      
      if (result.winnerSide) {
        const reasonText = result.winnerReason ? ` (${result.winnerReason === 'vp' ? 'Victory Points' : result.winnerReason === 'rp' ? 'Resource Points tie-break' : result.winnerReason})` : '';
        console.log(`🏅 Winner: ${result.winnerSide}${reasonText}`);
      } else if (result.tieSideIds && result.tieSideIds.length > 0) {
        console.log(`🤝 Result: Tie`);
        console.log(`   Tied sides: ${result.tieSideIds.join(', ')}`);
        console.log(`   Tie-break: ${result.winnerReason === 'rp' ? 'RP tie-break failed (still tied)' : 'No tie-break applied'}`);
      } else {
        console.log(`🤝 Result: Tie`);
      }
      
      console.log(`Turns: ${result.turnsPlayed}`);
      console.log(`End Reason: ${result.endGameReason}`);
      console.log('');
    }

  } catch (error) {
    console.error('Battle failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
main();

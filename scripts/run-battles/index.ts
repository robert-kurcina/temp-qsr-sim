#!/usr/bin/env node
/**
 * Battle Runner CLI
 * 
 * Unified battle runner for MEST Tactics AI vs AI battles.
 * 
 * Usage:
 *   npx tsx scripts/run-battles/                    # Run default VERY_SMALL battle
 *   npx tsx scripts/run-battles/ --config small     # Run specific config
 *   npx tsx scripts/run-battles/ --help             # Show help
 */

import { runBattle, type BattleConfig } from './battle-runner';
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
  // Additional configs will be added as they're created
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
                                    duel-1v1, duel-4v4, qai-11-elimination
                           Default: very-small

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

  # Full detail instrumentation
  npx tsx scripts/run-battles/ --instrumentation 5
`);
}

async function parseArgs(): Promise<{ configName: string; overrides: Partial<BattleConfig> }> {
  const args = process.argv.slice(2);
  let configName = 'very-small';
  const overrides: Partial<BattleConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--config':
        configName = value;
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
        overrides.terrainDensity = parseInt(value, 10);
        i++;
        break;
      case '--lighting':
        overrides.lighting = LIGHTING_PRESETS[value];
        i++;
        break;
      case '--instrumentation':
        overrides.instrumentation = {
          grade: parseInt(value, 10) as InstrumentationGrade,
          outputFormat: 'console',
          verbose: true,
        };
        i++;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return { configName, overrides };
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  try {
    const { configName, overrides } = await parseArgs();

    // Load config
    const configLoader = CONFIGS[configName];
    if (!configLoader) {
      console.error(`Unknown configuration: ${configName}`);
      console.error(`Available configs: ${Object.keys(CONFIGS).join(', ')}`);
      process.exit(1);
    }

    let config = await configLoader();

    // Apply overrides
    config = {
      ...config,
      ...overrides,
      instrumentation: {
        ...config.instrumentation,
        ...(overrides.instrumentation || {}),
      },
    };

    // Run battle
    const result = await runBattle(config);

    // Print final result
    console.log('═══════════════════════════════════════');
    console.log('🏆 FINAL RESULT');
    console.log('═══════════════════════════════════════');
    console.log(`Winner: ${result.winner}`);
    console.log(`Turns: ${result.turnsCompleted}`);
    console.log(`End Reason: ${result.endReason}`);
    console.log('');

  } catch (error) {
    console.error('Battle failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
main();

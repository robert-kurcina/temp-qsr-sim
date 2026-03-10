import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import type { BattleRunnerConfig as BattleConfig } from './types';
import { LIGHTING_PRESETS } from './lighting-presets';

export type OutputFormat = 'console' | 'json' | 'both';

export interface ParseResult {
  configName: string;
  configFile?: string;
  overrides: Partial<BattleConfig>;
  outputFormat: OutputFormat;
  showHelp: boolean;
}

export class RunBattlesCliError extends Error {}

export function printRunBattlesHelp(): void {
  console.log(`
Battle Runner - AI vs AI Battle Simulation

Usage:
  npm run run-battles -- [options]

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
                           Used only when no pre-generated battlefield JSON is available

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

  --battlefield <path>     Explicit battlefield JSON path
                           If omitted, defaults to data/battlefields/default/simple/<SIZE>-battlefield_A0-B0-W0-R0-S0-T0.json

  --audit                  Enable visual audit capture (generates audit.json)
  --viewer                 Generate HTML battle report viewer (implies --audit)

  --help                   Show this help message

Examples:
  # Default VERY_SMALL battle (QAI_11 Elimination)
  npm run run-battles --

  # SMALL battle
  npm run run-battles -- --config small

  # Custom MEDIUM battle with night lighting
  npm run run-battles -- --gameSize MEDIUM --lighting "Night, Full Moon"

  # QAI_12 Convergence mission
  npm run run-battles -- --mission QAI_12

  # Full detail instrumentation with JSON output
  npm run run-battles -- --instrumentation 5 --output json

  # Custom JSON configuration file
  npm run run-battles -- --config-file my-battle.json

  # Reproducible battle with seed
  npm run run-battles -- --seed 424242

  # VERY_SMALL battle with visual audit
  npm run run-battles -- --config very-small --audit --viewer
`);
}

export function parseRunBattlesCliArgs(args: string[]): ParseResult {
  let configName = 'very-small';
  let configFile: string | undefined;
  const overrides: Partial<BattleConfig> = {};
  let outputFormat: OutputFormat = 'console';
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--config':
        if (value) {
          configName = value;
          i++;
        }
        break;
      case '--config-file':
        if (value) {
          configFile = value;
          i++;
        }
        break;
      case '--gameSize':
        if (value) {
          overrides.gameSize = GameSize[value as keyof typeof GameSize];
          i++;
        }
        break;
      case '--mission':
        if (value) {
          overrides.missionId = value;
          i++;
        }
        break;
      case '--terrain':
        if (value) {
          overrides.terrainDensity = Number.parseInt(value, 10) / 100;
          i++;
        }
        break;
      case '--lighting':
        if (value) {
          overrides.lighting = LIGHTING_PRESETS[value];
          i++;
        }
        break;
      case '--instrumentation':
        if (value) {
          overrides.instrumentationGrade = Number.parseInt(value, 10) as InstrumentationGrade;
          i++;
        }
        break;
      case '--output':
        if (!value || (value !== 'console' && value !== 'json' && value !== 'both')) {
          throw new RunBattlesCliError(`Invalid output format: ${String(value)}. Use: console, json, both`);
        }
        outputFormat = value;
        i++;
        break;
      case '--seed':
        if (value) {
          overrides.seed = Number.parseInt(value, 10);
          i++;
        }
        break;
      case '--battlefield':
        if (value) {
          overrides.battlefieldPath = value;
          i++;
        }
        break;
      case '--audit':
        overrides.audit = true;
        break;
      case '--viewer':
        overrides.viewer = true;
        overrides.audit = true;
        break;
      case '--help':
      case '-h':
        showHelp = true;
        break;
    }
  }

  return {
    configName,
    configFile,
    overrides,
    outputFormat,
    showHelp,
  };
}

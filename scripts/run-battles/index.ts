#!/usr/bin/env node
/**
 * Battle Runner CLI
 *
 * Unified battle runner for MEST Tactics AI vs AI battles.
 *
 * Usage:
 *   npm run run-battles --                          # Run default VERY_SMALL battle
 *   npm run run-battles -- --config small           # Run specific config
 *   npm run run-battles -- --config-file path/to/config.json  # Custom JSON config
 *   npm run run-battles -- --help                   # Show help
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { BattleRunnerConfig as BattleConfig } from './types';
import type { LightingCondition } from '../../src/lib/mest-tactics/utils/visibility';
import { AIBattleRunner } from '../ai-battle/AIBattleRunner';
import { type GameConfig } from '../shared/AIBattleConfig';
import type { BattleReport } from '../shared/BattleReportTypes';
import { writeBattleArtifacts } from '../ai-battle/reporting/BattleReportWriter';
import {
  buildCanonicalGameConfig,
  mapDoctrine,
  MISSION_NAME_BY_ID,
  toCanonicalSideConfig,
} from '../shared/CanonicalBattleConfigAdapter';
import {
  parseRunBattlesCliArgs,
  printRunBattlesHelp,
  RunBattlesCliError,
  type OutputFormat,
  type ParseResult,
} from './RunBattlesCliParser';

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

export { mapDoctrine, toCanonicalSideConfig };

export function toCanonicalGameConfig(config: BattleConfig, outputFormat: OutputFormat): GameConfig {
  return buildCanonicalGameConfig({
    missionId: String(config.missionId || 'QAI_11'),
    missionName: MISSION_NAME_BY_ID[String(config.missionId || 'QAI_11')] ?? String(config.missionId || 'QAI_11'),
    gameSize: config.gameSize,
    sides: config.sides.map(side => toCanonicalSideConfig(side, config.gameSize)),
    densityRatio: Number(config.terrainDensity),
    lighting: (config.lighting?.name || 'Day, Clear') as LightingCondition,
    allowWaitAction: config.allowWaitAction,
    allowHideAction: config.allowHideAction,
    verbose: outputFormat !== 'json',
    seed: config.seed,
    audit: config.audit,
    viewer: config.viewer,
    battlefieldPath: config.battlefieldPath,
  });
}

export function resolveLegacyEndGameReason(report: BattleReport): 'trigger' | 'elimination' | 'max-turn' | 'mission-immediate' {
  const turnsPlayed = Number(report.stats?.turnsCompleted ?? 0);
  const maxTurns = Number(report.config?.maxTurns ?? turnsPlayed);
  const sidesWithModels = Array.isArray(report.finalCounts)
    ? report.finalCounts.filter(count => Number(count.remaining ?? 0) > 0).length
    : 0;

  if (report.missionRuntime?.immediateWinnerSideId) {
    return 'mission-immediate';
  }
  if (sidesWithModels <= 1) {
    return 'elimination';
  }
  if (turnsPlayed >= maxTurns) {
    return 'max-turn';
  }
  return 'trigger';
}

export function toLegacyJsonOutput(report: BattleReport): Record<string, unknown> {
  const winner = report.winner && report.winner !== 'Draw' && report.winner !== 'None' ? report.winner : null;
  return {
    battleId: `battle-${report.config.gameSize}-${Date.now()}`,
    config: report.config,
    turnsPlayed: report.stats.turnsCompleted,
    gameEnded: true,
    endGameReason: resolveLegacyEndGameReason(report),
    vpBySide: report.missionRuntime?.vpBySide ?? {},
    rpBySide: report.missionRuntime?.rpBySide ?? {},
    winnerSide: winner,
    stats: report.stats,
    keys: {},
    log: report.log,
  };
}

async function parseArgs(): Promise<ParseResult> {
  const parsed = parseRunBattlesCliArgs(process.argv.slice(2));
  if (parsed.showHelp) {
    printRunBattlesHelp();
    process.exit(0);
  }
  return parsed;
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

export async function main() {
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

    // Run canonical battle executor (AIBattleRunner)
    const canonicalConfig = toCanonicalGameConfig(config, outputFormat);
    const runner = new AIBattleRunner();
    const report = await runner.runBattle(canonicalConfig, {
      seed: canonicalConfig.seed,
      suppressOutput: outputFormat === 'json',
    });

    const artifacts = writeBattleArtifacts(report, {
      audit: canonicalConfig.audit || canonicalConfig.viewer,
      viewer: canonicalConfig.viewer,
    });
    if (artifacts.auditPath && outputFormat !== 'json') {
      console.log(`🎬 Visual Audit: ${artifacts.auditPath}`);
    }
    if (artifacts.viewerPath && outputFormat !== 'json') {
      console.log(`📺 HTML Viewer: ${artifacts.viewerPath}`);
    }
    if (outputFormat !== 'json') {
      console.log(`📁 JSON Report: ${artifacts.reportPath}`);
    }

    // Output results based on format
    if (outputFormat === 'json' || outputFormat === 'both') {
      console.log('\n--- JSON OUTPUT ---');
      console.log(JSON.stringify(toLegacyJsonOutput(report), null, 2));
      if (outputFormat === 'json') {
        return;
      }
    }

    if (outputFormat === 'console' || outputFormat === 'both') {
      const winner = report.winner && report.winner !== 'Draw' && report.winner !== 'None' ? report.winner : null;
      console.log('═══════════════════════════════════════');
      console.log('🏆 FINAL RESULT');
      console.log('═══════════════════════════════════════');
      if (winner) {
        console.log(`🏅 Winner: ${winner}`);
      } else {
        console.log('🤝 Result: Tie');
      }
      console.log(`Turns: ${report.stats.turnsCompleted}`);
      const vpBySide = report.missionRuntime?.vpBySide ?? {};
      if (Object.keys(vpBySide).length > 0) {
        console.log(`VP by Side: ${Object.entries(vpBySide).map(([side, vp]) => `${side}=${vp}`).join(', ')}`);
      }
      console.log('');
    }

  } catch (error) {
    if (error instanceof RunBattlesCliError) {
      console.error(error.message);
      process.exit(1);
      return;
    }
    console.error('Battle failed:', error);
    process.exit(1);
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint) return false;
  return import.meta.url === pathToFileURL(entrypoint).href;
}

// Run if executed directly
if (isMainModule()) {
  main();
}

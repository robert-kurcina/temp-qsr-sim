#!/usr/bin/env node
/**
 * Battle compatibility wrapper.
 *
 * Non-terrain runs delegate to canonical AIBattleRunner.
 * Terrain-only runs generate battlefield SVG artifacts without executing a battle.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { loadBattlefieldFromFile } from '../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { GameSize } from '../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { AIBattleRunner } from './ai-battle/AIBattleRunner';
import { GAME_SIZE_CONFIG, type GameConfig } from './ai-battle/AIBattleConfig';
import { writeBattleArtifacts } from './ai-battle/reporting/BattleReportWriter';
import { buildCanonicalGameConfig, createDefaultHeadToHeadSides } from './shared/CanonicalBattleConfigAdapter';
import { getDefaultSimpleBattlefieldPath } from './shared/BattlefieldPaths';

interface BattleCliConfig {
  gameSize: GameSize;
  density: number;
  terrainOnly: boolean;
  audit: boolean;
  viewer: boolean;
  seed?: number;
  battlefieldPath?: string;
}

function createOutputDir(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(process.cwd(), 'generated', 'battle-reports', `battle-report-${timestamp}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function parseArgs(argv: string[] = process.argv.slice(2)): BattleCliConfig {
  const config: BattleCliConfig = {
    gameSize: GameSize.VERY_SMALL,
    density: 0.5,
    terrainOnly: false,
    audit: false,
    viewer: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];

    switch (arg) {
      case '--config': {
        const mapped = value ? GameSize[value.toUpperCase() as keyof typeof GameSize] : undefined;
        if (mapped) {
          config.gameSize = mapped;
        }
        i++;
        break;
      }
      case '--audit':
        config.audit = true;
        break;
      case '--viewer':
        config.viewer = true;
        config.audit = true;
        break;
      case '--terrain-only':
        config.terrainOnly = true;
        break;
      case '--seed': {
        const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
        if (Number.isFinite(parsed)) {
          config.seed = parsed;
        }
        i++;
        break;
      }
      case '--density': {
        const parsed = value ? Number.parseFloat(value) : Number.NaN;
        if (Number.isFinite(parsed)) {
          config.density = Math.max(0, Math.min(1, parsed));
        }
        i++;
        break;
      }
      case '--battlefield':
        config.battlefieldPath = value;
        i++;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
      default:
        break;
    }
  }

  return config;
}

function showHelp(): void {
  console.log(`
Unified Battle Runner - MEST Tactics

Usage:
  npx tsx scripts/battle.ts [options]

Options:
  --config <size>      Game size: VERY_SMALL (default), SMALL, MEDIUM, LARGE, VERY_LARGE
  --audit              Enable audit capture
  --viewer             Generate HTML viewer
  --terrain-only       Generate terrain only, skip battle
  --seed <number>      Random seed for reproducibility
  --density <0-1>      Terrain density (default: 0.5)
  --battlefield <path> Load battlefield JSON export instead of generating terrain
  --help               Show this help message

Examples:
  npx tsx scripts/battle.ts
  npx tsx scripts/battle.ts --config small
  npx tsx scripts/battle.ts --audit --viewer
  npx tsx scripts/battle.ts --terrain-only --seed 42
  npx tsx scripts/battle.ts --battlefield data/battlefields/default/simple/VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json
`);
}

function toCanonicalBattleConfig(config: BattleCliConfig): GameConfig {
  return buildCanonicalGameConfig({
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: config.gameSize,
    sides: createDefaultHeadToHeadSides(config.gameSize, TacticalDoctrine.Balanced),
    densityRatio: config.density,
    lighting: 'Day, Clear',
    allowWaitAction: false,
    allowHideAction: false,
    verbose: true,
    seed: config.seed,
    audit: config.audit,
    viewer: config.viewer,
    battlefieldPath: config.battlefieldPath,
  });
}

async function runCanonicalBattle(config: BattleCliConfig): Promise<void> {
  const canonicalConfig = toCanonicalBattleConfig(config);
  const runner = new AIBattleRunner();
  const report = await runner.runBattle(canonicalConfig, {
    seed: canonicalConfig.seed,
    suppressOutput: false,
  });

  const artifacts = writeBattleArtifacts(report, {
    audit: canonicalConfig.audit || canonicalConfig.viewer,
    viewer: canonicalConfig.viewer,
  });
  if (artifacts.auditPath) {
    console.log(`🎬 Visual Audit: ${artifacts.auditPath}`);
  }
  if (artifacts.viewerPath) {
    console.log(`📺 HTML Viewer: ${artifacts.viewerPath}`);
  }

  console.log(`📁 JSON Report: ${artifacts.reportPath}`);
}

function createBattlefield(config: BattleCliConfig): Battlefield {
  const explicitPath = config.battlefieldPath;
  const defaultPath = getDefaultSimpleBattlefieldPath(config.gameSize);
  const resolvedPath = explicitPath ?? defaultPath;

  if (resolvedPath) {
    return loadBattlefieldFromFile(resolvedPath);
  }

  const sizeConfig = GAME_SIZE_CONFIG[config.gameSize];
  const terrain = placeTerrain({
    mode: 'balanced',
    density: config.density * 100,
    battlefieldWidth: sizeConfig.battlefieldWidth,
    battlefieldHeight: sizeConfig.battlefieldHeight,
    seed: config.seed,
    terrainTypes: ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'],
  });

  const battlefield = new Battlefield(sizeConfig.battlefieldWidth, sizeConfig.battlefieldHeight);
  for (const feature of terrain.terrain) {
    battlefield.addTerrain(feature, true);
  }
  battlefield.finalizeTerrain();
  return battlefield;
}

function writeTerrainOnlyArtifacts(config: BattleCliConfig): void {
  const battlefield = createBattlefield(config);
  const outputDir = createOutputDir();
  const svg = SvgRenderer.render(battlefield, {
    width: battlefield.width,
    height: battlefield.height,
    gridResolution: 0.5,
    title: `QAI_11 - ${config.gameSize}`,
  });
  const svgPath = join(outputDir, 'battlefield.svg');
  writeFileSync(svgPath, svg, 'utf-8');

  console.log('✅ Terrain-only mode completed.');
  console.log(`📁 Battlefield SVG: ${svgPath}`);
}

async function main(): Promise<void> {
  const config = parseArgs();

  if (config.terrainOnly) {
    writeTerrainOnlyArtifacts(config);
    return;
  }

  await runCanonicalBattle(config);
}

main().catch(error => {
  console.error('\n❌ Battle failed with error:');
  console.error(error);
  process.exit(1);
});

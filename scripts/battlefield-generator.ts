/**
 * Battlefield Generator
 *
 * Generates battlefields with CLI-style layer tokens (A/B/W/R/S/T).
 * Used by the Battlefield Audit Dashboard POST /api/battlefields/generate endpoint.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { exportBattlefield } from '../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { placeTerrain, type TerrainPlacementOptions, type TerrainPlacementResult } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { CANONICAL_GAME_SIZES, type CanonicalGameSize } from '../src/lib/mest-tactics/mission/game-size-canonical';
import {
  EMPTY_BATTLEFIELD_DENSITIES,
  ensureBattlefieldDirectories,
  formatBattlefieldDensityFilename,
  getGeneratedBattlefieldDir,
  type BattlefieldDensityConfig,
} from './shared/BattlefieldPaths';
import { parseBattlefieldLayerArgs as parseLayerTokens } from './shared/BattlefieldLayerTokens';
import { parseBattlefieldGenerateArgs as parseBattlefieldGenerateCliArgs } from './shared/BattlefieldGenerateCli';
import { printBattlefieldGenerateHelp } from './shared/BattlefieldGenerateHelp';
import { writeBattlefieldSvgFile } from './shared/BattlefieldSvg';


export interface BattlefieldGenerationConfig {
  gameSize: CanonicalGameSize;
  args?: string[];
  mode?: TerrainPlacementOptions['mode'];
  seed?: number;
}

export interface BattlefieldGenerationResult {
  success: boolean;
  battlefieldId: string;
  svgPath: string;
  jsonPath: string;
  battlefieldPath: string;
  stats: {
    totalTerrain: number;
    byCategory: Record<string, number>;
    fitnessScore: number;
    coverageRatio: number;
    densities: BattlefieldDensityConfig;
  };
  generationTimeMs: number;
  error?: string;
}

export function parseBattlefieldLayerArgs(args: string[] = []): BattlefieldDensityConfig {
  return parseLayerTokens(args, token => {
    console.warn(`[battlefield-generator] Ignoring unrecognized layer token: ${token}`);
  });
}

function densitiesToLayerArgs(densities: BattlefieldDensityConfig): string[] {
  return [
    `A${densities.area}`,
    `B${densities.buildings}`,
    `W${densities.walls}`,
    `R${densities.rocks}`,
    `S${densities.shrubs}`,
    `T${densities.trees}`,
  ];
}

function buildTerrainTypes(densities: BattlefieldDensityConfig): string[] {
  const terrainTypes: string[] = [];
  if (densities.area > 0) {
    terrainTypes.push('Small Rough Patch', 'Medium Rough Patch', 'Large Rough Patch');
  }
  if (densities.buildings > 0) {
    terrainTypes.push('Small Building', 'Medium Building');
  }
  if (densities.walls > 0) {
    terrainTypes.push('Short Wall', 'Medium Wall');
  }
  if (densities.rocks > 0) {
    terrainTypes.push('Small Rocks', 'Medium Rocks', 'Large Rocks');
  }
  if (densities.shrubs > 0) {
    terrainTypes.push('Shrub');
  }
  if (densities.trees > 0) {
    terrainTypes.push('Tree');
  }
  return terrainTypes;
}

function polygonArea(vertices: Array<{ x: number; y: number }>): number {
  if (!vertices || vertices.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
}

function calculateGenerationStats(
  battlefield: Battlefield,
  terrainResult: TerrainPlacementResult,
  densities: BattlefieldDensityConfig
): BattlefieldGenerationResult['stats'] {
  const byCategory: Record<string, number> = {
    area: 0,
    building: 0,
    wall: 0,
    tree: 0,
    rocks: 0,
    shrub: 0,
  };

  let terrainArea = 0;
  for (const feature of terrainResult.terrain) {
    const category = feature.meta?.category;
    if (feature.type === 'Rough' || feature.type === 'Difficult') {
      byCategory.area++;
    } else if (category === 'building') {
      byCategory.building++;
    } else if (category === 'wall') {
      byCategory.wall++;
    } else if (category === 'tree') {
      byCategory.tree++;
    } else if (category === 'rocks') {
      byCategory.rocks++;
    } else if (category === 'shrub') {
      byCategory.shrub++;
    }
    terrainArea += polygonArea(feature.vertices ?? []);
  }

  const battlefieldArea = battlefield.width * battlefield.height;
  const coverageRatio = battlefieldArea > 0 ? terrainArea / battlefieldArea : 0;

  return {
    totalTerrain: terrainResult.stats.placed,
    byCategory,
    fitnessScore: terrainResult.fitness?.score ?? 100,
    coverageRatio: Math.round(coverageRatio * 1000) / 1000,
    densities,
  };
}

export async function generateBattlefield(
  config: BattlefieldGenerationConfig
): Promise<BattlefieldGenerationResult> {
  const startTime = Date.now();

  try {
    const normalizedSize = String(config.gameSize || '').toUpperCase();
    const gameSize: CanonicalGameSize = (
      normalizedSize in CANONICAL_GAME_SIZES ? normalizedSize : 'VERY_SMALL'
    ) as CanonicalGameSize;

    ensureBattlefieldDirectories([gameSize]);
    const outputDir = getGeneratedBattlefieldDir(gameSize);
    mkdirSync(outputDir, { recursive: true });

    const canonical = CANONICAL_GAME_SIZES[gameSize] ?? CANONICAL_GAME_SIZES.SMALL;
    const densities = parseBattlefieldLayerArgs(config.args ?? []);
    const filenameBase = formatBattlefieldDensityFilename(densities);
    const terrainTypes = buildTerrainTypes(densities);
    const mode = config.mode ?? 'balanced';

    const terrainResult = placeTerrain({
      mode,
      density: 0,
      battlefieldWidth: canonical.battlefieldWidthMU,
      battlefieldHeight: canonical.battlefieldHeightMU,
      seed: config.seed,
      terrainTypes,
      areaDensity: densities.area,
      structuresDensity: Math.max(densities.buildings, densities.walls),
      buildingsDensity: densities.buildings,
      wallsDensity: densities.walls,
      rocksDensity: densities.rocks,
      shrubsDensity: densities.shrubs,
      treesDensity: densities.trees,
    });

    const battlefield = new Battlefield(canonical.battlefieldWidthMU, canonical.battlefieldHeightMU);
    for (const feature of terrainResult.terrain) {
      battlefield.addTerrain(feature, true);
    }
    battlefield.finalizeTerrain();

    const jsonPath = exportBattlefield(
      battlefield,
      terrainResult,
      outputDir,
      `${filenameBase}.json`
    );
    const svgPath = join(outputDir, `${filenameBase}.svg`);
    writeBattlefieldSvgFile(svgPath, battlefield, {
      title: `${gameSize} ${filenameBase}`,
    });

    return {
      success: true,
      battlefieldId: `${gameSize}-${filenameBase}`,
      svgPath,
      jsonPath,
      battlefieldPath: jsonPath,
      stats: calculateGenerationStats(battlefield, terrainResult, densities),
      generationTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      battlefieldId: '',
      svgPath: '',
      jsonPath: '',
      battlefieldPath: '',
      stats: {
        totalTerrain: 0,
        byCategory: {},
        fitnessScore: 0,
        coverageRatio: 0,
        densities: { ...EMPTY_BATTLEFIELD_DENSITIES },
      },
      generationTimeMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

function parseCliArgs(argv: string[]): BattlefieldGenerationConfig {
  if (argv.includes('--help') || argv.includes('-h')) {
    printBattlefieldGenerateHelp({
      title: 'battlefield-generator',
      usageLine: 'node --import tsx scripts/battlefield-generator.ts [GAME_SIZE] [A#] [B#] [W#] [R#] [S#] [T#] [options]',
      notes: ['If multiple game sizes are provided, the first one is used.'],
      examples: [
        'node --import tsx scripts/battlefield-generator.ts VERY_SMALL A20 B40',
        'node --import tsx scripts/battlefield-generator.ts SMALL A17 B73 W50 --seed 42',
      ],
    });
    process.exit(0);
  }

  const parsed = parseBattlefieldGenerateCliArgs(argv, {
    onUnknownToken: token => {
      console.warn(`[battlefield-generator] Ignoring unrecognized token: ${token}`);
    },
  });
  const gameSize = (parsed.gameSizes[0] || 'VERY_SMALL') as CanonicalGameSize;

  if (parsed.gameSizes.length > 1) {
    console.warn(
      `[battlefield-generator] Multiple game sizes provided (${parsed.gameSizes.join(', ')}); using '${gameSize}'.`
    );
  }

  return {
    gameSize,
    mode: parsed.mode,
    seed: parsed.seed,
    args: densitiesToLayerArgs(parsed.densities),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = parseCliArgs(process.argv.slice(2));
  generateBattlefield(config).then(result => {
    if (!result.success) {
      console.error('❌ Battlefield generation failed');
      console.error(result.error ?? 'Unknown error');
      process.exit(1);
    }

    console.log('✅ Battlefield generated successfully');
    console.log(`  ID: ${result.battlefieldId}`);
    console.log(`  JSON: ${result.jsonPath}`);
    console.log(`  SVG: ${result.svgPath}`);
    console.log(`  Terrain: ${result.stats.totalTerrain}`);
    console.log(`  Coverage: ${(result.stats.coverageRatio * 100).toFixed(1)}%`);
    console.log(`  Densities: ${JSON.stringify(result.stats.densities)}`);
    console.log(`  Time: ${result.generationTimeMs}ms`);
  });
}

/**
 * Battlefield Generator
 *
 * Generates battlefields with custom terrain densities and game sizes.
 * Used by the Battlefield Audit Dashboard for interactive generation.
 */

import { BattlefieldFactory } from '../src/lib/mest-tactics/battlefield/rendering/BattlefieldFactory';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { exportBattlefield as exportBattlefieldToJson } from '../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { TerrainPlacementResult } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { CANONICAL_GAME_SIZES, type CanonicalGameSize } from '../src/lib/mest-tactics/mission/game-size-canonical';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface TerrainDensities {
  area: number;      // 0-100
  building: number;  // 0-100
  wall: number;      // 0-100
  tree: number;      // 0-100
  rocks: number;     // 0-100
  shrub: number;     // 0-100
}

export interface BattlefieldGenerationConfig {
  gameSize: CanonicalGameSize;
  terrainDensities: TerrainDensities;
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
  };
  generationTimeMs: number;
  error?: string;
}

const OUTPUT_DIR = join(process.cwd(), 'generated', 'battlefields');

/**
 * Generate a battlefield with custom terrain densities
 */
export async function generateBattlefield(
  config: BattlefieldGenerationConfig
): Promise<BattlefieldGenerationResult> {
  const startTime = Date.now();

  try {
    // Ensure output directory exists
    mkdirSync(OUTPUT_DIR, { recursive: true });

    // Get battlefield dimensions
    const canonicalSize = CANONICAL_GAME_SIZES[config.gameSize] ?? CANONICAL_GAME_SIZES.SMALL;
    const dimensions = {
      width: canonicalSize.battlefieldWidthMU,
      height: canonicalSize.battlefieldHeightMU,
    };

    // Convert terrain densities to BattlefieldFactory weights
    // Densities are 0-100, weights are relative importance
    const terrainWeights = {
      area: config.terrainDensities.area,
      building: config.terrainDensities.building,
      wall: config.terrainDensities.wall,
      tree: config.terrainDensities.tree,
      rocks: config.terrainDensities.rocks,
      shrub: config.terrainDensities.shrub,
    };

    // Calculate overall density ratio (average of non-area terrains)
    // If all densities are 0, use 0 (no terrain)
    const nonAreaDensity = (
      config.terrainDensities.building +
      config.terrainDensities.wall +
      config.terrainDensities.tree +
      config.terrainDensities.rocks +
      config.terrainDensities.shrub
    ) / 5;

    // Only apply density if user requested terrain (respect 0 setting)
    const effectiveDensity = nonAreaDensity > 0 ? Math.max(10, Math.min(100, nonAreaDensity)) : 0;
    const effectiveAreaDensity = config.terrainDensities.area > 0 ? Math.max(10, Math.min(100, config.terrainDensities.area)) : 0;

    // Create battlefield using factory
    const battlefield = BattlefieldFactory.create(dimensions.width, dimensions.height, {
      terrain: terrainWeights,
      densityRatio: effectiveDensity,
      areaDensityRatio: effectiveAreaDensity,
      maxNonAreaSpacing: 0.5,
      maxPlacementAttempts: 1000,
      maxFillerAttempts: 1000,
      maxPlacementMs: 30000,
    });

    // Generate SVG using static render method with proper dimensions
    const svg = SvgRenderer.render(battlefield, {
      width: battlefield.width,
      height: battlefield.height,
      title: `Generated Battlefield ${config.gameSize}`,
    });

    // Export battlefield JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const battlefieldId = `generated-${timestamp}`;

    // Create a minimal terrain result for export
    const terrainResult: TerrainPlacementResult = {
      terrain: battlefield.terrain,
      stats: {
        placed: battlefield.terrain.length,
        seed: config.seed ?? Math.floor(Math.random() * 1000000),
      },
      fitness: undefined,
    };

    const battlefieldJson = exportBattlefieldToJson(
      battlefield,
      terrainResult,
      OUTPUT_DIR,
      `${battlefieldId}.json`
    );

    // Save SVG
    const svgPath = join(OUTPUT_DIR, `${battlefieldId}.svg`);
    writeFileSync(svgPath, svg, 'utf-8');

    // Calculate stats
    const stats = calculateGenerationStats(battlefield, terrainResult);

    return {
      success: true,
      battlefieldId,
      svgPath,
      jsonPath: battlefieldJson,
      battlefieldPath: battlefieldJson,
      stats,
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
      },
      generationTimeMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Calculate generation statistics
 */
function calculateGenerationStats(
  battlefield: Battlefield,
  terrainResult: TerrainPlacementResult
): {
  totalTerrain: number;
  byCategory: Record<string, number>;
  fitnessScore: number;
  coverageRatio: number;
} {
  const totalTerrain = terrainResult.stats.placed;

  // Count by category (simplified - would need terrain type mapping)
  const byCategory: Record<string, number> = {
    area: 0,
    building: 0,
    wall: 0,
    tree: 0,
    rocks: 0,
    shrub: 0,
  };

  // Count terrain by type
  for (const feature of terrainResult.terrain) {
    const type = feature.type || 'unknown';
    if (type === 'Rough' || type === 'Difficult') {
      byCategory.area++;
    } else if (type === 'Obstacle' || type === 'Impassable') {
      // Check meta for specific type
      const category = feature.meta?.category || '';
      if (category === 'building') byCategory.building++;
      else if (category === 'wall') byCategory.wall++;
      else if (category === 'tree') byCategory.tree++;
      else if (category === 'rocks') byCategory.rocks++;
      else if (category === 'shrub') byCategory.shrub++;
    }
  }

  // Calculate coverage ratio
  const battlefieldArea = battlefield.width * battlefield.height;
  let terrainArea = 0;
  for (const feature of terrainResult.terrain) {
    if (feature.vertices && feature.vertices.length >= 3) {
      // Simple polygon area calculation
      let area = 0;
      for (let i = 0; i < feature.vertices.length; i++) {
        const j = (i + 1) % feature.vertices.length;
        area += feature.vertices[i].x * feature.vertices[j].y;
        area -= feature.vertices[j].x * feature.vertices[i].y;
      }
      terrainArea += Math.abs(area / 2);
    }
  }
  const coverageRatio = terrainArea / battlefieldArea;

  return {
    totalTerrain,
    byCategory,
    fitnessScore: terrainResult.fitness?.score || 100,
    coverageRatio: Math.round(coverageRatio * 100) / 100,
  };
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const config: BattlefieldGenerationConfig = {
    gameSize: 'MEDIUM',
    terrainDensities: {
      area: 50,
      building: 30,
      wall: 30,
      tree: 50,
      rocks: 40,
      shrub: 40,
    },
    seed: 12345,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--gameSize':
        config.gameSize = args[++i] as any;
        break;
      case '--density':
        const density = parseInt(args[++i], 10);
        config.terrainDensities.area = density;
        config.terrainDensities.building = density;
        config.terrainDensities.wall = density;
        config.terrainDensities.tree = density;
        config.terrainDensities.rocks = density;
        config.terrainDensities.shrub = density;
        break;
      case '--seed':
        config.seed = parseInt(args[++i], 10);
        break;
    }
  }

  console.log('Generating battlefield...');
  console.log(`  Game Size: ${config.gameSize}`);
  console.log(`  Terrain Densities: ${JSON.stringify(config.terrainDensities)}`);
  console.log(`  Seed: ${config.seed}`);

  generateBattlefield(config).then((result) => {
    if (result.success) {
      console.log('\n✅ Battlefield generated successfully!');
      console.log(`  ID: ${result.battlefieldId}`);
      console.log(`  SVG: ${result.svgPath}`);
      console.log(`  JSON: ${result.jsonPath}`);
      console.log(`  Total Terrain: ${result.stats.totalTerrain}`);
      console.log(`  Coverage: ${result.stats.coverageRatio * 100}%`);
      console.log(`  Fitness: ${result.stats.fitnessScore}`);
      console.log(`  Time: ${result.generationTimeMs}ms`);
    } else {
      console.error('\n❌ Battlefield generation failed!');
      console.error(`  Error: ${result.error}`);
      process.exit(1);
    }
  });
}

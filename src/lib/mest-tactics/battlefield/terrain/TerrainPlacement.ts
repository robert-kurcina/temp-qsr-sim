/**
 * Terrain Placement Service
 *
 * Unified terrain placement for all battle generation scripts.
 * Provides three placement modes: fast, balanced, and thorough.
 * Supports layered placement for area terrain (rough patches).
 *
 * @module mest-tactics/battlefield/terrain
 */

import { TerrainFeature, TerrainType } from './Terrain';
import { TerrainElement } from './TerrainElement';
import { Position } from '../Position';
import { validateTerrainFitness, TerrainFitnessReport } from './TerrainFitness';
import { distance } from './BattlefieldUtils';
import { AreaTerrainLayer } from './AreaTerrainLayer';
import { StructuresLayer } from './StructuresLayer';
import { RocksLayer } from './RocksLayer';
import { ShrubsLayer } from './ShrubsLayer';
import { TreesLayer } from './TreesLayer';

/**
 * Terrain placement mode
 * - fast: Quick placement, no overlap checks (CLI battles)
 * - balanced: Moderate checks, reasonable quality (AI battles)
 * - thorough: Full validation, best quality (generate:svg)
 */
export type PlacementMode = 'fast' | 'balanced' | 'thorough';

/**
 * Terrain placement configuration
 */
export interface TerrainPlacementOptions {
  mode: PlacementMode;
  density: number;          // 0-100 percentage
  battlefieldSize: number;  // MU (square battlefield)
  seed?: number;            // For reproducibility
  minSpacing?: number;      // Minimum spacing between terrain (default: 0.5 MU)
  terrainTypes?: string[];  // Available terrain types
  
  // Area terrain specific options
  areaDensity?: number;     // 0-100 percentage for rough patches (default: density)
  areaOverlapRatio?: number; // Maximum overlap for area terrain (default: 0.20)
  
  // Structures specific options
  structuresDensity?: number; // 0-100 percentage for buildings/walls (default: 50)
  structuresClearance?: number; // Minimum clearance between structures (default: 0.5 MU)
  
  // Rocks specific options
  rocksDensity?: number; // 0-100 percentage for rocks (default: 50)
  rocksClearance?: number; // Minimum clearance between rocks and structures (default: 0.5 MU)
  
  // Shrubs specific options
  shrubsDensity?: number; // 0-100 percentage for shrubs (default: 50)
  
  // Trees specific options
  treesDensity?: number; // 0-100 percentage for trees (default: 50)
  treesOverlapRatio?: number; // Maximum overlap between trees (default: 0.20 = 20%)
}

/**
 * Terrain placement statistics
 */
export interface PlacementStats {
  placed: number;
  rejected: number;
  attempts: number;
  overlaps: number;
  outOfBounds: number;
}

/**
 * Terrain placement result
 */
export interface TerrainPlacementResult {
  terrain: TerrainFeature[];
  stats: PlacementStats;
  fitness: TerrainFitnessReport;
}

/**
 * Seeded random number generator
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

/**
 * Terrain type configuration
 */
interface TerrainTypeConfig {
  name: string;
  size: number;  // MU (diameter for circles, side for squares)
  shape: 'circle' | 'rectangle';
  weight: number;  // Selection weight
}

/**
 * Default terrain types with QSR-appropriate sizes
 * Size represents approximate footprint diameter/extent for placement calculations
 * Only includes terrain types that exist in game data
 */
const DEFAULT_TERRAIN_TYPES: TerrainTypeConfig[] = [
  { name: 'Tree', size: 1.5, shape: 'circle', weight: 3 },
  { name: 'Shrub', size: 1.0, shape: 'circle', weight: 2 },
  { name: 'Small Rocks', size: 1.0, shape: 'rectangle', weight: 2 },
  { name: 'Medium Rocks', size: 1.5, shape: 'rectangle', weight: 1 },
  { name: 'Large Rocks', size: 2.0, shape: 'rectangle', weight: 1 },
  { name: 'Small Rough Patch', size: 6.0, shape: 'rectangle', weight: 2 },
  { name: 'Medium Rough Patch', size: 9.0, shape: 'rectangle', weight: 1 },
  { name: 'Large Rough Patch', size: 12.0, shape: 'rectangle', weight: 1 },
  // Structures - size represents approximate footprint extent
  { name: 'Small Building', size: 5.0, shape: 'rectangle', weight: 2 },  // Actual: 4×6 MU
  { name: 'Medium Building', size: 7.0, shape: 'rectangle', weight: 1 },  // Actual: 6×8 MU
  { name: 'Short Wall', size: 6.0, shape: 'rectangle', weight: 2 },       // Actual: 0.5×6 MU
  { name: 'Medium Wall', size: 8.0, shape: 'rectangle', weight: 1 },      // Actual: 1×8 MU
];

/**
 * Mode configuration presets
 */
const MODE_CONFIG: Record<PlacementMode, {
  maxAttempts: number;
  checkOverlaps: boolean;
  checkSpacing: boolean;
  checkBounds: boolean;
  minSpacing: number;
}> = {
  fast: {
    maxAttempts: 10,
    checkOverlaps: false,
    checkSpacing: false,
    checkBounds: true,
    minSpacing: 0,
  },
  balanced: {
    maxAttempts: 200,  // Increased for structures placement
    checkOverlaps: true,
    checkSpacing: true,
    checkBounds: true,
    minSpacing: 0.5,
  },
  thorough: {
    maxAttempts: 500,  // Increased for structures placement
    checkOverlaps: true,
    checkSpacing: true,
    checkBounds: true,
    minSpacing: 0.5,
  },
};

/**
 * Place terrain on battlefield with layered placement
 *
 * Placement order:
 * 1. Area terrain (rough patches) - placed first with overlap allowed
 * 2. Structures (buildings, walls) - placed second, cannot overlap each other
 * 3. Rocks - placed third, cannot overlap rocks or structures (0.5 MU clearance)
 * 4. Shrubs - placed fourth, can touch all terrain (zero clearance)
 * 5. Other terrain (trees) - placed fifth
 *
 * @param options - Placement configuration
 * @returns Placement result with terrain, stats, and fitness report
 */
export function placeTerrain(options: TerrainPlacementOptions): TerrainPlacementResult {
  const rng = options.seed !== undefined ? new SeededRandom(options.seed) : null;
  const config = MODE_CONFIG[options.mode];
  const allTerrainTypes = options.terrainTypes
    ? DEFAULT_TERRAIN_TYPES.filter(t => options.terrainTypes!.includes(t.name))
    : DEFAULT_TERRAIN_TYPES;

  const terrain: TerrainFeature[] = [];
  const stats: PlacementStats = {
    placed: 0,
    rejected: 0,
    attempts: 0,
    overlaps: 0,
    outOfBounds: 0,
  };

  // Separate terrain by layer
  const areaTerrainTypes = allTerrainTypes.filter(t =>
    t.name.includes('Rough Patch')
  );
  const structureTerrainTypes = allTerrainTypes.filter(t =>
    t.name.includes('Building') || t.name.includes('Wall')
  );
  const rockTerrainTypes = allTerrainTypes.filter(t =>
    t.name.includes('Rocks')
  );
  const shrubTerrainTypes = allTerrainTypes.filter(t =>
    t.name.includes('Shrub') || t.name.includes('Bush')
  );
  const treeTerrainTypes = allTerrainTypes.filter(t =>
    t.name.includes('Tree')
  );
  const otherTerrainTypes = allTerrainTypes.filter(t =>
    !t.name.includes('Rough Patch') &&
    !t.name.includes('Building') &&
    !t.name.includes('Wall') &&
    !t.name.includes('Rocks') &&
    !t.name.includes('Shrub') &&
    !t.name.includes('Bush') &&
    !t.name.includes('Tree')
  );

  const minSpacing = options.minSpacing ?? config.minSpacing;
  const edgeMargin = 1.0;
  const placeableWidth = options.battlefieldSize - edgeMargin * 2;
  const placeableHeight = options.battlefieldSize - edgeMargin * 2;

  // Step 1: Place area terrain (rough patches) with overlap
  if (areaTerrainTypes.length > 0) {
    const areaDensity = options.areaDensity ?? options.density;
    const areaOverlapRatio = options.areaOverlapRatio ?? 0.20;

    const areaResult = placeAreaTerrainLayer(
      areaTerrainTypes,
      options.battlefieldSize,
      areaDensity,
      areaOverlapRatio,
      edgeMargin,
      placeableWidth,
      placeableHeight,
      config,
      rng,
      stats
    );

    // Add area terrain to result
    terrain.push(...areaResult);
  }

  // Step 2: Place structures (buildings, walls) with clearance
  let structuresBlockedRatio = 0;
  let structureBounds: { clearanceBounds: any }[] = [];
  let structuresResult: { terrain: TerrainFeature[]; blockedRatio: number; structureBounds: any[]; actualBounds: any[] } | undefined;
  if (structureTerrainTypes.length > 0) {
    const structuresDensity = options.structuresDensity ?? 50;
    const structuresClearance = options.structuresClearance ?? 0.5;

    structuresResult = placeStructuresLayer(
      structureTerrainTypes,
      options.battlefieldSize,
      structuresDensity,
      structuresClearance,
      edgeMargin,
      placeableWidth,
      placeableHeight,
      config,
      rng,
      stats
    );

    // Add structures to result
    terrain.push(...structuresResult.terrain);
    structuresBlockedRatio = structuresResult.blockedRatio;
    structureBounds = structuresResult.structureBounds;
  }

  // Step 3: Place rocks with clearance from structures
  let rocksResult: { terrain: TerrainFeature[] } | undefined;
  if (rockTerrainTypes.length > 0) {
    const rocksDensity = options.rocksDensity ?? 50;
    const rocksClearance = options.rocksClearance ?? 0.5;

    rocksResult = placeRocksLayer(
      rockTerrainTypes,
      options.battlefieldSize,
      rocksDensity,
      rocksClearance,
      edgeMargin,
      placeableWidth,
      placeableHeight,
      config,
      rng,
      stats,
      structureBounds
    );

    // Add rocks to result
    terrain.push(...rocksResult.terrain);
  }

  // Step 4: Place shrubs with zero clearance (can touch all terrain)
  let shrubsResult: { terrain: TerrainFeature[] } | undefined;
  if (shrubTerrainTypes.length > 0) {
    const shrubsDensity = options.shrubsDensity ?? 50;

    // Combine structure actual bounds (no clearance) and rock bounds for shrub placement
    // Shrubs can touch structures and rocks, so we use actual bounds not clearance bounds
    const allBlockingBounds = [];
    
    // Add structure actual bounds (shrubs can touch structures)
    if (structuresResult) {
      for (const structure of structuresResult.actualBounds) {
        allBlockingBounds.push({ clearanceBounds: structure.bounds });
      }
    }
    
    // Add rock bounds (shrubs can touch rocks)
    if (rocksResult && rocksResult.terrain) {
      for (const rock of rocksResult.terrain) {
        const bounds = rock.vertices;
        const minX = Math.min(...bounds.map(v => v.x));
        const maxX = Math.max(...bounds.map(v => v.x));
        const minY = Math.min(...bounds.map(v => v.y));
        const maxY = Math.max(...bounds.map(v => v.y));
        allBlockingBounds.push({
          clearanceBounds: { minX, minY, maxX, maxY }
        });
      }
    }

    shrubsResult = placeShrubsLayer(
      shrubTerrainTypes,
      options.battlefieldSize,
      shrubsDensity,
      edgeMargin,
      placeableWidth,
      placeableHeight,
      config,
      rng,
      stats,
      allBlockingBounds
    );

    // Add shrubs to result
    terrain.push(...shrubsResult.terrain);
  }

  // Step 5: Place trees with 20% overlap allowance (can touch all terrain)
  if (treeTerrainTypes.length > 0) {
    const treesDensity = options.treesDensity ?? 50;
    const treesOverlapRatio = options.treesOverlapRatio ?? 0.20;

    // Combine structure actual bounds, rock bounds, and shrub bounds for tree placement
    // Trees can touch structures, rocks, and shrubs (0 clearance)
    const allBlockingBounds = [];

    // Add structure actual bounds (trees can touch structures)
    if (structuresResult) {
      for (const structure of structuresResult.actualBounds) {
        allBlockingBounds.push({ bounds: structure.bounds });
      }
    }

    // Add rock bounds (trees can touch rocks)
    if (rocksResult && rocksResult.terrain) {
      for (const rock of rocksResult.terrain) {
        const bounds = rock.vertices;
        const minX = Math.min(...bounds.map(v => v.x));
        const maxX = Math.max(...bounds.map(v => v.x));
        const minY = Math.min(...bounds.map(v => v.y));
        const maxY = Math.max(...bounds.map(v => v.y));
        allBlockingBounds.push({
          bounds: { minX, minY, maxX, maxY }
        });
      }
    }

    // Add shrub bounds (trees can touch shrubs)
    if (shrubsResult && shrubsResult.terrain) {
      for (const shrub of shrubsResult.terrain) {
        const bounds = shrub.vertices;
        const minX = Math.min(...bounds.map(v => v.x));
        const maxX = Math.max(...bounds.map(v => v.x));
        const minY = Math.min(...bounds.map(v => v.y));
        const maxY = Math.max(...bounds.map(v => v.y));
        allBlockingBounds.push({
          bounds: { minX, minY, maxX, maxY }
        });
      }
    }

    const treesResult = placeTreesLayer(
      treeTerrainTypes,
      options.battlefieldSize,
      treesDensity,
      treesOverlapRatio,
      edgeMargin,
      placeableWidth,
      placeableHeight,
      config,
      rng,
      stats,
      allBlockingBounds
    );

    // Add trees to result
    terrain.push(...treesResult.terrain);
  }

  // Step 6: Place other terrain (etc.)
  // Structures, rocks, shrubs, and trees reduce available area for this layer
  if (otherTerrainTypes.length > 0) {
    const terrainCount = calculateTerrainCount(options.battlefieldSize, options.density);

    for (let i = 0; i < terrainCount; i++) {
      const placed = tryPlaceTerrain(
        terrain,
        otherTerrainTypes,
        options.battlefieldSize,
        edgeMargin,
        placeableWidth,
        placeableHeight,
        config,
        minSpacing,
        rng,
        stats
      );

      if (placed) {
        stats.placed++;
      } else {
        stats.rejected++;
      }
    }
  }

  // Validate final placement
  const fitness = validateTerrainFitness(terrain, options.battlefieldSize, minSpacing);

  return { terrain, stats, fitness };
}

/**
 * Place area terrain layer (rough patches) with overlap allowance
 */
function placeAreaTerrainLayer(
  areaTerrainTypes: TerrainTypeConfig[],
  battlefieldSize: number,
  density: number,
  maxOverlapRatio: number,
  edgeMargin: number,
  placeableWidth: number,
  placeableHeight: number,
  config: typeof MODE_CONFIG['balanced'],
  rng: SeededRandom | null,
  stats: PlacementStats
): TerrainFeature[] {
  const placedFeatures: TerrainFeature[] = [];
  const areaLayer = new AreaTerrainLayer({
    width: battlefieldSize,
    height: battlefieldSize,
    cellResolution: 0.5,
    maxOverlapRatio,
  });

  // Calculate number of area terrain pieces
  const areaCount = calculateTerrainCount(battlefieldSize, density);

  for (let i = 0; i < areaCount; i++) {
    stats.attempts++;

    // Select random terrain type (weighted)
    const terrainType = selectTerrainType(areaTerrainTypes, rng);
    const typeName = terrainType.name as 'Small Rough Patch' | 'Medium Rough Patch' | 'Large Rough Patch';

    // Generate random position
    const x = (rng ? rng.nextFloat(0, placeableWidth) : Math.random() * placeableWidth) + edgeMargin;
    const y = (rng ? rng.nextFloat(0, placeableHeight) : Math.random() * placeableHeight) + edgeMargin;
    const rotation = rng ? rng.nextInt(0, 359) : Math.floor(Math.random() * 360);

    // Try to place using area terrain layer (handles overlap checking)
    const placed = areaLayer.tryPlace(typeName, { x, y }, rotation);

    if (placed) {
      stats.placed++;
      const patch = areaLayer.getPatches().pop();
      if (patch) {
        placedFeatures.push(patch.feature);
      }
    } else {
      stats.rejected++;
      stats.overlaps++; // Count overlap rejections separately
    }
  }

  return placedFeatures;
}

/**
 * Place structures layer (buildings, walls) with clearance rules
 */
function placeStructuresLayer(
  structureTerrainTypes: TerrainTypeConfig[],
  battlefieldSize: number,
  density: number,
  minClearance: number,
  edgeMargin: number,
  placeableWidth: number,
  placeableHeight: number,
  config: typeof MODE_CONFIG['balanced'],
  rng: SeededRandom | null,
  stats: PlacementStats
): { terrain: TerrainFeature[]; blockedRatio: number; actualBounds: { bounds: { minX: number; minY: number; maxX: number; maxY: number } }[] } {
  const placedFeatures: TerrainFeature[] = [];
  const structuresLayer = new StructuresLayer({
    width: battlefieldSize,
    height: battlefieldSize,
    minClearance,
    edgeMargin,
  });

  // Calculate number of structures to place
  // Structures use a different formula: more structures per area due to smaller size
  // Base: 1 structure per 30 square MU at 100% density
  const structuresCount = calculateStructuresCount(battlefieldSize, density);

  for (let i = 0; i < structuresCount; i++) {
    stats.attempts++;

    // Select random structure type (weighted)
    const terrainType = selectTerrainType(structureTerrainTypes, rng);
    const typeName = terrainType.name;

    // Generate random position
    const x = (rng ? rng.nextFloat(0, placeableWidth) : Math.random() * placeableWidth) + edgeMargin;
    const y = (rng ? rng.nextFloat(0, placeableHeight) : Math.random() * placeableHeight) + edgeMargin;
    const baseRotation = rng ? rng.nextInt(0, 359) : Math.floor(Math.random() * 360);

    // Try to place using structures layer (handles clearance checking)
    // Try multiple rotations to improve placement success
    const placed = structuresLayer.tryPlaceWithRotation(typeName, { x, y }, [
      baseRotation,
      (baseRotation + 90) % 360,
      (baseRotation + 45) % 360,
      (baseRotation + 135) % 360,
      0,  // Try cardinal orientations
      90,
    ]);

    if (placed) {
      stats.placed++;
      const structure = structuresLayer.getStructures().pop();
      if (structure) {
        placedFeatures.push(structure.feature);
      }
    } else {
      stats.rejected++;
      stats.overlaps++; // Count clearance violations as overlaps
    }
  }

  return {
    terrain: placedFeatures,
    blockedRatio: structuresLayer.getBlockedAreaRatio(),
    structureBounds: structuresLayer.getStructureBounds(),
    actualBounds: structuresLayer.getActualBounds(),
  };
}

/**
 * Place rocks layer with clearance from structures
 */
function placeRocksLayer(
  rockTerrainTypes: TerrainTypeConfig[],
  battlefieldSize: number,
  density: number,
  minClearance: number,
  edgeMargin: number,
  placeableWidth: number,
  placeableHeight: number,
  config: typeof MODE_CONFIG['balanced'],
  rng: SeededRandom | null,
  stats: PlacementStats,
  structureBounds: { clearanceBounds: any }[]
): { terrain: TerrainFeature[] } {
  const placedFeatures: TerrainFeature[] = [];
  const rocksLayer = new RocksLayer({
    width: battlefieldSize,
    height: battlefieldSize,
    minClearance,
    edgeMargin,
  });

  // Set structure bounds for overlap checking
  rocksLayer.setStructures(structureBounds);

  // Calculate number of rocks to place
  const rocksCount = calculateRocksCount(battlefieldSize, density);

  for (let i = 0; i < rocksCount; i++) {
    stats.attempts++;

    // Select random rock type (weighted)
    const terrainType = selectTerrainType(rockTerrainTypes, rng);
    const typeName = terrainType.name;

    // Generate random position
    const x = (rng ? rng.nextFloat(0, placeableWidth) : Math.random() * placeableWidth) + edgeMargin;
    const y = (rng ? rng.nextFloat(0, placeableHeight) : Math.random() * placeableHeight) + edgeMargin;
    const baseRotation = rng ? rng.nextInt(0, 359) : Math.floor(Math.random() * 360);

    // Try to place using rocks layer (handles overlap checking)
    // Try multiple rotations to improve placement success
    const placed = rocksLayer.tryPlaceWithRotation(typeName, { x, y }, [
      baseRotation,
      (baseRotation + 90) % 360,
      (baseRotation + 45) % 360,
      (baseRotation + 135) % 360,
      0,  // Try cardinal orientations
      90,
    ]);

    if (placed) {
      stats.placed++;
      const rock = rocksLayer.getRocks().pop();
      if (rock) {
        placedFeatures.push(rock.feature);
      }
    } else {
      stats.rejected++;
      stats.overlaps++; // Count overlap violations
    }
  }

  return {
    terrain: placedFeatures,
  };
}

/**
 * Place shrubs layer with zero clearance (can touch all terrain)
 * Uses same placement logic as rocks but with zero clearance from structures
 */
function placeShrubsLayer(
  shrubTerrainTypes: TerrainTypeConfig[],
  battlefieldSize: number,
  density: number,
  edgeMargin: number,
  placeableWidth: number,
  placeableHeight: number,
  config: typeof MODE_CONFIG['balanced'],
  rng: SeededRandom | null,
  stats: PlacementStats,
  structureBounds: { clearanceBounds: any }[]
): { terrain: TerrainFeature[] } {
  const placedFeatures: TerrainFeature[] = [];
  const shrubsLayer = new ShrubsLayer({
    width: battlefieldSize,
    height: battlefieldSize,
    minClearance: 0.0,  // ZERO clearance - shrubs can touch structures
    edgeMargin: 0.5,
  });

  // Set structure bounds for overlap checking
  shrubsLayer.setStructures(structureBounds);

  // Calculate number of shrubs to place
  const shrubsCount = calculateShrubsCount(battlefieldSize, density);

  for (let i = 0; i < shrubsCount; i++) {
    stats.attempts++;

    // Select random shrub type (weighted)
    const terrainType = selectTerrainType(shrubTerrainTypes, rng);
    const typeName = terrainType.name;

    // Generate random position
    const x = (rng ? rng.nextFloat(0, placeableWidth) : Math.random() * placeableWidth) + edgeMargin;
    const y = (rng ? rng.nextFloat(0, placeableHeight) : Math.random() * placeableHeight) + edgeMargin;

    // Try to place using shrubs layer (zero clearance - can touch but not overlap)
    const placed = shrubsLayer.tryPlace(typeName, { x, y }, 0);

    if (placed) {
      stats.placed++;
      const shrub = shrubsLayer.getShrubs().pop();
      if (shrub) {
        placedFeatures.push(shrub.feature);
      }
    } else {
      stats.rejected++;
      stats.overlaps++; // Count overlap violations
    }
  }

  return {
    terrain: placedFeatures,
  };
}

/**
 * Place trees layer with 20% overlap allowance (can touch all terrain)
 * Uses same placement logic as shrubs but allows 20% overlap between trees
 */
function placeTreesLayer(
  treeTerrainTypes: TerrainTypeConfig[],
  battlefieldSize: number,
  density: number,
  maxOverlapRatio: number,
  edgeMargin: number,
  placeableWidth: number,
  placeableHeight: number,
  config: typeof MODE_CONFIG['balanced'],
  rng: SeededRandom | null,
  stats: PlacementStats,
  blockingBounds: { bounds: { minX: number; minY: number; maxX: number; maxY: number } }[]
): { terrain: TerrainFeature[] } {
  const placedFeatures: TerrainFeature[] = [];
  const treesLayer = new TreesLayer({
    width: battlefieldSize,
    height: battlefieldSize,
    minClearance: 0.0,  // ZERO clearance - trees can touch structures
    edgeMargin: 0.5,
    maxOverlapRatio,  // 20% overlap allowed between trees
  });

  // Set structure bounds for overlap checking
  treesLayer.setStructures(blockingBounds);

  // Calculate number of trees to place
  const treesCount = calculateTreesCount(battlefieldSize, density);

  for (let i = 0; i < treesCount; i++) {
    stats.attempts++;

    // Select random tree type (weighted)
    const terrainType = selectTerrainType(treeTerrainTypes, rng);
    const typeName = terrainType.name;

    // Generate random position
    const x = (rng ? rng.nextFloat(0, placeableWidth) : Math.random() * placeableWidth) + edgeMargin;
    const y = (rng ? rng.nextFloat(0, placeableHeight) : Math.random() * placeableHeight) + edgeMargin;

    // Try to place using trees layer (20% overlap allowed, can touch structures)
    const placed = treesLayer.tryPlace(typeName, { x, y }, 0);

    if (placed) {
      stats.placed++;
      const tree = treesLayer.getTrees().pop();
      if (tree) {
        placedFeatures.push(tree.feature);
      }
    } else {
      stats.rejected++;
      stats.overlaps++; // Count overlap violations
    }
  }

  return {
    terrain: placedFeatures,
  };
}

/**
 * Calculate number of trees based on density
 * Trees are medium-sized (2 MU diameter), moderate count
 */
function calculateTreesCount(battlefieldSize: number, density: number): number {
  // Base: 1 tree per 8 square MU at 100% density
  const baseCount = (battlefieldSize * battlefieldSize) / 8;
  return Math.max(1, Math.floor(baseCount * (density / 100)));
}

/**
 * Calculate number of shrubs based on density
 * Shrubs are small (1 MU diameter), so many can be placed
 */
function calculateShrubsCount(battlefieldSize: number, density: number): number {
  // Base: 1 shrub per 4 square MU at 100% density
  const baseCount = (battlefieldSize * battlefieldSize) / 4;
  return Math.max(1, Math.floor(baseCount * (density / 100)));
}

/**
 * Calculate number of rocks based on density
 * Rocks are smaller than structures, so more can be placed
 */
function calculateRocksCount(battlefieldSize: number, density: number): number {
  // Base: 1 rock per 20 square MU at 100% density
  const baseCount = (battlefieldSize * battlefieldSize) / 20;
  return Math.max(1, Math.floor(baseCount * (density / 100)));
}

/**
 * Calculate number of structures based on density
 * Structures use higher density than area terrain (smaller footprint)
 * Formula targets ~40% of density as actual structure coverage
 * (rest is clearance zones)
 * 
 * With 0.5 MU clearance:
 * - Small Building (24 sq MU) + clearance = ~35 sq MU blocked
 * - Medium Building (48 sq MU) + clearance = ~70 sq MU blocked
 * - Average structure blocks ~50 sq MU
 * - At 80% density on 576 sq MU = ~15 structures attempted
 * - Expected placement: 5-8 structures = 120-200 sq MU (21-35% coverage)
 */
function calculateStructuresCount(battlefieldSize: number, density: number): number {
  // Base: 1 structure per 25 square MU at 100% density
  // This allows for clearance overhead while targeting 40% coverage
  const baseCount = (battlefieldSize * battlefieldSize) / 25;
  return Math.max(1, Math.floor(baseCount * (density / 100)));
}

/**
 * Calculate number of terrain pieces based on density
 */
function calculateTerrainCount(battlefieldSize: number, density: number): number {
  // Base: 1 terrain per 100 square MU at 100% density
  const baseCount = (battlefieldSize * battlefieldSize) / 100;
  return Math.floor(baseCount * (density / 100));
}

/**
 * Try to place a single terrain piece
 */
function tryPlaceTerrain(
  existingTerrain: TerrainFeature[],
  terrainTypes: TerrainTypeConfig[],
  battlefieldSize: number,
  edgeMargin: number,
  placeableWidth: number,
  placeableHeight: number,
  config: typeof MODE_CONFIG['fast'],
  minSpacing: number,
  rng: SeededRandom | null,
  stats: PlacementStats
): TerrainFeature | null {
  const maxAttempts = config.maxAttempts;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    stats.attempts++;

    // Select random terrain type (weighted)
    const terrainType = selectTerrainType(terrainTypes, rng);
    const size = terrainType.size;

    // Generate random position
    const x = (rng ? rng.nextFloat(0, placeableWidth) : Math.random() * placeableWidth) + edgeMargin;
    const y = (rng ? rng.nextFloat(0, placeableHeight) : Math.random() * placeableHeight) + edgeMargin;
    const rotation = rng ? rng.nextInt(0, 359) : Math.floor(Math.random() * 360);

    // Create terrain element
    const element = new TerrainElement(terrainType.name, { x, y }, rotation);
    const feature = element.toFeature();

    // Check bounds
    if (config.checkBounds && !isWithinBounds(feature, battlefieldSize)) {
      stats.outOfBounds++;
      continue;
    }

    // Check overlaps and spacing
    if (config.checkOverlaps || config.checkSpacing) {
      let hasOverlap = false;
      let hasSpacingViolation = false;

      for (const existing of existingTerrain) {
        if (config.checkOverlaps && polygonsIntersect(feature.vertices, existing.vertices)) {
          hasOverlap = true;
          stats.overlaps++;
          break;
        }

        if (config.checkSpacing) {
          const dist = getMinDistance(feature.vertices, existing.vertices);
          if (dist < minSpacing && dist > 0) {
            hasSpacingViolation = true;
            break;
          }
        }
      }

      if (hasOverlap || hasSpacingViolation) {
        continue;
      }
    }

    // Valid placement
    existingTerrain.push(feature);
    return feature;
  }

  // Could not place after max attempts
  return null;
}

/**
 * Select terrain type based on weights
 */
function selectTerrainType(terrainTypes: TerrainTypeConfig[], rng: SeededRandom | null): TerrainTypeConfig {
  const totalWeight = terrainTypes.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng ? rng.nextFloat(0, totalWeight) : Math.random() * totalWeight;

  for (const type of terrainTypes) {
    if (roll < type.weight) {
      return type;
    }
    roll -= type.weight;
  }

  return terrainTypes[0];
}

/**
 * Check if terrain is within battlefield bounds
 */
function isWithinBounds(terrain: TerrainFeature, battlefieldSize: number): boolean {
  if (!terrain.vertices || terrain.vertices.length === 0) return false;

  for (const v of terrain.vertices) {
    if (v.x < 0 || v.x > battlefieldSize || v.y < 0 || v.y > battlefieldSize) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two polygons intersect (simplified for placement)
 */
function polygonsIntersect(poly1: Position[], poly2: Position[]): boolean {
  // Quick bounding box check
  const bounds1 = getBoundingBox(poly1);
  const bounds2 = getBoundingBox(poly2);

  if (bounds1.maxX < bounds2.minX || bounds2.maxX < bounds1.minX ||
      bounds1.maxY < bounds2.minY || bounds2.maxY < bounds1.minY) {
    return false;
  }

  // Full SAT check
  return satIntersect(poly1, poly2);
}

/**
 * Get bounding box for polygon
 */
function getBoundingBox(vertices: Position[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Separating Axis Theorem for polygon intersection
 */
function satIntersect(poly1: Position[], poly2: Position[]): boolean {
  for (let i = 0; i < poly1.length; i++) {
    const edge = { x: poly1[(i + 1) % poly1.length].x - poly1[i].x, y: poly1[(i + 1) % poly1.length].y - poly1[i].y };
    if (isSeparatingAxis(edge, poly1, poly2)) return false;
  }
  for (let i = 0; i < poly2.length; i++) {
    const edge = { x: poly2[(i + 1) % poly2.length].x - poly2[i].x, y: poly2[(i + 1) % poly2.length].y - poly2[i].y };
    if (isSeparatingAxis(edge, poly1, poly2)) return false;
  }
  return true;
}

/**
 * Check if edge is separating axis
 */
function isSeparatingAxis(edge: Position, poly1: Position[], poly2: Position[]): boolean {
  const axis = { x: -edge.y, y: edge.x };
  const proj1 = projectPolygon(axis, poly1);
  const proj2 = projectPolygon(axis, poly2);
  return proj1.max < proj2.min || proj2.max < proj1.min;
}

/**
 * Project polygon onto axis
 */
function projectPolygon(axis: Position, polygon: Position[]): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (const v of polygon) {
    const proj = v.x * axis.x + v.y * axis.y;
    min = Math.min(min, proj);
    max = Math.max(max, proj);
  }
  return { min, max };
}

/**
 * Get minimum distance between two polygons
 */
function getMinDistance(poly1: Position[], poly2: Position[]): number {
  let minDist = Infinity;
  for (const v1 of poly1) {
    for (const v2 of poly2) {
      minDist = Math.min(minDist, distance(v1, v2));
    }
  }
  return minDist;
}

/**
 * Export terrain for battle report JSON
 */
export function exportTerrainForReport(terrain: TerrainFeature[]): any[] {
  return terrain.map(t => ({
    id: t.id,
    type: t.type,
    vertices: t.vertices,
    meta: t.meta,
  }));
}

/**
 * Import terrain from battle report JSON
 */
export function importTerrainFromReport(data: any[]): TerrainFeature[] {
  return data.map(t => ({
    id: t.id,
    type: t.type,
    vertices: t.vertices.map((v: any) => ({ x: v.x, y: v.y })),
    meta: t.meta,
  }));
}

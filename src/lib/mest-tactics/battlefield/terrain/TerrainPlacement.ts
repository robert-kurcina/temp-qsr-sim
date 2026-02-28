/**
 * Terrain Placement Service
 * 
 * Unified terrain placement for all battle generation scripts.
 * Provides three placement modes: fast, balanced, and thorough.
 * 
 * @module mest-tactics/battlefield/terrain
 */

import { TerrainFeature, TerrainType } from './Terrain';
import { TerrainElement } from './TerrainElement';
import { Position } from '../Position';
import { validateTerrainFitness, TerrainFitnessReport, distance } from './TerrainFitness';

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
 */
const DEFAULT_TERRAIN_TYPES: TerrainTypeConfig[] = [
  { name: 'Tree', size: 1.5, shape: 'circle', weight: 3 },
  { name: 'Shrub', size: 1.0, shape: 'circle', weight: 2 },
  { name: 'Small Rocks', size: 1.0, shape: 'rectangle', weight: 2 },
  { name: 'Medium Rocks', size: 1.5, shape: 'rectangle', weight: 1 },
  { name: 'Large Rocks', size: 2.0, shape: 'rectangle', weight: 1 },
  { name: 'Ruin', size: 2.0, shape: 'rectangle', weight: 1 },
  { name: 'Bush', size: 1.0, shape: 'circle', weight: 2 },
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
    maxAttempts: 100,
    checkOverlaps: true,
    checkSpacing: true,
    checkBounds: true,
    minSpacing: 0.5,
  },
  thorough: {
    maxAttempts: 1000,
    checkOverlaps: true,
    checkSpacing: true,
    checkBounds: true,
    minSpacing: 0.5,
  },
};

/**
 * Place terrain on battlefield
 * 
 * @param options - Placement configuration
 * @returns Placement result with terrain, stats, and fitness report
 */
export function placeTerrain(options: TerrainPlacementOptions): TerrainPlacementResult {
  const rng = options.seed !== undefined ? new SeededRandom(options.seed) : null;
  const config = MODE_CONFIG[options.mode];
  const terrainTypes = options.terrainTypes 
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

  // Calculate number of terrain pieces based on density
  const terrainCount = calculateTerrainCount(options.battlefieldSize, options.density);
  const minSpacing = options.minSpacing ?? config.minSpacing;

  // Edge margin (keep terrain away from battlefield edges)
  const edgeMargin = 1.0;
  const placeableWidth = options.battlefieldSize - edgeMargin * 2;
  const placeableHeight = options.battlefieldSize - edgeMargin * 2;

  // Place each terrain piece
  for (let i = 0; i < terrainCount; i++) {
    const placed = tryPlaceTerrain(
      terrain,
      terrainTypes,
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

  // Validate final placement
  const fitness = validateTerrainFitness(terrain, options.battlefieldSize, minSpacing);

  return { terrain, stats, fitness };
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

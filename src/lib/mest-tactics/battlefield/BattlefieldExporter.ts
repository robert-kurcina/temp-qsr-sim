/**
 * Battlefield Exporter
 * 
 * Exports battlefield state to JSON for reuse, testing, and visualization.
 * Separates static terrain data from dynamic battle events.
 * 
 * @module mest-tactics/battlefield
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Battlefield } from './Battlefield';
import { TerrainFeature, TerrainType } from './terrain/Terrain';
import type { TerrainPlacementResult } from './terrain/TerrainPlacement';
import type { PathfindingCacheStats } from './pathfinding/PathfindingEngine';

/**
 * Battlefield export format version
 */
export const BATTLEFIELD_EXPORT_VERSION = '1.0';

/**
 * Terrain type definition
 */
export interface TerrainTypeInfo {
  name: string;
  los: 'blocking' | 'soft' | 'clear';
  movement: 'impassable' | 'difficult' | 'normal';
  cover: 'hard' | 'soft' | 'none';
  baseSize: number; // MU
}

/**
 * Terrain instance placement
 */
export interface TerrainInstance {
  typeRef: string; // Reference to terrainTypes key
  position: { x: number; y: number };
  rotation: number; // Degrees
  vertices: { x: number; y: number }[];
}

/**
 * Delaunay mesh export format
 */
export interface DelaunayMeshExport {
  vertices: { x: number; y: number }[];
  triangles: [number, number, number][]; // Indices into vertices
  edges?: [number, number][]; // Optional: explicit edge list
}

/**
 * Grid layer export format
 */
export interface GridLayerExport {
  resolution: number; // MU per cell
  width: number; // Cells
  height: number; // Cells
  cells: GridCellExport[];
}

/**
 * Grid cell export format
 */
export interface GridCellExport {
  x: number; // Cell column
  y: number; // Cell row
  walkable: boolean;
  cost: number; // Movement cost multiplier
  terrain?: string; // Terrain type if applicable
}

/**
 * Complete battlefield export structure
 */
export interface BattlefieldExport {
  version: string;
  exportedAt: string; // ISO timestamp
  dimensions: {
    width: number; // MU
    height: number; // MU
  };
  terrainTypes: Record<string, TerrainTypeInfo>;
  terrainInstances: TerrainInstance[];
  delaunayMesh: DelaunayMeshExport;
  grid?: GridLayerExport;
  stats: {
    placed: number;
    density: number;
    fitnessScore?: number;
  };
  metadata?: {
    seed?: number;
    mode: 'fast' | 'balanced' | 'thorough';
    generator: string;
  };
}

/**
 * Export battlefield to JSON file
 * 
 * @param battlefield - The battlefield to export
 * @param terrainResult - Terrain placement result
 * @param outputPath - Output directory path
 * @param filename - Optional filename (default: battlefield-{timestamp}.json)
 * @returns Path to exported file
 */
export function exportBattlefield(
  battlefield: Battlefield,
  terrainResult: TerrainPlacementResult,
  outputPath: string,
  filename?: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportData = buildBattlefieldExport(battlefield, terrainResult);
  
  const finalFilename = filename || `battlefield-${timestamp}.json`;
  const filePath = join(outputPath, finalFilename);
  
  writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  
  return filePath;
}

/**
 * Build battlefield export object
 */
function buildBattlefieldExport(
  battlefield: Battlefield,
  terrainResult: TerrainPlacementResult
): BattlefieldExport {
  // Extract terrain types from instances
  const terrainTypes = extractTerrainTypes(terrainResult.terrain);
  
  // Extract terrain instances - use meta.name for typeRef to preserve original terrain type
  const terrainInstances = terrainResult.terrain.map(feature => ({
    typeRef: feature.meta?.name || feature.id || 'Unknown',
    position: {
      x: feature.vertices[0]?.x || 0,
      y: feature.vertices[0]?.y || 0
    },
    rotation: feature.meta?.rotationDegrees || 0,
    vertices: feature.vertices.map(v => ({ x: v.x, y: v.y }))
  }));
  
  // Extract Delaunay mesh
  const delaunayMesh = extractDelaunayMesh(battlefield);
  
  // Extract grid (if available)
  const grid = extractGrid(battlefield);
  
  return {
    version: BATTLEFIELD_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    dimensions: {
      width: battlefield.width,
      height: battlefield.height
    },
    terrainTypes,
    terrainInstances,
    delaunayMesh,
    grid,
    stats: {
      placed: terrainResult.stats.placed,
      density: terrainResult.stats.placed / (battlefield.width * battlefield.height) * 100,
      fitnessScore: terrainResult.fitness?.score
    },
    metadata: {
      seed: terrainResult.stats.seed,
      mode: 'balanced', // Would need to pass this in
      generator: 'TerrainPlacementService v1.0'
    }
  };
}

/**
 * Extract terrain types from terrain instances
 */
function extractTerrainTypes(terrain: TerrainFeature[]): Record<string, TerrainTypeInfo> {
  const types: Record<string, TerrainTypeInfo> = {};
  
  // Default terrain type definitions (QSR-appropriate)
  const defaultTypes: Record<string, TerrainTypeInfo> = {
    'Tree': {
      name: 'Tree',
      los: 'blocking',
      movement: 'impassable',
      cover: 'hard',
      baseSize: 1.5
    },
    'Shrub': {
      name: 'Shrub',
      los: 'soft',
      movement: 'difficult',
      cover: 'soft',
      baseSize: 1.0
    },
    'Small Rocks': {
      name: 'Small Rocks',
      los: 'clear',
      movement: 'difficult',
      cover: 'soft',
      baseSize: 1.0
    },
    'Medium Rocks': {
      name: 'Medium Rocks',
      los: 'clear',
      movement: 'difficult',
      cover: 'soft',
      baseSize: 1.5
    },
    'Large Rocks': {
      name: 'Large Rocks',
      los: 'clear',
      movement: 'difficult',
      cover: 'soft',
      baseSize: 2.0
    },
    'Building': {
      name: 'Building',
      los: 'blocking',
      movement: 'impassable',
      cover: 'hard',
      baseSize: 3.0
    },
    'Wall': {
      name: 'Wall',
      los: 'blocking',
      movement: 'impassable',
      cover: 'hard',
      baseSize: 2.0
    },
    'Ruin': {
      name: 'Ruin',
      los: 'soft',
      movement: 'difficult',
      cover: 'soft',
      baseSize: 2.0
    }
  };
  
  // Add types that are actually used
  const usedTypes = new Set(terrain.map(f => f.type));
  for (const typeName of usedTypes) {
    if (defaultTypes[typeName]) {
      types[typeName] = defaultTypes[typeName];
    } else {
      // Unknown type - use defaults
      types[typeName] = {
        name: typeName,
        los: 'clear',
        movement: 'normal',
        cover: 'none',
        baseSize: 1.0
      };
    }
  }
  
  return types;
}

/**
 * Extract Delaunay mesh from battlefield
 */
function extractDelaunayMesh(battlefield: Battlefield): DelaunayMeshExport {
  const navMesh = battlefield.getNavMesh();
  
  if (!navMesh) {
    return {
      vertices: [],
      triangles: []
    };
  }
  
  // Extract vertices
  const vertices = Array.from(navMesh.points as any).map((p: any) => ({
    x: p.x,
    y: p.y
  }));
  
  // Extract triangles (Delaunay provides triangle accessor)
  const triangles: [number, number, number][] = [];
  const numTriangles = navMesh.triangles.length / 3;
  
  for (let i = 0; i < numTriangles; i++) {
    const i0 = navMesh.triangles[i * 3];
    const i1 = navMesh.triangles[i * 3 + 1];
    const i2 = navMesh.triangles[i * 3 + 2];
    
    if (i0 >= 0 && i1 >= 0 && i2 >= 0) {
      triangles.push([i0, i1, i2]);
    }
  }
  
  return {
    vertices,
    triangles
  };
}

/**
 * Extract grid from PathfindingEngine
 * Note: This is a simplified version - full implementation would need
 * access to PathfindingEngine's internal grid state
 */
function extractGrid(battlefield: Battlefield): GridLayerExport | undefined {
  // For now, return undefined
  // Full implementation would:
  // 1. Create PathfindingEngine(battlefield)
  // 2. Force grid generation
  // 3. Export cell data
  
  // This is optional - grid can be regenerated from terrain
  return undefined;
}

/**
 * Load battlefield from exported JSON
 * 
 * @param filePath - Path to battlefield.json
 * @returns Battlefield export data
 */
export function loadBattlefieldExport(filePath: string): BattlefieldExport {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as BattlefieldExport;
}

function resolveTerrainTypeFromExport(
  typeRef: string,
  terrainTypeInfo?: TerrainTypeInfo
): TerrainType {
  const normalizedRef = String(typeRef ?? '').toLowerCase();
  const movement = terrainTypeInfo?.movement ?? 'normal';
  const los = terrainTypeInfo?.los ?? 'clear';

  if (normalizedRef.includes('rough patch') || movement === 'difficult' && normalizedRef.includes('rough')) {
    return TerrainType.Rough;
  }
  if (movement === 'impassable' || los === 'blocking') {
    return TerrainType.Obstacle;
  }
  if (movement === 'difficult') {
    return TerrainType.Difficult;
  }
  return TerrainType.Clear;
}

function inferTerrainCategory(typeRef: string): string | undefined {
  const value = String(typeRef ?? '').toLowerCase();
  if (value.includes('building')) return 'building';
  if (value.includes('wall')) return 'wall';
  if (value.includes('tree')) return 'tree';
  if (value.includes('rock')) return 'rocks';
  if (value.includes('shrub') || value.includes('bush')) return 'shrub';
  if (value.includes('rough patch')) return 'area';
  return undefined;
}

/**
 * Build a Battlefield instance from BattlefieldExport data.
 */
export function buildBattlefieldFromExport(data: BattlefieldExport): Battlefield {
  const battlefield = new Battlefield(data.dimensions.width, data.dimensions.height);

  for (const [index, instance] of (data.terrainInstances ?? []).entries()) {
    const typeInfo = data.terrainTypes?.[instance.typeRef];
    const terrainType = resolveTerrainTypeFromExport(instance.typeRef, typeInfo);
    const category = inferTerrainCategory(instance.typeRef);

    const feature: TerrainFeature = {
      id: `${instance.typeRef}-${index}`,
      type: terrainType,
      vertices: (instance.vertices ?? []).map(v => ({ x: v.x, y: v.y })),
      meta: {
        name: instance.typeRef,
        rotationDegrees: instance.rotation ?? 0,
        category,
        layer: category === 'area' ? 'area' : undefined,
      },
    };

    battlefield.addTerrain(feature, true);
  }

  battlefield.finalizeTerrain();
  return battlefield;
}

/**
 * Load a battlefield JSON export and materialize a Battlefield instance.
 */
export function loadBattlefieldFromFile(filePath: string): Battlefield {
  return buildBattlefieldFromExport(loadBattlefieldExport(filePath));
}

/**
 * Get relative path from battle report to battlefield file
 * 
 * @param battleReportDir - Battle report directory
 * @param battlefieldPath - Battlefield file path
 * @returns Relative path for audit.json reference
 */
export function getBattlefieldReference(
  battleReportDir: string,
  battlefieldPath: string
): string {
  // Simple implementation - just return filename
  // Could be enhanced to compute proper relative path
  const filename = battlefieldPath.split('/').pop() || battlefieldPath;
  return `../battlefields/${filename}`;
}

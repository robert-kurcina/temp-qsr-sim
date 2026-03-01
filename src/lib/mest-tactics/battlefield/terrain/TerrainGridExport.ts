/**
 * Terrain Grid Export
 * 
 * Exports terrain data as grid cells and Delaunay mesh for game engine and AI use.
 * 
 * Output format:
 * - Grid: 0.5 MU resolution cells with terrain type and properties
 * - Mesh: Delaunay triangulation for long-range pathfinding
 * - Terrain: Actual terrain footprints with metadata
 * - Stats: Coverage and placement statistics
 */

import { TerrainFeature, TerrainType } from './Terrain';
import { Position } from './Position';
import {
  calculateBounds,
  calculateCentroid,
  calculateArea,
  pointInPolygon,
} from './TerrainUtils';

/**
 * Grid cell data structure
 */
export interface GridCell {
  /** Cell coordinates (0.5 MU grid) */
  x: number;
  y: number;
  /** Terrain type in this cell */
  terrainType: string | null;
  /** Terrain category (building, wall, rocks, shrub, tree, area, clear) */
  category: string;
  /** Movement cost multiplier (1.0 = normal, 2.0 = rough/difficult) */
  movementCost: number;
  /** LOS blocking (true = blocks line of sight) */
  blocksLOS: boolean;
  /** Cover provided (none, soft, hard, blocking) */
  coverType: string;
  /** Center position in MU */
  centerX: number;
  centerY: number;
}

/**
 * Delaunay triangle for mesh navigation
 */
export interface MeshTriangle {
  /** Triangle vertices */
  vertices: Position[];
  /** Vertex indices */
  vertexIndices: number[];
  /** Neighboring triangle indices (-1 = no neighbor) */
  neighbors: [number, number, number];
  /** Edge clearance (minimum distance to terrain) */
  clearance: number;
  /** Triangle centroid */
  centroid: Position;
  /** Area in square MU */
  area: number;
}

/**
 * Terrain footprint with metadata
 */
export interface TerrainFootprint {
  /** Terrain type name */
  type: string;
  /** Terrain category */
  category: string;
  /** Vertices in MU coordinates */
  vertices: Position[];
  /** Center position */
  center: Position;
  /** Rotation in degrees */
  rotation: number;
  /** Movement cost multiplier */
  movementCost: number;
  /** LOS blocking */
  blocksLOS: boolean;
  /** Cover type */
  coverType: string;
  /** Area in square MU */
  area: number;
}

/**
 * Coverage statistics
 */
export interface TerrainStats {
  /** Total battlefield area */
  totalArea: number;
  /** Battlefield dimensions */
  width: number;
  height: number;
  /** Grid cell size in MU */
  cellSize: number;
  /** Total grid cells */
  totalCells: number;
  /** Covered cells */
  coveredCells: number;
  /** Coverage ratio (0.0-1.0) */
  coverageRatio: number;
  /** Uncovered ratio (0.0-1.0) */
  uncoveredRatio: number;
  /** Per-category coverage */
  byCategory: Record<string, {
    cells: number;
    area: number;
    ratio: number;
  }>;
}

/**
 * Complete terrain export data
 */
export interface TerrainExportData {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: string;
  /** Battlefield dimensions */
  battlefield: {
    width: number;
    height: number;
    area: number;
  };
  /** Grid cell data */
  grid: {
    cellSize: number;
    cells: GridCell[];
    width: number;  // cells
    height: number; // cells
  };
  /** Delaunay mesh data */
  mesh: {
    vertices: Position[];
    triangles: MeshTriangle[];
  };
  /** Terrain footprints */
  terrain: TerrainFootprint[];
  /** Coverage statistics */
  stats: TerrainStats;
}

/**
 * Terrain type metadata
 */
interface TerrainTypeMetadata {
  category: string;
  movementCost: number;
  blocksLOS: boolean;
  coverType: string;
}

/**
 * Terrain type metadata lookup
 */
const TERRAIN_METADATA: Record<string, TerrainTypeMetadata> = {
  // Structures
  'Small Building': { category: 'building', movementCost: 999, blocksLOS: true, coverType: 'blocking' },
  'Medium Building': { category: 'building', movementCost: 999, blocksLOS: true, coverType: 'blocking' },
  'Short Wall': { category: 'wall', movementCost: 999, blocksLOS: true, coverType: 'blocking' },
  'Medium Wall': { category: 'wall', movementCost: 999, blocksLOS: true, coverType: 'blocking' },
  
  // Rocks
  'Small Rocks': { category: 'rocks', movementCost: 2.0, blocksLOS: false, coverType: 'hard' },
  'Medium Rocks': { category: 'rocks', movementCost: 2.0, blocksLOS: false, coverType: 'hard' },
  'Large Rocks': { category: 'rocks', movementCost: 2.0, blocksLOS: false, coverType: 'hard' },
  
  // Shrubs
  'Shrub': { category: 'shrub', movementCost: 2.0, blocksLOS: false, coverType: 'soft' },
  'Bush': { category: 'shrub', movementCost: 2.0, blocksLOS: false, coverType: 'soft' },
  
  // Trees
  'Tree': { category: 'tree', movementCost: 2.0, blocksLOS: false, coverType: 'soft' },
  
  // Area terrain
  'Small Rough Patch': { category: 'area', movementCost: 2.0, blocksLOS: false, coverType: 'none' },
  'Medium Rough Patch': { category: 'area', movementCost: 2.0, blocksLOS: false, coverType: 'none' },
  'Large Rough Patch': { category: 'area', movementCost: 2.0, blocksLOS: false, coverType: 'none' },
};

/**
 * Get terrain metadata
 * Uses meta.name if available, otherwise falls back to type
 */
function getTerrainMetadata(feature: TerrainFeature): TerrainTypeMetadata {
  // Try to use the original terrain name from meta
  const typeName = feature.meta?.name || feature.type || 'Unknown';
  
  // Map enum types to metadata
  if (feature.type === TerrainType.Rough) {
    return { category: 'area', movementCost: 2.0, blocksLOS: false, coverType: 'none' };
  }
  if (feature.type === TerrainType.Impassable || feature.type === TerrainType.Obstacle) {
    // Check if it's a building or wall based on category
    const category = feature.meta?.category || '';
    if (category === 'building' || category === 'wall') {
      return { category, movementCost: 999, blocksLOS: true, coverType: 'blocking' };
    }
    return { category: 'obstacle', movementCost: 999, blocksLOS: true, coverType: 'blocking' };
  }
  if (feature.type === TerrainType.Difficult) {
    const category = feature.meta?.category || '';
    if (category === 'tree') {
      return { category: 'tree', movementCost: 2.0, blocksLOS: false, coverType: 'soft' };
    }
    if (category === 'shrub') {
      return { category: 'shrub', movementCost: 2.0, blocksLOS: false, coverType: 'soft' };
    }
    if (category === 'rocks') {
      return { category: 'rocks', movementCost: 2.0, blocksLOS: false, coverType: 'hard' };
    }
    return { category: 'difficult', movementCost: 2.0, blocksLOS: false, coverType: 'soft' };
  }
  
  // Default
  return { category: 'clear', movementCost: 1.0, blocksLOS: false, coverType: 'none' };
}

/**
 * Export terrain to grid and mesh format
 */
export function exportTerrainData(
  terrain: TerrainFeature[],
  battlefieldWidth: number,
  battlefieldHeight: number,
  cellSize: number = 0.5
): TerrainExportData {
  const totalArea = battlefieldWidth * battlefieldHeight;
  const gridWidth = Math.ceil(battlefieldWidth / cellSize);
  const gridHeight = Math.ceil(battlefieldHeight / cellSize);
  const totalCells = gridWidth * gridHeight;

  // Initialize grid with clear terrain
  const grid: GridCell[] = [];
  const categoryStats: Record<string, { cells: number; area: number }> = {};

  for (let cy = 0; cy < gridHeight; cy++) {
    for (let cx = 0; cx < gridWidth; cx++) {
      const cellCenter = {
        x: (cx + 0.5) * cellSize,
        y: (cy + 0.5) * cellSize,
      };

      // Find terrain at this cell center
      let terrainType: string | null = null;
      let category = 'clear';
      let movementCost = 1.0;
      let blocksLOS = false;
      let coverType = 'none';

      // Check each terrain feature (last one wins for overlapping)
      for (const feature of terrain) {
        if (pointInPolygon(cellCenter, feature.vertices)) {
          const metadata = getTerrainMetadata(feature);
          terrainType = feature.meta?.name || feature.type || 'Unknown';
          category = metadata.category;
          movementCost = metadata.movementCost;
          blocksLOS = metadata.blocksLOS;
          coverType = metadata.coverType;
        }
      }

      // Add cell to grid
      grid.push({
        x: cx,
        y: cy,
        terrainType,
        category,
        movementCost,
        blocksLOS,
        coverType,
        centerX: cellCenter.x,
        centerY: cellCenter.y,
      });

      // Update category stats
      if (!categoryStats[category]) {
        categoryStats[category] = { cells: 0, area: 0 };
      }
      categoryStats[category].cells++;
      categoryStats[category].area += cellSize * cellSize;
    }
  }

  // Calculate covered cells
  const coveredCells = grid.filter(c => c.category !== 'clear').length;

  // Build terrain footprints
  const footprints: TerrainFootprint[] = [];
  for (const feature of terrain) {
    const metadata = getTerrainMetadata(feature);
    footprints.push({
      type: feature.meta?.name || feature.type || 'Unknown',
      category: metadata.category,
      vertices: feature.vertices,
      center: calculateCentroid(feature.vertices),
      rotation: feature.meta?.rotationDegrees ?? 0,
      movementCost: metadata.movementCost,
      blocksLOS: metadata.blocksLOS,
      coverType: metadata.coverType,
      area: calculateArea(feature.vertices),
    });
  }

  // Generate Delaunay mesh (simplified - just terrain vertices + battlefield corners)
  const meshVertices: Position[] = [
    { x: 0, y: 0 },
    { x: battlefieldWidth, y: 0 },
    { x: 0, y: battlefieldHeight },
    { x: battlefieldWidth, y: battlefieldHeight },
  ];

  // Add terrain vertices
  for (const feature of terrain) {
    for (const v of feature.vertices) {
      meshVertices.push({ x: v.x, y: v.y });
    }
  }

  // Simplified mesh generation (placeholder - would use d3-delaunay in production)
  const meshTriangles: MeshTriangle[] = [];

  // Build stats
  const stats: TerrainStats = {
    totalArea,
    width: battlefieldWidth,
    height: battlefieldHeight,
    cellSize,
    totalCells,
    coveredCells,
    coverageRatio: coveredCells / totalCells,
    uncoveredRatio: 1 - (coveredCells / totalCells),
    byCategory: {},
  };

  // Add category stats
  for (const [category, data] of Object.entries(categoryStats)) {
    stats.byCategory[category] = {
      cells: data.cells,
      area: data.area,
      ratio: data.cells / totalCells,
    };
  }

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    battlefield: {
      width: battlefieldWidth,
      height: battlefieldHeight,
      area: totalArea,
    },
    grid: {
      cellSize,
      cells: grid,
      width: gridWidth,
      height: gridHeight,
    },
    mesh: {
      vertices: meshVertices,
      triangles: meshTriangles,
    },
    terrain: footprints,
    stats,
  };
}

/**
 * Export terrain data to JSON string
 */
export function exportTerrainToJSON(data: TerrainExportData, pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(data);
}

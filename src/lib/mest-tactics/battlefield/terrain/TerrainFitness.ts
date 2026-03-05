/**
 * Terrain Fitness Validator
 *
 * Validates terrain placement legality according to QSR rules.
 * Checks for overlaps, spacing violations, and bounds errors.
 *
 * @module mest-tactics/battlefield/terrain
 */

import { TerrainFeature } from './Terrain';
import { Position } from '../Position';
import { distance } from './BattlefieldUtils';

/**
 * Terrain fitness issue severity
 */
export type FitnessSeverity = 'warning' | 'error';

/**
 * Type of terrain fitness issue
 */
export type FitnessIssueType = 'overlap' | 'spacing' | 'bounds';

/**
 * Individual fitness issue
 */
export interface FitnessIssue {
  type: FitnessIssueType;
  severity: FitnessSeverity;
  terrainId: string;
  terrainType: string;
  description: string;
  position: Position;
  relatedTerrainId?: string;
}

/**
 * Terrain fitness statistics
 */
export interface FitnessStats {
  totalTerrain: number;
  legalTerrain: number;
  overlaps: number;
  spacingViolations: number;
  outOfBounds: number;
}

/**
 * Complete terrain fitness report
 */
export interface TerrainFitnessReport {
  overall: number;  // 0-100 fitness score
  issues: FitnessIssue[];
  stats: FitnessStats;
  // Backward compatibility property
  score?: number;
}

/**
 * Terrain placement bounds
 */
export interface TerrainBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Get bounding box for terrain feature
 */
export function getTerrainBounds(terrain: TerrainFeature): TerrainBounds {
  if (!terrain.vertices || terrain.vertices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const vertex of terrain.vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Check if two terrain features overlap
 * Uses simple bounding box check first, then polygon intersection
 */
export function checkOverlap(terrain1: TerrainFeature, terrain2: TerrainFeature): boolean {
  // Quick bounding box check
  const bounds1 = getTerrainBounds(terrain1);
  const bounds2 = getTerrainBounds(terrain2);

  // If bounding boxes don't overlap, terrain can't overlap
  if (bounds1.maxX < bounds2.minX || bounds2.maxX < bounds1.minX ||
      bounds1.maxY < bounds2.minY || bounds2.maxY < bounds1.minY) {
    return false;
  }

  // Full polygon intersection check
  return polygonsIntersect(terrain1.vertices, terrain2.vertices);
}

/**
 * Check if two polygons intersect using Separating Axis Theorem
 */
function polygonsIntersect(poly1: Position[], poly2: Position[]): boolean {
  // Check if any edge of poly1 separates the polygons
  for (let i = 0; i < poly1.length; i++) {
    const edge = {
      x: poly1[(i + 1) % poly1.length].x - poly1[i].x,
      y: poly1[(i + 1) % poly1.length].y - poly1[i].y,
    };
    
    if (isSeparatingAxis(edge, poly1, poly2)) {
      return false;
    }
  }

  // Check if any edge of poly2 separates the polygons
  for (let i = 0; i < poly2.length; i++) {
    const edge = {
      x: poly2[(i + 1) % poly2.length].x - poly2[i].x,
      y: poly2[(i + 1) % poly2.length].y - poly2[i].y,
    };
    
    if (isSeparatingAxis(edge, poly1, poly2)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if an edge is a separating axis
 */
function isSeparatingAxis(edge: Position, poly1: Position[], poly2: Position[]): boolean {
  // Get perpendicular axis
  const axis = { x: -edge.y, y: edge.x };

  // Project both polygons onto axis
  const proj1 = projectPolygon(axis, poly1);
  const proj2 = projectPolygon(axis, poly2);

  // Check if projections overlap
  return proj1.max < proj2.min || proj2.max < proj1.min;
}

/**
 * Project polygon onto axis
 */
function projectPolygon(axis: Position, polygon: Position[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const vertex of polygon) {
    const projection = vertex.x * axis.x + vertex.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }

  return { min, max };
}

/**
 * Check if terrain is within battlefield bounds
 */
export function checkBounds(terrain: TerrainFeature, battlefieldSize: number): boolean {
  const bounds = getTerrainBounds(terrain);
  return bounds.minX >= 0 && bounds.minY >= 0 && 
         bounds.maxX <= battlefieldSize && bounds.maxY <= battlefieldSize;
}

/**
 * Calculate minimum distance between two terrain features
 */
export function minTerrainDistance(terrain1: TerrainFeature, terrain2: TerrainFeature): number {
  if (!terrain1.vertices || !terrain2.vertices) return Infinity;

  let minDist = Infinity;

  // Check all vertex pairs
  for (const v1 of terrain1.vertices) {
    for (const v2 of terrain2.vertices) {
      const dist = distance(v1, v2);
      minDist = Math.min(minDist, dist);
    }
  }

  return minDist;
}

/**
 * Validate terrain placement fitness
 * 
 * @param terrain - Array of terrain features to validate
 * @param battlefieldSize - Battlefield dimensions (square)
 * @param minSpacing - Minimum spacing between terrain (default: 0.5 MU)
 * @returns Fitness report with issues and score
 */
export function validateTerrainFitness(
  terrain: TerrainFeature[],
  battlefieldSize: number,
  minSpacing: number = 0.5
): TerrainFitnessReport {
  const issues: FitnessIssue[] = [];
  const stats: FitnessStats = {
    totalTerrain: terrain.length,
    legalTerrain: terrain.length,
    overlaps: 0,
    spacingViolations: 0,
    outOfBounds: 0,
  };

  // Check each terrain piece
  for (let i = 0; i < terrain.length; i++) {
    const t1 = terrain[i];

    // Check bounds
    if (!checkBounds(t1, battlefieldSize)) {
      stats.outOfBounds++;
      stats.legalTerrain--;
      const bounds = getTerrainBounds(t1);
      issues.push({
        type: 'bounds',
        severity: 'error',
        terrainId: t1.id || `terrain-${i}`,
        terrainType: t1.type || 'Unknown',
        description: `Terrain extends outside battlefield bounds (${bounds.minX.toFixed(1)},${bounds.minY.toFixed(1)}) to (${bounds.maxX.toFixed(1)},${bounds.maxY.toFixed(1)})`,
        position: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
      });
    }

    // Check against all other terrain
    for (let j = i + 1; j < terrain.length; j++) {
      const t2 = terrain[j];

      // Check overlap
      if (checkOverlap(t1, t2)) {
        stats.overlaps++;
        stats.legalTerrain--;
        const centroid1 = getCentroid(t1.vertices);
        issues.push({
          type: 'overlap',
          severity: 'error',
          terrainId: t1.id || `terrain-${i}`,
          terrainType: t1.type || 'Unknown',
          description: `Overlaps with ${t2.type || 'terrain'} (${t2.id || `terrain-${j}`})`,
          position: centroid1,
          relatedTerrainId: t2.id || `terrain-${j}`,
        });
      }

      // Check spacing
      const dist = minTerrainDistance(t1, t2);
      if (dist < minSpacing && dist > 0) {
        stats.spacingViolations++;
        // Don't decrement legalTerrain again if already counted as overlap
        if (!checkOverlap(t1, t2)) {
          stats.legalTerrain--;
        }
        const centroid1 = getCentroid(t1.vertices);
        issues.push({
          type: 'spacing',
          severity: 'warning',
          terrainId: t1.id || `terrain-${i}`,
          terrainType: t1.type || 'Unknown',
          description: `Too close to ${t2.type || 'terrain'} (${t2.id || `terrain-${j}`}): ${dist.toFixed(2)} MU (min: ${minSpacing} MU)`,
          position: centroid1,
          relatedTerrainId: t2.id || `terrain-${j}`,
        });
      }
    }
  }

  // Calculate overall fitness score (0-100)
  const overall = calculateFitnessScore(stats);

  return { overall, issues, stats };
}

/**
 * Calculate overall fitness score from stats
 */
function calculateFitnessScore(stats: FitnessStats): number {
  if (stats.totalTerrain === 0) return 100;

  const overlapPenalty = (stats.overlaps / stats.totalTerrain) * 50;
  const boundsPenalty = (stats.outOfBounds / stats.totalTerrain) * 30;
  const spacingPenalty = (stats.spacingViolations / stats.totalTerrain) * 20;

  const score = 100 - overlapPenalty - boundsPenalty - spacingPenalty;
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

/**
 * Calculate centroid of polygon
 */
function getCentroid(vertices: Position[]): Position {
  if (!vertices || vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }

  return { x: x / vertices.length, y: y / vertices.length };
}

/**
 * Get fitness severity color for UI
 */
export function getFitnessColor(severity: FitnessSeverity): string {
  switch (severity) {
    case 'error': return '#e74c3c';  // Red
    case 'warning': return '#f39c12';  // Orange
    default: return '#27ae60';  // Green
  }
}

/**
 * Get fitness status icon
 */
export function getFitnessIcon(severity: FitnessSeverity | 'ok'): string {
  switch (severity) {
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'ok': return '✅';
    default: return '❓';
  }
}

/**
 * Terrain Utilities
 * 
 * Shared utility functions for terrain placement and analysis.
 * Eliminates code duplication across layer classes.
 */

import { Position } from '../Position';

/**
 * Bounding box representation
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Calculate bounding box for polygon vertices
 */
export function calculateBounds(vertices: Position[]): BoundingBox {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Expand bounding box by margin
 */
export function expandBounds(
  bounds: BoundingBox,
  margin: number
): BoundingBox {
  return {
    minX: bounds.minX - margin,
    minY: bounds.minY - margin,
    maxX: bounds.maxX + margin,
    maxY: bounds.maxY + margin,
  };
}

/**
 * Check if two bounding boxes overlap
 */
export function boundsOverlap(
  a: BoundingBox,
  b: BoundingBox
): boolean {
  return !(
    a.maxX < b.minX ||
    b.maxX < a.minX ||
    a.maxY < b.minY ||
    b.maxY < a.minY
  );
}

/**
 * Check if point is inside polygon using ray casting algorithm
 */
export function pointInPolygon(point: Position, polygon: Position[]): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Calculate polygon area using shoelace formula
 */
export function calculateArea(vertices: Position[]): number {
  if (vertices.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  
  return Math.abs(area / 2);
}

/**
 * Calculate centroid (center point) of polygon
 */
export function calculateCentroid(vertices: Position[]): Position {
  if (vertices.length === 0) return { x: 0, y: 0 };
  
  let x = 0, y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }
  return { x: x / vertices.length, y: y / vertices.length };
}

/**
 * Calculate overlap area between two bounding boxes
 */
export function calculateOverlapArea(a: BoundingBox, b: BoundingBox): number {
  const overlapX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const overlapY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return overlapX * overlapY;
}

/**
 * Check if position is within placeable area (not too close to edges)
 */
export function isWithinPlaceableArea(
  position: Position,
  size: number,
  edgeMargin: number,
  battlefieldWidth: number,
  battlefieldHeight: number
): boolean {
  const halfSize = size / 2;
  const maxExtent = halfSize + edgeMargin;

  return (
    position.x >= maxExtent &&
    position.x <= battlefieldWidth - maxExtent &&
    position.y >= maxExtent &&
    position.y <= battlefieldHeight - maxExtent
  );
}

/**
 * Calculate grid cell coordinates from position
 */
export function getCellCoordinates(
  position: Position,
  cellSize: number
): { cellX: number; cellY: number } {
  return {
    cellX: Math.floor(position.x / cellSize),
    cellY: Math.floor(position.y / cellSize),
  };
}

/**
 * Check if grid cell is occupied
 */
export function isCellOccupied(
  cellX: number,
  cellY: number,
  occupiedCells: Map<string, string>
): boolean {
  const cellKey = `${cellX},${cellY}`;
  return occupiedCells.has(cellKey);
}

/**
 * Mark grid cells as occupied
 */
export function markCellsOccupied(
  cells: string[],
  occupiedCells: Map<string, string>,
  category: string
): void {
  for (const cellKey of cells) {
    occupiedCells.set(cellKey, category);
  }
}

/**
 * Get cells for a 2×2 area (for shrubs/trees)
 */
export function get2x2Cells(position: Position, cellSize: number): string[] {
  const { cellX, cellY } = getCellCoordinates(position, cellSize);
  return [
    `${cellX},${cellY}`,
    `${cellX + 1},${cellY}`,
    `${cellX},${cellY + 1}`,
    `${cellX + 1},${cellY + 1}`,
  ];
}

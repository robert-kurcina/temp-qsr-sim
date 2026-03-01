/**
 * Area Terrain Layer
 * 
 * Manages rough terrain patches (Small, Medium, Large Rough Patches).
 * Tracks placement, overlap, and grid cell coverage.
 * 
 * Area terrain characteristics:
 * - Can overlap other area terrain by up to 20%
 * - Does not block movement (models can traverse)
 * - Applies 2× movement cost when crossed
 * - Placed first, before other terrain types
 * - Other terrain can be placed on top
 */

import { TerrainFeature } from './Terrain';
import { TerrainElement } from './TerrainElement';
import { Position } from '../Position';

/**
 * Area terrain patch information
 */
export interface AreaTerrainPatch {
  /** Terrain feature with vertices */
  feature: TerrainFeature;
  /** Patch type name */
  typeName: 'Small Rough Patch' | 'Medium Rough Patch' | 'Large Rough Patch';
  /** Area in square MU */
  area: number;
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Overlap amount with existing patches (0.0-1.0) */
  overlapRatio: number;
}

/**
 * Grid cell coverage information
 */
export interface CellCoverage {
  /** Cell center position */
  position: Position;
  /** Is this cell covered by area terrain? */
  isCovered: boolean;
  /** Which patch covers this cell (if any) */
  patchIndex: number | null;
  /** Movement cost multiplier (1.0 for clear, 2.0 for rough) */
  movementCost: number;
}

/**
 * Area terrain layer configuration
 */
export interface AreaTerrainLayerConfig {
  /** Battlefield width in MU */
  width: number;
  /** Battlefield height in MU */
  height: number;
  /** Grid resolution for cell tracking (default: 0.5 MU) */
  cellResolution?: number;
  /** Maximum allowed overlap ratio (default: 0.20 = 20%) */
  maxOverlapRatio?: number;
}

/**
 * Area terrain placement result
 */
export interface AreaTerrainPlacement {
  /** Successfully placed patches */
  patches: AreaTerrainPatch[];
  /** Patches rejected due to excessive overlap */
  rejected: number;
  /** Total placement attempts */
  attempts: number;
  /** Coverage statistics */
  stats: {
    /** Total battlefield area */
    totalArea: number;
    /** Area covered by rough terrain */
    coveredArea: number;
    /** Coverage ratio (0.0-1.0) */
    coverageRatio: number;
    /** Number of cells covered */
    cellsCovered: number;
    /** Total cells */
    totalCells: number;
  };
}

/**
 * Area Terrain Layer
 * 
 * Manages rough terrain patches and their coverage.
 */
export class AreaTerrainLayer {
  /** Placed area terrain patches */
  private patches: AreaTerrainPatch[] = [];
  /** Grid cell coverage map */
  private cellCoverage: Map<string, CellCoverage> = new Map();
  /** Battlefield dimensions */
  private width: number;
  private height: number;
  /** Grid resolution in MU */
  private cellResolution: number;
  /** Maximum allowed overlap (0.0-1.0) */
  private maxOverlapRatio: number;

  constructor(config: AreaTerrainLayerConfig) {
    this.width = config.width;
    this.height = config.height;
    this.cellResolution = config.cellResolution ?? 0.5;
    this.maxOverlapRatio = config.maxOverlapRatio ?? 0.20;
  }

  /**
   * Get all placed patches
   */
  getPatches(): AreaTerrainPatch[] {
    return [...this.patches];
  }

  /**
   * Get patch count
   */
  getPatchCount(): number {
    return this.patches.length;
  }

  /**
   * Clear all patches
   */
  clear(): void {
    this.patches = [];
    this.cellCoverage.clear();
  }

  /**
   * Try to place an area terrain patch
   * 
   * @param typeName - Patch type name
   * @param position - Center position
   * @param rotation - Rotation in degrees
   * @returns True if placement successful
   */
  tryPlace(
    typeName: 'Small Rough Patch' | 'Medium Rough Patch' | 'Large Rough Patch',
    position: Position,
    rotation: number = 0
  ): boolean {
    // Create terrain element
    const element = new TerrainElement(typeName, position, rotation);
    const feature = element.toFeature();

    // Calculate area
    const area = element.getArea();

    // Calculate bounds
    const bounds = this.calculateBounds(feature.vertices);

    // Calculate overlap with existing patches
    const overlapRatio = this.calculateOverlapRatio(feature, bounds);

    // Check if overlap exceeds limit
    if (overlapRatio > this.maxOverlapRatio) {
      return false;
    }

    // Create patch record
    const patch: AreaTerrainPatch = {
      feature,
      typeName,
      area,
      bounds,
      overlapRatio,
    };

    // Add to patches
    this.patches.push(patch);

    // Update cell coverage
    this.updateCellCoverage(patch, this.patches.length - 1);

    return true;
  }

  /**
   * Check if a position is covered by area terrain
   */
  isCovered(position: Position): boolean {
    const key = this.getCellKey(position);
    const coverage = this.cellCoverage.get(key);
    if (coverage) {
      return coverage.isCovered;
    }

    // Fallback: check patches directly
    return this.patches.some(patch => 
      this.pointInPolygon(position, patch.feature.vertices)
    );
  }

  /**
   * Get movement cost at position
   */
  getMovementCost(position: Position): number {
    const key = this.getCellKey(position);
    const coverage = this.cellCoverage.get(key);
    return coverage?.movementCost ?? 1.0;
  }

  /**
   * Get cell coverage info
   */
  getCellCoverage(position: Position): CellCoverage | undefined {
    const key = this.getCellKey(position);
    return this.cellCoverage.get(key);
  }

  /**
   * Get all covered cells
   */
  getCoveredCells(): CellCoverage[] {
    return Array.from(this.cellCoverage.values())
      .filter(cell => cell.isCovered);
  }

  /**
   * Calculate placement statistics
   */
  getStats(): AreaTerrainPlacement['stats'] {
    const totalArea = this.width * this.height;
    const coveredArea = this.patches.reduce((sum, patch) => sum + patch.area, 0);
    
    // Count covered cells
    let cellsCovered = 0;
    for (const coverage of this.cellCoverage.values()) {
      if (coverage.isCovered) {
        cellsCovered++;
      }
    }

    const totalCells = this.cellCoverage.size;

    return {
      totalArea,
      coveredArea,
      coverageRatio: coveredArea / totalArea,
      cellsCovered,
      totalCells,
    };
  }

  /**
   * Calculate bounding box for vertices
   */
  private calculateBounds(vertices: Position[]): { minX: number; minY: number; maxX: number; maxY: number } {
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
   * Calculate overlap ratio for a new patch
   */
  private calculateOverlapRatio(feature: TerrainFeature, bounds: AreaTerrainPatch['bounds']): number {
    if (this.patches.length === 0) {
      return 0;
    }

    // Quick rejection: check bounding boxes
    const overlappingPatches = this.patches.filter(patch => 
      bounds.maxX > patch.bounds.minX &&
      bounds.minX < patch.bounds.maxX &&
      bounds.maxY > patch.bounds.minY &&
      bounds.minY < patch.bounds.maxY
    );

    if (overlappingPatches.length === 0) {
      return 0;
    }

    // Calculate actual overlap area using sampling
    const sampleArea = this.calculateArea(feature.vertices);
    if (sampleArea === 0) return 0;

    const overlapArea = this.calculateOverlapArea(feature.vertices, overlappingPatches);
    return overlapArea / sampleArea;
  }

  /**
   * Calculate polygon area
   */
  private calculateArea(vertices: Position[]): number {
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
   * Calculate overlap area with existing patches
   */
  private calculateOverlapArea(
    vertices: Position[],
    overlappingPatches: AreaTerrainPatch[]
  ): number {
    // Use grid sampling for overlap calculation
    const bounds = this.calculateBounds(vertices);
    const sampleSpacing = this.cellResolution;
    
    let totalSamples = 0;
    let overlapSamples = 0;

    for (let x = bounds.minX; x <= bounds.maxX; x += sampleSpacing) {
      for (let y = bounds.minY; y <= bounds.maxY; y += sampleSpacing) {
        const point = { x, y };
        if (this.pointInPolygon(point, vertices)) {
          totalSamples++;
          
          // Check if this point is already covered by existing patches
          for (const patch of overlappingPatches) {
            if (this.pointInPolygon(point, patch.feature.vertices)) {
              overlapSamples++;
              break;
            }
          }
        }
      }
    }

    if (totalSamples === 0) return 0;

    // Calculate overlap area proportion
    const polygonArea = this.calculateArea(vertices);
    return (overlapSamples / totalSamples) * polygonArea;
  }

  /**
   * Update cell coverage for a patch
   */
  private updateCellCoverage(patch: AreaTerrainPatch, patchIndex: number): void {
    const bounds = patch.bounds;
    const sampleSpacing = this.cellResolution;

    // Mark cells within the patch bounds
    for (let x = bounds.minX; x <= bounds.maxX; x += sampleSpacing) {
      for (let y = bounds.minY; y <= bounds.maxY; y += sampleSpacing) {
        const center = { x: x + sampleSpacing / 2, y: y + sampleSpacing / 2 };
        
        if (this.pointInPolygon(center, patch.feature.vertices)) {
          const key = this.getCellKey(center);
          this.cellCoverage.set(key, {
            position: center,
            isCovered: true,
            patchIndex,
            movementCost: 2.0, // Rough terrain = 2× cost
          });
        }
      }
    }
  }

  /**
   * Get cell key for map lookup
   */
  private getCellKey(position: Position): string {
    const cellX = Math.floor(position.x / this.cellResolution);
    const cellY = Math.floor(position.y / this.cellResolution);
    return `${cellX},${cellY}`;
  }

  /**
   * Check if point is inside polygon
   */
  private pointInPolygon(point: Position, polygon: Position[]): boolean {
    if (polygon.length < 3) return false;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersects = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || Number.EPSILON) + xi);

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Export patches as terrain features
   */
  exportFeatures(): TerrainFeature[] {
    return this.patches.map(patch => patch.feature);
  }
}

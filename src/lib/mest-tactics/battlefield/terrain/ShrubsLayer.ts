/**
 * Shrubs Layer
 *
 * Manages shrub placement with overlap rules.
 * Shrubs cannot overlap other shrubs or structures (buildings, walls).
 * Shrubs CAN overlap area terrain (rough patches).
 * Shrubs CAN TOUCH structures and rocks (zero clearance).
 *
 * QSR Rules:
 * - Shrubs cannot overlap shrubs
 * - Shrubs cannot overlap walls or buildings
 * - Shrubs can overlap rough patches (area terrain)
 * - Shrubs can touch structures and rocks (0 MU clearance)
 */

import { TerrainFeature } from './Terrain';
import { TerrainElement } from './TerrainElement';
import { Position } from '../Position';
import {
  calculateBounds,
  expandBounds,
  boundsOverlap,
  isWithinPlaceableArea,
} from './TerrainUtils';

/**
 * Shrub placement result
 */
export interface ShrubPlacement {
  /** Placed shrub feature */
  feature: TerrainFeature;
  /** Shrub type name */
  typeName: string;
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Clearance zone (shrub bounds + clearance margin) */
  clearanceBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Shrubs layer configuration
 */
export interface ShrubsLayerConfig {
  /** Battlefield width in MU */
  width: number;
  /** Battlefield height in MU */
  height: number;
  /** Minimum clearance between shrubs and structures (default: 0 MU for shrubs) */
  minClearance?: number;
  /** Edge margin (default: 0.5 MU) */
  edgeMargin?: number;
}

/**
 * Shrubs layer placement result
 */
export interface ShrubsLayerResult {
  /** Successfully placed shrubs */
  shrubs: ShrubPlacement[];
  /** Shrubs rejected due to overlap violations */
  rejected: number;
  /** Total placement attempts */
  attempts: number;
  /** Coverage statistics */
  stats: {
    /** Total battlefield area */
    totalArea: number;
    /** Area covered by shrubs */
    shrubArea: number;
    /** Coverage ratio (shrub area / total area) */
    coverageRatio: number;
  };
}

/**
 * Structure bounds for overlap checking
 */
export interface StructureBounds {
  /** Structure clearance bounds */
  clearanceBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Shrubs Layer
 *
 * Manages shrub placement with overlap rules.
 * Uses same placement logic as RocksLayer but with zero clearance.
 */
export class ShrubsLayer {
  /** Placed shrubs */
  private shrubs: ShrubPlacement[] = [];
  /** Battlefield dimensions */
  private width: number;
  private height: number;
  /** Minimum clearance between shrubs and structures (0 for shrubs) */
  private minClearance: number;
  /** Edge margin */
  private edgeMargin: number;

  constructor(config: ShrubsLayerConfig) {
    this.width = config.width;
    this.height = config.height;
    this.minClearance = config.minClearance ?? 0.0;  // ZERO clearance for shrubs
    this.edgeMargin = config.edgeMargin ?? 0.5;
  }

  /**
   * Get all placed shrubs
   */
  getShrubs(): ShrubPlacement[] {
    return [...this.shrubs];
  }

  /**
   * Get shrub count
   */
  getShrubCount(): number {
    return this.shrubs.length;
  }

  /**
   * Clear all shrubs
   */
  clear(): void {
    this.shrubs = [];
  }

  /**
   * Set structure bounds for overlap checking
   * @param structures - Array of structure bounds (buildings, walls)
   */
  setStructures(structures: StructureBounds[]): void {
    // Store structures for overlap checking
    this.structures = structures;
  }
  private structures: StructureBounds[] = [];

  /**
   * Try to place a shrub
   *
   * @param typeName - Shrub type name (e.g., 'Shrub')
   * @param position - Center position
   * @param rotation - Rotation in degrees (ignored for circular shrubs)
   * @returns True if placement successful
   */
  tryPlace(typeName: string, position: Position, rotation: number = 0): boolean {
    // Check if position is within placeable area (respecting edge margin)
    if (!this.isWithinPlaceableArea(position, typeName)) {
      return false;
    }

    // Create terrain element (rotation ignored for circular shrubs)
    const element = new TerrainElement(typeName, position, 0);
    const feature = element.toFeature();

    // Calculate bounds
    const bounds = calculateBounds(feature.vertices);
    const clearanceBounds = expandBounds(bounds, this.minClearance);

    // Check overlap against all existing shrubs
    for (const existing of this.shrubs) {
      if (boundsOverlap(clearanceBounds, existing.clearanceBounds)) {
        return false;
      }
    }

    // Check overlap against structures (buildings, walls)
    // Shrubs use ZERO clearance - can touch but not overlap
    for (const structure of this.structures) {
      if (boundsOverlap(clearanceBounds, structure.clearanceBounds)) {
        return false;
      }
    }

    // Create placement record
    const placement: ShrubPlacement = {
      feature,
      typeName,
      bounds,
      clearanceBounds,
    };

    // Add to shrubs
    this.shrubs.push(placement);

    return true;
  }

  /**
   * Check if position is within placeable area (not too close to edges)
   */
  private isWithinPlaceableArea(position: Position, typeName: string): boolean {
    // Get approximate size for this shrub type
    const size = this.getShrubSize(typeName);
    const halfSize = size / 2;
    const maxExtent = halfSize + this.edgeMargin;

    return (
      position.x >= maxExtent &&
      position.x <= this.width - maxExtent &&
      position.y >= maxExtent &&
      position.y <= this.height - maxExtent
    );
  }

  /**
   * Get approximate size for shrub type
   */
  private getShrubSize(typeName: string): number {
    const sizes: Record<string, number> = {
      'Shrub': 1.0,      // 1 MU diameter
      'Bush': 1.0,       // 1 MU diameter
    };
    return sizes[typeName] ?? 1.0;
  }

  /**
   * Calculate placement statistics
   */
  getStats(): ShrubsLayerResult['stats'] {
    const totalArea = this.width * this.height;

    let shrubArea = 0;

    for (const shrub of this.shrubs) {
      // Shrub area (actual footprint)
      const width = shrub.bounds.maxX - shrub.bounds.minX;
      const height = shrub.bounds.maxY - shrub.bounds.minY;
      shrubArea += width * height;
    }

    return {
      totalArea,
      shrubArea,
      coverageRatio: shrubArea / totalArea,
    };
  }

  /**
   * Export shrubs as terrain features
   */
  exportFeatures(): TerrainFeature[] {
    return this.shrubs.map(s => s.feature);
  }

  /**
   * Get shrub bounds for passing to next layer
   */
  getStructureBounds(): StructureBounds[] {
    return this.shrubs.map(s => ({
      clearanceBounds: s.clearanceBounds,
    }));
  }
}

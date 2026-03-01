/**
 * Rocks Layer
 *
 * Manages rock placement with overlap rules.
 * Rocks cannot overlap other rocks or structures (buildings, walls).
 * Rocks CAN overlap area terrain (rough patches).
 *
 * QSR Rules:
 * - Rocks cannot overlap rocks
 * - Rocks cannot overlap walls or buildings
 * - Rocks can overlap rough patches (area terrain)
 * - Minimum clearance: 0.5 MU between rocks and structures
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
 * Rock placement result
 */
export interface RockPlacement {
  /** Placed rock feature */
  feature: TerrainFeature;
  /** Rock type name */
  typeName: string;
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Clearance zone (rock bounds + clearance margin) */
  clearanceBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Rocks layer configuration
 */
export interface RocksLayerConfig {
  /** Battlefield width in MU */
  width: number;
  /** Battlefield height in MU */
  height: number;
  /** Minimum clearance between rocks and structures (default: 0.5 MU) */
  minClearance?: number;
  /** Edge margin (default: 0.5 MU) */
  edgeMargin?: number;
}

/**
 * Rocks layer placement result
 */
export interface RocksLayerResult {
  /** Successfully placed rocks */
  rocks: RockPlacement[];
  /** Rocks rejected due to overlap violations */
  rejected: number;
  /** Total placement attempts */
  attempts: number;
  /** Coverage statistics */
  stats: {
    /** Total battlefield area */
    totalArea: number;
    /** Area covered by rocks */
    rockArea: number;
    /** Coverage ratio (rock area / total area) */
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
 * Rocks Layer
 * 
 * Manages rock placement with overlap rules.
 */
export class RocksLayer {
  /** Placed rocks */
  private rocks: RockPlacement[] = [];
  /** Battlefield dimensions */
  private width: number;
  private height: number;
  /** Minimum clearance between rocks and structures */
  private minClearance: number;
  /** Edge margin */
  private edgeMargin: number;

  constructor(config: RocksLayerConfig) {
    this.width = config.width;
    this.height = config.height;
    this.minClearance = config.minClearance ?? 0.5;
    this.edgeMargin = config.edgeMargin ?? 0.5;
  }

  /**
   * Get all placed rocks
   */
  getRocks(): RockPlacement[] {
    return [...this.rocks];
  }

  /**
   * Get rock count
   */
  getRockCount(): number {
    return this.rocks.length;
  }

  /**
   * Clear all rocks
   */
  clear(): void {
    this.rocks = [];
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
   * Try to place a rock
   * 
   * @param typeName - Rock type name (e.g., 'Small Rocks', 'Medium Rocks')
   * @param position - Center position
   * @param rotation - Rotation in degrees
   * @returns True if placement successful
   */
  tryPlace(typeName: string, position: Position, rotation: number = 0): boolean {
    // Check if position is within placeable area (respecting edge margin)
    if (!this.isWithinPlaceableArea(position, typeName)) {
      return false;
    }

    // Create terrain element
    const element = new TerrainElement(typeName, position, rotation);
    const feature = element.toFeature();

    // Calculate bounds
    const bounds = calculateBounds(feature.vertices);
    const clearanceBounds = expandBounds(bounds, this.minClearance);

    // Check overlap against all existing rocks
    for (const existing of this.rocks) {
      if (boundsOverlap(clearanceBounds, existing.clearanceBounds)) {
        return false;
      }
    }

    // Check overlap against structures (buildings, walls)
    for (const structure of this.structures) {
      if (boundsOverlap(clearanceBounds, structure.clearanceBounds)) {
        return false;
      }
    }

    // Create placement record
    const placement: RockPlacement = {
      feature,
      typeName,
      bounds,
      clearanceBounds,
    };

    // Add to rocks
    this.rocks.push(placement);

    return true;
  }

  /**
   * Try to place a rock at a specific position with retry on rotation
   * Tries multiple rotations to find a valid placement
   */
  tryPlaceWithRotation(typeName: string, position: Position, rotations: number[] = [0, 90, 45, 135, 180]): boolean {
    for (const rotation of rotations) {
      if (this.tryPlace(typeName, position, rotation)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if position is within placeable area (not too close to edges)
   */
  private isWithinPlaceableArea(position: Position, typeName: string): boolean {
    // Get approximate size for this rock type
    const size = this.getRockSize(typeName);
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
   * Get approximate size for rock type
   */
  private getRockSize(typeName: string): number {
    const sizes: Record<string, number> = {
      'Small Rocks': 1.5,
      'Medium Rocks': 2.0,
      'Large Rocks': 2.5,
    };
    return sizes[typeName] ?? 1.5;
  }

  /**
   * Calculate placement statistics
   */
  getStats(): RocksLayerResult['stats'] {
    const totalArea = this.width * this.height;
    
    let rockArea = 0;

    for (const rock of this.rocks) {
      // Rock area (actual footprint)
      const width = rock.bounds.maxX - rock.bounds.minX;
      const height = rock.bounds.maxY - rock.bounds.minY;
      rockArea += width * height;
    }

    return {
      totalArea,
      rockArea,
      coverageRatio: rockArea / totalArea,
    };
  }

  /**
   * Export rocks as terrain features
   */
  exportFeatures(): TerrainFeature[] {
    return this.rocks.map(r => r.feature);
  }

  /**
   * Get structure bounds for passing to next layer
   */
  getStructureBounds(): StructureBounds[] {
    return this.rocks.map(r => ({
      clearanceBounds: r.clearanceBounds,
    }));
  }
}

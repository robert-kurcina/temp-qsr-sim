/**
 * Trees Layer
 *
 * Manages tree placement with overlap rules.
 * Trees can overlap other trees by up to 20%.
 * Trees can touch structures and rocks (0 clearance).
 * Trees can overlap area terrain (rough patches).
 *
 * QSR Rules:
 * - Trees can overlap trees (up to 20%)
 * - Trees can touch walls (0 clearance)
 * - Trees can touch buildings (0 clearance)
 * - Trees can touch rocks (0 clearance)
 * - Trees can overlap rough patches (area terrain)
 */

import { TerrainFeature } from './Terrain';
import { TerrainElement } from './TerrainElement';
import { Position } from '../Position';
import {
  calculateBounds,
  expandBounds,
  boundsOverlap,
  isWithinPlaceableArea,
  calculateOverlapArea,
} from './TerrainUtils';

/**
 * Tree placement result
 */
export interface TreePlacement {
  /** Placed tree feature */
  feature: TerrainFeature;
  /** Tree type name */
  typeName: string;
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Clearance zone (tree bounds + clearance margin) */
  clearanceBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Trees layer configuration
 */
export interface TreesLayerConfig {
  /** Battlefield width in MU */
  width: number;
  /** Battlefield height in MU */
  height: number;
  /** Minimum clearance between trees and structures (default: 0 MU for trees) */
  minClearance?: number;
  /** Edge margin (default: 0.5 MU) */
  edgeMargin?: number;
  /** Maximum overlap allowed between trees (default: 0.20 = 20%) */
  maxOverlapRatio?: number;
}

/**
 * Trees layer placement result
 */
export interface TreesLayerResult {
  /** Successfully placed trees */
  trees: TreePlacement[];
  /** Trees rejected due to overlap violations */
  rejected: number;
  /** Total placement attempts */
  attempts: number;
  /** Coverage statistics */
  stats: {
    /** Total battlefield area */
    totalArea: number;
    /** Area covered by trees */
    treeArea: number;
    /** Coverage ratio (tree area / total area) */
    coverageRatio: number;
  };
}

/**
 * Structure bounds for overlap checking
 */
export interface StructureBounds {
  /** Structure bounds */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Trees Layer
 *
 * Manages tree placement with 20% overlap allowance.
 */
export class TreesLayer {
  /** Placed trees */
  private trees: TreePlacement[] = [];
  /** Battlefield dimensions */
  private width: number;
  private height: number;
  /** Minimum clearance between trees and structures (0 for trees) */
  private minClearance: number;
  /** Edge margin */
  private edgeMargin: number;
  /** Maximum overlap ratio between trees (0.20 = 20%) */
  private maxOverlapRatio: number;

  constructor(config: TreesLayerConfig) {
    this.width = config.width;
    this.height = config.height;
    this.minClearance = config.minClearance ?? 0.0;  // ZERO clearance for trees
    this.edgeMargin = config.edgeMargin ?? 0.5;
    this.maxOverlapRatio = config.maxOverlapRatio ?? 0.20;  // 20% overlap allowed
  }

  /**
   * Get all placed trees
   */
  getTrees(): TreePlacement[] {
    return [...this.trees];
  }

  /**
   * Get tree count
   */
  getTreeCount(): number {
    return this.trees.length;
  }

  /**
   * Clear all trees
   */
  clear(): void {
    this.trees = [];
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
   * Try to place a tree
   *
   * @param typeName - Tree type name (e.g., 'Tree')
   * @param position - Center position
   * @param rotation - Rotation in degrees (ignored for circular trees)
   * @returns True if placement successful
   */
  tryPlace(typeName: string, position: Position, rotation: number = 0): boolean {
    // Check if position is within placeable area (respecting edge margin)
    if (!this.isWithinPlaceableArea(position, typeName)) {
      return false;
    }

    // Create terrain element (rotation ignored for circular trees)
    const element = new TerrainElement(typeName, position, 0);
    const feature = element.toFeature();

    // Calculate bounds
    const bounds = calculateBounds(feature.vertices);
    const clearanceBounds = expandBounds(bounds, this.minClearance);

    // Check overlap against existing trees (allow 20% overlap)
    for (const existing of this.trees) {
      if (this.treesOverlap(clearanceBounds, existing.clearanceBounds)) {
        return false;
      }
    }

    // Check overlap against structures (buildings, walls)
    // Trees use ZERO clearance - can touch but not overlap
    for (const structure of this.structures) {
      if (boundsOverlap(clearanceBounds, structure.bounds)) {
        return false;
      }
    }

    // Create placement record
    const placement: TreePlacement = {
      feature,
      typeName,
      bounds,
      clearanceBounds,
    };

    // Add to trees
    this.trees.push(placement);

    return true;
  }

  /**
   * Check if two trees overlap too much (>20%)
   * Trees can overlap by up to 20% of their area
   */
  private treesOverlap(
    a: { minX: number; minY: number; maxX: number; maxY: number },
    b: { minX: number; minY: number; maxX: number; maxY: number }
  ): boolean {
    // For trees, we allow 20% overlap
    // Simple approximation: check if bounding boxes overlap more than 20%
    const overlap = calculateOverlapArea(a, b);
    const treeArea = (a.maxX - a.minX) * (a.maxY - a.minY);
    
    // Reject if overlap > 20% of tree area
    return overlap > (treeArea * this.maxOverlapRatio);
  }

  /**
   * Check if position is within placeable area (not too close to edges)
   */
  private isWithinPlaceableArea(position: Position, typeName: string): boolean {
    // Get approximate size for this tree type
    const size = this.getTreeSize(typeName);
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
   * Get approximate size for tree type
   */
  private getTreeSize(typeName: string): number {
    const sizes: Record<string, number> = {
      'Tree': 2.0,      // 2 MU diameter
    };
    return sizes[typeName] ?? 2.0;
  }

  /**
   * Calculate placement statistics
   */
  getStats(): TreesLayerResult['stats'] {
    const totalArea = this.width * this.height;

    let treeArea = 0;

    for (const tree of this.trees) {
      // Tree area (actual footprint - circle area)
      const radius = (tree.bounds.maxX - tree.bounds.minX) / 2;
      treeArea += Math.PI * radius * radius;
    }

    return {
      totalArea,
      treeArea,
      coverageRatio: treeArea / totalArea,
    };
  }

  /**
   * Export trees as terrain features
   */
  exportFeatures(): TerrainFeature[] {
    return this.trees.map(t => t.feature);
  }
}

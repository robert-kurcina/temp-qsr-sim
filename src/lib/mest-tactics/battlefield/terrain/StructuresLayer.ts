/**
 * Structures Layer
 *
 * Manages building and wall placement with clearance rules.
 * Structures cannot overlap each other but can overlap area terrain.
 *
 * QSR Rules:
 * - Walls cannot overlap walls or buildings
 * - Buildings cannot overlap walls or buildings
 * - Minimum clearance: 1 MU between structures
 * - Structures reduce available area for subsequent layers (rocks, shrubs, trees)
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
 * Structure placement result
 */
export interface StructurePlacement {
  /** Placed structure feature */
  feature: TerrainFeature;
  /** Structure type name */
  typeName: string;
  /** Bounding box */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Clearance zone (structure bounds + clearance margin) */
  clearanceBounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Structures layer configuration
 */
export interface StructuresLayerConfig {
  /** Battlefield width in MU */
  width: number;
  /** Battlefield height in MU */
  height: number;
  /** Minimum clearance between structures (default: 0.5 MU) */
  minClearance?: number;
  /** Edge margin (default: 1.0 MU) */
  edgeMargin?: number;
}

/**
 * Structures layer placement result
 */
export interface StructuresLayerResult {
  /** Successfully placed structures */
  structures: StructurePlacement[];
  /** Structures rejected due to clearance violations */
  rejected: number;
  /** Total placement attempts */
  attempts: number;
  /** Coverage statistics */
  stats: {
    /** Total battlefield area */
    totalArea: number;
    /** Area covered by structures (excluding clearance) */
    structureArea: number;
    /** Area blocked by structures + clearance */
    blockedArea: number;
    /** Coverage ratio (structure area / total area) */
    coverageRatio: number;
    /** Blocked ratio (blocked area / total area) */
    blockedRatio: number;
  };
}

/**
 * Structures Layer
 * 
 * Manages building and wall placement with clearance rules.
 */
export class StructuresLayer {
  /** Placed structures */
  private structures: StructurePlacement[] = [];
  /** Battlefield dimensions */
  private width: number;
  private height: number;
  /** Minimum clearance between structures */
  private minClearance: number;
  /** Edge margin */
  private edgeMargin: number;

  constructor(config: StructuresLayerConfig) {
    this.width = config.width;
    this.height = config.height;
    this.minClearance = config.minClearance ?? 0.5;  // Reduced from 1.0 to 0.5 MU
    this.edgeMargin = config.edgeMargin ?? 1.0;
  }

  /**
   * Get all placed structures
   */
  getStructures(): StructurePlacement[] {
    return [...this.structures];
  }

  /**
   * Get structure count
   */
  getStructureCount(): number {
    return this.structures.length;
  }

  /**
   * Clear all structures
   */
  clear(): void {
    this.structures = [];
  }

  /**
   * Try to place a structure
   * 
   * @param typeName - Structure type name (e.g., 'Small Building', 'Short Wall')
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

    // Check clearance against all existing structures
    // (Structures cannot overlap other structures, including clearance zones)
    for (const existing of this.structures) {
      if (boundsOverlap(clearanceBounds, existing.clearanceBounds)) {
        return false;
      }
    }

    // Create placement record
    const placement: StructurePlacement = {
      feature,
      typeName,
      bounds,
      clearanceBounds,
    };

    // Add to structures
    this.structures.push(placement);

    return true;
  }

  /**
   * Try to place a structure at a specific position with retry on rotation
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
    // Get approximate size for this structure type
    const size = this.getStructureSize(typeName);
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
   * Get approximate size for structure type
   */
  private getStructureSize(typeName: string): number {
    const sizes: Record<string, number> = {
      'Small Building': 4.0,
      'Medium Building': 5.0,
      'Short Wall': 3.0,
      'Medium Wall': 4.0,
    };
    return sizes[typeName] ?? 3.0;
  }

  /**
   * Calculate placement statistics
   */
  getStats(): StructuresLayerResult['stats'] {
    const totalArea = this.width * this.height;
    
    let structureArea = 0;
    let blockedArea = 0;

    for (const structure of this.structures) {
      // Structure area (actual footprint)
      const width = structure.bounds.maxX - structure.bounds.minX;
      const height = structure.bounds.maxY - structure.bounds.minY;
      structureArea += width * height;

      // Blocked area (including clearance)
      const clearWidth = structure.clearanceBounds.maxX - structure.clearanceBounds.minX;
      const clearHeight = structure.clearanceBounds.maxY - structure.clearanceBounds.minY;
      blockedArea += clearWidth * clearHeight;
    }

    return {
      totalArea,
      structureArea,
      blockedArea: Math.min(blockedArea, totalArea), // Cap at total area
      coverageRatio: structureArea / totalArea,
      blockedRatio: Math.min(blockedArea / totalArea, 1.0),
    };
  }

  /**
   * Export structures as terrain features
   */
  exportFeatures(): TerrainFeature[] {
    return this.structures.map(s => s.feature);
  }

  /**
   * Get blocked area ratio for subsequent layer placement
   */
  getBlockedAreaRatio(): number {
    return this.getStats().blockedRatio;
  }

  /**
   * Get structure bounds for rocks layer overlap checking
   */
  getStructureBounds(): { clearanceBounds: { minX: number; minY: number; maxX: number; maxY: number } }[] {
    return this.structures.map(s => ({
      clearanceBounds: s.clearanceBounds,
    }));
  }

  /**
   * Get actual structure bounds (without clearance) for shrub placement
   * Shrubs can touch structures, so they need actual bounds not clearance bounds
   */
  getActualBounds(): { bounds: { minX: number; minY: number; maxX: number; maxY: number } }[] {
    return this.structures.map(s => ({
      bounds: s.bounds,
    }));
  }
}

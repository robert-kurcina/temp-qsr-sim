import { Position } from './battlefield/Position';
import { SpatialModel } from './battlefield/spatial/spatial-rules';

/**
 * Types of points of interest / control zones
 */
export enum POIType {
  /** Standard control zone */
  ControlZone = 'ControlZone',
  /** Beacon location */
  Beacon = 'Beacon',
  /** Extraction point */
  ExtractionPoint = 'ExtractionPoint',
  /** Drop zone for reinforcements */
  DropZone = 'DropZone',
  /** Objective marker spawn point */
  ObjectiveSpawn = 'ObjectiveSpawn',
  /** Safe zone (no combat allowed) */
  SafeZone = 'SafeZone',
  /** Danger zone (hazardous terrain) */
  DangerZone = 'DangerZone',
  /** Special mission-specific zone */
  Special = 'Special',
}

/**
 * Zone shape for different area types
 */
export enum ZoneShape {
  Circle = 'Circle',
  Rectangle = 'Rectangle',
  Polygon = 'Polygon',
}

/**
 * Zone control state
 */
export enum ZoneControlState {
  /** Zone is uncontrolled (neutral) */
  Uncontrolled = 'Uncontrolled',
  /** Zone is contested (multiple sides present) */
  Contested = 'Contested',
  /** Zone is controlled by a side */
  Controlled = 'Controlled',
  /** Zone is locked (cannot be contested) */
  Locked = 'Locked',
  /** Zone is destroyed/unavailable */
  Destroyed = 'Destroyed',
}

/**
 * Point of Interest / Control Zone definition
 */
export interface PointOfInterest {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Zone type */
  type: POIType;
  /** Zone shape */
  shape: ZoneShape;
  /** Zone center position */
  position: Position;
  /** Zone radius (for circles) or half-width (for rectangles) */
  radius: number;
  /** Zone height (for rectangles) */
  height?: number;
  /** Polygon vertices (for polygon zones) */
  vertices?: Position[];
  /** Current control state */
  controlState: ZoneControlState;
  /** Side currently controlling the zone */
  controlledBy?: string;
  /** Victory points awarded per turn for control */
  vpPerTurn: number;
  /** Victory points awarded for first control */
  vpFirstControl: number;
  /** Models currently in the zone */
  modelsInZone: string[];
  /** Turns controlled (for scoring) */
  turnsControlled: number;
  /** Metadata for mission-specific data */
  metadata: Record<string, unknown>;
}

/**
 * Configuration for creating a POI
 */
export interface POIConfig {
  id?: string;
  name?: string;
  type?: POIType;
  shape?: ZoneShape;
  position: Position;
  radius?: number;
  height?: number;
  vertices?: Position[];
  vpPerTurn?: number;
  vpFirstControl?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new Point of Interest
 */
export function createPOI(config: POIConfig): PointOfInterest {
  const shape = config.shape ?? ZoneShape.Circle;
  const radius = config.radius ?? 2;

  return {
    id: config.id ?? `poi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: config.name ?? 'Control Zone',
    type: config.type ?? POIType.ControlZone,
    shape,
    position: config.position,
    radius,
    height: config.height,
    vertices: config.vertices,
    controlState: ZoneControlState.Uncontrolled,
    controlledBy: undefined,
    vpPerTurn: config.vpPerTurn ?? 1,
    vpFirstControl: config.vpFirstControl ?? 0,
    modelsInZone: [],
    turnsControlled: 0,
    metadata: config.metadata ?? {},
  };
}

/**
 * Zone control change result
 */
export interface ZoneControlResult {
  success: boolean;
  poi: PointOfInterest;
  previousState: ZoneControlState;
  newState: ZoneControlState;
  previousController?: string;
  newController?: string;
  victoryPointsAwarded: number;
  reason?: string;
}

/**
 * POI Manager - handles all POI/zone operations
 */
export class POIManager {
  private pois: Map<string, PointOfInterest> = new Map();

  /**
   * Add a POI to the manager
   */
  addPOI(poi: PointOfInterest): void {
    this.pois.set(poi.id, poi);
  }

  /**
   * Remove a POI from the manager
   */
  removePOI(poiId: string): boolean {
    return this.pois.delete(poiId);
  }

  /**
   * Get a POI by ID
   */
  getPOI(poiId: string): PointOfInterest | undefined {
    return this.pois.get(poiId);
  }

  /**
   * Get all POIs
   */
  getAllPOIs(): PointOfInterest[] {
    return Array.from(this.pois.values());
  }

  /**
   * Get POIs by type
   */
  getPOIsByType(type: POIType): PointOfInterest[] {
    return this.getAllPOIs().filter(p => p.type === type);
  }

  /**
   * Get POIs by control state
   */
  getPOIsByControlState(state: ZoneControlState): PointOfInterest[] {
    return this.getAllPOIs().filter(p => p.controlState === state);
  }

  /**
   * Get POIs controlled by a side
   */
  getPOIsControlledBy(sideId: string): PointOfInterest[] {
    return this.getAllPOIs().filter(p => p.controlledBy === sideId);
  }

  /**
   * Get uncontrolled POIs
   */
  getUncontrolledPOIs(): PointOfInterest[] {
    return this.getPOIsByControlState(ZoneControlState.Uncontrolled);
  }

  /**
   * Get contested POIs
   */
  getContestedPOIs(): PointOfInterest[] {
    return this.getPOIsByControlState(ZoneControlState.Contested);
  }

  /**
   * Check if a position is inside a POI
   */
  isPositionInPOI(position: Position, poiId: string): boolean {
    const poi = this.getPOI(poiId);
    if (!poi) return false;

    return this.isPositionInZone(position, poi);
  }

  /**
   * Check if a position is inside a zone
   */
  private isPositionInZone(position: Position, poi: PointOfInterest): boolean {
    switch (poi.shape) {
      case ZoneShape.Circle:
        return this.isInCircle(position, poi.position, poi.radius);
      case ZoneShape.Rectangle:
        return this.isInRectangle(position, poi.position, poi.radius, poi.height ?? poi.radius);
      case ZoneShape.Polygon:
        if (!poi.vertices) return false;
        return this.isInPolygon(position, poi.vertices);
      default:
        return false;
    }
  }

  private isInCircle(position: Position, center: Position, radius: number): boolean {
    const dx = position.x - center.x;
    const dy = position.y - center.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  private isInRectangle(
    position: Position,
    center: Position,
    halfWidth: number,
    halfHeight: number
  ): boolean {
    return (
      position.x >= center.x - halfWidth &&
      position.x <= center.x + halfWidth &&
      position.y >= center.y - halfHeight &&
      position.y <= center.y + halfHeight
    );
  }

  private isInPolygon(position: Position, vertices: Position[]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].x, yi = vertices[i].y;
      const xj = vertices[j].x, yj = vertices[j].y;
      const intersect =
        ((yi > position.y) !== (yj > position.y)) &&
        (position.x < (xj - xi) * (position.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Check if a model is in a POI
   */
  isModelInPOI(model: SpatialModel, poiId: string): boolean {
    return this.isPositionInPOI(model.position, poiId);
  }

  /**
   * Get all models in a POI
   */
  getModelsInPOI(poiId: string, models: SpatialModel[]): SpatialModel[] {
    return models.filter(model => this.isModelInPOI(model, poiId));
  }

  /**
   * Update models in all POIs
   */
  updateModelsInPOIs(models: SpatialModel[]): void {
    for (const poi of this.getAllPOIs()) {
      poi.modelsInZone = models
        .filter(model => this.isModelInPOI(model, poi.id))
        .map(model => model.id);
    }
  }

  /**
   * Update control state of a POI based on models present
   */
  updateControlState(
    poiId: string,
    models: SpatialModel[],
    sideMapping: Map<string, string> // modelId -> sideId
  ): ZoneControlResult {
    const poi = this.getPOI(poiId);
    if (!poi) {
      return {
        success: false,
        poi: { id: '', name: '', type: POIType.ControlZone, shape: ZoneShape.Circle, position: { x: 0, y: 0 }, radius: 0, controlState: ZoneControlState.Destroyed, vpPerTurn: 0, vpFirstControl: 0, modelsInZone: [], turnsControlled: 0, metadata: {} },
        previousState: ZoneControlState.Destroyed,
        newState: ZoneControlState.Destroyed,
        victoryPointsAwarded: 0,
        reason: 'POI not found',
      };
    }

    const previousState = poi.controlState;
    const previousController = poi.controlledBy;
    let vpAwarded = 0;

    // Get models in this POI
    const modelsInPOI = this.getModelsInPOI(poiId, models);

    if (modelsInPOI.length === 0) {
      // No models - zone becomes uncontrolled
      poi.controlState = ZoneControlState.Uncontrolled;
      poi.controlledBy = undefined;
    } else {
      // Get sides present
      const sidesPresent = new Set<string>();
      for (const model of modelsInPOI) {
        const side = sideMapping.get(model.id);
        if (side) sidesPresent.add(side);
      }

      if (sidesPresent.size === 0) {
        poi.controlState = ZoneControlState.Uncontrolled;
        poi.controlledBy = undefined;
      } else if (sidesPresent.size === 1) {
        // Single side - controlled
        const controllingSide = Array.from(sidesPresent)[0];
        
        if (poi.controlState !== ZoneControlState.Controlled || poi.controlledBy !== controllingSide) {
          // First time controlling
          vpAwarded = poi.vpFirstControl;
        }
        
        poi.controlState = ZoneControlState.Controlled;
        poi.controlledBy = controllingSide;
      } else {
        // Multiple sides - contested
        poi.controlState = ZoneControlState.Contested;
        poi.controlledBy = undefined;
      }
    }

    return {
      success: true,
      poi,
      previousState,
      newState: poi.controlState,
      previousController,
      newController: poi.controlledBy,
      victoryPointsAwarded: vpAwarded,
    };
  }

  /**
   * Award VP for controlling zones at end of turn
   */
  awardTurnControlVP(): Map<string, number> {
    const vpBySide = new Map<string, number>();

    for (const poi of this.getAllPOIs()) {
      if (poi.controlState === ZoneControlState.Controlled && poi.controlledBy) {
        const currentVP = vpBySide.get(poi.controlledBy) ?? 0;
        vpBySide.set(poi.controlledBy, currentVP + poi.vpPerTurn);
        poi.turnsControlled++;
      }
    }

    return vpBySide;
  }

  /**
   * Lock a POI (prevent contesting)
   */
  lockPOI(poiId: string): boolean {
    const poi = this.getPOI(poiId);
    if (!poi) return false;

    poi.controlState = ZoneControlState.Locked;
    return true;
  }

  /**
   * Unlock a POI
   */
  unlockPOI(poiId: string): boolean {
    const poi = this.getPOI(poiId);
    if (!poi) return false;

    if (poi.controlState === ZoneControlState.Locked) {
      poi.controlState = ZoneControlState.Uncontrolled;
    }
    return true;
  }

  /**
   * Destroy a POI
   */
  destroyPOI(poiId: string): boolean {
    const poi = this.getPOI(poiId);
    if (!poi) return false;

    poi.controlState = ZoneControlState.Destroyed;
    poi.modelsInZone = [];
    return true;
  }

  /**
   * Get total VP from zone control for a side
   */
  getTotalControlVP(sideId: string): number {
    let total = 0;
    for (const poi of this.getPOIsControlledBy(sideId)) {
      total += poi.vpPerTurn * poi.turnsControlled + poi.vpFirstControl;
    }
    return total;
  }

  /**
   * Clear all POIs
   */
  clear(): void {
    this.pois.clear();
  }

  /**
   * Export POI state for serialization
   */
  exportState(): Record<string, PointOfInterest> {
    const result: Record<string, PointOfInterest> = {};
    for (const [id, poi] of this.pois.entries()) {
      result[id] = { ...poi };
    }
    return result;
  }

  /**
   * Import POI state from serialization
   */
  importState(state: Record<string, PointOfInterest>): void {
    this.pois.clear();
    for (const [id, poi] of Object.entries(state)) {
      this.pois.set(id, poi);
    }
  }
}

/**
 * Create standard control zones for a mission
 */
export function createControlZones(
  positions: Position[],
  options: {
    radius?: number;
    vpPerTurn?: number;
    vpFirstControl?: number;
  } = {}
): PointOfInterest[] {
  return positions.map((pos, index) =>
    createPOI({
      id: `zone-${index + 1}`,
      name: `Control Zone ${index + 1}`,
      type: POIType.ControlZone,
      position: pos,
      radius: options.radius ?? 3,
      vpPerTurn: options.vpPerTurn ?? 1,
      vpFirstControl: options.vpFirstControl ?? 2,
    })
  );
}

/**
 * Create beacon zones for beacon missions
 */
export function createBeaconZones(
  positions: Position[],
  options: {
    radius?: number;
    vpPerTurn?: number;
    vpFirstControl?: number;
  } = {}
): PointOfInterest[] {
  return positions.map((pos, index) =>
    createPOI({
      id: `beacon-${index + 1}`,
      name: `Beacon ${index + 1}`,
      type: POIType.Beacon,
      position: pos,
      radius: options.radius ?? 2,
      vpPerTurn: options.vpPerTurn ?? 2,
      vpFirstControl: options.vpFirstControl ?? 5,
    })
  );
}

/**
 * Create extraction zones for exfil missions
 */
export function createExtractionZones(
  positions: Position[],
  options: {
    radius?: number;
  } = {}
): PointOfInterest[] {
  return positions.map((pos, index) =>
    createPOI({
      id: `exfil-${index + 1}`,
      name: `Extraction Point ${index + 1}`,
      type: POIType.ExtractionPoint,
      position: pos,
      radius: options.radius ?? 3,
      vpPerTurn: 0,
      vpFirstControl: 0,
    })
  );
}

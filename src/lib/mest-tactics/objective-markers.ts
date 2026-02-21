import { Position } from './battlefield/Position';

/**
 * Types of objective markers used in missions
 */
export enum ObjectiveMarkerType {
  /** Standard objective marker (1 VP) */
  Standard = 'Standard',
  /** High-value marker (2-3 VP) */
  HighValue = 'HighValue',
  /** Beacon marker for beacon missions */
  Beacon = 'Beacon',
  /** Intelligence marker */
  Intel = 'Intel',
  /** Supply marker */
  Supply = 'Supply',
  /** Special mission-specific marker */
  Special = 'Special',
}

/**
 * State of an objective marker
 */
export enum MarkerState {
  /** Marker is available to be picked up */
  Available = 'Available',
  /** Marker is being carried by a model */
  Carried = 'Carried',
  /** Marker is dropped on the battlefield */
  Dropped = 'Dropped',
  /** Marker has been scored/collected */
  Scored = 'Scored',
  /** Marker is destroyed/removed */
  Destroyed = 'Destroyed',
}

/**
 * Objective marker definition
 */
export interface ObjectiveMarker {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Marker type */
  type: ObjectiveMarkerType;
  /** Current state */
  state: MarkerState;
  /** Current position (undefined if carried or scored) */
  position?: Position;
  /** ID of model carrying this marker (if carried) */
  carriedBy?: string;
  /** Victory points this marker is worth */
  victoryPoints: number;
  /** Which side placed this marker (if applicable) */
  placedBy?: string;
  /** Which side currently controls/scored this marker */
  controlledBy?: string;
  /** Mission-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Configuration for creating an objective marker
 */
export interface ObjectiveMarkerConfig {
  id?: string;
  name?: string;
  type?: ObjectiveMarkerType;
  victoryPoints?: number;
  position?: Position;
  placedBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new objective marker
 */
export function createObjectiveMarker(config: ObjectiveMarkerConfig = {}): ObjectiveMarker {
  return {
    id: config.id ?? `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: config.name ?? 'Objective Marker',
    type: config.type ?? ObjectiveMarkerType.Standard,
    state: config.position ? MarkerState.Available : MarkerState.Scored,
    position: config.position,
    carriedBy: undefined,
    victoryPoints: config.victoryPoints ?? 1,
    placedBy: config.placedBy,
    controlledBy: undefined,
    metadata: config.metadata ?? {},
  };
}

/**
 * Objective marker placement options
 */
export interface MarkerPlacementOptions {
  /** Random placement within bounds */
  random?: boolean;
  /** Specific position */
  position?: Position;
  /** Minimum distance from battlefield edges */
  edgeMargin?: number;
  /** Minimum distance between markers */
  minSpacing?: number;
  /** Deployment zone restrictions */
  deploymentZones?: string[];
}

/**
 * Marker movement result
 */
export interface MarkerMoveResult {
  success: boolean;
  marker: ObjectiveMarker;
  previousPosition?: Position;
  previousCarrier?: string;
  reason?: string;
}

/**
 * Marker control change result
 */
export interface MarkerControlResult {
  success: boolean;
  marker: ObjectiveMarker;
  previousController?: string;
  newController?: string;
  victoryPointsAwarded: number;
  reason?: string;
}

/**
 * Objective Marker Manager - handles all marker operations
 */
export class ObjectiveMarkerManager {
  private markers: Map<string, ObjectiveMarker> = new Map();

  /**
   * Add a marker to the manager
   */
  addMarker(marker: ObjectiveMarker): void {
    this.markers.set(marker.id, marker);
  }

  /**
   * Remove a marker from the manager
   */
  removeMarker(markerId: string): boolean {
    return this.markers.delete(markerId);
  }

  /**
   * Get a marker by ID
   */
  getMarker(markerId: string): ObjectiveMarker | undefined {
    return this.markers.get(markerId);
  }

  /**
   * Get all markers
   */
  getAllMarkers(): ObjectiveMarker[] {
    return Array.from(this.markers.values());
  }

  /**
   * Get markers by state
   */
  getMarkersByState(state: MarkerState): ObjectiveMarker[] {
    return this.getAllMarkers().filter(m => m.state === state);
  }

  /**
   * Get markers by type
   */
  getMarkersByType(type: ObjectiveMarkerType): ObjectiveMarker[] {
    return this.getAllMarkers().filter(m => m.type === type);
  }

  /**
   * Get markers controlled by a side
   */
  getMarkersControlledBy(sideId: string): ObjectiveMarker[] {
    return this.getAllMarkers().filter(m => m.controlledBy === sideId);
  }

  /**
   * Get markers carried by a model
   */
  getMarkersCarriedBy(modelId: string): ObjectiveMarker[] {
    return this.getAllMarkers().filter(m => m.carriedBy === modelId);
  }

  /**
   * Get available markers (not carried or scored)
   */
  getAvailableMarkers(): ObjectiveMarker[] {
    return this.getMarkersByState(MarkerState.Available);
  }

  /**
   * Get dropped markers
   */
  getDroppedMarkers(): ObjectiveMarker[] {
    return this.getMarkersByState(MarkerState.Dropped);
  }

  /**
   * Place a marker on the battlefield
   */
  placeMarker(markerId: string, position: Position): MarkerMoveResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        victoryPointsAwarded: 0,
        reason: 'Marker not found',
      };
    }

    const previousPosition = marker.position;
    const previousCarrier = marker.carriedBy;

    marker.position = position;
    marker.state = MarkerState.Available;
    marker.carriedBy = undefined;

    return {
      success: true,
      marker,
      previousPosition,
      previousCarrier,
    };
  }

  /**
   * Pick up a marker with a model
   */
  pickUpMarker(markerId: string, modelId: string): MarkerMoveResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        victoryPointsAwarded: 0,
        reason: 'Marker not found',
      };
    }

    if (marker.state !== MarkerState.Available && marker.state !== MarkerState.Dropped) {
      return {
        success: false,
        marker,
        victoryPointsAwarded: 0,
        reason: `Marker cannot be picked up (state: ${marker.state})`,
      };
    }

    const previousPosition = marker.position;
    const previousCarrier = marker.carriedBy;

    marker.position = undefined;
    marker.carriedBy = modelId;
    marker.state = MarkerState.Carried;

    return {
      success: true,
      marker,
      previousPosition,
      previousCarrier,
    };
  }

  /**
   * Drop a marker at current position
   */
  dropMarker(markerId: string, position: Position): MarkerMoveResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        victoryPointsAwarded: 0,
        reason: 'Marker not found',
      };
    }

    if (marker.state !== MarkerState.Carried) {
      return {
        success: false,
        marker,
        victoryPointsAwarded: 0,
        reason: `Marker cannot be dropped (state: ${marker.state})`,
      };
    }

    const previousCarrier = marker.carriedBy;

    marker.position = position;
    marker.carriedBy = undefined;
    marker.state = MarkerState.Dropped;

    return {
      success: true,
      marker,
      previousCarrier,
    };
  }

  /**
   * Score/collect a marker
   */
  scoreMarker(markerId: string, sideId: string): MarkerControlResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        victoryPointsAwarded: 0,
        reason: 'Marker not found',
      };
    }

    const previousController = marker.controlledBy;
    const vpAwarded = marker.victoryPoints;

    marker.state = MarkerState.Scored;
    marker.controlledBy = sideId;
    marker.position = undefined;
    marker.carriedBy = undefined;

    return {
      success: true,
      marker,
      previousController,
      newController: sideId,
      victoryPointsAwarded: vpAwarded,
    };
  }

  /**
   * Transfer control of a marker (without scoring)
   */
  transferControl(markerId: string, newController: string): MarkerControlResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        victoryPointsAwarded: 0,
        reason: 'Marker not found',
      };
    }

    const previousController = marker.controlledBy;

    marker.controlledBy = newController;

    return {
      success: true,
      marker,
      previousController,
      newController,
      victoryPointsAwarded: 0,
    };
  }

  /**
   * Destroy a marker
   */
  destroyMarker(markerId: string): boolean {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return false;
    }

    marker.state = MarkerState.Destroyed;
    marker.position = undefined;
    marker.carriedBy = undefined;
    return true;
  }

  /**
   * Get total victory points for a side from markers
   */
  getTotalVictoryPoints(sideId: string): number {
    return this.getMarkersControlledBy(sideId)
      .reduce((sum, m) => sum + m.victoryPoints, 0);
  }

  /**
   * Get count of markers by state
   */
  getCountByState(state: MarkerState): number {
    return this.getMarkersByState(state).length;
  }

  /**
   * Clear all markers
   */
  clear(): void {
    this.markers.clear();
  }

  /**
   * Export marker state for serialization
   */
  exportState(): Record<string, ObjectiveMarker> {
    const result: Record<string, ObjectiveMarker> = {};
    for (const [id, marker] of this.markers.entries()) {
      result[id] = { ...marker };
    }
    return result;
  }

  /**
   * Import marker state from serialization
   */
  importState(state: Record<string, ObjectiveMarker>): void {
    this.markers.clear();
    for (const [id, marker] of Object.entries(state)) {
      this.markers.set(id, marker);
    }
  }
}

/**
 * Create a set of standard objective markers for a mission
 */
export function createStandardMarkers(
  count: number,
  options: {
    victoryPoints?: number;
    positions?: Position[];
    placedBy?: string;
  } = {}
): ObjectiveMarker[] {
  const markers: ObjectiveMarker[] = [];
  const vp = options.victoryPoints ?? 1;
  const positions = options.positions ?? [];

  for (let i = 0; i < count; i++) {
    const config: ObjectiveMarkerConfig = {
      id: `obj-${i + 1}`,
      name: `Objective ${i + 1}`,
      type: ObjectiveMarkerType.Standard,
      victoryPoints: vp,
      placedBy: options.placedBy,
    };

    if (positions[i]) {
      config.position = positions[i];
    }

    markers.push(createObjectiveMarker(config));
  }

  return markers;
}

/**
 * Create beacon markers for beacon missions
 */
export function createBeaconMarkers(
  count: number,
  options: {
    victoryPoints?: number;
    positions?: Position[];
  } = {}
): ObjectiveMarker[] {
  const markers: ObjectiveMarker[] = [];
  const vp = options.victoryPoints ?? 2;
  const positions = options.positions ?? [];

  for (let i = 0; i < count; i++) {
    const config: ObjectiveMarkerConfig = {
      id: `beacon-${i + 1}`,
      name: `Beacon ${i + 1}`,
      type: ObjectiveMarkerType.Beacon,
      victoryPoints: vp,
    };

    if (positions[i]) {
      config.position = positions[i];
    }

    markers.push(createObjectiveMarker(config));
  }

  return markers;
}

/**
 * Create intel markers for intelligence-gathering missions
 */
export function createIntelMarkers(
  count: number,
  options: {
    victoryPoints?: number;
    positions?: Position[];
  } = {}
): ObjectiveMarker[] {
  const markers: ObjectiveMarker[] = [];
  const vp = options.victoryPoints ?? 3;
  const positions = options.positions ?? [];

  for (let i = 0; i < count; i++) {
    const config: ObjectiveMarkerConfig = {
      id: `intel-${i + 1}`,
      name: `Intel ${i + 1}`,
      type: ObjectiveMarkerType.Intel,
      victoryPoints: vp,
    };

    if (positions[i]) {
      config.position = positions[i];
    }

    markers.push(createObjectiveMarker(config));
  }

  return markers;
}

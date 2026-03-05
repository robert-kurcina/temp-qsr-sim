import { Position } from '../battlefield/Position';

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
 * QSR objective marker kinds (may be combined)
 */
export enum ObjectiveMarkerKind {
  Switch = 'Switch',
  Lock = 'Lock',
  Key = 'Key',
  Idea = 'Idea',
  Tiny = 'Tiny',
  Small = 'Small',
  Large = 'Large',
  Bulky = 'Bulky',
}

export enum SwitchState {
  On = 'On',
  Off = 'Off',
}

export enum ObjectiveMarkerPhysicalSize {
  Tiny = 'Tiny',
  Small = 'Small',
  Large = 'Large',
  Bulky = 'Bulky',
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
  /** QSR marker kinds (Switch/Lock/Key/Idea/Physical sizes) */
  omTypes: ObjectiveMarkerKind[];
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
  /** Which side is credited for scoring collection (RP/VP) */
  scoringSideId?: string;
  /** Whether this marker is currently neutral */
  isNeutral?: boolean;
  /** Idea holders by side (Idea OMs only) */
  ideaHoldersBySide?: Record<string, string[]>;
  /** Switch state for Switch/Lock markers */
  switchState?: SwitchState;
  /** Lock ID this Key belongs to */
  lockId?: string;
  // Backward compatibility properties
  heldBy?: string; // Alias for carriedBy
  kind?: ObjectiveMarkerKind | ObjectiveMarkerType; // Alias for type or first omType
  /** Required key IDs for a Lock */
  keyIds?: string[];
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
  omTypes?: ObjectiveMarkerKind[];
  switchState?: SwitchState;
  lockId?: string;
  keyIds?: string[];
  victoryPoints?: number;
  position?: Position;
  placedBy?: string;
  scoringSideId?: string;
  isNeutral?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new objective marker
 */
export function createObjectiveMarker(config: ObjectiveMarkerConfig = {}): ObjectiveMarker {
  const defaultOmTypes =
    config.type === ObjectiveMarkerType.Beacon ? [ObjectiveMarkerKind.Switch] :
    config.type === ObjectiveMarkerType.Intel ? [ObjectiveMarkerKind.Idea] :
    [ObjectiveMarkerKind.Tiny];
  const omTypes = config.omTypes ?? defaultOmTypes;
  return {
    id: config.id ?? `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: config.name ?? 'Objective Marker',
    type: config.type ?? ObjectiveMarkerType.Standard,
    omTypes,
    state: config.position ? MarkerState.Available : MarkerState.Scored,
    position: config.position,
    carriedBy: undefined,
    victoryPoints: config.victoryPoints ?? 1,
    placedBy: config.placedBy,
    controlledBy: undefined,
    scoringSideId: config.scoringSideId,
    isNeutral: config.isNeutral ?? false,
    switchState: config.switchState ?? (omTypes.includes(ObjectiveMarkerKind.Switch) || omTypes.includes(ObjectiveMarkerKind.Lock) ? SwitchState.Off : undefined),
    lockId: config.lockId,
    keyIds: config.keyIds,
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

export interface MarkerAcquireResult {
  success: boolean;
  marker: ObjectiveMarker;
  apCost: number;
  switchToggled?: boolean;
  carried?: boolean;
  reason?: string;
}

export interface MarkerShareResult {
  success: boolean;
  marker: ObjectiveMarker;
  apCost: number;
  reason?: string;
}

export interface MarkerTransferOptions {
  allowOpposing?: boolean;
  opposingTransfer?: boolean;
  requiresAttentiveOrdered?: boolean;
  attackerAttentiveOrdered?: boolean;
  targetAttentiveOrdered?: boolean;
  isStunnedOrDisorderedOrDistracted?: boolean;
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
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
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
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        reason: 'Marker not found',
      };
    }

    if (marker.state !== MarkerState.Available && marker.state !== MarkerState.Dropped) {
      return {
        success: false,
        marker,
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
   * Acquire a marker using QSR OM rules (Fiddle action)
   */
  acquireMarker(
    markerId: string,
    modelId: string,
    sideId: string,
    options: {
      isFree?: boolean;
      opposingInBaseContact?: boolean;
      isAttentive?: boolean;
      isOrdered?: boolean;
      isAnimal?: boolean;
      keyIdsInHand?: string[];
    } = {}
  ): MarkerAcquireResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        apCost: 0,
        reason: 'Marker not found',
      };
    }

    if (options.opposingInBaseContact) {
      return { success: false, marker, apCost: 0, reason: 'Opposing model in base-contact' };
    }

    const apCost = getMarkerAcquireApCost(marker);

    if (isSwitchMarker(marker) || isLockMarker(marker)) {
      if (!options.isFree) {
        return { success: false, marker, apCost, reason: 'Must be Free to toggle switch/lock' };
      }
      if (isLockMarker(marker)) {
        const requiredKeys = marker.keyIds ?? [];
        const keysInHand = new Set(options.keyIdsInHand ?? []);
        const hasAllKeys = requiredKeys.every(keyId => keysInHand.has(keyId));
        if (requiredKeys.length > 0 && !hasAllKeys) {
          return { success: false, marker, apCost, reason: 'Missing required key(s)' };
        }
      }
      marker.switchState = marker.switchState === SwitchState.On ? SwitchState.Off : SwitchState.On;
      if (!marker.scoringSideId) {
        marker.scoringSideId = sideId;
      }
      return { success: true, marker, apCost, switchToggled: true };
    }

    if (isIdeaMarker(marker)) {
      if (options.isAnimal) {
        return { success: false, marker, apCost, reason: 'Animals cannot acquire Idea OMs' };
      }
      if (!marker.ideaHoldersBySide) marker.ideaHoldersBySide = {};
      const holders = new Set(marker.ideaHoldersBySide[sideId] ?? []);
      holders.add(modelId);
      marker.ideaHoldersBySide[sideId] = Array.from(holders);
      if (!marker.scoringSideId) {
        marker.scoringSideId = sideId;
      }
      return { success: true, marker, apCost };
    }

    if (!isPhysicalMarker(marker)) {
      return { success: false, marker, apCost, reason: 'Marker not acquireable' };
    }

    if (marker.state !== MarkerState.Available && marker.state !== MarkerState.Dropped) {
      return { success: false, marker, apCost, reason: `Marker cannot be picked up (state: ${marker.state})` };
    }

    marker.position = undefined;
    marker.carriedBy = modelId;
    marker.state = MarkerState.Carried;
    marker.isNeutral = false;
    marker.scoringSideId = sideId;
    return { success: true, marker, apCost, carried: true };
  }

  /**
   * Share an Idea OM between friendly models
   */
  shareIdea(
    markerId: string,
    fromModelId: string,
    toModelId: string,
    sideId: string,
    hindrance: number = 0
  ): MarkerShareResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        apCost: 0,
        reason: 'Marker not found',
      };
    }
    if (!isIdeaMarker(marker)) {
      return { success: false, marker, apCost: 0, reason: 'Marker is not an Idea OM' };
    }
    const apCost = 1 + Math.max(0, hindrance);
    if (!marker.ideaHoldersBySide) marker.ideaHoldersBySide = {};
    const holders = new Set(marker.ideaHoldersBySide[sideId] ?? []);
    holders.add(fromModelId);
    holders.add(toModelId);
    marker.ideaHoldersBySide[sideId] = Array.from(holders);
    if (!marker.scoringSideId) {
      marker.scoringSideId = sideId;
    }
    return { success: true, marker, apCost };
  }

  /**
   * Drop a marker at current position
   */
  dropMarker(markerId: string, position: Position): MarkerMoveResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        reason: 'Marker not found',
      };
    }

    if (marker.state !== MarkerState.Carried) {
      return {
        success: false,
        marker,
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
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
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
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
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
   * Transfer a carried Physical OM between models
   */
  transferMarker(
    markerId: string,
    newCarrierId: string,
    sideId: string,
    options: MarkerTransferOptions = {}
  ): MarkerMoveResult {
    const marker = this.getMarker(markerId);
    if (!marker) {
      return {
        success: false,
        marker: { id: '', name: '', type: ObjectiveMarkerType.Standard, omTypes: [], state: MarkerState.Destroyed, victoryPoints: 0, metadata: {} },
        reason: 'Marker not found',
      };
    }
    if (!isPhysicalMarker(marker)) {
      return {
        success: false,
        marker,
        reason: 'Marker is not Physical',
      };
    }
    if (marker.state !== MarkerState.Carried) {
      return {
        success: false,
        marker,
        reason: `Marker cannot be transferred (state: ${marker.state})`,
      };
    }
    if (options.requiresAttentiveOrdered) {
      const ok = options.attackerAttentiveOrdered || options.targetAttentiveOrdered;
      if (!ok) {
        return {
          success: false,
          marker,
          reason: 'Requires Attentive Ordered model',
        };
      }
    }
    marker.carriedBy = newCarrierId;
    marker.isNeutral = options.opposingTransfer ?? false;
    if (!marker.isNeutral) {
      marker.scoringSideId = sideId;
    }
    return { success: true, marker };
  }

  /**
   * Drop all carried Physical OMs for a model (KO/Elimination)
   */
  dropAllPhysicalMarkers(modelId: string, position: Position): ObjectiveMarker[] {
    const dropped: ObjectiveMarker[] = [];
    for (const marker of this.getMarkersCarriedBy(modelId)) {
      if (!isPhysicalMarker(marker)) continue;
      marker.position = position;
      marker.carriedBy = undefined;
      marker.state = MarkerState.Dropped;
      marker.isNeutral = true;
      marker.scoringSideId = undefined;
      dropped.push(marker);
    }
    return dropped;
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

export function isSwitchMarker(marker: ObjectiveMarker): boolean {
  return marker.omTypes.includes(ObjectiveMarkerKind.Switch);
}

export function isLockMarker(marker: ObjectiveMarker): boolean {
  return marker.omTypes.includes(ObjectiveMarkerKind.Lock);
}

export function isKeyMarker(marker: ObjectiveMarker): boolean {
  return marker.omTypes.includes(ObjectiveMarkerKind.Key);
}

export function isIdeaMarker(marker: ObjectiveMarker): boolean {
  return marker.omTypes.includes(ObjectiveMarkerKind.Idea);
}

export function getMarkerPhysicalSize(marker: ObjectiveMarker): ObjectiveMarkerPhysicalSize | null {
  if (marker.omTypes.includes(ObjectiveMarkerKind.Bulky)) return ObjectiveMarkerPhysicalSize.Bulky;
  if (marker.omTypes.includes(ObjectiveMarkerKind.Large)) return ObjectiveMarkerPhysicalSize.Large;
  if (marker.omTypes.includes(ObjectiveMarkerKind.Small)) return ObjectiveMarkerPhysicalSize.Small;
  if (marker.omTypes.includes(ObjectiveMarkerKind.Tiny)) return ObjectiveMarkerPhysicalSize.Tiny;
  return null;
}

export function isPhysicalMarker(marker: ObjectiveMarker): boolean {
  return getMarkerPhysicalSize(marker) !== null;
}

export function getMarkerHandsRequired(marker: ObjectiveMarker): number {
  const size = getMarkerPhysicalSize(marker);
  if (!size) return 0;
  if (size === ObjectiveMarkerPhysicalSize.Bulky) return 2;
  if (size === ObjectiveMarkerPhysicalSize.Large) return 1;
  if (size === ObjectiveMarkerPhysicalSize.Small) return 1;
  return 0;
}

export function getMarkerLadenLevel(marker: ObjectiveMarker): number {
  const size = getMarkerPhysicalSize(marker);
  if (size === ObjectiveMarkerPhysicalSize.Bulky) return 2;
  if (size === ObjectiveMarkerPhysicalSize.Large) return 1;
  return 0;
}

export function getMarkerAcquireApCost(marker: ObjectiveMarker): number {
  if (isSwitchMarker(marker) || isLockMarker(marker)) return 1;
  const size = getMarkerPhysicalSize(marker);
  if (size === ObjectiveMarkerPhysicalSize.Tiny) return 2;
  if (size) return 1;
  if (isIdeaMarker(marker)) return 1;
  return 1;
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
      omTypes: [ObjectiveMarkerKind.Tiny],
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
      omTypes: [ObjectiveMarkerKind.Switch],
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
      omTypes: [ObjectiveMarkerKind.Idea],
      victoryPoints: vp,
    };

    if (positions[i]) {
      config.position = positions[i];
    }

    markers.push(createObjectiveMarker(config));
  }

  return markers;
}

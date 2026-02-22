import { MissionSide } from '../mission/MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../mission/poi-zone-control';
import { Position } from '../battlefield/Position';

/**
 * Breach Mission State
 */
export interface BreachMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Marker control (markerId -> controlling sideId) */
  markerControl: Map<string, string | null>;
  /** Original marker control (before switches) */
  originalControl: Map<string, string | null>;
  /** VP per side */
  vpBySide: Map<string, number>;
  /** Markers controlled per side this turn */
  markersControlledThisTurn: Map<string, number>;
  /** Breach turns */
  breachTurns: number[];
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Switch result
 */
export interface SwitchResult {
  switched: boolean;
  markerId: string;
  previousController: string | null;
  newController: string | null;
  vpAwarded: number;
}

/**
 * Breach Mission Manager
 * Handles all Breach mission logic with automatic marker switching
 */
export class BreachMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private state: BreachMissionState;

  constructor(
    sides: MissionSide[],
    markerPositions?: Position[],
    breachTurns?: number[]
  ) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.state = {
      sideIds: sides.map(s => s.id),
      markerControl: new Map(),
      originalControl: new Map(),
      vpBySide: new Map(),
      markersControlledThisTurn: new Map(),
      breachTurns: breachTurns ?? [4, 8],
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.markersControlledThisTurn.set(side.id, 0);
    }

    // Create markers
    this.setupMarkers(markerPositions);
  }

  /**
   * Set up markers
   */
  private setupMarkers(positions?: Position[]): void {
    // Default marker positions
    const defaultPositions: Position[] = [
      { x: 12, y: 6 },   // Top center
      { x: 6, y: 12 },   // Left center
      { x: 18, y: 12 },  // Right center
      { x: 6, y: 18 },   // Bottom left
      { x: 18, y: 18 },  // Bottom right
    ];

    const markerPositions = positions && positions.length > 0
      ? positions
      : defaultPositions.slice(0, 5);

    for (let i = 0; i < markerPositions.length && i < 6; i++) {
      const marker = createPOI({
        id: `breach-marker-${i + 1}`,
        name: `Breach Marker ${i + 1}`,
        type: POIType.ControlZone,
        position: markerPositions[i],
        radius: 3,
        vpPerTurn: 3,
        vpFirstControl: 0,
      });
      this.poiManager.addPOI(marker);
      this.state.markerControl.set(marker.id, null);
      this.state.originalControl.set(marker.id, null);
    }
  }

  /**
   * Update marker control based on model positions
   */
  updateMarkerControl(models: Array<{ id: string; position: Position }>): void {
    const markers = this.poiManager.getAllPOIs();

    for (const marker of markers) {
      const modelsInMarker = models.filter(m => {
        const dx = m.position.x - marker.position.x;
        const dy = m.position.y - marker.position.y;
        return (dx * dx + dy * dy) <= (marker.radius * marker.radius);
      });

      if (modelsInMarker.length === 0) {
        this.state.markerControl.set(marker.id, null);
        continue;
      }

      const sidesPresent = new Set<string>();
      for (const model of modelsInMarker) {
        const side = this.getSideForModel(model.id);
        if (side) {
          sidesPresent.add(side);
        }
      }

      if (sidesPresent.size === 0) {
        this.state.markerControl.set(marker.id, null);
      } else if (sidesPresent.size === 1) {
        this.state.markerControl.set(marker.id, Array.from(sidesPresent)[0]);
      } else {
        // Contested
        this.state.markerControl.set(marker.id, null);
      }
    }

    // Store original control for switch tracking
    for (const [markerId, controller] of this.state.markerControl.entries()) {
      if (controller && !this.state.originalControl.get(markerId)) {
        this.state.originalControl.set(markerId, controller);
      }
    }
  }

  /**
   * Get side ID for a model
   */
  private getSideForModel(modelId: string): string | undefined {
    for (const [sideId, side] of this.sides.entries()) {
      if (side.members.some(m => m.id === modelId)) {
        return sideId;
      }
    }
    return undefined;
  }

  /**
   * Check and execute marker switches on breach turns
   */
  executeSwitches(currentTurn: number): SwitchResult[] {
    const results: SwitchResult[] = [];

    if (!this.state.breachTurns.includes(currentTurn)) {
      return results;
    }

    const markers = this.poiManager.getAllPOIs();
    const sideIds = Array.from(this.state.sideIds);

    for (const marker of markers) {
      const currentController = this.state.markerControl.get(marker.id);

      // Find next side in rotation
      let newController: string | null = null;
      if (currentController) {
        const currentIndex = sideIds.indexOf(currentController);
        const nextIndex = (currentIndex + 1) % sideIds.length;
        newController = sideIds[nextIndex];
      } else if (this.state.originalControl.get(marker.id)) {
        // If uncontrolled but was controlled, switch from original
        const originalController = this.state.originalControl.get(marker.id)!;
        const currentIndex = sideIds.indexOf(originalController);
        const nextIndex = (currentIndex + 1) % sideIds.length;
        newController = sideIds[nextIndex];
      }

      // Award VP to new controller
      let vpAwarded = 0;
      if (newController && newController !== currentController) {
        this.state.markerControl.set(marker.id, newController);
        vpAwarded = 5;
        this.awardVP(newController, vpAwarded);
      }

      results.push({
        switched: newController !== currentController,
        markerId: marker.id,
        previousController: currentController,
        newController,
        vpAwarded,
      });
    }

    return results;
  }

  /**
   * Award VP for marker control at end of turn
   */
  awardTurnVP(): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    // Reset turn tracking
    for (const sideId of this.state.sideIds) {
      this.state.markersControlledThisTurn.set(sideId, 0);
      vpAwarded.set(sideId, 0);
    }

    // Count markers controlled by each side
    let controllers = new Map<string, number>();
    for (const controller of this.state.markerControl.values()) {
      if (controller) {
        const count = controllers.get(controller) ?? 0;
        controllers.set(controller, count + 1);
      }
    }

    // Award 3 VP per marker
    for (const [controller, count] of controllers.entries()) {
      this.state.markersControlledThisTurn.set(controller, count);
      const vp = count * 3;
      vpAwarded.set(controller, vp);
      this.awardVP(controller, vp);
    }

    // Check for full control bonus
    const markers = this.poiManager.getAllPOIs();
    for (const sideId of this.state.sideIds) {
      const controlled = controllers.get(sideId) ?? 0;
      if (controlled === markers.length && markers.length > 0) {
        // Award 10 VP bonus for full control
        const currentVP = vpAwarded.get(sideId) ?? 0;
        vpAwarded.set(sideId, currentVP + 10);
        this.awardVP(sideId, 10);
      }
    }

    return vpAwarded;
  }

  /**
   * Award VP to a side
   */
  awardVP(sideId: string, amount: number): void {
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    this.state.vpBySide.set(sideId, currentVP + amount);

    const side = this.sides.get(sideId);
    if (side) {
      side.state.victoryPoints = currentVP + amount;
    }
  }

  /**
   * End the mission
   */
  endMission(winnerId?: string, reason?: string): void {
    this.state.ended = true;
    this.state.winner = winnerId;
    this.state.endReason = reason;

    if (!winnerId) {
      winnerId = this.determineVPWinner();
      this.state.winner = winnerId;
      this.state.endReason = reason ?? 'Turn limit reached';
    }
  }

  /**
   * Determine winner by VP
   */
  private determineVPWinner(): string | undefined {
    let maxVP = -1;
    let winner: string | undefined;

    for (const [sideId, vp] of this.state.vpBySide.entries()) {
      const side = this.sides.get(sideId);
      if (!side) continue;

      const activeModels = side.members.filter(
        m => m.status !== 'Eliminated' as any && m.status !== 'KO' as any
      ).length;

      if (activeModels === 0) continue;

      if (vp > maxVP) {
        maxVP = vp;
        winner = sideId;
      }
    }

    return winner;
  }

  /**
   * Get current VP for a side
   */
  getVictoryPoints(sideId: string): number {
    return this.state.vpBySide.get(sideId) ?? 0;
  }

  /**
   * Get marker controller
   */
  getMarkerController(markerId: string): string | null | undefined {
    return this.state.markerControl.get(markerId);
  }

  /**
   * Get all marker controllers
   */
  getMarkerControllers(): Map<string, string | null> {
    return new Map(this.state.markerControl);
  }

  /**
   * Get markers controlled by a side this turn
   */
  getMarkersControlledThisTurn(sideId: string): number {
    return this.state.markersControlledThisTurn.get(sideId) ?? 0;
  }

  /**
   * Get breach turns
   */
  getBreachTurns(): number[] {
    return [...this.state.breachTurns];
  }

  /**
   * Get mission state
   */
  getState(): BreachMissionState {
    return { ...this.state };
  }

  /**
   * Get all markers
   */
  getMarkers(): PointOfInterest[] {
    return this.poiManager.getAllPOIs();
  }

  /**
   * Check if mission has ended
   */
  hasEnded(): boolean {
    return this.state.ended;
  }

  /**
   * Get winner
   */
  getWinner(): string | undefined {
    return this.state.winner;
  }

  /**
   * Get end reason
   */
  getEndReason(): string | undefined {
    return this.state.endReason;
  }

  /**
   * Get VP standings
   */
  getVPStandings(): Array<{ sideId: string; vp: number; markersControlled: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        markersControlled: this.state.markersControlledThisTurn.get(sideId) ?? 0,
      }))
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Breach mission manager
 */
export function createBreachMission(
  sides: MissionSide[],
  markerPositions?: Position[],
  breachTurns?: number[]
): BreachMissionManager {
  return new BreachMissionManager(sides, markerPositions, breachTurns);
}

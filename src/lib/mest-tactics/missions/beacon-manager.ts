import { MissionSide } from '../MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../poi-zone-control';
import { Position } from '../battlefield/Position';
import { SpatialModel } from '../battlefield/spatial-rules';

/**
 * Beacon Mission State
 */
export interface BeaconMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Beacon control tracking */
  beaconControl: Map<string, string | null>; // beaconId -> controlling sideId (null = contested)
  /** First control tracking (for VP bonus) */
  firstControl: Map<string, string>; // beaconId -> first controlling sideId
  /** VP from beacon control per side */
  vpBySide: Map<string, number>;
  /** Beacons controlled per side this turn */
  beaconsControlledThisTurn: Map<string, number>;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Beacon Mission Manager
 * Handles all Beacon mission logic
 */
export class BeaconMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private state: BeaconMissionState;
  private beaconCount: number;

  constructor(sides: MissionSide[], beaconPositions?: Position[], beaconCount?: number) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.beaconCount = beaconCount ?? beaconPositions?.length ?? 4;
    this.state = {
      sideIds: sides.map(s => s.id),
      beaconControl: new Map(),
      firstControl: new Map(),
      vpBySide: new Map(),
      beaconsControlledThisTurn: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.beaconsControlledThisTurn.set(side.id, 0);
    }

    // Create beacon zones
    this.setupBeaconZones(beaconPositions);
  }

  /**
   * Set up beacon zones
   */
  private setupBeaconZones(positions: Position[]): void {
    // Default beacon positions in a strategic pattern
    const defaultPositions: Position[] = [
      { x: 12, y: 6 },   // Top center
      { x: 6, y: 12 },   // Left center
      { x: 18, y: 12 },  // Right center
      { x: 12, y: 18 },  // Bottom center
      { x: 12, y: 12 },  // Center
    ];

    const beaconPositions = positions.length > 0 ? positions : defaultPositions.slice(0, this.beaconCount);

    for (let i = 0; i < beaconPositions.length; i++) {
      const beacon = createPOI({
        id: `beacon-${i + 1}`,
        name: `Beacon ${i + 1}`,
        type: POIType.Beacon,
        position: beaconPositions[i],
        radius: 3,
        vpPerTurn: 2,
        vpFirstControl: 2,
      });
      this.poiManager.addPOI(beacon);
      this.state.beaconControl.set(beacon.id, null);
    }
  }

  /**
   * Update beacon control based on model positions
   */
  updateBeaconControl(models: SpatialModel[]): void {
    const beacons = this.poiManager.getAllPOIs();

    for (const beacon of beacons) {
      // Get models in this beacon zone
      const modelsInBeacon = this.poiManager.getModelsInPOI(beacon.id, models);

      if (modelsInBeacon.length === 0) {
        // No models - beacon becomes uncontrolled
        this.state.beaconControl.set(beacon.id, null);
        continue;
      }

      // Get sides present in beacon
      const sidesPresent = new Set<string>();
      for (const model of modelsInBeacon) {
        const side = this.getSideForModel(model.id);
        if (side) {
          sidesPresent.add(side);
        }
      }

      if (sidesPresent.size === 0) {
        this.state.beaconControl.set(beacon.id, null);
      } else if (sidesPresent.size === 1) {
        // Single side controls the beacon
        const controllingSide = Array.from(sidesPresent)[0];
        const previousController = this.state.beaconControl.get(beacon.id);

        this.state.beaconControl.set(beacon.id, controllingSide);

        // Track first control
        if (!this.state.firstControl.has(beacon.id)) {
          this.state.firstControl.set(beacon.id, controllingSide);
        }

        // Award first control VP if newly controlled
        if (previousController !== controllingSide && !previousController) {
          const poi = this.poiManager.getPOI(beacon.id);
          if (poi) {
            this.awardVP(controllingSide, poi.vpFirstControl);
          }
        }
      } else {
        // Multiple sides - beacon is contested
        this.state.beaconControl.set(beacon.id, null);
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
   * Award VP at end of turn for controlled beacons
   */
  awardTurnVP(): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    // Reset turn tracking
    for (const sideId of this.state.sideIds) {
      this.state.beaconsControlledThisTurn.set(sideId, 0);
      vpAwarded.set(sideId, 0);
    }

    // Count beacons controlled by each side
    for (const [beaconId, controller] of this.state.beaconControl.entries()) {
      if (controller) {
        const currentCount = this.state.beaconsControlledThisTurn.get(controller) ?? 0;
        this.state.beaconsControlledThisTurn.set(controller, currentCount + 1);

        // Award 2 VP per beacon
        const currentVP = vpAwarded.get(controller) ?? 0;
        vpAwarded.set(controller, currentVP + 2);
        this.awardVP(controller, 2);
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

    // Update side state
    const side = this.sides.get(sideId);
    if (side) {
      side.state.victoryPoints = currentVP + amount;
    }
  }

  /**
   * Check for victory (all beacons controlled)
   */
  checkForVictory(): void {
    if (this.state.ended) return;

    for (const sideId of this.state.sideIds) {
      let controlledCount = 0;
      let totalBeacons = 0;

      for (const [beaconId, controller] of this.state.beaconControl.entries()) {
        totalBeacons++;
        if (controller === sideId) {
          controlledCount++;
        }
      }

      // Victory if controlling all beacons
      if (controlledCount === totalBeacons && totalBeacons > 0) {
        this.endMission(sideId, 'Controlled all beacon zones');
        return;
      }
    }
  }

  /**
   * End the mission
   */
  endMission(winnerId?: string, reason?: string): void {
    this.state.ended = true;
    this.state.winner = winnerId;
    this.state.endReason = reason;

    // If no winner, determine by VP
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

      // Only sides with active models can win
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
   * Get beacon controller
   */
  getBeaconController(beaconId: string): string | null | undefined {
    return this.state.beaconControl.get(beaconId);
  }

  /**
   * Get all beacon controllers
   */
  getBeaconControllers(): Map<string, string | null> {
    return new Map(this.state.beaconControl);
  }

  /**
   * Get first controller of a beacon
   */
  getFirstController(beaconId: string): string | undefined {
    return this.state.firstControl.get(beaconId);
  }

  /**
   * Get beacons controlled by a side this turn
   */
  getBeaconsControlledThisTurn(sideId: string): number {
    return this.state.beaconsControlledThisTurn.get(sideId) ?? 0;
  }

  /**
   * Get mission state
   */
  getState(): BeaconMissionState {
    return { ...this.state };
  }

  /**
   * Get all POIs (beacons)
   */
  getBeacons(): PointOfInterest[] {
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
  getVPStandings(): Array<{ sideId: string; vp: number; beaconsControlled: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        beaconsControlled: this.state.beaconsControlledThisTurn.get(sideId) ?? 0,
      }))
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Beacon mission manager
 */
export function createBeaconMission(
  sides: MissionSide[],
  beaconPositions?: Position[],
  beaconCount?: number
): BeaconMissionManager {
  return new BeaconMissionManager(sides, beaconPositions ?? [], beaconCount);
}

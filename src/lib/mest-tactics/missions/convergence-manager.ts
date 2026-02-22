import { MissionSide } from '../MissionSide';
import { PointOfInterest, POIType, ZoneControlState, POIManager, createPOI } from '../poi-zone-control';
import { Position } from '../battlefield/Position';
import { SpatialModel } from '../battlefield/spatial-rules';

/**
 * Convergence Mission State
 */
export interface ConvergenceMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Zone control tracking */
  zoneControl: Map<string, string | null>; // zoneId -> controlling sideId (null = contested)
  /** First control tracking (for VP bonus) */
  firstControl: Map<string, string>; // zoneId -> first controlling sideId
  /** VP from zone control per side */
  vpBySide: Map<string, number>;
  /** Zones controlled per side this turn */
  zonesControlledThisTurn: Map<string, number>;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Convergence Mission Manager
 * Handles all Convergence mission logic
 */
export class ConvergenceMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private state: ConvergenceMissionState;
  private zoneCount: number;

  constructor(sides: MissionSide[], zonePositions: Position[], zoneCount?: number) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.zoneCount = zoneCount ?? zonePositions.length ?? 3;
    this.state = {
      sideIds: sides.map(s => s.id),
      zoneControl: new Map(),
      firstControl: new Map(),
      vpBySide: new Map(),
      zonesControlledThisTurn: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.zonesControlledThisTurn.set(side.id, 0);
    }

    // Create convergence zones
    this.setupConvergenceZones(zonePositions);
  }

  /**
   * Set up convergence zones
   */
  private setupConvergenceZones(positions: Position[]): void {
    const defaultPositions: Position[] = [
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 12, y: 12 },
      { x: 6, y: 18 },
      { x: 18, y: 18 },
    ];

    const zonePositions = positions.length > 0 ? positions : defaultPositions.slice(0, this.zoneCount);

    for (let i = 0; i < zonePositions.length; i++) {
      const zone = createPOI({
        id: `zone-${i + 1}`,
        name: `Convergence Zone ${i + 1}`,
        type: POIType.ControlZone,
        position: zonePositions[i],
        radius: 3,
        vpPerTurn: 2,
        vpFirstControl: 1,
      });
      this.poiManager.addPOI(zone);
      this.state.zoneControl.set(zone.id, null);
    }
  }

  /**
   * Update zone control based on model positions
   */
  updateZoneControl(models: SpatialModel[]): void {
    const zones = this.poiManager.getAllPOIs();

    for (const zone of zones) {
      // Get models in this zone
      const modelsInZone = this.poiManager.getModelsInPOI(zone.id, models);

      if (modelsInZone.length === 0) {
        // No models - zone becomes uncontrolled
        this.state.zoneControl.set(zone.id, null);
        continue;
      }

      // Get sides present in zone
      const sidesPresent = new Set<string>();
      for (const model of modelsInZone) {
        const side = this.getSideForModel(model.id);
        if (side) {
          sidesPresent.add(side);
        }
      }

      if (sidesPresent.size === 0) {
        this.state.zoneControl.set(zone.id, null);
      } else if (sidesPresent.size === 1) {
        // Single side controls the zone
        const controllingSide = Array.from(sidesPresent)[0];
        const previousController = this.state.zoneControl.get(zone.id);

        this.state.zoneControl.set(zone.id, controllingSide);

        // Track first control
        if (!this.state.firstControl.has(zone.id)) {
          this.state.firstControl.set(zone.id, controllingSide);
        }

        // Award first control VP if newly controlled
        if (previousController !== controllingSide && !previousController) {
          const poi = this.poiManager.getPOI(zone.id);
          if (poi) {
            this.awardVP(controllingSide, poi.vpFirstControl);
          }
        }
      } else {
        // Multiple sides - zone is contested
        this.state.zoneControl.set(zone.id, null);
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
   * Award VP at end of turn for controlled zones
   */
  awardTurnVP(): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    // Reset turn tracking
    for (const sideId of this.state.sideIds) {
      this.state.zonesControlledThisTurn.set(sideId, 0);
      vpAwarded.set(sideId, 0);
    }

    // Count zones controlled by each side
    for (const [zoneId, controller] of this.state.zoneControl.entries()) {
      if (controller) {
        const currentCount = this.state.zonesControlledThisTurn.get(controller) ?? 0;
        this.state.zonesControlledThisTurn.set(controller, currentCount + 1);

        // Award 2 VP per zone
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
   * Check for victory (all zones controlled)
   */
  checkForVictory(): void {
    if (this.state.ended) return;

    for (const sideId of this.state.sideIds) {
      let controlledCount = 0;
      let totalZones = 0;

      for (const [zoneId, controller] of this.state.zoneControl.entries()) {
        totalZones++;
        if (controller === sideId) {
          controlledCount++;
        }
      }

      // Victory if controlling all zones
      if (controlledCount === totalZones && totalZones > 0) {
        this.endMission(sideId, 'Controlled all convergence zones');
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
   * Get zone controller
   */
  getZoneController(zoneId: string): string | null | undefined {
    return this.state.zoneControl.get(zoneId);
  }

  /**
   * Get all zone controllers
   */
  getZoneControllers(): Map<string, string | null> {
    return new Map(this.state.zoneControl);
  }

  /**
   * Get first controller of a zone
   */
  getFirstController(zoneId: string): string | undefined {
    return this.state.firstControl.get(zoneId);
  }

  /**
   * Get zones controlled by a side this turn
   */
  getZonesControlledThisTurn(sideId: string): number {
    return this.state.zonesControlledThisTurn.get(sideId) ?? 0;
  }

  /**
   * Get mission state
   */
  getState(): ConvergenceMissionState {
    return { ...this.state };
  }

  /**
   * Get all POIs (zones)
   */
  getZones(): PointOfInterest[] {
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
  getVPStandings(): Array<{ sideId: string; vp: number; zonesControlled: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        zonesControlled: this.state.zonesControlledThisTurn.get(sideId) ?? 0,
      }))
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Convergence mission manager
 */
export function createConvergenceMission(
  sides: MissionSide[],
  zonePositions?: Position[],
  zoneCount?: number
): ConvergenceMissionManager {
  return new ConvergenceMissionManager(sides, zonePositions ?? [], zoneCount);
}

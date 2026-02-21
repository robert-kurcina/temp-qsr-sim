import { MissionSide } from '../MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../poi-zone-control';
import { Position } from '../battlefield/Position';

/**
 * Triad Mission State
 */
export interface TriadMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Zone control for each triad zone */
  zoneControl: Map<string, string | null>; // zoneId -> controlling sideId
  /** VP per side */
  vpBySide: Map<string, number>;
  /** Zones controlled per side this turn */
  zonesControlledThisTurn: Map<string, number>;
  /** Has any side achieved full triad? */
  fullTriadAchieved: Map<string, boolean>; // sideId -> achieved
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Triad Mission Manager
 * Handles all Triad mission logic
 */
export class TriadMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private state: TriadMissionState;

  constructor(
    sides: MissionSide[],
    zonePositions?: Position[]
  ) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.state = {
      sideIds: sides.map(s => s.id),
      zoneControl: new Map(),
      vpBySide: new Map(),
      zonesControlledThisTurn: new Map(),
      fullTriadAchieved: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.zonesControlledThisTurn.set(side.id, 0);
      this.state.fullTriadAchieved.set(side.id, false);
    }

    // Create triad zones
    this.setupTriadZones(zonePositions);
  }

  /**
   * Set up triad zones in triangle formation
   */
  private setupTriadZones(positions?: Position[]): void {
    // Default triad positions (triangle formation)
    const defaultPositions: Position[] = [
      { x: 12, y: 4 },   // Top center
      { x: 4, y: 18 },   // Bottom left
      { x: 20, y: 18 },  // Bottom right
    ];

    const zonePositions = positions && positions.length > 0 ? positions : defaultPositions;

    for (let i = 0; i < zonePositions.length && i < 3; i++) {
      const zone = createPOI({
        id: `triad-zone-${i + 1}`,
        name: `Triad Zone ${i + 1}`,
        type: POIType.ControlZone,
        position: zonePositions[i],
        radius: 4,
        vpPerTurn: 3,
        vpFirstControl: 0,
      });
      this.poiManager.addPOI(zone);
      this.state.zoneControl.set(zone.id, null);
    }
  }

  /**
   * Update zone control based on model positions
   */
  updateZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs();

    for (const zone of zones) {
      // Get models in this zone
      const modelsInZone = models.filter(m => {
        const dx = m.position.x - zone.position.x;
        const dy = m.position.y - zone.position.y;
        return (dx * dx + dy * dy) <= (zone.radius * zone.radius);
      });

      if (modelsInZone.length === 0) {
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
        this.state.zoneControl.set(zone.id, Array.from(sidesPresent)[0]);
      } else {
        // Contested
        this.state.zoneControl.set(zone.id, null);
      }
    }

    // Check for full triad achievement
    this.checkForFullTriad();
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
   * Check if any side has achieved full triad
   */
  private checkForFullTriad(): void {
    for (const sideId of this.state.sideIds) {
      if (this.state.fullTriadAchieved.get(sideId)) continue;

      let controlledCount = 0;
      for (const controller of this.state.zoneControl.values()) {
        if (controller === sideId) {
          controlledCount++;
        }
      }

      if (controlledCount >= 3) {
        this.state.fullTriadAchieved.set(sideId, true);
        // Award bonus VP
        this.awardVP(sideId, 5);
        // Instant win!
        this.endMission(sideId, 'Achieved full triad control');
      }
    }
  }

  /**
   * Award VP for zone control at end of turn
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

        // Award 3 VP per zone
        const currentVP = vpAwarded.get(controller) ?? 0;
        vpAwarded.set(controller, currentVP + 3);
        this.awardVP(controller, 3);
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
   * Check if side has achieved full triad
   */
  hasFullTriad(sideId: string): boolean {
    return this.state.fullTriadAchieved.get(sideId) ?? false;
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
  getState(): TriadMissionState {
    return { ...this.state };
  }

  /**
   * Get all triad zones
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
  getVPStandings(): Array<{ sideId: string; vp: number; zonesControlled: number; hasFullTriad: boolean }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        zonesControlled: this.state.zonesControlledThisTurn.get(sideId) ?? 0,
        hasFullTriad: this.state.fullTriadAchieved.get(sideId) ?? false,
      }))
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Triad mission manager
 */
export function createTriadMission(
  sides: MissionSide[],
  zonePositions?: Position[]
): TriadMissionManager {
  return new TriadMissionManager(sides, zonePositions);
}

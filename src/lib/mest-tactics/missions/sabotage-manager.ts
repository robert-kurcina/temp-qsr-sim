import { MissionSide } from '../MissionSide';
import { Position } from '../battlefield/Position';
import { SpatialModel } from '../battlefield/spatial-rules';
import { MeasurementUtils } from '../battlefield/model-registry';

/**
 * Sabotage marker types
 */
export enum SabotageMarkerType {
  /** Standard sabotage target */
  Standard = 'Standard',
  /** High-value target (more VP) */
  HighValue = 'HighValue',
  /** Resource that can be harvested */
  Resource = 'Resource',
  /** Intel that provides bonus */
  Intel = 'Intel',
}

/**
 * Sabotage marker state
 */
export interface SabotageMarker {
  /** Unique identifier */
  id: string;
  /** Marker type */
  type: SabotageMarkerType;
  /** Position on battlefield */
  position: Position;
  /** Has this marker been sabotaged? */
  sabotaged: boolean;
  /** Which side sabotaged it */
  sabotagedBy?: string;
  /** VP value for sabotage */
  sabotageVP: number;
  /** VP value for harvest (if resource) */
  harvestVP: number;
  /** Times this marker has been harvested */
  harvestCount: number;
  /** Maximum harvests (0 = unlimited) */
  maxHarvests: number;
}

/**
 * Sabotage Mission State
 */
export interface SabotageMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Sabotage markers */
  markers: Map<string, SabotageMarker>;
  /** VP from sabotage/harvest per side */
  vpBySide: Map<string, number>;
  /** Sabotage count per side */
  sabotageCountBySide: Map<string, number>;
  /** Harvest count per side */
  harvestCountBySide: Map<string, number>;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Sabotage action result
 */
export interface SabotageActionResult {
  success: boolean;
  markerId: string;
  actionType: 'sabotage' | 'harvest';
  vpAwarded: number;
  reason?: string;
}

/**
 * Sabotage Mission Manager
 * Handles all Sabotage mission logic
 */
export class SabotageMissionManager {
  private sides: Map<string, MissionSide>;
  private state: SabotageMissionState;
  private markerCount: number;

  constructor(sides: MissionSide[], markerPositions?: Position[], markerCount?: number) {
    this.sides = new Map();
    this.markerCount = markerCount ?? markerPositions?.length ?? 4;
    this.state = {
      sideIds: sides.map(s => s.id),
      markers: new Map(),
      vpBySide: new Map(),
      sabotageCountBySide: new Map(),
      harvestCountBySide: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.sabotageCountBySide.set(side.id, 0);
      this.state.harvestCountBySide.set(side.id, 0);
    }

    // Create sabotage markers
    this.setupSabotageMarkers(markerPositions);
  }

  /**
   * Set up sabotage markers
   */
  private setupSabotageMarkers(positions: Position[]): void {
    const defaultPositions: Position[] = [
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 6, y: 18 },
      { x: 18, y: 18 },
      { x: 12, y: 12 },
      { x: 12, y: 3 },
    ];

    const markerPositions = positions.length > 0 ? positions : defaultPositions.slice(0, this.markerCount);

    for (let i = 0; i < markerPositions.length; i++) {
      const isResource = i % 3 === 0; // Every 3rd marker is a resource
      const isHighValue = i === 0; // First marker is high value

      const marker: SabotageMarker = {
        id: `sabotage-${i + 1}`,
        type: isHighValue ? SabotageMarkerType.HighValue : (isResource ? SabotageMarkerType.Resource : SabotageMarkerType.Standard),
        position: markerPositions[i],
        sabotaged: false,
        sabotageVP: isHighValue ? 5 : 3,
        harvestVP: 1,
        harvestCount: 0,
        maxHarvests: isResource ? 3 : 0, // Resources can be harvested 3 times
      };

      this.state.markers.set(marker.id, marker);
    }
  }

  /**
   * Attempt to sabotage a marker
   */
  sabotageMarker(modelId: string, markerId: string): SabotageActionResult {
    const marker = this.state.markers.get(markerId);
    if (!marker) {
      return {
        success: false,
        markerId,
        actionType: 'sabotage',
        vpAwarded: 0,
        reason: 'Marker not found',
      };
    }

    if (marker.sabotaged) {
      return {
        success: false,
        markerId,
        actionType: 'sabotage',
        vpAwarded: 0,
        reason: 'Marker already sabotaged',
      };
    }

    // Find the model and its side
    const side = this.getSideForModel(modelId);
    if (!side) {
      return {
        success: false,
        markerId,
        actionType: 'sabotage',
        vpAwarded: 0,
        reason: 'Model not found',
      };
    }

    // Check if model is at marker position (within 1 MU)
    const model = this.getModel(modelId);
    if (!model || !model.position) {
      return {
        success: false,
        markerId,
        actionType: 'sabotage',
        vpAwarded: 0,
        reason: 'Model has no position',
      };
    }

    const distance = MeasurementUtils.centerToCenter(
      { id: modelId, position: model.position, baseDiameter: 1 },
      { id: markerId, position: marker.position, baseDiameter: 1 }
    );

    if (distance > 1) {
      return {
        success: false,
        markerId,
        actionType: 'sabotage',
        vpAwarded: 0,
        reason: 'Model not adjacent to marker',
      };
    }

    // Success! Sabotage the marker
    marker.sabotaged = true;
    marker.sabotagedBy = side.id;

    // Award VP
    this.awardVP(side.id, marker.sabotageVP);

    // Track sabotage count
    const currentCount = this.state.sabotageCountBySide.get(side.id) ?? 0;
    this.state.sabotageCountBySide.set(side.id, currentCount + 1);

    return {
      success: true,
      markerId,
      actionType: 'sabotage',
      vpAwarded: marker.sabotageVP,
    };
  }

  /**
   * Attempt to harvest a resource marker
   */
  harvestMarker(modelId: string, markerId: string): SabotageActionResult {
    const marker = this.state.markers.get(markerId);
    if (!marker) {
      return {
        success: false,
        markerId,
        actionType: 'harvest',
        vpAwarded: 0,
        reason: 'Marker not found',
      };
    }

    if (marker.type !== SabotageMarkerType.Resource) {
      return {
        success: false,
        markerId,
        actionType: 'harvest',
        vpAwarded: 0,
        reason: 'Marker is not a resource',
      };
    }

    if (marker.maxHarvests > 0 && marker.harvestCount >= marker.maxHarvests) {
      return {
        success: false,
        markerId,
        actionType: 'harvest',
        vpAwarded: 0,
        reason: 'Resource depleted',
      };
    }

    // Find the model and its side
    const side = this.getSideForModel(modelId);
    if (!side) {
      return {
        success: false,
        markerId,
        actionType: 'harvest',
        vpAwarded: 0,
        reason: 'Model not found',
      };
    }

    // Check if model is at marker position
    const model = this.getModel(modelId);
    if (!model || !model.position) {
      return {
        success: false,
        markerId,
        actionType: 'harvest',
        vpAwarded: 0,
        reason: 'Model has no position',
      };
    }

    const distance = MeasurementUtils.centerToCenter(
      { id: modelId, position: model.position, baseDiameter: 1 },
      { id: markerId, position: marker.position, baseDiameter: 1 }
    );

    if (distance > 1) {
      return {
        success: false,
        markerId,
        actionType: 'harvest',
        vpAwarded: 0,
        reason: 'Model not adjacent to marker',
      };
    }

    // Success! Harvest the resource
    marker.harvestCount++;

    // Award VP
    this.awardVP(side.id, marker.harvestVP);

    // Track harvest count
    const currentCount = this.state.harvestCountBySide.get(side.id) ?? 0;
    this.state.harvestCountBySide.set(side.id, currentCount + 1);

    return {
      success: true,
      markerId,
      actionType: 'harvest',
      vpAwarded: marker.harvestVP,
    };
  }

  /**
   * Get side for a model
   */
  private getSideForModel(modelId: string): MissionSide | undefined {
    for (const side of this.sides.values()) {
      if (side.members.some(m => m.id === modelId)) {
        return side;
      }
    }
    return undefined;
  }

  /**
   * Get model from side members
   */
  private getModel(modelId: string): { id: string; position?: Position | null } | undefined {
    for (const side of this.sides.values()) {
      const member = side.members.find(m => m.id === modelId);
      if (member) {
        return { id: member.id, position: member.position };
      }
    }
    return undefined;
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
   * Check for victory (all markers sabotaged by one side)
   */
  checkForVictory(): void {
    if (this.state.ended) return;

    // Count sabotaged markers per side
    const sabotagedBySide = new Map<string, number>();
    let totalSabotaged = 0;

    for (const marker of this.state.markers.values()) {
      if (marker.sabotaged && marker.sabotagedBy) {
        const count = sabotagedBySide.get(marker.sabotagedBy) ?? 0;
        sabotagedBySide.set(marker.sabotagedBy, count + 1);
        totalSabotaged++;
      }
    }

    // Check if any side has sabotaged all markers
    const totalMarkers = this.state.markers.size;
    for (const [sideId, count] of sabotagedBySide.entries()) {
      if (count === totalMarkers && totalMarkers > 0) {
        this.endMission(sideId, 'Sabotaged all objectives');
        return;
      }
    }

    // Check if all markers are sabotaged (any side)
    if (totalSabotaged === totalMarkers && totalMarkers > 0) {
      // Game ends, winner determined by VP
      this.endMission(undefined, 'All objectives sabotaged');
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
   * Get a marker by ID
   */
  getMarker(markerId: string): SabotageMarker | undefined {
    return this.state.markers.get(markerId);
  }

  /**
   * Get all markers
   */
  getAllMarkers(): SabotageMarker[] {
    return Array.from(this.state.markers.values());
  }

  /**
   * Get unsabotaged markers
   */
  getUnsabotagedMarkers(): SabotageMarker[] {
    return this.getAllMarkers().filter(m => !m.sabotaged);
  }

  /**
   * Get sabotage count for a side
   */
  getSabotageCount(sideId: string): number {
    return this.state.sabotageCountBySide.get(sideId) ?? 0;
  }

  /**
   * Get harvest count for a side
   */
  getHarvestCount(sideId: string): number {
    return this.state.harvestCountBySide.get(sideId) ?? 0;
  }

  /**
   * Get mission state
   */
  getState(): SabotageMissionState {
    return { ...this.state };
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
  getVPStandings(): Array<{ sideId: string; vp: number; sabotages: number; harvests: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        sabotages: this.state.sabotageCountBySide.get(sideId) ?? 0,
        harvests: this.state.harvestCountBySide.get(sideId) ?? 0,
      }))
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Sabotage mission manager
 */
export function createSabotageMission(
  sides: MissionSide[],
  markerPositions?: Position[],
  markerCount?: number
): SabotageMissionManager {
  return new SabotageMissionManager(sides, markerPositions ?? [], markerCount);
}

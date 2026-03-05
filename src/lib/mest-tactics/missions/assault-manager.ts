import { MissionSide } from '../mission/MissionSide';
import { Position } from '../battlefield/Position';
import { SpatialModel } from '../battlefield/spatial/spatial-rules';
import { MeasurementUtils } from '../battlefield/spatial/model-registry';
import {
  calculateEliminationFractionalVP,
  calculateBottledFractionalVP,
  calculateMarkerControlFractionalVP,
} from './FractionalScoringUtils';

/**
 * Assault marker types
 */
export enum AssaultMarkerType {
  /** Standard assault target */
  Standard = 'Standard',
  /** High-value target (more VP) */
  HighValue = 'HighValue',
  /** Resource that can be harvested */
  Resource = 'Resource',
  /** Intel that provides bonus */
  Intel = 'Intel',
}

/**
 * Assault marker state
 */
export interface AssaultMarker {
  /** Unique identifier */
  id: string;
  /** Marker type */
  type: AssaultMarkerType;
  /** Position on battlefield */
  position: Position;
  /** Has this marker been assaulted? */
  assaulted: boolean;
  /** Which side assaulted it */
  assaultedBy?: string;
  /** VP value for assault */
  assaultVP: number;
  /** VP value for harvest (if resource) */
  harvestVP: number;
  /** Times this marker has been harvested */
  harvestCount: number;
  /** Maximum harvests (0 = unlimited) */
  maxHarvests: number;
}

/**
 * Assault Mission State
 */
export interface AssaultMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Assault markers */
  markers: Map<string, AssaultMarker>;
  /** VP from assault/harvest per side */
  vpBySide: Map<string, number>;
  /** Assault count per side */
  assaultCountBySide: Map<string, number>;
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
 * Assault action result
 */
export interface AssaultActionResult {
  success: boolean;
  markerId: string;
  actionType: 'assault' | 'harvest';
  vpAwarded: number;
  reason?: string;
}

/**
 * Assault Mission Manager
 * Handles all Assault mission logic
 */
export class AssaultMissionManager {
  private sides: Map<string, MissionSide>;
  private state: AssaultMissionState;
  private markerCount: number;

  constructor(sides: MissionSide[], markerPositions?: Position[], markerCount?: number) {
    this.sides = new Map();
    const providedCount = markerPositions && markerPositions.length > 0 ? markerPositions.length : undefined;
    this.markerCount = markerCount ?? providedCount ?? 4;
    this.state = {
      sideIds: sides.map(s => s.id),
      markers: new Map(),
      vpBySide: new Map(),
      assaultCountBySide: new Map(),
      harvestCountBySide: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.assaultCountBySide.set(side.id, 0);
      this.state.harvestCountBySide.set(side.id, 0);
    }

    // Create assault markers
    this.setupAssaultMarkers(markerPositions);
  }

  /**
   * Set up assault markers
   */
  private setupAssaultMarkers(positions?: Position[]): void {
    const defaultPositions: Position[] = [
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 6, y: 18 },
      { x: 18, y: 18 },
      { x: 12, y: 12 },
      { x: 12, y: 3 },
    ];

    const suppliedPositions = positions ?? [];
    const markerPositions = suppliedPositions.length > 0
      ? suppliedPositions
      : defaultPositions.slice(0, this.markerCount);

    for (let i = 0; i < markerPositions.length; i++) {
      const isResource = i % 3 === 0; // Every 3rd marker is a resource
      const isHighValue = i === 0; // First marker is high value

      const marker: AssaultMarker = {
        id: `assault-${i + 1}`,
        type: isHighValue ? AssaultMarkerType.HighValue : (isResource ? AssaultMarkerType.Resource : AssaultMarkerType.Standard),
        position: markerPositions[i],
        assaulted: false,
        assaultVP: isHighValue ? 5 : 3,
        harvestVP: 1,
        harvestCount: 0,
        maxHarvests: isResource ? 3 : 0, // Resources can be harvested 3 times
      };

      this.state.markers.set(marker.id, marker);
    }
  }

  /**
   * Attempt to assault a marker
   */
  assaultMarker(modelId: string, markerId: string): AssaultActionResult {
    const marker = this.state.markers.get(markerId);
    if (!marker) {
      return {
        success: false,
        markerId,
        actionType: 'assault',
        vpAwarded: 0,
        reason: 'Marker not found',
      };
    }

    if (marker.assaulted) {
      return {
        success: false,
        markerId,
        actionType: 'assault',
        vpAwarded: 0,
        reason: 'Marker already assaulted',
      };
    }

    // Find the model and its side
    const side = this.getSideForModel(modelId);
    if (!side) {
      return {
        success: false,
        markerId,
        actionType: 'assault',
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
        actionType: 'assault',
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
        actionType: 'assault',
        vpAwarded: 0,
        reason: 'Model not adjacent to marker',
      };
    }

    // Success! Assault the marker
    marker.assaulted = true;
    marker.assaultedBy = side.id;

    // Award VP
    this.awardVP(side.id, marker.assaultVP);

    // Track assault count
    const currentCount = this.state.assaultCountBySide.get(side.id) ?? 0;
    this.state.assaultCountBySide.set(side.id, currentCount + 1);

    return {
      success: true,
      markerId,
      actionType: 'assault',
      vpAwarded: marker.assaultVP,
    };
  }

  /**
   * Attempt to harvest a resource marker
   */
  harvestMarker(modelId: string, markerId: string): AssaultActionResult {
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

    if (marker.type !== AssaultMarkerType.Resource) {
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
   * Check for victory (all markers assaulted by one side)
   */
  checkForVictory(): void {
    if (this.state.ended) return;

    // Count assaulted markers per side
    const assaultedBySide = new Map<string, number>();
    let totalAssaulted = 0;

    for (const marker of this.state.markers.values()) {
      if (marker.assaulted && marker.assaultedBy) {
        const count = assaultedBySide.get(marker.assaultedBy) ?? 0;
        assaultedBySide.set(marker.assaultedBy, count + 1);
        totalAssaulted++;
      }
    }

    // Check if any side has assaulted all markers
    const totalMarkers = this.state.markers.size;
    for (const [sideId, count] of assaultedBySide.entries()) {
      if (count === totalMarkers && totalMarkers > 0) {
        this.endMission(sideId, 'Assaulted all objectives');
        return;
      }
    }

    // Check if all markers are assaulted (any side)
    if (totalAssaulted === totalMarkers && totalMarkers > 0) {
      // Game ends, winner determined by VP
      this.endMission(undefined, 'All objectives assaulted');
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
  getMarker(markerId: string): AssaultMarker | undefined {
    return this.state.markers.get(markerId);
  }

  /**
   * Get all markers
   */
  getAllMarkers(): AssaultMarker[] {
    return Array.from(this.state.markers.values());
  }

  /**
   * Get unassaulted markers
   */
  getUnassaultedMarkers(): AssaultMarker[] {
    return this.getAllMarkers().filter(m => !m.assaulted);
  }

  /**
   * Get assault count for a side
   */
  getAssaultCount(sideId: string): number {
    return this.state.assaultCountBySide.get(sideId) ?? 0;
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
  getState(): AssaultMissionState {
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
  getVPStandings(): Array<{ sideId: string; vp: number; assaults: number; harvests: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        assaults: this.state.assaultCountBySide.get(sideId) ?? 0,
        harvests: this.state.harvestCountBySide.get(sideId) ?? 0,
      }))
      .sort((a, b) => b.vp - a.vp);
  }

  /**
   * Calculate predicted scoring with key breakdown for AI planning
   * Keys: Sabotage (assault), POI (control), Elimination, Bottled
   */
  calculatePredictedScoring(): {
    sideScores: Record<string, {
      predictedVp: number;
      predictedRp: number;
      keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>;
    }>;
  } {
    const sideScores: Record<string, {
      predictedVp: number;
      predictedRp: number;
      keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>;
    }> = {};

    // Initialize side scores
    for (const sideId of this.state.sideIds) {
      sideScores[sideId] = {
        predictedVp: 0,
        predictedRp: 0,
        keyScores: {},
      };
    }

    // Build side status for scoring functions
    const sideStatuses = Array.from(this.sides.values()).map(side => {
      let koCount = 0;
      let eliminatedCount = 0;
      let orderedCount = 0;
      let koBp = 0;
      let eliminatedBp = 0;

      for (const member of side.members) {
        const bp = member.profile?.totalBp ?? 0;
        if (member.status === 'Eliminated' as any) {
          eliminatedCount++;
          eliminatedBp += bp;
        } else if (member.status === 'KO' as any) {
          koCount++;
          koBp += bp;
        } else if (member.status === 'Ready' as any || member.status === 'Distracted' as any) {
          orderedCount++;
        }
      }

      return {
        sideId: side.id,
        startingCount: side.members.length,
        inPlayCount: side.members.length - koCount - eliminatedCount,
        orderedCount,
        koCount,
        eliminatedCount,
        koBp,
        eliminatedBp,
        totalBp: side.totalBP,
        bottledOut: orderedCount === 0,
      };
    });

    // Sabotage: +2 VP per assaulted marker (already awarded, so current = predicted)
    // Count remaining unassaulted markers for potential VP
    const allMarkers = this.getAllMarkers();
    const assaultedMarkers = allMarkers.filter(m => m.assaulted);
    const unassaultedMarkers = allMarkers.filter(m => !m.assaulted);

    // Count assaults per side
    const assaultsBySide: Record<string, number> = {};
    for (const sideId of this.state.sideIds) {
      assaultsBySide[sideId] = this.state.assaultCountBySide.get(sideId) ?? 0;
    }

    // Predict sabotage VP (2 VP per assault, already awarded)
    const sortedAssaults = Object.entries(assaultsBySide).sort((a, b) => b[1] - a[1]);
    for (const [sideId, assaultCount] of Object.entries(assaultsBySide)) {
      const current = this.state.vpBySide.get(sideId) ?? 0;
      // Predict additional VP from remaining markers (assume equal distribution)
      const potentialAdditional = unassaultedMarkers.length > 0
        ? Math.floor(unassaultedMarkers.length / Object.keys(assaultsBySide).length)
        : 0;
      const predicted = current + (potentialAdditional * 2);

      const opponentBest = sideId === sortedAssaults[0]?.[0]
        ? (sortedAssaults[1]?.[1] ?? 0) * 2
        : (sortedAssaults[0]?.[1] ?? 0) * 2;
      const confidence = assaultCount > 0 && opponentBest > 0
        ? Math.max(0, Math.min(1, 1 - (opponentBest / (assaultCount * 2))))
        : (assaultCount > (sortedAssaults[1]?.[1] ?? 0) ? 1 : 0.5);

      sideScores[sideId].keyScores['sabotage'] = {
        current,
        predicted,
        confidence,
        leadMargin: (assaultCount - (sortedAssaults[1]?.[1] ?? 0)) * 2,
      };
      sideScores[sideId].predictedVp += predicted;
    }

    // POI: Fractional VP based on marker control ratio
    // Count "controlled" markers (assaulted by each side)
    const controlBySide: Record<string, number> = {};
    for (const sideId of this.state.sideIds) {
      controlBySide[sideId] = assaultedMarkers.filter(m => m.assaultedBy === sideId).length;
    }

    const sortedControl = Object.entries(controlBySide).sort((a, b) => b[1] - a[1]);
    const bestControlSide = sortedControl[0]?.[0];
    const totalMarkers = allMarkers.length;

    for (const [sideId, controlled] of Object.entries(controlBySide)) {
      const isLeading = sideId === bestControlSide;
      const score = calculateMarkerControlFractionalVP(sideId, controlled, totalMarkers, isLeading);

      sideScores[sideId].keyScores['poi'] = {
        current: controlled > 0 ? 1 : 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on control ratio
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[sideId].predictedVp += score.predicted;
    }

    // Elimination: Fractional VP based on BP eliminated ratio
    const eliminationBpBySide: Record<string, number> = {};
    const totalEnemyBpBySide: Record<string, number> = {};
    for (const side of sideStatuses) {
      let totalEnemyBpEliminated = 0;
      let totalEnemyBp = 0;
      for (const opponent of sideStatuses) {
        if (opponent.sideId === side.sideId) continue;
        totalEnemyBpEliminated += opponent.koBp + opponent.eliminatedBp;
        totalEnemyBp += opponent.totalBp;
      }
      eliminationBpBySide[side.sideId] = totalEnemyBpEliminated;
      totalEnemyBpBySide[side.sideId] = totalEnemyBp;
    }

    for (const [sideId] of Object.entries(eliminationBpBySide)) {
      const score = calculateEliminationFractionalVP(sideId, eliminationBpBySide, totalEnemyBpBySide);

      sideScores[sideId].keyScores['elimination'] = {
        current: 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on elimination progress
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[sideId].predictedVp += score.predicted;
    }

    // Bottled: Fractional VP based on opponent casualty rates
    for (const side of sideStatuses) {
      const score = calculateBottledFractionalVP(side.sideId, sideStatuses);

      sideScores[side.sideId].keyScores['bottled'] = {
        current: 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on bottleneck progress
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[side.sideId].predictedVp += score.predicted;
    }

    return { sideScores };
  }
}

/**
 * Create an Assault mission manager
 */
export function createAssaultMission(
  sides: MissionSide[],
  markerPositions?: Position[],
  markerCount?: number
): AssaultMissionManager {
  return new AssaultMissionManager(sides, markerPositions, markerCount);
}

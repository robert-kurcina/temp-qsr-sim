import { MissionSide } from '../mission/MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../mission/poi-zone-control';
import { Position } from '../battlefield/Position';
import {
  calculateZoneControlFractionalVP,
  calculateAggressionFractionalVP,
  calculateEliminationFractionalVP,
  calculateBottledFractionalVP,
} from './FractionalScoringUtils';
import { EncroachmentState } from './mission-scoring';

/**
 * Triumvirate Mission State
 */
export interface TriumvirateMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Zone control for each triumvirate zone */
  zoneControl: Map<string, string | null>; // zoneId -> controlling sideId
  /** VP per side */
  vpBySide: Map<string, number>;
  /** Zones controlled per side this turn */
  zonesControlledThisTurn: Map<string, number>;
  /** Has any side achieved full triumvirate? */
  fullTriumvirateAchieved: Map<string, boolean>; // sideId -> achieved
  /** Encroachment tracking (first to cross midline) */
  encroachment: EncroachmentState;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
  /** Commander eliminated tracking (backward compatibility) */
  commanderEliminated?: Map<string, boolean>;
}

/**
 * Triumvirate Mission Manager
 * Handles all Triumvirate mission logic
 */
export class TriumvirateMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private state: TriumvirateMissionState;

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
      fullTriumvirateAchieved: new Map(),
      encroachment: {},
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.zonesControlledThisTurn.set(side.id, 0);
      this.state.fullTriumvirateAchieved.set(side.id, false);
    }

    // Create triumvirate zones
    this.setupTriumvirateZones(zonePositions);
  }

  /**
   * Set up triumvirate zones in triangle formation
   */
  private setupTriumvirateZones(positions?: Position[]): void {
    // Default triumvirate positions (triangle formation)
    const defaultPositions: Position[] = [
      { x: 12, y: 4 },   // Top center
      { x: 4, y: 18 },   // Bottom left
      { x: 20, y: 18 },  // Bottom right
    ];

    const zonePositions = positions && positions.length > 0 ? positions : defaultPositions;

    for (let i = 0; i < zonePositions.length && i < 3; i++) {
      const zone = createPOI({
        id: `triumvirate-zone-${i + 1}`,
        name: `Triumvirate Zone ${i + 1}`,
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

    // Check for full triumvirate achievement
    this.checkForFullTriumvirate();
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
   * Check if any side has achieved full triumvirate
   */
  private checkForFullTriumvirate(): void {
    for (const sideId of this.state.sideIds) {
      if (this.state.fullTriumvirateAchieved.get(sideId)) continue;

      let controlledCount = 0;
      for (const controller of this.state.zoneControl.values()) {
        if (controller === sideId) {
          controlledCount++;
        }
      }

      if (controlledCount >= 3) {
        this.state.fullTriumvirateAchieved.set(sideId, true);
        // Award bonus VP
        this.awardVP(sideId, 5);
        // Instant win!
        this.endMission(sideId, 'Achieved full triumvirate control');
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
   * Track a model crossing the midline for Encroachment scoring
   * QSR: Encroachment key - +1 VP to first side to cross midline
   */
  trackEncroachment(modelId: string, sideId: string, position: { x: number; y: number }, battlefieldCenter: { x: number; y: number }): void {
    // Don't track if already awarded
    if (this.state.encroachment.firstCrossedSideId) return;

    const side = this.sides.get(sideId);
    if (!side) return;

    // Determine if model is past midline (simple x-axis check for opposite deployment)
    // Assuming Side A deploys at x=0, Side B at x=battlefieldSize
    // Midline is at battlefieldSize/2
    const hasCrossed = position.x > battlefieldCenter.x;

    if (hasCrossed) {
      this.state.encroachment.firstCrossedSideId = sideId;
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
   * Check if side has achieved full triumvirate
   */
  hasFullTriumvirate(sideId: string): boolean {
    return this.state.fullTriumvirateAchieved.get(sideId) ?? false;
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
  getState(): TriumvirateMissionState {
    return { ...this.state };
  }

  /**
   * Get all triumvirate zones
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
  getVPStandings(): Array<{ sideId: string; vp: number; zonesControlled: number; hasFullTriumvirate: boolean }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        zonesControlled: this.state.zonesControlledThisTurn.get(sideId) ?? 0,
        hasFullTriumvirate: this.state.fullTriumvirateAchieved.get(sideId) ?? false,
      }))
      .sort((a, b) => b.vp - a.vp);
  }

  /**
   * Calculate predicted scoring with key breakdown for AI planning
   * Keys: Dominance (zones), Harvest (NA extraction), Commander Elimination, Sanctuary, Bottled
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

    // Dominance: Fractional VP based on zone control ratio
    const zoneControllers = this.getZoneControllers();
    const zonesBySide: Record<string, number> = {};
    for (const sideId of this.state.sideIds) {
      zonesBySide[sideId] = 0;
    }
    for (const [zoneId, controller] of zoneControllers.entries()) {
      if (controller && controller !== 'null') {
        zonesBySide[controller] = (zonesBySide[controller] ?? 0) + 1;
      }
    }

    // Calculate total zones for fractional VP
    const totalZones = zoneControllers.size;
    const sortedZones = Object.entries(zonesBySide).sort((a, b) => b[1] - a[1]);
    const bestZoneSide = sortedZones[0]?.[0];

    for (const [sideId, zoneCount] of Object.entries(zonesBySide)) {
      const isLeading = sideId === bestZoneSide;
      const score = calculateZoneControlFractionalVP(sideId, zoneCount, totalZones, isLeading);

      sideScores[sideId].keyScores['dominance'] = {
        current: this.state.vpBySide.get(sideId) ?? 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on zone ratio
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[sideId].predictedVp += score.predicted;
    }

    // Harvest: +1 VP per NA extracted (already awarded in VP)
    // Use VP as proxy since extraction awards VP immediately
    const sortedVP = Array.from(this.state.vpBySide.entries()).sort((a, b) => b[1] - a[1]);
    for (const [sideId, vp] of this.state.vpBySide.entries()) {
      // Subtract dominance VP to estimate harvest VP
      const dominanceVP = zonesBySide[sideId] ?? 0;
      const harvestVP = Math.max(0, vp - dominanceVP);

      sideScores[sideId].keyScores['harvest'] = {
        current: harvestVP,
        predicted: harvestVP,
        confidence: harvestVP > 0 ? 0.8 : 0.3,
        leadMargin: harvestVP,
      };
    }

    // Commander Elimination: +2 VP for eliminating enemy commander
    // Check if any side's commander was eliminated
    if (this.state.commanderEliminated) {
      for (const [sideId, eliminated] of this.state.commanderEliminated.entries()) {
        if (eliminated) {
          // Find enemy sides and award VP
          for (const enemyId of this.state.sideIds) {
            if (enemyId !== sideId) {
              const current = sideScores[enemyId].keyScores['commander_elimination']?.current ?? 0;
              sideScores[enemyId].keyScores['commander_elimination'] = {
                current: current + 2,
                predicted: current + 2,
                confidence: 1.0,
                leadMargin: 2,
              };
              sideScores[enemyId].predictedVp += 2;
            }
          }
        }
      }
    }

    // Sanctuary: +1 VP per turn maintaining 25% BP in entry edge zone
    for (const side of sideStatuses) {
      const sanctuaryVP = side.inPlayCount >= Math.ceil(side.startingCount * 0.25) ? 1 : 0;

      sideScores[side.sideId].keyScores['sanctuary'] = {
        current: 0,
        predicted: sanctuaryVP,
        confidence: sanctuaryVP > 0 ? 0.7 : 0.0,
        leadMargin: sanctuaryVP,
      };
      sideScores[side.sideId].predictedVp += sanctuaryVP;
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

    // Encroachment: Fractional VP based on crossing progress
    for (const side of sideStatuses) {
      const crossed = (this.state.encroachment.crossedBySide as any)?.[side.sideId] ?? 0;
      const threshold = Math.ceil(side.startingCount / 2);
      const score = calculateAggressionFractionalVP(side.sideId, crossed, threshold);

      sideScores[side.sideId].keyScores['encroachment'] = {
        current: 0,
        predicted: score.predicted,  // FRACTIONAL: 0.0-1.0 based on crossing progress
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
      sideScores[side.sideId].predictedVp += score.predicted;
    }

    return { sideScores };
  }
}

/**
 * Create a Triumvirate mission manager
 */
export function createTriumvirateMission(
  sides: MissionSide[],
  zonePositions?: Position[]
): TriumvirateMissionManager {
  return new TriumvirateMissionManager(sides, zonePositions);
}

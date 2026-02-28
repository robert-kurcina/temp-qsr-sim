import { MissionSide } from '../mission/MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../mission/poi-zone-control';
import { Position } from '../battlefield/Position';
import { SpatialModel } from '../battlefield/spatial-rules';
import { EncroachmentState } from './mission-scoring';

/**
 * Dominion Mission State
 */
export interface DominionMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** Dominion control tracking */
  zoneControl: Map<string, string | null>; // zoneId -> controlling sideId (null = contested)
  /** First control tracking (for VP bonus) */
  firstControl: Map<string, string>; // zoneId -> first controlling sideId
  /** VP from dominion control per side */
  vpBySide: Map<string, number>;
  /** Zones controlled per side this turn */
  zonesControlledThisTurn: Map<string, number>;
  /** Encroachment tracking (first to cross midline) */
  encroachment: EncroachmentState;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Dominion Mission Manager
 * Handles all Dominion mission logic
 */
export class DominionMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private state: DominionMissionState;
  private zoneCount: number;

  constructor(sides: MissionSide[], zonePositions?: Position[], zoneCount?: number) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.zoneCount = zoneCount ?? zonePositions?.length ?? 4;
    this.state = {
      sideIds: sides.map(s => s.id),
      zoneControl: new Map(),
      firstControl: new Map(),
      vpBySide: new Map(),
      zonesControlledThisTurn: new Map(),
      encroachment: {},
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.zonesControlledThisTurn.set(side.id, 0);
    }

    // Create dominion zones
    this.setupDominionZones(zonePositions);
  }

  /**
   * Set up dominion zones
   */
  private setupDominionZones(positions: Position[]): void {
    // Default dominion positions in a strategic pattern
    const defaultPositions: Position[] = [
      { x: 12, y: 6 },   // Top center
      { x: 6, y: 12 },   // Left center
      { x: 18, y: 12 },  // Right center
      { x: 12, y: 18 },  // Bottom center
      { x: 12, y: 12 },  // Center
    ];

    const zonePositions = positions.length > 0 ? positions : defaultPositions.slice(0, this.zoneCount);

    for (let i = 0; i < zonePositions.length; i++) {
      const zone = createPOI({
        id: `zone-${i + 1}`,
        name: `Dominion Zone ${i + 1}`,
        type: POIType.ControlZone,
        position: zonePositions[i],
        radius: 3,
        vpPerTurn: 2,
        vpFirstControl: 2,
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
        this.endMission(sideId, 'Controlled all dominion zones');
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
  getState(): DominionMissionState {
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

  /**
   * Calculate predicted scoring with key breakdown for AI planning
   * Keys: Dominance (zones), Elimination, Bottled
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

    // Dominance: +1 VP per zone controlled
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

    // Calculate dominance VP (1 VP per zone)
    const sortedZones = Object.entries(zonesBySide).sort((a, b) => b[1] - a[1]);
    const bestZoneCount = sortedZones[0]?.[1] ?? 0;
    const secondZoneCount = sortedZones[1]?.[1] ?? 0;

    for (const [sideId, zoneCount] of Object.entries(zonesBySide)) {
      const predicted = zoneCount;
      const leadMargin = zoneCount - secondZoneCount;
      const opponentBest = sideId === sortedZones[0]?.[0] ? secondZoneCount : bestZoneCount;
      const confidence = zoneCount > 0 && opponentBest > 0
        ? Math.max(0, Math.min(1, 1 - (opponentBest / zoneCount)))
        : (zoneCount > opponentBest ? 1 : 0);

      sideScores[sideId].keyScores['dominance'] = {
        current: this.state.vpBySide.get(sideId) ?? 0,
        predicted,
        confidence,
        leadMargin,
      };
      sideScores[sideId].predictedVp += predicted;
    }

    // Elimination: +1 VP for most BP eliminated
    const eliminationBpBySide: Record<string, number> = {};
    for (const side of sideStatuses) {
      let totalEnemyBpEliminated = 0;
      for (const opponent of sideStatuses) {
        if (opponent.sideId === side.sideId) continue;
        totalEnemyBpEliminated += opponent.koBp + opponent.eliminatedBp;
      }
      eliminationBpBySide[side.sideId] = totalEnemyBpEliminated;
    }

    const sortedElimination = Object.entries(eliminationBpBySide).sort((a, b) => b[1] - a[1]);
    const bestElimination = sortedElimination[0];
    const secondElimination = sortedElimination[1];

    for (const [sideId, bp] of Object.entries(eliminationBpBySide)) {
      const isBest = bestElimination && sideId === bestElimination[0];
      const predicted = isBest && (!secondElimination || bestElimination[1] > secondElimination[1]) ? 1 : 0;
      const leadMargin = isBest && secondElimination ? bestElimination[1] - secondElimination[1] : 0;
      const opponentBest = isBest && secondElimination ? secondElimination[1] : (bestElimination?.[1] ?? 0);
      const confidence = bp > 0 && opponentBest > 0
        ? Math.max(0, Math.min(1, 1 - (opponentBest / bp)))
        : (isBest ? 1 : 0);

      sideScores[sideId].keyScores['elimination'] = {
        current: 0,
        predicted,
        confidence,
        leadMargin,
      };
      sideScores[sideId].predictedVp += predicted;
    }

    // Bottled: +1 VP if opponent bottles out
    const bottledSides = sideStatuses.filter(s => s.bottledOut);
    for (const side of sideStatuses) {
      const isOpponentBottled = bottledSides.some(s => s.sideId !== side.sideId);
      const predicted = isOpponentBottled ? 1 : 0;

      sideScores[side.sideId].keyScores['bottled'] = {
        current: 0,
        predicted,
        confidence: isOpponentBottled ? 1.0 : 0.0,
        leadMargin: isOpponentBottled ? 1 : 0,
      };
      sideScores[side.sideId].predictedVp += predicted;
    }

    // Encroachment: +1 VP to first side to cross midline
    const encroachmentSideId = this.state.encroachment.firstCrossedSideId;
    if (encroachmentSideId) {
      sideScores[encroachmentSideId].keyScores['encroachment'] = {
        current: 0,
        predicted: 1,
        confidence: 1.0,
        leadMargin: 1,
      };
      sideScores[encroachmentSideId].predictedVp += 1;
    } else {
      // Not yet awarded - either side could still get it
      for (const side of sideStatuses) {
        sideScores[side.sideId].keyScores['encroachment'] = {
          current: 0,
          predicted: 0,
          confidence: 0.0,
          leadMargin: 0,
        };
      }
    }

    return { sideScores };
  }
}

/**
 * Create a Dominion mission manager
 */
export function createDominionMission(
  sides: MissionSide[],
  zonePositions?: Position[],
  zoneCount?: number
): DominionMissionManager {
  return new DominionMissionManager(sides, zonePositions ?? [], zoneCount);
}

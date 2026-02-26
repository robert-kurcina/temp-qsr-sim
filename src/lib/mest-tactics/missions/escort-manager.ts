import { MissionSide, SideMember } from '../mission/MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../mission/poi-zone-control';
import { VIP, VIPManager, VIPState, createVIP } from '../mission/vip-system';
import { ReinforcementsManager, createReinforcementGroup, ReinforcementTrigger, ArrivalEdge } from '../mission/reinforcements-system';
import { Position } from '../battlefield/Position';
import { buildAssembly, buildProfile, AssemblyRoster } from '../mission/assembly-builder';

/**
 * Escort Mission State
 */
export interface EscortMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** VIP for each side (sideId -> VIP member ID) */
  vipBySide: Map<string, string>;
  /** Side for each VIP (vipMemberId -> sideId) */
  sideByVip: Map<string, string>;
  /** Escort zone control */
  escortZoneControl: string | null; // controlling sideId or null
  /** VIP escort progress */
  escortProgress: Map<string, number>; // vipId -> turns escorting (0-2)
  /** VP per side */
  vpBySide: Map<string, number>;
  /** Reinforcements arrived per side */
  reinforcementsArrived: Map<string, boolean>;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Escort action result
 */
export interface EscortActionResult {
  success: boolean;
  actionType: 'start_escort' | 'continue_escort' | 'complete_escort';
  vpAwarded: number;
  reason?: string;
}

/**
 * Escort Mission Manager
 * Handles all Escort mission logic combining VIP + Reinforcements
 */
export class EscortMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private vipManager: VIPManager;
  private reinforceManager: ReinforcementsManager;
  private state: EscortMissionState;
  private reinforcementTurnMin: number;
  private reinforcementTurnMax: number;

  constructor(
    sides: MissionSide[],
    vipMemberIds: Map<string, string>, // sideId -> member ID to be VIP
    reinforcementRosters: Map<string, AssemblyRoster>, // sideId -> reinforcement roster
    escortZonePosition?: Position,
    reinforcementTurnRange?: [number, number]
  ) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.vipManager = new VIPManager();
    this.reinforceManager = new ReinforcementsManager();
    this.reinforcementTurnMin = reinforcementTurnRange?.[0] ?? 4;
    this.reinforcementTurnMax = reinforcementTurnRange?.[1] ?? 6;
    this.state = {
      sideIds: sides.map(s => s.id),
      vipBySide: new Map(),
      sideByVip: new Map(),
      escortZoneControl: null,
      escortProgress: new Map(),
      vpBySide: new Map(),
      reinforcementsArrived: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.reinforcementsArrived.set(side.id, false);

      // Set up VIP for this side
      const vipMemberId = vipMemberIds.get(side.id);
      if (vipMemberId) {
        const member = side.members.find(m => m.id === vipMemberId);
        if (member) {
          this.state.vipBySide.set(side.id, vipMemberId);
          this.state.sideByVip.set(vipMemberId, side.id);
          this.setupVIP(member, side.id);
        }
      }

      // Set up reinforcements for this side
      const roster = reinforcementRosters.get(side.id);
      if (roster) {
        this.setupReinforcements(side.id, roster);
      }
    }

    // Create escort zone
    this.setupEscortZone(escortZonePosition);
  }

  /**
   * Set up VIP for a side
   */
  private setupVIP(member: SideMember, sideId: string): void {
    const vip = createVIP(member.id, member.character, sideId, {
      name: member.id,
      type: 'Commander' as any,
      extractionVP: 10,
      eliminationVP: 5,
      extractingSide: sideId,
    });
    this.vipManager.addVIP(vip);
  }

  /**
   * Set up reinforcements for a side
   */
  private setupReinforcements(sideId: string, roster: AssemblyRoster): void {
    const reinforceGroup = createReinforcementGroup({
      sideId,
      roster,
      trigger: ReinforcementTrigger.Random,
      turnRange: [this.reinforcementTurnMin, this.reinforcementTurnMax] as [number, number],
      arrivalEdge: ArrivalEdge.Any,
      canBeDelayed: false,
    });
    this.reinforceManager.addGroup(reinforceGroup);
  }

  /**
   * Set up escort zone
   */
  private setupEscortZone(position?: Position): void {
    const escortPosition = position ?? { x: 12, y: 12 }; // Center of battlefield

    const zone = createPOI({
      id: 'escort-zone',
      name: 'Escort Zone',
      type: POIType.ExtractionPoint,
      position: escortPosition,
      radius: 4,
      vpPerTurn: 0,
      vpFirstControl: 0,
    });
    this.poiManager.addPOI(zone);
  }

  /**
   * Update escort zone control based on model positions
   */
  updateEscortZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs();
    const escortZone = zones.find(z => z.id === 'escort-zone');
    if (!escortZone) return;

    // Get models in escort zone
    const modelsInZone = models.filter(m => {
      const dx = m.position.x - escortZone.position.x;
      const dy = m.position.y - escortZone.position.y;
      return (dx * dx + dy * dy) <= (escortZone.radius * escortZone.radius);
    });

    if (modelsInZone.length === 0) {
      this.state.escortZoneControl = null;
      return;
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
      this.state.escortZoneControl = null;
    } else if (sidesPresent.size === 1) {
      this.state.escortZoneControl = Array.from(sidesPresent)[0];
    } else {
      // Contested
      this.state.escortZoneControl = null;
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
   * Check and trigger reinforcement arrivals
   */
  checkReinforcements(currentTurn: number): Map<string, boolean> {
    const arrived = new Map<string, boolean>();

    for (const sideId of this.state.sideIds) {
      if (this.state.reinforcementsArrived.get(sideId)) continue;

      const groups = this.reinforceManager.getGroupsForSide(sideId);
      for (const group of groups) {
        if (this.reinforceManager.shouldArriveThisTurn(group, currentTurn)) {
          this.reinforceManager.triggerArrival(group.id, currentTurn);
          this.state.reinforcementsArrived.set(sideId, true);
          arrived.set(sideId, true);

          // Award VP for reinforcement arrival
          this.awardVP(sideId, 5);
        }
      }
    }

    return arrived;
  }

  /**
   * Start VIP escort
   */
  startEscort(vipMemberId: string): EscortActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'start_escort',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    if (vip.state !== VIPState.Active) {
      return {
        success: false,
        actionType: 'start_escort',
        vpAwarded: 0,
        reason: 'VIP is not active',
      };
    }

    // Check if VIP is in controlled escort zone
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) {
      return {
        success: false,
        actionType: 'start_escort',
        vpAwarded: 0,
        reason: 'VIP has no position',
      };
    }

    const inZone = this.isInEscortZone(member.position);
    if (!inZone) {
      return {
        success: false,
        actionType: 'start_escort',
        vpAwarded: 0,
        reason: 'VIP not in escort zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.escortZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'start_escort',
        vpAwarded: 0,
        reason: 'Escort zone not controlled',
      };
    }

    // Start escort (progress = 1)
    this.state.escortProgress.set(vipMemberId, 1);
    vip.state = VIPState.InTransit;

    return {
      success: true,
      actionType: 'start_escort',
      vpAwarded: 0,
    };
  }

  /**
   * Continue/complete VIP escort
   */
  continueEscort(vipMemberId: string): EscortActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'continue_escort',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    const progress = this.state.escortProgress.get(vipMemberId) ?? 0;
    if (progress === 0) {
      return {
        success: false,
        actionType: 'continue_escort',
        vpAwarded: 0,
        reason: 'Escort not started',
      };
    }

    // Check if still in controlled zone
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) {
      return {
        success: false,
        actionType: 'continue_escort',
        vpAwarded: 0,
        reason: 'VIP has no position',
      };
    }

    const inZone = this.isInEscortZone(member.position);
    if (!inZone) {
      return {
        success: false,
        actionType: 'continue_escort',
        vpAwarded: 0,
        reason: 'VIP no longer in escort zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.escortZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'continue_escort',
        vpAwarded: 0,
        reason: 'Escort zone no longer controlled',
      };
    }

    // Increment progress
    const newProgress = progress + 1;
    this.state.escortProgress.set(vipMemberId, newProgress);

    if (newProgress >= 2) {
      // Escort complete!
      return this.completeEscort(vipMemberId);
    }

    return {
      success: true,
      actionType: 'continue_escort',
      vpAwarded: 0,
    };
  }

  /**
   * Complete VIP escort
   */
  private completeEscort(vipMemberId: string): EscortActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'complete_escort',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    const sideId = vip.extractingSide;
    if (!sideId) {
      return {
        success: false,
        actionType: 'complete_escort',
        vpAwarded: 0,
        reason: 'No extracting side',
      };
    }

    // Mark VIP as extracted
    vip.state = VIPState.Extracted;
    this.state.escortProgress.delete(vipMemberId);

    // Award VP
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    const vpAwarded = 10; // Base escort VP
    this.state.vpBySide.set(sideId, currentVP + vpAwarded);

    // Update side state
    const side = this.sides.get(sideId);
    if (side) {
      side.state.victoryPoints = currentVP + vpAwarded;
    }

    // Instant win!
    this.endMission(sideId, 'VIP escorted successfully');

    return {
      success: true,
      actionType: 'complete_escort',
      vpAwarded,
    };
  }

  /**
   * Check if position is in escort zone
   */
  private isInEscortZone(position: Position): boolean {
    const zones = this.poiManager.getAllPOIs();
    const escortZone = zones.find(z => z.id === 'escort-zone');
    if (!escortZone) return false;

    const dx = position.x - escortZone.position.x;
    const dy = position.y - escortZone.position.y;
    return (dx * dx + dy * dy) <= (escortZone.radius * escortZone.radius);
  }

  /**
   * Get member by ID
   */
  private getMemberById(memberId: string): SideMember | undefined {
    for (const side of this.sides.values()) {
      const member = side.members.find(m => m.id === memberId);
      if (member) return member;
    }
    return undefined;
  }

  /**
   * Award VP for VIP alive at end of turn
   */
  awardTurnVP(): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    for (const sideId of this.state.sideIds) {
      const vipMemberId = this.state.vipBySide.get(sideId);
      if (!vipMemberId) continue;

      const vip = this.vipManager.getVIP(vipMemberId);
      if (!vip) continue;

      if (vip.state === VIPState.Active || vip.state === VIPState.InTransit) {
        // Award 2 VP for VIP alive
        const currentVP = this.state.vpBySide.get(sideId) ?? 0;
        const newVP = currentVP + 2;
        this.state.vpBySide.set(sideId, newVP);
        vpAwarded.set(sideId, 2);

        const side = this.sides.get(sideId);
        if (side) {
          side.state.victoryPoints = newVP;
        }
      } else {
        vpAwarded.set(sideId, 0);
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
   * Check for VIP elimination (instant loss)
   */
  checkForVIPElimination(): void {
    for (const [sideId, vipMemberId] of this.state.vipBySide.entries()) {
      const vip = this.vipManager.getVIP(vipMemberId);
      if (!vip) continue;

      const member = this.getMemberById(vipMemberId);
      if (!member || member.status === 'Eliminated' as any) {
        // VIP eliminated - find enemy with VIP to award win
        for (const [enemySideId] of this.state.vipBySide.entries()) {
          if (enemySideId !== sideId) {
            this.endMission(enemySideId, 'Enemy VIP eliminated');
            return;
          }
        }
      }
    }
  }

  /**
   * Check for victory conditions
   */
  checkForVictory(): void {
    if (this.state.ended) return;

    // Check VIP elimination
    this.checkForVIPElimination();
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
   * Get VIP for a side
   */
  getVIPForSide(sideId: string): VIP | undefined {
    const vipMemberId = this.state.vipBySide.get(sideId);
    if (!vipMemberId) return undefined;
    return this.vipManager.getVIP(vipMemberId);
  }

  /**
   * Get escort progress for a VIP
   */
  getEscortProgress(vipMemberId: string): number {
    return this.state.escortProgress.get(vipMemberId) ?? 0;
  }

  /**
   * Check if reinforcements have arrived for a side
   */
  haveReinforcementsArrived(sideId: string): boolean {
    return this.state.reinforcementsArrived.get(sideId) ?? false;
  }

  /**
   * Get escort zone controller
   */
  getEscortZoneController(): string | null {
    return this.state.escortZoneControl;
  }

  /**
   * Get mission state
   */
  getState(): EscortMissionState {
    return { ...this.state };
  }

  /**
   * Get escort zone
   */
  getEscortZone(): PointOfInterest | null {
    const zones = this.poiManager.getAllPOIs();
    return zones.find(z => z.id === 'escort-zone') ?? null;
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
  getVPStandings(): Array<{ sideId: string; vp: number; reinforcementsArrived: boolean }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({
        sideId,
        vp,
        reinforcementsArrived: this.state.reinforcementsArrived.get(sideId) ?? false,
      }))
      .sort((a, b) => b.vp - a.vp);
  }

  /**
   * Calculate predicted scoring with key breakdown for AI planning
   * Keys: Courier (VIP extraction), Sanctuary, VIP Elimination, Bottled
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

    // Courier: VP for VIP reaching extraction zone (already awarded)
    const sortedVP = Array.from(this.state.vpBySide.entries()).sort((a, b) => b[1] - a[1]);
    for (const [sideId, vp] of this.state.vpBySide.entries()) {
      const opponentBest = sideId === sortedVP[0]?.[0] ? (sortedVP[1]?.[1] ?? 0) : (sortedVP[0]?.[1] ?? 0);
      const confidence = vp > 0 && opponentBest > 0
        ? Math.max(0, Math.min(1, 1 - (opponentBest / vp)))
        : (vp > opponentBest ? 1 : 0.5);

      sideScores[sideId].keyScores['courier'] = {
        current: vp,
        predicted: vp,
        confidence,
        leadMargin: vp - opponentBest,
      };
      sideScores[sideId].predictedVp += vp;
    }

    // Sanctuary: +1 VP per turn maintaining 25% BP in sanctuary
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

    // VIP Elimination: +2 VP to Defender if Attacker's VIP is eliminated
    // Check VIP status for each side
    for (const [sideId, vipMemberId] of this.state.vipBySide.entries()) {
      const member = this.sides.get(sideId)?.members.find(m => m.id === vipMemberId);
      if (member && member.status === 'Eliminated' as any) {
        // VIP eliminated - enemy gets 2 VP
        const enemySideId = this.state.sideIds.find(id => id !== sideId);
        if (enemySideId) {
          sideScores[enemySideId].keyScores['vip_elimination'] = {
            current: 2,
            predicted: 2,
            confidence: 1.0,
            leadMargin: 2,
          };
          sideScores[enemySideId].predictedVp += 2;
        }
      }
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

    return { sideScores };
  }
}

/**
 * Create an Escort mission manager
 */
export function createEscortMission(
  sides: MissionSide[],
  vipMemberIds: Map<string, string>,
  reinforcementRosters: Map<string, AssemblyRoster>,
  escortZonePosition?: Position,
  reinforcementTurnRange?: [number, number]
): EscortMissionManager {
  return new EscortMissionManager(sides, vipMemberIds, reinforcementRosters, escortZonePosition, reinforcementTurnRange);
}

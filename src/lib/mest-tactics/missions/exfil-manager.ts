import { MissionSide, SideMember } from '../MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../poi-zone-control';
import { VIP, VIPManager, VIPState, createVIP } from '../vip-system';
import { ReinforcementsManager, createReinforcementGroup, ReinforcementTrigger, ArrivalEdge } from '../reinforcements-system';
import { Position } from '../battlefield/Position';
import { buildAssembly, buildProfile, AssemblyRoster } from '../assembly-builder';

/**
 * Exfil Mission State
 */
export interface ExfilMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** VIP for each side (sideId -> VIP member ID) */
  vipBySide: Map<string, string>;
  /** Side for each VIP (vipMemberId -> sideId) */
  sideByVip: Map<string, string>;
  /** Exfil zone control */
  exfilZoneControl: string | null; // controlling sideId or null
  /** VIP exfil progress */
  exfilProgress: Map<string, number>; // vipId -> turns exfiling (0-2)
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
 * Exfil action result
 */
export interface ExfilActionResult {
  success: boolean;
  actionType: 'start_exfil' | 'continue_exfil' | 'complete_exfil';
  vpAwarded: number;
  reason?: string;
}

/**
 * Exfil Mission Manager
 * Handles all Exfil mission logic combining VIP + Reinforcements
 */
export class ExfilMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private vipManager: VIPManager;
  private reinforceManager: ReinforcementsManager;
  private state: ExfilMissionState;
  private reinforcementTurnMin: number;
  private reinforcementTurnMax: number;

  constructor(
    sides: MissionSide[],
    vipMemberIds: Map<string, string>, // sideId -> member ID to be VIP
    reinforcementRosters: Map<string, AssemblyRoster>, // sideId -> reinforcement roster
    exfilZonePosition?: Position,
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
      exfilZoneControl: null,
      exfilProgress: new Map(),
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

    // Create exfil zone
    this.setupExfilZone(exfilZonePosition);
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
   * Set up exfil zone
   */
  private setupExfilZone(position?: Position): void {
    const exfilPosition = position ?? { x: 12, y: 12 }; // Center of battlefield

    const zone = createPOI({
      id: 'exfil-zone',
      name: 'Exfiltration Zone',
      type: POIType.ExtractionPoint,
      position: exfilPosition,
      radius: 4,
      vpPerTurn: 0,
      vpFirstControl: 0,
    });
    this.poiManager.addPOI(zone);
  }

  /**
   * Update exfil zone control based on model positions
   */
  updateExfilZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs();
    const exfilZone = zones.find(z => z.id === 'exfil-zone');
    if (!exfilZone) return;

    // Get models in exfil zone
    const modelsInZone = models.filter(m => {
      const dx = m.position.x - exfilZone.position.x;
      const dy = m.position.y - exfilZone.position.y;
      return (dx * dx + dy * dy) <= (exfilZone.radius * exfilZone.radius);
    });

    if (modelsInZone.length === 0) {
      this.state.exfilZoneControl = null;
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
      this.state.exfilZoneControl = null;
    } else if (sidesPresent.size === 1) {
      this.state.exfilZoneControl = Array.from(sidesPresent)[0];
    } else {
      // Contested
      this.state.exfilZoneControl = null;
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
   * Start VIP exfiltration
   */
  startExfil(vipMemberId: string): ExfilActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    if (vip.state !== VIPState.Active) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        reason: 'VIP is not active',
      };
    }

    // Check if VIP is in controlled exfil zone
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        reason: 'VIP has no position',
      };
    }

    const inZone = this.isInExfilZone(member.position);
    if (!inZone) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        reason: 'VIP not in exfil zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.exfilZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        reason: 'Exfil zone not controlled',
      };
    }

    // Start exfil (progress = 1)
    this.state.exfilProgress.set(vipMemberId, 1);
    vip.state = VIPState.InTransit;

    return {
      success: true,
      actionType: 'start_exfil',
      vpAwarded: 0,
    };
  }

  /**
   * Continue/complete VIP exfiltration
   */
  continueExfil(vipMemberId: string): ExfilActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    const progress = this.state.exfilProgress.get(vipMemberId) ?? 0;
    if (progress === 0) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        reason: 'Exfil not started',
      };
    }

    // Check if still in controlled zone
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        reason: 'VIP has no position',
      };
    }

    const inZone = this.isInExfilZone(member.position);
    if (!inZone) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        reason: 'VIP no longer in exfil zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.exfilZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        reason: 'Exfil zone no longer controlled',
      };
    }

    // Increment progress
    const newProgress = progress + 1;
    this.state.exfilProgress.set(vipMemberId, newProgress);

    if (newProgress >= 2) {
      // Exfil complete!
      return this.completeExfil(vipMemberId);
    }

    return {
      success: true,
      actionType: 'continue_exfil',
      vpAwarded: 0,
    };
  }

  /**
   * Complete VIP exfiltration
   */
  private completeExfil(vipMemberId: string): ExfilActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'complete_exfil',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    const sideId = vip.extractingSide;
    if (!sideId) {
      return {
        success: false,
        actionType: 'complete_exfil',
        vpAwarded: 0,
        reason: 'No extracting side',
      };
    }

    // Mark VIP as extracted
    vip.state = VIPState.Extracted;
    this.state.exfilProgress.delete(vipMemberId);

    // Award VP
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    const vpAwarded = 10; // Base exfil VP
    this.state.vpBySide.set(sideId, currentVP + vpAwarded);

    // Update side state
    const side = this.sides.get(sideId);
    if (side) {
      side.state.victoryPoints = currentVP + vpAwarded;
    }

    // Instant win!
    this.endMission(sideId, 'VIP exfiltrated successfully');

    return {
      success: true,
      actionType: 'complete_exfil',
      vpAwarded,
    };
  }

  /**
   * Check if position is in exfil zone
   */
  private isInExfilZone(position: Position): boolean {
    const zones = this.poiManager.getAllPOIs();
    const exfilZone = zones.find(z => z.id === 'exfil-zone');
    if (!exfilZone) return false;

    const dx = position.x - exfilZone.position.x;
    const dy = position.y - exfilZone.position.y;
    return (dx * dx + dy * dy) <= (exfilZone.radius * exfilZone.radius);
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
   * Get exfil progress for a VIP
   */
  getExfilProgress(vipMemberId: string): number {
    return this.state.exfilProgress.get(vipMemberId) ?? 0;
  }

  /**
   * Check if reinforcements have arrived for a side
   */
  haveReinforcementsArrived(sideId: string): boolean {
    return this.state.reinforcementsArrived.get(sideId) ?? false;
  }

  /**
   * Get exfil zone controller
   */
  getExfilZoneController(): string | null {
    return this.state.exfilZoneControl;
  }

  /**
   * Get mission state
   */
  getState(): ExfilMissionState {
    return { ...this.state };
  }

  /**
   * Get exfil zone
   */
  getExfilZone(): PointOfInterest | null {
    const zones = this.poiManager.getAllPOIs();
    return zones.find(z => z.id === 'exfil-zone') ?? null;
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
}

/**
 * Create an Exfil mission manager
 */
export function createExfilMission(
  sides: MissionSide[],
  vipMemberIds: Map<string, string>,
  reinforcementRosters: Map<string, AssemblyRoster>,
  exfilZonePosition?: Position,
  reinforcementTurnRange?: [number, number]
): ExfilMissionManager {
  return new ExfilMissionManager(sides, vipMemberIds, reinforcementRosters, exfilZonePosition, reinforcementTurnRange);
}

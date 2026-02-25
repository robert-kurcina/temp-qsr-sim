import { MissionSide, SideMember } from '../mission/MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../mission/poi-zone-control';
import { VIP, VIPManager, VIPState, createVIP } from '../mission/vip-system';
import { ReinforcementsManager, createReinforcementGroup, ReinforcementTrigger, ArrivalEdge } from '../mission/reinforcements-system';
import { Position } from '../battlefield/Position';
import { buildAssembly, buildProfile, AssemblyRoster } from '../mission/assembly-builder';

/**
 * Defiance Mission State
 */
export interface DefianceMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** VIP for each side (sideId -> VIP member ID) */
  vipBySide: Map<string, string>;
  /** Side for each VIP (vipMemberId -> sideId) */
  sideByVip: Map<string, string>;
  /** Turns each VIP has survived */
  vipSurvivalTurns: Map<string, number>;
  /** Defense zone control */
  zoneControl: Map<string, string | null>;
  /** VP per side */
  vpBySide: Map<string, number>;
  /** Reinforcements arrived per side */
  reinforcementsArrived: Map<string, boolean>;
  /** Turn when reinforcements arrive */
  reinforcementTurn: number;
  /** Has the mission ended? */
  ended: boolean;
  /** Winning side ID (if ended) */
  winner?: string;
  /** Reason for ending */
  endReason?: string;
}

/**
 * Defiance Mission Manager
 * Handles all Defiance mission logic combining VIP + Reinforcements + Defense
 */
export class DefianceMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private vipManager: VIPManager;
  private reinforceManager: ReinforcementsManager;
  private state: DefianceMissionState;

  constructor(
    sides: MissionSide[],
    vipMemberIds: Map<string, string>,
    reinforcementRosters: Map<string, AssemblyRoster>,
    defenseZonePositions?: Position[],
    reinforcementTurn?: number
  ) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.vipManager = new VIPManager();
    this.reinforceManager = new ReinforcementsManager();
    this.state = {
      sideIds: sides.map(s => s.id),
      vipBySide: new Map(),
      sideByVip: new Map(),
      vipSurvivalTurns: new Map(),
      zoneControl: new Map(),
      vpBySide: new Map(),
      reinforcementsArrived: new Map(),
      reinforcementTurn: reinforcementTurn ?? 6,
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
          this.state.vipSurvivalTurns.set(vipMemberId, 0);
          this.setupVIP(member, side.id);
        }
      }

      // Set up reinforcements for this side
      const roster = reinforcementRosters.get(side.id);
      if (roster) {
        this.setupReinforcements(side.id, roster);
      }
    }

    // Create defense zones
    this.setupDefenseZones(defenseZonePositions);
  }

  /**
   * Set up VIP for a side
   */
  private setupVIP(member: SideMember, sideId: string): void {
    const vip = createVIP(member.id, member.character, sideId, {
      name: member.id,
      type: 'Commander' as any,
      extractionVP: 20,
      eliminationVP: 5,
      extractingSide: sideId,
    });
    this.vipManager.addVIP(vip);
  }

  /**
   * Set up reinforcements for a side (arrives on reinforcement turn)
   */
  private setupReinforcements(sideId: string, roster: AssemblyRoster): void {
    const reinforceGroup = createReinforcementGroup({
      sideId,
      roster,
      trigger: ReinforcementTrigger.OnTurn,
      turnNumber: this.state.reinforcementTurn,
      arrivalEdge: ArrivalEdge.Any,
      canBeDelayed: false,
    });
    this.reinforceManager.addGroup(reinforceGroup);
  }

  /**
   * Set up defense zones around VIP positions
   */
  private setupDefenseZones(positions?: Position[]): void {
    // Default defense zone positions
    const defaultPositions: Position[] = [
      { x: 12, y: 12 },  // Center
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 6, y: 18 },
      { x: 18, y: 18 },
    ];

    const zonePositions = positions && positions.length > 0
      ? positions
      : defaultPositions.slice(0, 4);

    for (let i = 0; i < zonePositions.length && i < 5; i++) {
      const zone = createPOI({
        id: `defense-zone-${i + 1}`,
        name: `Defense Zone ${i + 1}`,
        type: POIType.ControlZone,
        position: zonePositions[i],
        radius: 3,
        vpPerTurn: 2,
        vpFirstControl: 0,
      });
      this.poiManager.addPOI(zone);
      this.state.zoneControl.set(zone.id, null);
    }
  }

  /**
   * Update defense zone control based on model positions
   */
  updateDefenseZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs();

    for (const zone of zones) {
      const modelsInZone = models.filter(m => {
        const dx = m.position.x - zone.position.x;
        const dy = m.position.y - zone.position.y;
        return (dx * dx + dy * dy) <= (zone.radius * zone.radius);
      });

      if (modelsInZone.length === 0) {
        this.state.zoneControl.set(zone.id, null);
        continue;
      }

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
   * Check and trigger reinforcement arrivals
   */
  checkReinforcements(currentTurn: number): Map<string, boolean> {
    const arrived = new Map<string, boolean>();

    if (currentTurn !== this.state.reinforcementTurn) {
      return arrived;
    }

    for (const sideId of this.state.sideIds) {
      if (this.state.reinforcementsArrived.get(sideId)) continue;

      const groups = this.reinforceManager.getGroupsForSide(sideId);
      for (const group of groups) {
        if (this.reinforceManager.shouldArriveThisTurn(group, currentTurn)) {
          this.reinforceManager.triggerArrival(group.id, currentTurn);
          this.state.reinforcementsArrived.set(sideId, true);
          arrived.set(sideId, true);

          // Check VIP survival bonus
          this.checkVIPSurvivalBonus(sideId);
        }
      }
    }

    return arrived;
  }

  /**
   * Check VIP survival and award bonus when reinforcements arrive
   */
  private checkVIPSurvivalBonus(sideId: string): void {
    const vipMemberId = this.state.vipBySide.get(sideId);
    if (!vipMemberId) return;

    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip || vip.state === VIPState.Eliminated) return;

    // VIP survived until reinforcements - award 20 VP bonus
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    this.state.vpBySide.set(sideId, currentVP + 20);

    const side = this.sides.get(sideId);
    if (side) {
      side.state.victoryPoints = currentVP + 20;
    }
  }

  /**
   * End of turn processing - award VP for VIP survival
   */
  endTurn(currentTurn: number): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    for (const [sideId, vipMemberId] of this.state.vipBySide.entries()) {
      const vip = this.vipManager.getVIP(vipMemberId);
      if (!vip || vip.state === VIPState.Eliminated) {
        vpAwarded.set(sideId, 0);
        continue;
      }

      // Increment survival turns
      const survivalTurns = (this.state.vipSurvivalTurns.get(vipMemberId) ?? 0) + 1;
      this.state.vipSurvivalTurns.set(vipMemberId, survivalTurns);

      // Award 10 VP per turn survived
      const currentVP = this.state.vpBySide.get(sideId) ?? 0;
      const newVP = currentVP + 10;
      this.state.vpBySide.set(sideId, newVP);
      vpAwarded.set(sideId, 10);

      const side = this.sides.get(sideId);
      if (side) {
        side.state.victoryPoints = newVP;
      }
    }

    return vpAwarded;
  }

  /**
   * Award VP for zone control at end of turn
   */
  awardZoneVP(): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    for (const sideId of this.state.sideIds) {
      vpAwarded.set(sideId, 0);
    }

    for (const [zoneId, controller] of this.state.zoneControl.entries()) {
      if (controller) {
        const currentVP = vpAwarded.get(controller) ?? 0;
        vpAwarded.set(controller, currentVP + 2);
        
        const sideVP = this.state.vpBySide.get(controller) ?? 0;
        this.state.vpBySide.set(controller, sideVP + 2);

        const side = this.sides.get(controller);
        if (side) {
          side.state.victoryPoints = sideVP + 2;
        }
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
   * Handle VIP elimination
   */
  handleVIPElimination(eliminatedVipMemberId: string, eliminatingSideId?: string): void {
    const sideId = this.state.sideByVip.get(eliminatedVipMemberId);
    if (!sideId) return;

    // Award 5 VP to eliminating side
    if (eliminatingSideId && eliminatingSideId !== sideId) {
      this.awardVP(eliminatingSideId, 5);
    }

    // Check for last VIP standing
    this.checkForLastVIPStanding();
  }

  /**
   * Check if only one VIP remains (instant win)
   */
  private checkForLastVIPStanding(): void {
    const survivingVIPs: string[] = [];

    for (const [sideId, vipMemberId] of this.state.vipBySide.entries()) {
      const vip = this.vipManager.getVIP(vipMemberId);
      const member = this.getMemberById(vipMemberId);

      if (vip && vip.state !== VIPState.Eliminated &&
          member && member.status !== 'Eliminated' as any) {
        survivingVIPs.push(sideId);
      }
    }

    if (survivingVIPs.length === 1) {
      // Last VIP standing wins!
      this.endMission(survivingVIPs[0], 'Last VIP standing');
    } else if (survivingVIPs.length === 0) {
      // All VIPs eliminated - highest VP wins
      this.endMission(undefined, 'All VIPs eliminated');
    }
  }

  /**
   * Check for victory conditions
   */
  checkForVictory(): void {
    if (this.state.ended) return;
    this.checkForLastVIPStanding();
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
   * Get VIP survival turns
   */
  getVIPSurvivalTurns(vipMemberId: string): number {
    return this.state.vipSurvivalTurns.get(vipMemberId) ?? 0;
  }

  /**
   * Check if reinforcements have arrived for a side
   */
  haveReinforcementsArrived(sideId: string): boolean {
    return this.state.reinforcementsArrived.get(sideId) ?? false;
  }

  /**
   * Get reinforcement turn
   */
  getReinforcementTurn(): number {
    return this.state.reinforcementTurn;
  }

  /**
   * Get mission state
   */
  getState(): DefianceMissionState {
    return { ...this.state };
  }

  /**
   * Get all defense zones
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
  getVPStandings(): Array<{ sideId: string; vp: number; vipAlive: boolean; survivalTurns: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => {
        const vipMemberId = this.state.vipBySide.get(sideId);
        const vip = vipMemberId ? this.vipManager.getVIP(vipMemberId) : undefined;
        const vipAlive = vip !== undefined && vip.state !== VIPState.Eliminated;
        const survivalTurns = vipMemberId ? (this.state.vipSurvivalTurns.get(vipMemberId) ?? 0) : 0;
        
        return {
          sideId,
          vp,
          vipAlive,
          survivalTurns,
        };
      })
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Defiance mission manager
 */
export function createDefianceMission(
  sides: MissionSide[],
  vipMemberIds: Map<string, string>,
  reinforcementRosters: Map<string, AssemblyRoster>,
  defenseZonePositions?: Position[],
  reinforcementTurn?: number
): DefianceMissionManager {
  return new DefianceMissionManager(sides, vipMemberIds, reinforcementRosters, defenseZonePositions, reinforcementTurn);
}

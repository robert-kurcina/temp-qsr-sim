import { MissionSide, SideMember } from '../MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../poi-zone-control';
import { VIP, VIPManager, VIPState, createVIP } from '../vip-system';
import { ReinforcementsManager, createReinforcementGroup, ReinforcementTrigger, ArrivalEdge } from '../reinforcements-system';
import { Position } from '../battlefield/Position';
import { buildAssembly, buildProfile, AssemblyRoster } from '../assembly-builder';

/**
 * VIP detection state
 */
export enum DetectionState {
  Hidden = 'Hidden',
  Suspected = 'Suspected',
  Confirmed = 'Confirmed',
}

/**
 * Ghost Protocol Mission State
 */
export interface GhostProtocolMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** VIP for each side (sideId -> VIP member ID) */
  vipBySide: Map<string, string>;
  /** Side for each VIP (vipMemberId -> sideId) */
  sideByVip: Map<string, string>;
  /** Detection state for each VIP */
  vipDetection: Map<string, DetectionState>;
  /** Whether VIP was ever detected (for ghost bonus) */
  vipWasDetected: Map<string, boolean>;
  /** Stealth zone control */
  zoneControl: Map<string, string | null>;
  /** Exfil zone controller */
  exfilZoneControl: string | null;
  /** VIP exfil progress */
  exfilProgress: Map<string, number>;
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
  isGhostBonus: boolean;
  reason?: string;
}

/**
 * Detection action result
 */
export interface DetectionResult {
  detected: boolean;
  vipMemberId: string;
  previousState: DetectionState;
  newState: DetectionState;
  detectingSide?: string;
}

/**
 * Ghost Protocol Mission Manager
 * Handles all Ghost Protocol mission logic combining VIP + Detection + Reinforcements
 */
export class GhostProtocolMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private vipManager: VIPManager;
  private reinforceManager: ReinforcementsManager;
  private state: GhostProtocolMissionState;

  constructor(
    sides: MissionSide[],
    vipMemberIds: Map<string, string>, // sideId -> member ID to be VIP
    reinforcementRosters: Map<string, AssemblyRoster>, // sideId -> reinforcement roster
    stealthZonePositions?: Position[],
    exfilZonePosition?: Position
  ) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.vipManager = new VIPManager();
    this.reinforceManager = new ReinforcementsManager();
    this.state = {
      sideIds: sides.map(s => s.id),
      vipBySide: new Map(),
      sideByVip: new Map(),
      vipDetection: new Map(),
      vipWasDetected: new Map(),
      zoneControl: new Map(),
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
          this.state.vipDetection.set(vipMemberId, DetectionState.Hidden);
          this.state.vipWasDetected.set(vipMemberId, false);
          this.setupVIP(member, side.id);
        }
      }

      // Set up reinforcements for this side
      const roster = reinforcementRosters.get(side.id);
      if (roster) {
        this.setupReinforcements(side.id, roster);
      }
    }

    // Create stealth zones and exfil zone
    this.setupZones(stealthZonePositions, exfilZonePosition);
  }

  /**
   * Set up VIP for a side
   */
  private setupVIP(member: SideMember, sideId: string): void {
    const vip = createVIP(member.id, member.character, sideId, {
      name: member.id,
      type: 'Courier' as any,
      extractionVP: 15,
      eliminationVP: 5,
      extractingSide: sideId,
    });
    this.vipManager.addVIP(vip);
  }

  /**
   * Set up reinforcements for a side (triggered on VIP detection)
   */
  private setupReinforcements(sideId: string, roster: AssemblyRoster): void {
    const reinforceGroup = createReinforcementGroup({
      sideId,
      roster,
      trigger: ReinforcementTrigger.Manual, // Triggered by detection event
      arrivalEdge: ArrivalEdge.Any,
      canBeDelayed: false,
    });
    this.reinforceManager.addGroup(reinforceGroup);
  }

  /**
   * Set up stealth zones and exfil zone
   */
  private setupZones(stealthPositions?: Position[], exfilPosition?: Position): void {
    // Default stealth zone positions
    const defaultStealthPositions: Position[] = [
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 12, y: 12 },
    ];

    const zonePositions = stealthPositions && stealthPositions.length > 0 
      ? stealthPositions 
      : defaultStealthPositions;

    for (let i = 0; i < zonePositions.length && i < 4; i++) {
      const zone = createPOI({
        id: `stealth-zone-${i + 1}`,
        name: `Stealth Zone ${i + 1}`,
        type: POIType.ControlZone,
        position: zonePositions[i],
        radius: 3,
        vpPerTurn: 2,
        vpFirstControl: 0,
      });
      this.poiManager.addPOI(zone);
      this.state.zoneControl.set(zone.id, null);
    }

    // Create exfil zone
    const exfilPos = exfilPosition ?? { x: 12, y: 2 };
    const exfilZone = createPOI({
      id: 'exfil-zone',
      name: 'Exfiltration Point',
      type: POIType.ExtractionPoint,
      position: exfilPos,
      radius: 4,
      vpPerTurn: 0,
      vpFirstControl: 0,
    });
    this.poiManager.addPOI(exfilZone);
  }

  /**
   * Update stealth zone control based on model positions
   */
  updateStealthZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs().filter(z => z.id.startsWith('stealth-zone'));

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

    // Update exfil zone control
    this.updateExfilZoneControl(models);
  }

  /**
   * Update exfil zone control
   */
  private updateExfilZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs();
    const exfilZone = zones.find(z => z.id === 'exfil-zone');
    if (!exfilZone) return;

    const modelsInZone = models.filter(m => {
      const dx = m.position.x - exfilZone.position.x;
      const dy = m.position.y - exfilZone.position.y;
      return (dx * dx + dy * dy) <= (exfilZone.radius * exfilZone.radius);
    });

    if (modelsInZone.length === 0) {
      this.state.exfilZoneControl = null;
      return;
    }

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
   * Check if VIP is in a stealth zone
   */
  isVIPInStealthZone(vipMemberId: string): boolean {
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) return false;

    const zones = this.poiManager.getAllPOIs().filter(z => z.id.startsWith('stealth-zone'));
    for (const zone of zones) {
      const dx = member.position.x - zone.position.x;
      const dy = member.position.y - zone.position.y;
      if ((dx * dx + dy * dy) <= (zone.radius * zone.radius)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if VIP is in exfil zone
   */
  isVIPInExfilZone(vipMemberId: string): boolean {
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) return false;

    const zones = this.poiManager.getAllPOIs();
    const exfilZone = zones.find(z => z.id === 'exfil-zone');
    if (!exfilZone) return false;

    const dx = member.position.x - exfilZone.position.x;
    const dy = member.position.y - exfilZone.position.y;
    return (dx * dx + dy * dy) <= (exfilZone.radius * exfilZone.radius);
  }

  /**
   * Detect VIP (increase detection state)
   */
  detectVIP(vipMemberId: string, detectingSideId: string): DetectionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    const currentState = this.state.vipDetection.get(vipMemberId) ?? DetectionState.Hidden;

    // If VIP is in stealth zone, detection fails
    if (this.isVIPInStealthZone(vipMemberId)) {
      return {
        detected: false,
        vipMemberId,
        previousState: currentState,
        newState: currentState,
      };
    }

    // Increase detection state
    let newState = currentState;
    if (currentState === DetectionState.Hidden) {
      newState = DetectionState.Suspected;
    } else if (currentState === DetectionState.Suspected) {
      newState = DetectionState.Confirmed;
    }

    this.state.vipDetection.set(vipMemberId, newState);

    // Mark VIP as detected (for ghost bonus tracking)
    if (currentState === DetectionState.Hidden) {
      this.state.vipWasDetected.set(vipMemberId, true);
      // Award VP for detection
      this.awardVP(detectingSideId, 5);
      // Trigger reinforcements for detected VIP's side
      this.triggerReinforcements(this.state.sideByVip.get(vipMemberId)!);
    }

    return {
      detected: true,
      vipMemberId,
      previousState: currentState,
      newState,
      detectingSide: detectingSideId,
    };
  }

  /**
   * Trigger reinforcements for a side
   */
  triggerReinforcements(sideId: string): void {
    const groups = this.reinforceManager.getGroupsForSide(sideId);
    for (const group of groups) {
      this.reinforceManager.triggerArrival(group.id, 1);
      this.state.reinforcementsArrived.set(sideId, true);
    }
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
        isGhostBonus: false,
        reason: 'VIP not found',
      };
    }

    if (vip.state !== VIPState.Active) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
        reason: 'VIP is not active',
      };
    }

    // Check if VIP is in exfil zone
    if (!this.isVIPInExfilZone(vipMemberId)) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
        reason: 'VIP not in exfil zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.exfilZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'start_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
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
      isGhostBonus: false,
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
        isGhostBonus: false,
        reason: 'VIP not found',
      };
    }

    const progress = this.state.exfilProgress.get(vipMemberId) ?? 0;
    if (progress === 0) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
        reason: 'Exfil not started',
      };
    }

    // Check if still in exfil zone
    if (!this.isVIPInExfilZone(vipMemberId)) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
        reason: 'VIP no longer in exfil zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.exfilZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'continue_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
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
      isGhostBonus: false,
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
        isGhostBonus: false,
        reason: 'VIP not found',
      };
    }

    const sideId = vip.extractingSide;
    if (!sideId) {
      return {
        success: false,
        actionType: 'complete_exfil',
        vpAwarded: 0,
        isGhostBonus: false,
        reason: 'No extracting side',
      };
    }

    // Mark VIP as extracted
    vip.state = VIPState.Extracted;
    this.state.exfilProgress.delete(vipMemberId);

    // Determine VP (ghost bonus if never detected)
    const wasDetected = this.state.vipWasDetected.get(vipMemberId) ?? false;
    const vpAwarded = wasDetected ? 8 : 15;

    // Award VP
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    this.state.vpBySide.set(sideId, currentVP + vpAwarded);

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
      isGhostBonus: !wasDetected,
    };
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
   * Award VP for zone control at end of turn
   */
  awardTurnVP(): Map<string, number> {
    const vpAwarded = new Map<string, number>();

    for (const sideId of this.state.sideIds) {
      vpAwarded.set(sideId, 0);
    }

    for (const [zoneId, controller] of this.state.zoneControl.entries()) {
      if (controller) {
        const currentVP = vpAwarded.get(controller) ?? 0;
        vpAwarded.set(controller, currentVP + 2);
        this.awardVP(controller, 2);
      }
    }

    return vpAwarded;
  }

  /**
   * Check for VIP elimination
   */
  checkForVIPElimination(): void {
    for (const [sideId, vipMemberId] of this.state.vipBySide.entries()) {
      const vip = this.vipManager.getVIP(vipMemberId);
      if (!vip) continue;

      const member = this.getMemberById(vipMemberId);
      if (!member || member.status === 'Eliminated' as any) {
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
   * Get VIP detection state
   */
  getVIPDetectionState(vipMemberId: string): DetectionState {
    return this.state.vipDetection.get(vipMemberId) ?? DetectionState.Hidden;
  }

  /**
   * Check if VIP was ever detected
   */
  wasVIPDetected(vipMemberId: string): boolean {
    return this.state.vipWasDetected.get(vipMemberId) ?? false;
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
   * Get mission state
   */
  getState(): GhostProtocolMissionState {
    return { ...this.state };
  }

  /**
   * Get all zones
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
  getVPStandings(): Array<{ sideId: string; vp: number; vipDetected: boolean }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => {
        const vipMemberId = this.state.vipBySide.get(sideId);
        return {
          sideId,
          vp,
          vipDetected: vipMemberId ? (this.state.vipWasDetected.get(vipMemberId) ?? false) : false,
        };
      })
      .sort((a, b) => b.vp - a.vp);
  }
}

/**
 * Create a Ghost Protocol mission manager
 */
export function createGhostProtocolMission(
  sides: MissionSide[],
  vipMemberIds: Map<string, string>,
  reinforcementRosters: Map<string, AssemblyRoster>,
  stealthZonePositions?: Position[],
  exfilZonePosition?: Position
): GhostProtocolMissionManager {
  return new GhostProtocolMissionManager(sides, vipMemberIds, reinforcementRosters, stealthZonePositions, exfilZonePosition);
}

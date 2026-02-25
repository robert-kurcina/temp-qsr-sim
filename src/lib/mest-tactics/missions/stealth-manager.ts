import { MissionSide, SideMember } from '../mission/MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../mission/poi-zone-control';
import { VIP, VIPManager, VIPState, createVIP } from '../mission/vip-system';
import { ReinforcementsManager, createReinforcementGroup, ReinforcementTrigger, ArrivalEdge } from '../mission/reinforcements-system';
import { Position } from '../battlefield/Position';
import { buildAssembly, buildProfile, AssemblyRoster } from '../mission/assembly-builder';

/**
 * VIP detection state
 */
export enum DetectionState {
  Hidden = 'Hidden',
  Suspected = 'Suspected',
  Confirmed = 'Confirmed',
}

/**
 * Stealth Mission State
 */
export interface StealthMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** VIP for each side (sideId -> VIP member ID) */
  vipBySide: Map<string, string>;
  /** Side for each VIP (vipMemberId -> sideId) */
  sideByVip: Map<string, string>;
  /** Detection state for each VIP */
  vipDetection: Map<string, DetectionState>;
  /** Whether VIP was ever detected (for stealth bonus) */
  vipWasDetected: Map<string, boolean>;
  /** Stealth zone control */
  zoneControl: Map<string, string | null>;
  /** Extraction zone controller */
  extractionZoneControl: string | null;
  /** VIP extraction progress */
  extractionProgress: Map<string, number>;
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
 * Extraction action result
 */
export interface ExtractionActionResult {
  success: boolean;
  actionType: 'start_extraction' | 'continue_extraction' | 'complete_extraction';
  vpAwarded: number;
  isStealthBonus: boolean;
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
 * Stealth Mission Manager
 * Handles all Stealth mission logic combining VIP + Detection + Reinforcements
 */
export class StealthMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private vipManager: VIPManager;
  private reinforceManager: ReinforcementsManager;
  private state: StealthMissionState;

  constructor(
    sides: MissionSide[],
    vipMemberIds: Map<string, string>, // sideId -> member ID to be VIP
    reinforcementRosters: Map<string, AssemblyRoster>, // sideId -> reinforcement roster
    stealthZonePositions?: Position[],
    extractionZonePosition?: Position
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
      extractionZoneControl: null,
      extractionProgress: new Map(),
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

    // Create stealth zones and extraction zone
    this.setupZones(stealthZonePositions, extractionZonePosition);
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
   * Set up stealth zones and extraction zone
   */
  private setupZones(stealthPositions?: Position[], extractionPosition?: Position): void {
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

    // Create extraction zone
    const extractionPos = extractionPosition ?? { x: 12, y: 2 };
    const extractionZone = createPOI({
      id: 'extraction-zone',
      name: 'Stealth Extraction Point',
      type: POIType.ExtractionPoint,
      position: extractionPos,
      radius: 4,
      vpPerTurn: 0,
      vpFirstControl: 0,
    });
    this.poiManager.addPOI(extractionZone);
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

    // Update extraction zone control
    this.updateExtractionZoneControl(models);
  }

  /**
   * Update extraction zone control
   */
  private updateExtractionZoneControl(models: Array<{ id: string; position: Position }>): void {
    const zones = this.poiManager.getAllPOIs();
    const extractionZone = zones.find(z => z.id === 'extraction-zone');
    if (!extractionZone) return;

    const modelsInZone = models.filter(m => {
      const dx = m.position.x - extractionZone.position.x;
      const dy = m.position.y - extractionZone.position.y;
      return (dx * dx + dy * dy) <= (extractionZone.radius * extractionZone.radius);
    });

    if (modelsInZone.length === 0) {
      this.state.extractionZoneControl = null;
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
      this.state.extractionZoneControl = null;
    } else if (sidesPresent.size === 1) {
      this.state.extractionZoneControl = Array.from(sidesPresent)[0];
    } else {
      this.state.extractionZoneControl = null;
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
   * Check if VIP is in extraction zone
   */
  isVIPInExtractionZone(vipMemberId: string): boolean {
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) return false;

    const zones = this.poiManager.getAllPOIs();
    const extractionZone = zones.find(z => z.id === 'extraction-zone');
    if (!extractionZone) return false;

    const dx = member.position.x - extractionZone.position.x;
    const dy = member.position.y - extractionZone.position.y;
    return (dx * dx + dy * dy) <= (extractionZone.radius * extractionZone.radius);
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
   * Start VIP extraction
   */
  startExtraction(vipMemberId: string): ExtractionActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'start_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'VIP not found',
      };
    }

    if (vip.state !== VIPState.Active) {
      return {
        success: false,
        actionType: 'start_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'VIP is not active',
      };
    }

    // Check if VIP is in extraction zone
    if (!this.isVIPInExtractionZone(vipMemberId)) {
      return {
        success: false,
        actionType: 'start_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'VIP not in extraction zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.extractionZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'start_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'Extraction zone not controlled',
      };
    }

    // Start extraction (progress = 1)
    this.state.extractionProgress.set(vipMemberId, 1);
    vip.state = VIPState.InTransit;

    return {
      success: true,
      actionType: 'start_extraction',
      vpAwarded: 0,
      isStealthBonus: false,
    };
  }

  /**
   * Continue/complete VIP extraction
   */
  continueExtraction(vipMemberId: string): ExtractionActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'continue_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'VIP not found',
      };
    }

    const progress = this.state.extractionProgress.get(vipMemberId) ?? 0;
    if (progress === 0) {
      return {
        success: false,
        actionType: 'continue_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'Extraction not started',
      };
    }

    // Check if still in extraction zone
    if (!this.isVIPInExtractionZone(vipMemberId)) {
      return {
        success: false,
        actionType: 'continue_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'VIP no longer in extraction zone',
      };
    }

    const sideId = this.state.sideByVip.get(vipMemberId);
    if (this.state.extractionZoneControl !== sideId) {
      return {
        success: false,
        actionType: 'continue_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'Extraction zone no longer controlled',
      };
    }

    // Increment progress
    const newProgress = progress + 1;
    this.state.extractionProgress.set(vipMemberId, newProgress);

    if (newProgress >= 2) {
      // Extraction complete!
      return this.completeExtraction(vipMemberId);
    }

    return {
      success: true,
      actionType: 'continue_extraction',
      vpAwarded: 0,
      isStealthBonus: false,
    };
  }

  /**
   * Complete VIP extraction
   */
  private completeExtraction(vipMemberId: string): ExtractionActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'complete_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'VIP not found',
      };
    }

    const sideId = vip.extractingSide;
    if (!sideId) {
      return {
        success: false,
        actionType: 'complete_extraction',
        vpAwarded: 0,
        isStealthBonus: false,
        reason: 'No extracting side',
      };
    }

    // Mark VIP as extracted
    vip.state = VIPState.Extracted;
    this.state.extractionProgress.delete(vipMemberId);

    // Determine VP (stealth bonus if never detected)
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
    this.endMission(sideId, 'VIP extracted successfully');

    return {
      success: true,
      actionType: 'complete_extraction',
      vpAwarded,
      isStealthBonus: !wasDetected,
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
   * Get extraction progress for a VIP
   */
  getExtractionProgress(vipMemberId: string): number {
    return this.state.extractionProgress.get(vipMemberId) ?? 0;
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
  getState(): StealthMissionState {
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

  /**
   * Calculate predicted scoring with key breakdown for AI planning
   * Keys: Courier (Core extraction), Lockdown, Elimination, Bottled
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

    // Courier: +3 VP for extracting Authentic Core (immediate victory)
    // Check if core was extracted (VP already awarded)
    const sortedVP = Array.from(this.state.vpBySide.entries()).sort((a, b) => b[1] - a[1]);
    for (const [sideId, vp] of this.state.vpBySide.entries()) {
      // Assume high VP means core was extracted
      const coreExtracted = vp >= 3;
      const predicted = coreExtracted ? 3 : 0;
      
      sideScores[sideId].keyScores['courier'] = {
        current: vp,
        predicted,
        confidence: coreExtracted ? 1.0 : 0.3, // Low confidence if not yet extracted
        leadMargin: coreExtracted ? 3 : 0,
      };
      sideScores[sideId].predictedVp += predicted;
    }

    // Lockdown: Security victory when Alarm Level reaches threshold
    // Defender (Security) wins if alarm level is high
    const alarmLevel = this.state.alarmLevel ?? 0;
    const lockdownThreshold = this.state.lockdownThreshold ?? 6;
    const lockdownAchieved = alarmLevel >= lockdownThreshold;
    
    // Find defender side (typically the one with VIP at center)
    for (const side of sideStatuses) {
      sideScores[side.sideId].keyScores['lockdown'] = {
        current: lockdownAchieved ? 1 : 0,
        predicted: lockdownAchieved ? 1 : 0,
        confidence: lockdownAchieved ? 1.0 : Math.min(1, alarmLevel / lockdownThreshold),
        leadMargin: lockdownAchieved ? 1 : 0,
      };
      if (lockdownAchieved) {
        sideScores[side.sideId].predictedVp += 1;
      }
    }

    // Elimination: Security victory if all Infiltrators eliminated
    const infiltratorsEliminated = sideStatuses
      .filter(s => s.sideId !== sortedVP[0]?.[0]) // Assume attacker is not leading
      .every(s => s.eliminatedCount === s.startingCount);
    
    if (infiltratorsEliminated && sortedVP[0]) {
      const defenderId = sortedVP[0][0];
      sideScores[defenderId].keyScores['elimination'] = {
        current: 1,
        predicted: 1,
        confidence: 1.0,
        leadMargin: 1,
      };
      sideScores[defenderId].predictedVp += 1;
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
 * Create a Stealth mission manager
 */
export function createStealthMission(
  sides: MissionSide[],
  vipMemberIds: Map<string, string>,
  reinforcementRosters: Map<string, AssemblyRoster>,
  stealthZonePositions?: Position[],
  extractionZonePosition?: Position
): StealthMissionManager {
  return new StealthMissionManager(sides, vipMemberIds, reinforcementRosters, stealthZonePositions, extractionZonePosition);
}

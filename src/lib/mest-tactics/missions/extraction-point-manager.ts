import { MissionSide, SideMember } from '../MissionSide';
import { PointOfInterest, POIType, POIManager, createPOI } from '../poi-zone-control';
import { VIP, VIPManager, VIPState, createVIP } from '../vip-system';
import { Position } from '../battlefield/Position';
import { Character } from '../Character';

/**
 * Extraction Point Mission State
 */
export interface ExtractionPointMissionState {
  /** Side IDs in the mission */
  sideIds: string[];
  /** VIP for each side (sideId -> VIP member ID) */
  vipBySide: Map<string, string>;
  /** Side for each VIP (vipMemberId -> sideId) */
  sideByVip: Map<string, string>;
  /** Extraction zone control */
  zoneControl: Map<string, string | null>; // zoneId -> controlling sideId
  /** VIP extraction progress */
  extractionProgress: Map<string, number>; // vipId -> turns extracting (0-2)
  /** VP per side */
  vpBySide: Map<string, number>;
  /** Zones controlled per side this turn */
  zonesControlledThisTurn: Map<string, number>;
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
  actionType: 'start_extract' | 'continue_extract' | 'complete_extract';
  vpAwarded: number;
  reason?: string;
}

/**
 * Extraction Point Mission Manager
 * Handles all Extraction Point mission logic
 */
export class ExtractionPointMissionManager {
  private sides: Map<string, MissionSide>;
  private poiManager: POIManager;
  private vipManager: VIPManager;
  private state: ExtractionPointMissionState;
  private zoneCount: number;

  constructor(
    sides: MissionSide[],
    vipMemberIds: Map<string, string>, // sideId -> member ID to be VIP
    zonePositions?: Position[],
    zoneCount?: number
  ) {
    this.sides = new Map();
    this.poiManager = new POIManager();
    this.vipManager = new VIPManager();
    this.zoneCount = zoneCount ?? (zonePositions && zonePositions.length > 0 ? zonePositions.length : 3);
    this.state = {
      sideIds: sides.map(s => s.id),
      vipBySide: new Map(),
      sideByVip: new Map(),
      zoneControl: new Map(),
      extractionProgress: new Map(),
      vpBySide: new Map(),
      zonesControlledThisTurn: new Map(),
      ended: false,
    };

    // Initialize sides
    for (const side of sides) {
      this.sides.set(side.id, side);
      this.state.vpBySide.set(side.id, 0);
      this.state.zonesControlledThisTurn.set(side.id, 0);

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
    }

    // Create extraction zones
    this.setupExtractionZones(zonePositions);
  }

  /**
   * Set up VIP for a side
   */
  private setupVIP(member: SideMember, sideId: string): void {
    const vip = createVIP(member.id, member.character, sideId, {
      name: member.id,
      type: 'Commander' as any,
      extractionVP: 5,
      eliminationVP: 3,
      extractingSide: sideId,
    });
    this.vipManager.addVIP(vip);
  }

  /**
   * Set up extraction zones
   */
  private setupExtractionZones(positions?: Position[]): void {
    // Default extraction zone positions
    const defaultPositions: Position[] = [
      { x: 3, y: 3 },    // Corner 1
      { x: 21, y: 3 },   // Corner 2
      { x: 12, y: 21 },  // Top center
    ];

    const zonePositions = positions && positions.length > 0 ? positions : defaultPositions.slice(0, this.zoneCount);

    for (let i = 0; i < zonePositions.length; i++) {
      const zone = createPOI({
        id: `extract-zone-${i + 1}`,
        name: `Extraction Zone ${i + 1}`,
        type: POIType.ExtractionPoint,
        position: zonePositions[i],
        radius: 3,
        vpPerTurn: 1,
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
   * Start VIP extraction
   */
  startExtraction(vipMemberId: string): ExtractionActionResult {
    const vip = this.vipManager.getVIP(vipMemberId);
    if (!vip) {
      return {
        success: false,
        actionType: 'start_extract',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    if (vip.state !== VIPState.Active) {
      return {
        success: false,
        actionType: 'start_extract',
        vpAwarded: 0,
        reason: 'VIP is not active',
      };
    }

    // Check if VIP is in a controlled extraction zone
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) {
      return {
        success: false,
        actionType: 'start_extract',
        vpAwarded: 0,
        reason: 'VIP has no position',
      };
    }

    const zone = this.getZoneForPosition(member.position);
    if (!zone) {
      return {
        success: false,
        actionType: 'start_extract',
        vpAwarded: 0,
        reason: 'VIP not in extraction zone',
      };
    }

    const controller = this.state.zoneControl.get(zone.id);
    const sideId = this.state.sideByVip.get(vipMemberId);
    if (controller !== sideId) {
      return {
        success: false,
        actionType: 'start_extract',
        vpAwarded: 0,
        reason: 'Zone not controlled by VIP side',
      };
    }

    // Start extraction (progress = 1)
    this.state.extractionProgress.set(vipMemberId, 1);
    vip.state = VIPState.InTransit; // Extracting

    return {
      success: true,
      actionType: 'start_extract',
      vpAwarded: 0,
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
        actionType: 'continue_extract',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    const progress = this.state.extractionProgress.get(vipMemberId) ?? 0;
    if (progress === 0) {
      return {
        success: false,
        actionType: 'continue_extract',
        vpAwarded: 0,
        reason: 'Extraction not started',
      };
    }

    // Check if still in controlled zone
    const member = this.getMemberById(vipMemberId);
    if (!member || !member.position) {
      return {
        success: false,
        actionType: 'continue_extract',
        vpAwarded: 0,
        reason: 'VIP has no position',
      };
    }

    const zone = this.getZoneForPosition(member.position);
    if (!zone) {
      return {
        success: false,
        actionType: 'continue_extract',
        vpAwarded: 0,
        reason: 'VIP no longer in extraction zone',
      };
    }

    const controller = this.state.zoneControl.get(zone.id);
    const sideId = this.state.sideByVip.get(vipMemberId);
    if (controller !== sideId) {
      return {
        success: false,
        actionType: 'continue_extract',
        vpAwarded: 0,
        reason: 'Zone no longer controlled',
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
      actionType: 'continue_extract',
      vpAwarded: 0,
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
        actionType: 'complete_extract',
        vpAwarded: 0,
        reason: 'VIP not found',
      };
    }

    const sideId = vip.extractingSide;
    if (!sideId) {
      return {
        success: false,
        actionType: 'complete_extract',
        vpAwarded: 0,
        reason: 'No extracting side',
      };
    }

    // Mark VIP as extracted
    vip.state = VIPState.Extracted;
    this.state.extractionProgress.delete(vipMemberId);

    // Award VP
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    const vpAwarded = 5; // Base extraction VP
    this.state.vpBySide.set(sideId, currentVP + vpAwarded);

    // Update side state
    const side = this.sides.get(sideId);
    if (side) {
      side.state.victoryPoints = currentVP + vpAwarded;
    }

    // Instant win!
    this.endMission(sideId, 'VIP extracted successfully');

    return {
      success: true,
      actionType: 'complete_extract',
      vpAwarded,
    };
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
   * Get zone for a position
   */
  private getZoneForPosition(position: Position): PointOfInterest | null {
    for (const zone of this.poiManager.getAllPOIs()) {
      const dx = position.x - zone.position.x;
      const dy = position.y - zone.position.y;
      if ((dx * dx + dy * dy) <= (zone.radius * zone.radius)) {
        return zone;
      }
    }
    return null;
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

        // Award 1 VP per zone
        const currentVP = vpAwarded.get(controller) ?? 0;
        vpAwarded.set(controller, currentVP + 1);
        this.awardVP(controller, 1);
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
    if (this.state.ended) return;

    // Check if any VIP extracted (handled in completeExtraction)
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
   * Get extraction progress for a VIP
   */
  getExtractionProgress(vipMemberId: string): number {
    return this.state.extractionProgress.get(vipMemberId) ?? 0;
  }

  /**
   * Get mission state
   */
  getState(): ExtractionPointMissionState {
    return { ...this.state };
  }

  /**
   * Get all extraction zones
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
}

/**
 * Create an Extraction Point mission manager
 */
export function createExtractionPointMission(
  sides: MissionSide[],
  vipMemberIds: Map<string, string>,
  zonePositions?: Position[],
  zoneCount?: number
): ExtractionPointMissionManager {
  return new ExtractionPointMissionManager(sides, vipMemberIds, zonePositions ?? [], zoneCount);
}

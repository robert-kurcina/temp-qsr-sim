import { Character } from '../core/Character';
import { Position } from '../battlefield/Position';
import { MissionSide, SideMember } from './MissionSide';

/**
 * VIP state enumeration
 */
export enum VIPState {
  /** VIP is active and on the battlefield */
  Active = 'Active',
  /** VIP is hidden (concealed) */
  Hidden = 'Hidden',
  /** VIP has been extracted (successful) */
  Extracted = 'Extracted',
  /** VIP has been eliminated (failed) */
  Eliminated = 'Eliminated',
  /** VIP is in transit (between extraction) */
  InTransit = 'InTransit',
}

/**
 * VIP detection level
 */
export enum DetectionLevel {
  /** VIP is undetected */
  Undetected = 'Undetected',
  /** VIP is suspected (possible location known) */
  Suspected = 'Suspected',
  /** VIP is confirmed (exact location known) */
  Confirmed = 'Confirmed',
}

/**
 * VIP definition
 */
export interface VIP {
  /** Unique identifier */
  id: string;
  /** Display name/callsign */
  name: string;
  /** The character representing this VIP */
  character: Character;
  /** Current state */
  state: VIPState;
  /** Current detection level */
  detectionLevel: DetectionLevel;
  /** Which side the VIP belongs to */
  affiliatedSide: string;
  /** Whether the VIP is currently controlled by a guardian */
  controlled: boolean;
  /** Guardian model ID (if controlled) */
  guardianId?: string;
  /** Which side currently controls this VIP */
  controlledBySideId?: string;
  /** Which side is trying to extract this VIP */
  extractingSide?: string;
  /** Extraction point position (if applicable) */
  extractionPoint?: Position;
  /** Victory points for successful extraction */
  extractionVP: number;
  /** Victory points for elimination (if enemy extracts) */
  eliminationVP: number;
  /** Special VIP type */
  type: VIPType;
  /** Metadata for mission-specific data */
  metadata: Record<string, unknown>;
}

/**
 * VIP types for different mission scenarios
 */
export enum VIPType {
  /** Standard VIP (humanoid) */
  Standard = 'Standard',
  /** Scientist/researcher */
  Scientist = 'Scientist',
  /** Military commander */
  Commander = 'Commander',
  /** Political figure */
  Political = 'Political',
  /** Courier with intelligence */
  Courier = 'Courier',
  /** Defector */
  Defector = 'Defector',
  /** Hostage to be rescued */
  Hostage = 'Hostage',
}

/**
 * VIP extraction result
 */
export interface ExtractionResult {
  success: boolean;
  vip: VIP;
  extractingSide: string;
  victoryPointsAwarded: number;
  reason?: string;
}

/**
 * VIP detection result
 */
export interface DetectionResult {
  detected: boolean;
  vip: VIP;
  previousLevel: DetectionLevel;
  newLevel: DetectionLevel;
  detectingSide?: string;
}

/**
 * VIP elimination result
 */
export interface EliminationResult {
  eliminated: boolean;
  vip: VIP;
  eliminatingSide?: string;
  victoryPointsAwarded: number;
  reason?: string;
}

/**
 * VIP Manager - handles all VIP operations
 */
export class VIPManager {
  private vips: Map<string, VIP> = new Map();

  /**
   * Add a VIP to the manager
   */
  addVIP(vip: VIP): void {
    this.vips.set(vip.id, vip);
  }

  /**
   * Remove a VIP from the manager
   */
  removeVIP(vipId: string): boolean {
    return this.vips.delete(vipId);
  }

  /**
   * Get a VIP by ID
   */
  getVIP(vipId: string): VIP | undefined {
    return this.vips.get(vipId);
  }

  /**
   * Get all VIPs
   */
  getAllVIPs(): VIP[] {
    return Array.from(this.vips.values());
  }

  /**
   * Get VIPs by state
   */
  getVIPsByState(state: VIPState): VIP[] {
    return this.getAllVIPs().filter(v => v.state === state);
  }

  /**
   * Get VIPs affiliated with a side
   */
  getVIPsByAffiliation(sideId: string): VIP[] {
    return this.getAllVIPs().filter(v => v.affiliatedSide === sideId);
  }

  /**
   * Get VIPs being extracted by a side
   */
  getVIPsBeingExtractedBy(sideId: string): VIP[] {
    return this.getAllVIPs().filter(v => v.extractingSide === sideId);
  }

  /**
   * Get active VIPs
   */
  getActiveVIPs(): VIP[] {
    return this.getVIPsByState(VIPState.Active);
  }

  /**
   * Create a VIP from a side member
   */
  createVIPFromMember(
    member: SideMember,
    options: {
      type?: VIPType;
      extractionVP?: number;
      eliminationVP?: number;
      extractingSide?: string;
      extractionPoint?: Position;
    } = {}
  ): VIP {
    const vip: VIP = {
      id: member.id,
      name: member.id,
      character: member.character,
      state: VIPState.Active,
      detectionLevel: DetectionLevel.Confirmed, // VIPs start known
      affiliatedSide: member.isVIP ? 'self' : 'unknown',
      controlled: false,
      extractingSide: options.extractingSide,
      extractionPoint: options.extractionPoint,
      extractionVP: options.extractionVP ?? 5,
      eliminationVP: options.eliminationVP ?? 3,
      type: options.type ?? VIPType.Standard,
      metadata: {},
    };

    return vip;
  }

  /**
   * QSR VIP Control - check if a guardian can control the VIP
   */
  canControlVIP(
    vipId: string,
    guardian: Character,
    guardianSideId: string,
    options: {
      vipPosition: Position;
      guardianPosition: Position;
      guardianBaseDiameter: number;
      vipBaseDiameter: number;
      opposingModels: Array<{
        id: string;
        position: Position;
        baseDiameter: number;
        isOrdered: boolean;
      }>;
      cohesionRangeMu?: number;
    }
  ): { allowed: boolean; reason?: string } {
    const vip = this.getVIP(vipId);
    if (!vip) return { allowed: false, reason: 'VIP not found' };
    if (!guardian.state.isAttentive || !guardian.state.isOrdered) {
      return { allowed: false, reason: 'Guardian must be Attentive and Ordered' };
    }
    const distance = this.distanceEdgeToEdge(
      options.guardianPosition,
      options.guardianBaseDiameter,
      options.vipPosition,
      options.vipBaseDiameter
    );
    if (distance > 0) {
      return { allowed: false, reason: 'Guardian not in base-contact' };
    }
    const cohesion = options.cohesionRangeMu ?? 4;
    for (const opposing of options.opposingModels) {
      if (!opposing.isOrdered) continue;
      const oppDistance = this.distanceEdgeToEdge(
        options.vipPosition,
        options.vipBaseDiameter,
        opposing.position,
        opposing.baseDiameter
      );
      if (oppDistance <= cohesion) {
        return { allowed: false, reason: 'Opposing Ordered model within Cohesion' };
      }
    }
    return { allowed: true };
  }

  /**
   * Control a VIP with a guardian (QSR 2 AP Fiddle action)
   */
  controlVIP(
    vipId: string,
    guardian: Character,
    guardianSideId: string
  ): { success: boolean; vip?: VIP; reason?: string } {
    const vip = this.getVIP(vipId);
    if (!vip) return { success: false, reason: 'VIP not found' };
    vip.controlled = true;
    vip.guardianId = guardian.id;
    vip.controlledBySideId = guardianSideId;
    return { success: true, vip };
  }

  /**
   * Transfer VIP control between friendly models (QSR 1 AP Fiddle action)
   */
  transferVIPControl(
    vipId: string,
    newGuardian: Character,
    newGuardianSideId: string,
    options: { withinCohesion: boolean }
  ): { success: boolean; vip?: VIP; reason?: string } {
    const vip = this.getVIP(vipId);
    if (!vip) return { success: false, reason: 'VIP not found' };
    if (!vip.controlled) return { success: false, reason: 'VIP not controlled' };
    if (!newGuardian.state.isAttentive) return { success: false, reason: 'New guardian must be Attentive' };
    if (!options.withinCohesion) return { success: false, reason: 'New guardian not within Cohesion' };
    vip.guardianId = newGuardian.id;
    vip.controlledBySideId = newGuardianSideId;
    return { success: true, vip };
  }

  /**
   * Release VIP control (guardian KO/Eliminated or manual release)
   */
  releaseVIPControl(vipId: string): { success: boolean; vip?: VIP; reason?: string } {
    const vip = this.getVIP(vipId);
    if (!vip) return { success: false, reason: 'VIP not found' };
    vip.controlled = false;
    vip.guardianId = undefined;
    vip.controlledBySideId = undefined;
    return { success: true, vip };
  }

  private distanceEdgeToEdge(
    aPos: Position,
    aDiameter: number,
    bPos: Position,
    bDiameter: number
  ): number {
    const distance = Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y);
    return Math.max(0, distance - aDiameter / 2 - bDiameter / 2);
  }

  /**
   * Update VIP state from character state
   */
  syncVIPState(vipId: string): boolean {
    const vip = this.getVIP(vipId);
    if (!vip) return false;

    if (vip.character.state.isEliminated) {
      vip.state = VIPState.Eliminated;
    } else if (vip.character.state.isKOd) {
      // KO'd VIPs might be captured
      vip.state = VIPState.InTransit;
    }

    return true;
  }

  /**
   * Detect a VIP (increase detection level)
   */
  detectVIP(vipId: string, detectingSide: string): DetectionResult {
    const vip = this.getVIP(vipId);
    if (!vip) {
      return {
        detected: false,
        vip: { id: '', name: '', character: null as unknown as Character, state: VIPState.Eliminated, detectionLevel: DetectionLevel.Undetected, affiliatedSide: '', extractionVP: 0, eliminationVP: 0, type: VIPType.Standard, metadata: {} },
        previousLevel: DetectionLevel.Undetected,
        newLevel: DetectionLevel.Undetected,
      };
    }

    const previousLevel = vip.detectionLevel;
    let newLevel = previousLevel;

    // Increase detection level
    if (previousLevel === DetectionLevel.Undetected) {
      newLevel = DetectionLevel.Suspected;
    } else if (previousLevel === DetectionLevel.Suspected) {
      newLevel = DetectionLevel.Confirmed;
    }
    // Already confirmed, stays confirmed

    vip.detectionLevel = newLevel;

    return {
      detected: newLevel !== DetectionLevel.Undetected,
      vip,
      previousLevel,
      newLevel,
      detectingSide,
    };
  }

  /**
   * Hide a VIP (reduce detection level)
   */
  hideVIP(vipId: string): DetectionResult {
    const vip = this.getVIP(vipId);
    if (!vip) {
      return {
        detected: false,
        vip: { id: '', name: '', character: null as unknown as Character, state: VIPState.Eliminated, detectionLevel: DetectionLevel.Undetected, affiliatedSide: '', extractionVP: 0, eliminationVP: 0, type: VIPType.Standard, metadata: {} },
        previousLevel: DetectionLevel.Undetected,
        newLevel: DetectionLevel.Undetected,
      };
    }

    const previousLevel = vip.detectionLevel;
    let newLevel = previousLevel;

    // Decrease detection level
    if (previousLevel === DetectionLevel.Confirmed) {
      newLevel = DetectionLevel.Suspected;
    } else if (previousLevel === DetectionLevel.Suspected) {
      newLevel = DetectionLevel.Undetected;
    }

    vip.detectionLevel = newLevel;
    vip.state = newLevel === DetectionLevel.Undetected ? VIPState.Hidden : VIPState.Active;

    return {
      detected: newLevel !== DetectionLevel.Undetected,
      vip,
      previousLevel,
      newLevel,
    };
  }

  /**
   * Attempt to extract a VIP
   */
  extractVIP(vipId: string, extractingSide: string): ExtractionResult {
    const vip = this.getVIP(vipId);
    if (!vip) {
      return {
        success: false,
        vip: { id: '', name: '', character: null as unknown as Character, state: VIPState.Eliminated, detectionLevel: DetectionLevel.Undetected, affiliatedSide: '', extractionVP: 0, eliminationVP: 0, type: VIPType.Standard, metadata: {} },
        extractingSide,
        victoryPointsAwarded: 0,
        reason: 'VIP not found',
      };
    }

    // Check if VIP can be extracted
    if (vip.state === VIPState.Eliminated) {
      return {
        success: false,
        vip,
        extractingSide,
        victoryPointsAwarded: 0,
        reason: 'VIP is eliminated',
      };
    }

    if (vip.state === VIPState.Extracted) {
      return {
        success: false,
        vip,
        extractingSide,
        victoryPointsAwarded: 0,
        reason: 'VIP already extracted',
      };
    }

    // Check if this side is authorized to extract
    if (vip.extractingSide && vip.extractingSide !== extractingSide) {
      return {
        success: false,
        vip,
        extractingSide,
        victoryPointsAwarded: 0,
        reason: 'Not authorized to extract this VIP',
      };
    }

    // Successful extraction
    vip.state = VIPState.Extracted;
    vip.extractingSide = extractingSide;

    return {
      success: true,
      vip,
      extractingSide,
      victoryPointsAwarded: vip.extractionVP,
    };
  }

  /**
   * Eliminate a VIP
   */
  eliminateVIP(vipId: string, eliminatingSide?: string): EliminationResult {
    const vip = this.getVIP(vipId);
    if (!vip) {
      return {
        eliminated: false,
        vip: { id: '', name: '', character: null as unknown as Character, state: VIPState.Eliminated, detectionLevel: DetectionLevel.Undetected, affiliatedSide: '', extractionVP: 0, eliminationVP: 0, type: VIPType.Standard, metadata: {} },
        victoryPointsAwarded: 0,
        reason: 'VIP not found',
      };
    }

    vip.state = VIPState.Eliminated;

    // Award elimination VP if eliminated by enemy
    let vpAwarded = 0;
    if (eliminatingSide && eliminatingSide !== vip.affiliatedSide) {
      vpAwarded = vip.eliminationVP;
    }

    return {
      eliminated: true,
      vip,
      eliminatingSide,
      victoryPointsAwarded: vpAwarded,
    };
  }

  /**
   * Set extraction point for a VIP
   */
  setExtractionPoint(vipId: string, position: Position): boolean {
    const vip = this.getVIP(vipId);
    if (!vip) return false;

    vip.extractionPoint = position;
    return true;
  }

  /**
   * Check if a VIP is at their extraction point
   */
  isAtExtractionPoint(vipId: string): { atPoint: boolean; distance?: number } {
    const vip = this.getVIP(vipId);
    if (!vip || !vip.extractionPoint || !vip.character) {
      return { atPoint: false };
    }

    // This would need battlefield position tracking
    // For now, return false - actual implementation needs position data
    return { atPoint: false };
  }

  /**
   * Get VIPs that can be extracted by a side
   */
  getExtractableVIPs(sideId: string): VIP[] {
    return this.getAllVIPs().filter(v => 
      v.extractingSide === sideId && 
      v.state === VIPState.Active
    );
  }

  /**
   * Clear all VIPs
   */
  clear(): void {
    this.vips.clear();
  }

  /**
   * Export VIP state for serialization
   */
  exportState(): Record<string, VIP> {
    const result: Record<string, VIP> = {};
    for (const [id, vip] of this.vips.entries()) {
      result[id] = { ...vip };
    }
    return result;
  }

  /**
   * Import VIP state from serialization
   */
  importState(state: Record<string, VIP>): void {
    this.vips.clear();
    for (const [id, vip] of Object.entries(state)) {
      this.vips.set(id, vip);
    }
  }
}

/**
 * Create a standard VIP
 */
export function createVIP(
  id: string,
  character: Character,
  affiliatedSide: string,
  options: {
    name?: string;
    type?: VIPType;
    extractionVP?: number;
    eliminationVP?: number;
    extractingSide?: string;
  } = {}
): VIP {
  return {
    id,
    name: options.name ?? id,
    character,
    state: VIPState.Active,
    detectionLevel: DetectionLevel.Confirmed,
    affiliatedSide,
    controlled: false,
    extractingSide: options.extractingSide,
    extractionVP: options.extractionVP ?? 5,
    eliminationVP: options.eliminationVP ?? 3,
    type: options.type ?? VIPType.Standard,
    metadata: {},
  };
}

/**
 * Create VIPs for a mission
 */
export function createMissionVIPs(
  configs: Array<{
    id: string;
    character: Character;
    affiliatedSide: string;
    extractingSide: string;
    type?: VIPType;
    extractionVP?: number;
  }>
): VIP[] {
  return configs.map(config => createVIP(
    config.id,
    config.character,
    config.affiliatedSide,
    {
      type: config.type,
      extractionVP: config.extractionVP,
      extractingSide: config.extractingSide,
    }
  ));
}

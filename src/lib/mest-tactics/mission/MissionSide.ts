import { Assembly } from '../core/Assembly';
import { AssemblyRoster } from './assembly-builder';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Position } from '../battlefield/Position';
import {
  DEFAULT_PORTRAIT_SHEET,
  NamedPortraitAssignment,
  createPortraitAssignmentFromIndex,
} from '../../../lib/portraits/portrait-naming';
import { ObjectiveMarkerManager, ObjectiveMarker } from './objective-markers';

/**
 * Model slot status for tracking model state on the battlefield
 */
export enum ModelSlotStatus {
  Ready = 'Ready',
  Done = 'Done',
  Waiting = 'Waiting',
  KO = 'KO',
  Eliminated = 'Eliminated',
}

/**
 * A member of a MissionSide with full state tracking
 */
export interface SideMember {
  /** Unique identifier within the side */
  id: string;
  /** The character instance */
  character: Character;
  /** The profile used to create this character */
  profile: Profile;
  /** The assembly this member belongs to */
  assembly: Assembly;
  /** Portrait assignment for visual identification */
  portrait: NamedPortraitAssignment;
  /** Current battlefield position (undefined if not placed) */
  position?: Position;
  /** Current status */
  status: ModelSlotStatus;
  /** Whether this model is a VIP (for mission purposes) */
  isVIP: boolean;
  /** Objective markers carried by this model (for Courier missions) */
  objectiveMarkers: string[];
}

/**
 * Deployment zone definition
 */
export interface DeploymentZone {
  /** Zone identifier */
  id: string;
  /** Zone name */
  name: string;
  /** Zone bounds (x, y, width, height) */
  bounds: { x: number; y: number; width: number; height: number };
  /** Which side can deploy here */
  sideId: string;
  /** Maximum models that can deploy here */
  maxModels?: number;
}

/**
 * MissionSide represents a faction/side in a mission
 * with full state tracking for all members
 */
export interface MissionSide {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Assemblies that make up this side */
  assemblies: Assembly[];
  /** All members of this side */
  members: SideMember[];
  /** Total BP of all assemblies */
  totalBP: number;
  /** Deployment zones assigned to this side */
  deploymentZones: DeploymentZone[];
  /** Side-specific state */
  state: {
    /** Current turn number for this side */
    currentTurn: number;
    /** Models that have activated this turn */
    activatedModels: Set<string>;
    /** Models that are ready to activate */
    readyModels: Set<string>;
    /** Total wounds suffered this turn */
    woundsThisTurn: number;
    /** Models eliminated this mission */
    eliminatedModels: string[];
    /** Victory points earned */
    victoryPoints: number;
    /** Initiative Points held by this Side (QSR: Start of Turn) */
    initiativePoints: number;
    /** Mission-specific state (flexible for different mission types) */
    missionState: Record<string, unknown>;
  };
  /** Objective marker manager for this side */
  objectiveMarkerManager: ObjectiveMarkerManager;
}

/**
 * Options for creating a MissionSide
 */
export interface MissionSideOptions {
  /** Starting index for portrait assignments */
  startingIndex?: number;
  /** Default portrait sheet to use */
  defaultPortraitSheet?: string;
  /** Deployment zone definitions */
  deploymentZones?: DeploymentZone[];
  /** VIP model ID (if applicable) */
  vipModelId?: string;
}

/**
 * Create a new MissionSide from assembly rosters
 */
export function createMissionSide(
  name: string,
  rosters: AssemblyRoster[],
  options: MissionSideOptions = {}
): MissionSide {
  const sideName = name;
  const rosterList = rosters;
  const startIndex = options.startingIndex ?? 0;
  const defaultSheet = options.defaultPortraitSheet ?? DEFAULT_PORTRAIT_SHEET;
  const deploymentZones = options.deploymentZones ?? [];
  const vipModelId = options.vipModelId;

  const members: SideMember[] = [];
  const assemblies: Assembly[] = [];

  let index = startIndex;

  for (const roster of rosterList) {
    assemblies.push(roster.assembly);

    for (const character of roster.characters) {
      const profile = character.profile;
      const portrait = createPortraitAssignmentFromIndex(index, defaultSheet);
      const callSign = portrait.name;

      // Update character with callsign ID
      character.id = callSign;
      character.name = callSign;

      const member: SideMember = {
        id: callSign,
        character,
        profile,
        assembly: roster.assembly,
        portrait,
        position: undefined,
        status: ModelSlotStatus.Ready,
        isVIP: vipModelId === callSign,
        objectiveMarkers: [],
      };
      members.push(member);
      index += 1;
    }
  }

  const initialSum = 0;
  const totalBP = assemblies.reduce((sum, assembly) => sum + assembly.totalBP, initialSum);

  return {
    id: sideName,
    name: sideName,
    assemblies,
    members,
    totalBP,
    deploymentZones,
    state: {
      currentTurn: 0,
      activatedModels: new Set<string>(),
      readyModels: new Set<string>(members.map(m => m.id)),
      woundsThisTurn: 0,
      eliminatedModels: [],
      victoryPoints: 0,
      initiativePoints: 0,
      missionState: {},
    },
    objectiveMarkerManager: new ObjectiveMarkerManager(),
  };
}

/**
 * Place a member at a position on the battlefield
 */
export function placeMember(side: MissionSide, memberId: string, position: Position): boolean {
  const member = side.members.find(m => m.id === memberId);
  if (!member) {
    return false;
  }

  // Check if position is within a deployment zone (if zones are defined)
  if (side.deploymentZones.length > 0 && !member.position) {
    const inZone = side.deploymentZones.some(zone => {
      if (zone.sideId !== side.id) return false;
      return (
        position.x >= zone.bounds.x &&
        position.x <= zone.bounds.x + zone.bounds.width &&
        position.y >= zone.bounds.y &&
        position.y <= zone.bounds.y + zone.bounds.height
      );
    });

    if (!inZone) {
      return false; // Not in valid deployment zone
    }
  }

  member.position = position;
  return true;
}

/**
 * Move a member to a new position
 */
export function moveMember(side: MissionSide, memberId: string, position: Position): boolean {
  const member = side.members.find(m => m.id === memberId);
  if (!member || !member.position) {
    return false;
  }

  member.position = position;
  return true;
}

/**
 * Update a member's status
 */
export function setMemberStatus(
  side: MissionSide,
  memberId: string,
  status: ModelSlotStatus
): boolean {
  const member = side.members.find(m => m.id === memberId);
  if (!member) {
    return false;
  }

  const oldStatus = member.status;
  member.status = status;

  // Update side state tracking
  if (status === ModelSlotStatus.Done || status === ModelSlotStatus.KO || status === ModelSlotStatus.Eliminated) {
    side.state.activatedModels.delete(memberId);
    side.state.readyModels.delete(memberId);
  } else if (status === ModelSlotStatus.Ready) {
    side.state.readyModels.add(memberId);
  }

  // Track eliminations
  if (status === ModelSlotStatus.Eliminated && oldStatus !== ModelSlotStatus.Eliminated) {
    side.state.eliminatedModels.push(memberId);
  }

  return true;
}

/**
 * Mark a member as activated (taken their action this turn)
 */
export function activateMember(side: MissionSide, memberId: string): boolean {
  const member = side.members.find(m => m.id === memberId);
  if (!member || member.status !== ModelSlotStatus.Ready) {
    return false;
  }

  side.state.activatedModels.add(memberId);
  side.state.readyModels.delete(memberId);
  member.status = ModelSlotStatus.Done;
  return true;
}

/**
 * Reset side state for a new turn
 */
export function resetTurnState(side: MissionSide): void {
  side.state.currentTurn++;
  side.state.activatedModels.clear();
  side.state.woundsThisTurn = 0;

  // Reset all non-KO/eliminated models to Ready
  for (const member of side.members) {
    if (member.status !== ModelSlotStatus.KO && member.status !== ModelSlotStatus.Eliminated) {
      member.status = ModelSlotStatus.Ready;
      side.state.readyModels.add(member.id);
    }
  }
}

/**
 * Add victory points to the side
 */
export function addVictoryPoints(side: MissionSide, points: number): void {
  side.state.victoryPoints += points;
}

/**
 * Get all members in a specific status
 */
export function getMembersByStatus(side: MissionSide, status: ModelSlotStatus): SideMember[] {
  return side.members.filter(m => m.status === status);
}

/**
 * Get all ready members
 */
export function getReadyMembers(side: MissionSide): SideMember[] {
  return side.members.filter(m => m.status === ModelSlotStatus.Ready);
}

/**
 * Get all active (not eliminated/KO) members
 */
export function getActiveMembers(side: MissionSide): SideMember[] {
  return side.members.filter(
    m => m.status !== ModelSlotStatus.Eliminated && m.status !== ModelSlotStatus.KO
  );
}

/**
 * Get the VIP member if one exists
 */
export function getVIPMember(side: MissionSide): SideMember | undefined {
  return side.members.find(m => m.isVIP);
}

/**
 * Assign an objective marker to a member
 */
export function assignObjectiveMarker(side: MissionSide, memberId: string, markerId: string): boolean {
  const member = side.members.find(m => m.id === memberId);
  if (!member) {
    return false;
  }

  if (!member.objectiveMarkers.includes(markerId)) {
    member.objectiveMarkers.push(markerId);
  }
  return true;
}

/**
 * Remove an objective marker from a member
 */
export function removeObjectiveMarker(side: MissionSide, memberId: string, markerId: string): boolean {
  const member = side.members.find(m => m.id === memberId);
  if (!member) {
    return false;
  }

  const index = member.objectiveMarkers.indexOf(markerId);
  if (index >= 0) {
    member.objectiveMarkers.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get all members carrying objective markers
 */
export function getMarkerCarriers(side: MissionSide): SideMember[] {
  return side.members.filter(m => m.objectiveMarkers.length > 0);
}

/**
 * Get member by character ID
 */
export function getMemberByCharacterId(side: MissionSide, characterId: string): SideMember | undefined {
  return side.members.find(m => m.character.id === characterId);
}

/**
 * Get deployment positions for all members
 */
export function getDeploymentPositions(side: MissionSide): Map<string, Position> {
  const positions = new Map<string, Position>();
  for (const member of side.members) {
    if (member.position) {
      positions.set(member.id, member.position);
    }
  }
  return positions;
}

/**
 * Add an objective marker to the side's manager
 */
export function addSideMarker(side: MissionSide, marker: ObjectiveMarker): void {
  side.objectiveMarkerManager.addMarker(marker);
}

/**
 * Get a marker from the side's manager
 */
export function getSideMarker(side: MissionSide, markerId: string): ObjectiveMarker | undefined {
  return side.objectiveMarkerManager.getMarker(markerId);
}

/**
 * Get all markers from the side's manager
 */
export function getAllSideMarkers(side: MissionSide): ObjectiveMarker[] {
  return side.objectiveMarkerManager.getAllMarkers();
}

/**
 * Pick up a marker with a member
 */
export function memberPickUpMarker(
  side: MissionSide,
  memberId: string,
  markerId: string
): { success: boolean; reason?: string } {
  const member = side.members.find(m => m.id === memberId);
  if (!member) {
    return { success: false, reason: 'Member not found' };
  }

  const result = side.objectiveMarkerManager.pickUpMarker(markerId, memberId);
  if (result.success) {
    if (!member.objectiveMarkers.includes(markerId)) {
      member.objectiveMarkers.push(markerId);
    }
  }
  return { success: result.success, reason: result.reason };
}

/**
 * Drop a marker from a member at a position
 */
export function memberDropMarker(
  side: MissionSide,
  memberId: string,
  markerId: string,
  position: Position
): { success: boolean; reason?: string } {
  const member = side.members.find(m => m.id === memberId);
  if (!member) {
    return { success: false, reason: 'Member not found' };
  }

  const result = side.objectiveMarkerManager.dropMarker(markerId, position);
  if (result.success) {
    const index = member.objectiveMarkers.indexOf(markerId);
    if (index >= 0) {
      member.objectiveMarkers.splice(index, 1);
    }
  }
  return { success: result.success, reason: result.reason };
}

/**
 * Score a marker for the side
 */
export function scoreSideMarker(
  side: MissionSide,
  markerId: string
): { success: boolean; victoryPoints: number; reason?: string } {
  const result = side.objectiveMarkerManager.scoreMarker(markerId, side.id);
  if (result.success) {
    side.state.victoryPoints += result.victoryPointsAwarded;
    // Remove from any carrier
    for (const member of side.members) {
      const index = member.objectiveMarkers.indexOf(markerId);
      if (index >= 0) {
        member.objectiveMarkers.splice(index, 1);
      }
    }
  }
  return {
    success: result.success,
    victoryPoints: result.victoryPointsAwarded,
    reason: result.reason,
  };
}

/**
 * Get total victory points from markers for this side
 */
export function getMarkerVictoryPoints(side: MissionSide): number {
  return side.objectiveMarkerManager.getTotalVictoryPoints(side.id);
}

/**
 * Get markers carried by a member
 */
export function getMemberMarkers(side: MissionSide, memberId: string): ObjectiveMarker[] {
  return side.objectiveMarkerManager.getMarkersCarriedBy(memberId);
}

/**
 * Get available markers (not carried or scored)
 */
export function getAvailableMarkers(side: MissionSide): ObjectiveMarker[] {
  return side.objectiveMarkerManager.getAvailableMarkers();
}

/**
 * Get dropped markers
 */
export function getDroppedMarkers(side: MissionSide): ObjectiveMarker[] {
  return side.objectiveMarkerManager.getDroppedMarkers();
}

// ============================================================================
// Initiative Points Management (QSR: Start of Turn)
// ============================================================================

/**
 * Award Initiative Points to a Side (QSR: Start of Turn)
 * IP are awarded to the Side/Player, NOT to individual characters
 */
export function awardInitiativePoints(side: MissionSide, amount: number): void {
  side.state.initiativePoints = Math.max(0, side.state.initiativePoints + amount);
}

/**
 * Get current Initiative Points for a Side
 */
export function getInitiativePoints(side: MissionSide): number {
  return side.state.initiativePoints;
}

/**
 * Spend Initiative Points from a Side (QSR: Spending Initiative Points)
 * Returns true if successful, false if insufficient IP
 */
export function spendInitiativePoints(side: MissionSide, amount: number): boolean {
  if (side.state.initiativePoints >= amount) {
    side.state.initiativePoints -= amount;
    return true;
  }
  return false;
}

/**
 * Reset Initiative Points at End of Turn (QSR: End of Turn)
 * All unspent IP are lost
 */
export function clearInitiativePoints(side: MissionSide): void {
  side.state.initiativePoints = 0;
}

/**
 * Maintain Initiative - Spend 1 IP to activate another model (QSR: Spending IP)
 */
export function maintainInitiative(side: MissionSide): boolean {
  return spendInitiativePoints(side, 1);
}

/**
 * Force Initiative - Spend 1 IP to pass Initiative to another Side (QSR: Spending IP)
 */
export function forceInitiative(side: MissionSide): boolean {
  return spendInitiativePoints(side, 1);
}

/**
 * Refresh - Spend 1 IP to remove a Delay token (QSR: Spending IP)
 */
export function refreshInitiative(side: MissionSide): boolean {
  return spendInitiativePoints(side, 1);
}

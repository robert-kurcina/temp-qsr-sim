import { Assembly } from './Assembly';
import { AssemblyRoster } from './assembly-builder';
import { Character } from './Character';
import { Profile } from './Profile';
import { Position } from './battlefield/Position';
import {
  DEFAULT_PORTRAIT_SHEET,
  NamedPortraitAssignment,
  createPortraitAssignmentFromIndex,
} from '../portraits/portrait-naming';

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
    /** Mission-specific state (flexible for different mission types) */
    missionState: Record<string, unknown>;
  };
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
      missionState: {},
    },
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

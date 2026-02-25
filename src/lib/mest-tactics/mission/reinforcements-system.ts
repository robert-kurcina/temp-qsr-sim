import { AssemblyRoster, buildAssembly, buildProfile } from './assembly-builder';
import { Profile } from '../core/Profile';
import { Position } from '../battlefield/Position';
import { MissionSide } from './MissionSide';

/**
 * Reinforcement arrival trigger types
 */
export enum ReinforcementTrigger {
  /** Arrive at start of specified turn */
  OnTurn = 'OnTurn',
  /** Arrive after N turns have passed */
  AfterTurns = 'AfterTurns',
  /** Arrive when a condition is met (VIP extracted, zone captured, etc.) */
  OnCondition = 'OnCondition',
  /** Arrive when a model is eliminated */
  OnModelEliminated = 'OnModelEliminated',
  /** Arrive when a model enters a zone */
  OnZoneEntry = 'OnZoneEntry',
  /** Arrive at random turn within range */
  Random = 'Random',
  /** Do not arrive automatically (manual trigger) */
  Manual = 'Manual',
}

/**
 * Reinforcement arrival edge
 */
export enum ArrivalEdge {
  /** Arrive from north edge */
  North = 'North',
  /** Arrive from south edge */
  South = 'South',
  /** Arrive from east edge */
  East = 'East',
  /** Arrive from west edge */
  West = 'West',
  /** Arrive from any edge */
  Any = 'Any',
  /** Arrive at specific position */
  Specific = 'Specific',
  /** Arrive in deployment zone */
  DeploymentZone = 'DeploymentZone',
}

/**
 * Reinforcement group definition
 */
export interface ReinforcementGroup {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Which side these reinforcements belong to */
  sideId: string;
  /** The assembly roster for these reinforcements */
  roster: AssemblyRoster;
  /** Trigger for arrival */
  trigger: ReinforcementTrigger;
  /** Turn number for OnTurn/AfterTurns triggers */
  turnNumber?: number;
  /** Turn range for Random trigger [min, max] */
  turnRange?: [number, number];
  /** Condition ID for OnCondition trigger */
  conditionId?: string;
  /** Model ID for OnModelEliminated trigger */
  modelId?: string;
  /** Zone ID for OnZoneEntry trigger */
  zoneId?: string;
  /** Where reinforcements arrive from */
  arrivalEdge: ArrivalEdge;
  /** Specific position for Specific arrival */
  arrivalPosition?: Position;
  /** Have reinforcements arrived? */
  hasArrived: boolean;
  /** Turn when reinforcements arrived */
  arrivalTurn?: number;
  /** Can these reinforcements be delayed? */
  canBeDelayed: boolean;
  /** Metadata for mission-specific data */
  metadata: Record<string, unknown>;
}

/**
 * Configuration for creating a reinforcement group
 */
export interface ReinforcementGroupConfig {
  id?: string;
  name?: string;
  sideId: string;
  profiles?: Profile[];
  roster?: AssemblyRoster;
  trigger?: ReinforcementTrigger;
  turnNumber?: number;
  turnRange?: [number, number];
  conditionId?: string;
  modelId?: string;
  zoneId?: string;
  arrivalEdge?: ArrivalEdge;
  arrivalPosition?: Position;
  canBeDelayed?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Create a reinforcement group
 */
export function createReinforcementGroup(config: ReinforcementGroupConfig): ReinforcementGroup {
  let roster = config.roster;
  if (!roster && config.profiles && config.profiles.length > 0) {
    roster = buildAssembly(`${config.name || 'Reinforcements'} Group`, config.profiles);
  }

  if (!roster) {
    throw new Error('Reinforcement group must have either profiles or roster');
  }

  return {
    id: config.id ?? `reinforce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: config.name ?? 'Reinforcements',
    sideId: config.sideId,
    roster,
    trigger: config.trigger ?? ReinforcementTrigger.OnTurn,
    turnNumber: config.turnNumber,
    turnRange: config.turnRange,
    conditionId: config.conditionId,
    modelId: config.modelId,
    zoneId: config.zoneId,
    arrivalEdge: config.arrivalEdge ?? ArrivalEdge.DeploymentZone,
    arrivalPosition: config.arrivalPosition,
    hasArrived: false,
    canBeDelayed: config.canBeDelayed ?? true,
    metadata: config.metadata ?? {},
  };
}

/**
 * Reinforcement arrival result
 */
export interface ReinforcementArrivalResult {
  success: boolean;
  group: ReinforcementGroup;
  arrived: boolean;
  positions?: Position[];
  reason?: string;
}

/**
 * Reinforcement placement result
 */
export interface ReinforcementPlacementResult {
  success: boolean;
  positions: Position[];
  reason?: string;
}

/**
 * Reinforcements Manager - handles all reinforcement operations
 */
export class ReinforcementsManager {
  private groups: Map<string, ReinforcementGroup> = new Map();
  private arrivedGroups: Set<string> = new Set();

  /**
   * Add a reinforcement group
   */
  addGroup(group: ReinforcementGroup): void {
    this.groups.set(group.id, group);
  }

  /**
   * Remove a reinforcement group
   */
  removeGroup(groupId: string): boolean {
    return this.groups.delete(groupId);
  }

  /**
   * Get a reinforcement group by ID
   */
  getGroup(groupId: string): ReinforcementGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Get all reinforcement groups
   */
  getAllGroups(): ReinforcementGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get groups for a specific side
   */
  getGroupsForSide(sideId: string): ReinforcementGroup[] {
    return this.getAllGroups().filter(g => g.sideId === sideId);
  }

  /**
   * Get groups that haven't arrived yet
   */
  getPendingGroups(): ReinforcementGroup[] {
    return this.getAllGroups().filter(g => !g.hasArrived);
  }

  /**
   * Get groups that have arrived
   */
  getArrivedGroups(): ReinforcementGroup[] {
    return this.getAllGroups().filter(g => g.hasArrived);
  }

  /**
   * Check if a group should arrive this turn based on trigger
   */
  shouldArriveThisTurn(group: ReinforcementGroup, currentTurn: number, rng?: () => number): boolean {
    if (group.hasArrived) return false;

    const random = rng ?? Math.random;

    switch (group.trigger) {
      case ReinforcementTrigger.OnTurn:
        return currentTurn === group.turnNumber;

      case ReinforcementTrigger.AfterTurns:
        return currentTurn > (group.turnNumber ?? 0);

      case ReinforcementTrigger.Random: {
        const [min, max] = group.turnRange ?? [1, 6];
        if (currentTurn < min || currentTurn > max) return false;
        // Simple probability: more likely as we approach max
        const remaining = max - currentTurn + 1;
        const total = max - min + 1;
        return random() < (1 / remaining) || currentTurn === max;
      }

      case ReinforcementTrigger.Manual:
        return false; // Must be triggered manually

      case ReinforcementTrigger.OnCondition:
      case ReinforcementTrigger.OnModelEliminated:
      case ReinforcementTrigger.OnZoneEntry:
        // These are event-driven, checked separately
        return false;

      default:
        return false;
    }
  }

  /**
   * Check all groups for turn-based arrivals
   */
  checkTurnArrivals(currentTurn: number, rng?: () => number): ReinforcementGroup[] {
    const arriving: ReinforcementGroup[] = [];

    for (const group of this.getPendingGroups()) {
      if (this.shouldArriveThisTurn(group, currentTurn, rng)) {
        arriving.push(group);
      }
    }

    return arriving;
  }

  /**
   * Trigger arrival for a group (for Manual or event-driven triggers)
   */
  triggerArrival(groupId: string, currentTurn: number): ReinforcementArrivalResult {
    const group = this.getGroup(groupId);
    if (!group) {
      return {
        success: false,
        group: { id: '', name: '', sideId: '', roster: { assembly: { name: '', characters: [], totalBP: 0, totalCharacters: 0 }, characters: [], profiles: [] }, trigger: ReinforcementTrigger.Manual, arrivalEdge: ArrivalEdge.Any, hasArrived: false, canBeDelayed: true, metadata: {} },
        arrived: false,
        reason: 'Group not found',
      };
    }

    if (group.hasArrived) {
      return {
        success: false,
        group,
        arrived: false,
        reason: 'Group has already arrived',
      };
    }

    group.hasArrived = true;
    group.arrivalTurn = currentTurn;
    this.arrivedGroups.add(groupId);

    return {
      success: true,
      group,
      arrived: true,
    };
  }

  /**
   * Calculate arrival positions for a reinforcement group
   */
  calculateArrivalPositions(
    group: ReinforcementGroup,
    battlefieldWidth: number,
    battlefieldHeight: number,
    deploymentZones?: Array<{ bounds: { x: number; y: number; width: number; height: number } }>
  ): ReinforcementPlacementResult {
    const modelCount = group.roster.characters.length;
    const positions: Position[] = [];

    switch (group.arrivalEdge) {
      case ArrivalEdge.North:
        for (let i = 0; i < modelCount; i++) {
          positions.push({
            x: Math.random() * (battlefieldWidth - 2) + 1,
            y: 0.5,
          });
        }
        break;

      case ArrivalEdge.South:
        for (let i = 0; i < modelCount; i++) {
          positions.push({
            x: Math.random() * (battlefieldWidth - 2) + 1,
            y: battlefieldHeight - 0.5,
          });
        }
        break;

      case ArrivalEdge.East:
        for (let i = 0; i < modelCount; i++) {
          positions.push({
            x: battlefieldWidth - 0.5,
            y: Math.random() * (battlefieldHeight - 2) + 1,
          });
        }
        break;

      case ArrivalEdge.West:
        for (let i = 0; i < modelCount; i++) {
          positions.push({
            x: 0.5,
            y: Math.random() * (battlefieldHeight - 2) + 1,
          });
        }
        break;

      case ArrivalEdge.Any: {
        const edges = [ArrivalEdge.North, ArrivalEdge.South, ArrivalEdge.East, ArrivalEdge.West];
        const edge = edges[Math.floor(Math.random() * edges.length)];
        // Recursively calculate for the chosen edge
        group.arrivalEdge = edge;
        return this.calculateArrivalPositions(group, battlefieldWidth, battlefieldHeight, deploymentZones);
      }

      case ArrivalEdge.Specific:
        if (!group.arrivalPosition) {
          return {
            success: false,
            positions: [],
            reason: 'Specific arrival requires arrivalPosition',
          };
        }
        for (let i = 0; i < modelCount; i++) {
          positions.push({
            x: group.arrivalPosition.x + (Math.random() - 0.5) * 2,
            y: group.arrivalPosition.y + (Math.random() - 0.5) * 2,
          });
        }
        break;

      case ArrivalEdge.DeploymentZone:
        if (!deploymentZones || deploymentZones.length === 0) {
          return {
            success: false,
            positions: [],
            reason: 'No deployment zones available',
          };
        }
        for (let i = 0; i < modelCount; i++) {
          const zone = deploymentZones[Math.floor(Math.random() * deploymentZones.length)];
          positions.push({
            x: zone.bounds.x + Math.random() * zone.bounds.width,
            y: zone.bounds.y + Math.random() * zone.bounds.height,
          });
        }
        break;
    }

    return {
      success: true,
      positions,
    };
  }

  /**
   * Add reinforcements to a side
   */
  addReinforcementsToSide(
    group: ReinforcementGroup,
    side: MissionSide,
    positions: Position[]
  ): { success: boolean; addedCount: number; reason?: string } {
    if (group.sideId !== side.id) {
      return {
        success: false,
        addedCount: 0,
        reason: 'Group does not belong to this side',
      };
    }

    let addedCount = 0;
    for (let i = 0; i < group.roster.characters.length && i < positions.length; i++) {
      const character = group.roster.characters[i];
      const position = positions[i];

      // Find the corresponding member in the side
      const member = side.members.find(m => m.character.id === character.id);
      if (member) {
        member.position = position;
        addedCount++;
      }
    }

    return {
      success: true,
      addedCount,
    };
  }

  /**
   * Get total BP of pending reinforcements for a side
   */
  getPendingBP(sideId: string): number {
    return this.getGroupsForSide(sideId)
      .filter(g => !g.hasArrived)
      .reduce((sum, g) => sum + g.roster.assembly.totalBP, 0);
  }

  /**
   * Get total BP of arrived reinforcements for a side
   */
  getArrivedBP(sideId: string): number {
    return this.getGroupsForSide(sideId)
      .filter(g => g.hasArrived)
      .reduce((sum, g) => sum + g.roster.assembly.totalBP, 0);
  }

  /**
   * Clear all reinforcement groups
   */
  clear(): void {
    this.groups.clear();
    this.arrivedGroups.clear();
  }

  /**
   * Export reinforcement state
   */
  exportState(): Record<string, ReinforcementGroup> {
    const result: Record<string, ReinforcementGroup> = {};
    for (const [id, group] of this.groups.entries()) {
      result[id] = { ...group };
    }
    return result;
  }

  /**
   * Import reinforcement state
   */
  importState(state: Record<string, ReinforcementGroup>): void {
    this.groups.clear();
    this.arrivedGroups.clear();
    for (const [id, group] of Object.entries(state)) {
      this.groups.set(id, group);
      if (group.hasArrived) {
        this.arrivedGroups.add(id);
      }
    }
  }
}

/**
 * Create standard turn-based reinforcements
 */
export function createTurnReinforcements(
  sideId: string,
  turnNumber: number,
  profiles: Profile[],
  options: {
    name?: string;
    arrivalEdge?: ArrivalEdge;
  } = {}
): ReinforcementGroup {
  return createReinforcementGroup({
    sideId,
    profiles,
    trigger: ReinforcementTrigger.OnTurn,
    turnNumber,
    arrivalEdge: options.arrivalEdge ?? ArrivalEdge.DeploymentZone,
    name: options.name ?? `Turn ${turnNumber} Reinforcements`,
  });
}

/**
 * Create random arrival reinforcements
 */
export function createRandomReinforcements(
  sideId: string,
  turnRange: [number, number],
  profiles: Profile[],
  options: {
    name?: string;
    arrivalEdge?: ArrivalEdge;
  } = {}
): ReinforcementGroup {
  return createReinforcementGroup({
    sideId,
    profiles,
    trigger: ReinforcementTrigger.Random,
    turnRange,
    arrivalEdge: options.arrivalEdge ?? ArrivalEdge.Any,
    name: options.name ?? 'Random Reinforcements',
  });
}

/**
 * Create condition-based reinforcements
 */
export function createConditionReinforcements(
  sideId: string,
  conditionId: string,
  profiles: Profile[],
  options: {
    name?: string;
    arrivalEdge?: ArrivalEdge;
  } = {}
): ReinforcementGroup {
  return createReinforcementGroup({
    sideId,
    profiles,
    trigger: ReinforcementTrigger.OnCondition,
    conditionId,
    arrivalEdge: options.arrivalEdge ?? ArrivalEdge.DeploymentZone,
    name: options.name ?? 'Condition Reinforcements',
  });
}

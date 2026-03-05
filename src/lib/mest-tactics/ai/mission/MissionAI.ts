/**
 * Mission AI - Phase 5 Specialization
 *
 * Mission-specific AI behaviors that override or enhance
 * the standard Strategic Layer (SideAI/AssemblyAI) decisions.
 */

import { MissionSide } from '../../mission/MissionSide';
import { Battlefield } from '../../battlefield/Battlefield';
import { Character } from '../../core/Character';
import { Position } from '../../battlefield/Position';
import { ActionDecision } from '../core/AIController';
import { ZoneInstance } from '../../missions/mission-config';

/**
 * Mission AI context
 */
export interface MissionAIContext {
  /** Current turn */
  currentTurn: number;
  /** Current round */
  currentRound: number;
  /** Character's side */
  side: MissionSide;
  /** Enemy sides */
  enemySides: MissionSide[];
  /** Enemy characters (backward compatibility) */
  enemies?: Character[];
  /** Battlefield reference */
  battlefield: Battlefield;
  /** Mission-specific state */
  missionState: Record<string, unknown>;
  /** Scoring context for VP/RP pressure (backward compatibility) */
  scoringContext?: any;
}

/**
 * Mission AI decision override
 */
export interface MissionAIDecision {
  /** Override the standard AI decision */
  override?: ActionDecision;
  /** Modify priority of standard decision */
  priorityModifier?: number;
  /** Additional context for decision */
  context?: string;
}

/**
 * Base Mission AI class
 * 
 * All mission-specific AI classes extend this.
 */
export abstract class MissionAI {
  /** Mission identifier */
  abstract readonly missionId: string;
  
  /** Mission name */
  abstract readonly missionName: string;

  /**
   * Get AI decision override for a character
   * 
   * Override this method to provide mission-specific behavior.
   * Return undefined to use standard AI decisions.
   */
  abstract getDecision(
    character: Character,
    context: MissionAIContext
  ): MissionAIDecision | undefined;

  /**
   * Get strategic priorities for the mission
   * 
   * Override to provide mission-specific target/zone priorities.
   */
  getStrategicPriorities(context: MissionAIContext): {
    priorityZones?: string[];
    priorityTargets?: string[];
    objectives?: string[];
  } {
    return {};
  }

  /**
   * Check if character has mission-specific role
   */
  getCharacterRole(character: Character, context: MissionAIContext): string | undefined {
    return undefined;
  }

  /**
   * Get mission-specific evaluation score
   */
  evaluateSituation(context: MissionAIContext): number {
    // Default: neutral evaluation
    return 0;
  }

  /**
   * Helper: Find zones controlled by side
   */
  protected getControlledZones(
    sideId: string,
    zones: ZoneInstance[]
  ): ZoneInstance[] {
    return zones.filter(z => z.controlledBy === sideId);
  }

  /**
   * Helper: Find contested zones
   */
  protected getContestedZones(zones: ZoneInstance[]): ZoneInstance[] {
    return zones.filter(z => z.contested);
  }

  /**
   * Helper: Find nearest zone to character
   */
  protected findNearestZone(
    character: Character,
    zones: ZoneInstance[],
    battlefield: Battlefield
  ): ZoneInstance | null {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return null;

    let nearest: ZoneInstance | null = null;
    let nearestDist = Infinity;

    for (const zone of zones) {
      if (!zone.center) continue;
      const dist = Math.hypot(
        zone.center.x - charPos.x,
        zone.center.y - charPos.y
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = zone;
      }
    }

    return nearest;
  }

  /**
   * Helper: Find VIP in side
   */
  protected findVIP(side: MissionSide): Character | undefined {
    const vipMember = side.members.find(m => m.isVIP);
    return vipMember?.character;
  }

  /**
   * Helper: Check if character is VIP
   */
  protected isVIP(character: Character, side: MissionSide): boolean {
    return side.members.some(m => m.character === character && m.isVIP);
  }
}

/**
 * Mission AI Registry
 */
export class MissionAIRegistry {
  private factories: Map<string, () => MissionAI> = new Map();

  /**
   * Register a mission AI factory
   */
  register(missionId: string, factory: () => MissionAI): void {
    this.factories.set(missionId, factory);
  }

  /**
   * Get mission AI for a mission
   */
  getAI(missionId: string): MissionAI | undefined {
    const factory = this.factories.get(missionId);
    if (!factory) return undefined;
    return factory();
  }

  /**
   * Check if mission has AI registered
   */
  hasAI(missionId: string): boolean {
    return this.factories.has(missionId);
  }

  /**
   * Get all registered mission IDs
   */
  getRegisteredMissions(): string[] {
    return Array.from(this.factories.keys());
  }
}

/**
 * Create mission AI registry with default implementations
 */
export function createDefaultMissionAIRegistry(): MissionAIRegistry {
  const registry = new MissionAIRegistry();

  // Register mission AIs (implemented in mission-specific files)
  // These will be imported and registered as they are implemented

  return registry;
}

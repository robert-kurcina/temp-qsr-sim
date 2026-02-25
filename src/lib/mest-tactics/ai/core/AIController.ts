/**
 * AI Controller Base Interface
 * 
 * All AI controllers implement this interface for consistent integration.
 */

import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { Item } from '../core/Item';

export type DoctrineEngagement = 'melee' | 'ranged' | 'balanced';
export type DoctrinePlanning = 'aggression' | 'keys_to_victory' | 'balanced';
export type DoctrineAggression = 'aggressive' | 'balanced' | 'defensive';
export type MissionRole = 'attacker' | 'defender' | 'neutral';

export interface AIControllerConfig {
  /** Aggression level 0-1 (higher = more aggressive targeting) */
  aggression: number;
  /** Caution level 0-1 (higher = more defensive positioning) */
  caution: number;
  /** Accuracy modifier -1 to 1 (negative = worse aim, positive = better) */
  accuracyModifier: number;
  /** God mode - perfect battlefield knowledge */
  godMode: boolean;
  /** Personality seed for variation */
  personalitySeed?: number;
  /** Allow attacks against KO'd targets (default false) */
  allowKOdAttacks?: boolean;
  /** Optional controller traits for Puppet KO'd rules */
  kodControllerTraitsByCharacterId?: Record<string, string[]>;
  /** Optional coordinator traits for Puppet KO'd rules */
  kodCoordinatorTraitsByCharacterId?: Record<string, string[]>;
  /** Session visibility OR in MU (defaults to 16) */
  visibilityOrMu?: number;
  /** Session maximum OR multiple for normal checks (defaults to 3) */
  maxOrm?: number;
  /** Allow Concentrate to double OR and ignore max ORM for range gating */
  allowConcentrateRangeExtension?: boolean;
  /** If true, AI range/target checks require per-character LOS/FOV gates */
  perCharacterFovLos?: boolean;
  /** Mission identifier for mission-aware utility scoring */
  missionId?: string;
  /** Role for asymmetric missions */
  missionRole?: MissionRole;
  /** Doctrine engagement stratagem component */
  doctrineEngagement?: DoctrineEngagement;
  /** Doctrine planning stratagem component */
  doctrinePlanning?: DoctrinePlanning;
  /** Doctrine aggression stratagem component */
  doctrineAggression?: DoctrineAggression;
  /** Tactical Doctrine (encapsulates engagement, planning, aggression) */
  tacticalDoctrine?: import('../stratagems/AIStratagems').TacticalDoctrine;
}

export interface ActionDecision {
  /** Action type to perform */
  type: ActionType;
  /** Target character (for attacks, disengage, support) */
  target?: Character;
  /** Target position (for movement) */
  position?: Position;
  /** Weapon to use (for attacks) */
  weapon?: Item;
  /** Objective marker action subtype (for `fiddle`) */
  objectiveAction?: 'acquire_marker' | 'share_marker' | 'transfer_marker' | 'destroy_marker';
  /** Target objective marker ID (for objective interactions) */
  markerId?: string;
  /** Secondary model target for marker transfer/share */
  markerTargetModelId?: string;
  /** Reason for this decision (debug/logging) */
  reason: string;
  /** Optional planning metadata for audit/report attribution */
  planning?: {
    source: 'pattern' | 'goap_plan' | 'goap_forecast' | 'utility' | 'behavior_tree';
    waitExpectedTriggerCount?: number;
    waitExpectedReactValue?: number;
    waitGoapBranchScore?: number;
    waitPreferredBranch?: 'immediate_action' | 'wait_now' | 'move_then_wait';
    waitRolloutPreferredScore?: number;
  };
  /** Priority score (higher = more urgent) */
  priority: number;
  /** Whether this action requires AP */
  requiresAP: boolean;
}

export type ActionType =
  | 'none'           // No action
  | 'hold'           // Hold position
  | 'move'           // Move to position
  | 'charge'         // Charge into melee
  | 'close_combat'   // Attack in melee
  | 'ranged_combat'  // Attack at range
  | 'disengage'      // Break from melee
  | 'rally'          // Remove fear tokens
  | 'revive'         // Revive KO'd ally
  | 'fiddle'         // Interact with item/object
  | 'wait'           // Wait for opportunity
  | 'reload'         // Reload weapon
  | 'hide'           // Become hidden
  | 'detect'         // Detect hidden enemy
  | 'combined'       // Combined action (move + attack)
  | 'react-move'     // React to Move action
  | 'react_counter_strike' // Counter-strike react (Passive Player Option)
  | 'react_counter_fire'   // Counter-fire react (Passive Player Option)
  | 'compulsory'    // Compulsory action (fear/disorder)
  | 'bottle_test';  // Bottle test (breakpoint morale)

export interface ReactOpportunity {
  /** Type of action being reacted to */
  trigger: 'move-only' | 'abrupt-move' | 'abrupt-non-move';
  /** Character performing the action */
  actor: Character;
  /** Actor's position */
  actorPosition: Position;
  /** Whether this is a zero AP action (no react allowed) */
  isZeroAPAction?: boolean;
  /** Whether this is a reposition (react disallowed unless base-contact) */
  isReposition?: boolean;
}

export type ReactActionType =
  | 'none'
  | 'react-move'     // React to Move action (QSR p.1115)
  | 'counter_strike' // Passive Player Option (Advanced, p.1250)
  | 'counter_fire';  // Passive Player Option (Advanced, p.1250)

export interface CharacterKnowledge {
  /** Known enemy positions (god-mode: all, fog-of-war: only visible) */
  knownEnemies: Map<string, EnemyInfo>;
  /** Known terrain features */
  knownTerrain: Map<string, TerrainInfo>;
  /** Last known positions of all characters */
  lastKnownPositions: Map<string, Position>;
  /** Threat zones (areas under enemy fire) */
  threatZones: ThreatZone[];
  /** Safe zones (cover positions) */
  safeZones: Position[];
  /** Turn when knowledge was last updated */
  lastUpdated: number;
}

export interface EnemyInfo {
  characterId: string;
  position: Position;
  wounds: number;
  isKOd: boolean;
  isEliminated: boolean;
  isHidden: boolean;
  lastSeenTurn: number;
  threatLevel: number;
}

export interface TerrainInfo {
  position: Position;
  terrainType: string;
  providesCover: boolean;
  blocksLOS: boolean;
  isImpassable: boolean;
}

export interface ThreatZone {
  position: Position;
  radius: number;
  sourceCharacterId: string;
  threatType: 'ranged' | 'melee' | 'aoe';
}

export interface AIContext {
  /** Character being controlled */
  character: Character;
  /** All friendly characters */
  allies: Character[];
  /** All enemy characters */
  enemies: Character[];
  /** Battlefield reference */
  battlefield: Battlefield;
  /** Current turn number */
  currentTurn: number;
  /** Current round number */
  currentRound: number;
  /** AP remaining for this character */
  apRemaining: number;
  /** Side ID/name for mission-aware objective action gating */
  sideId?: string;
  /** Objective marker snapshot available to this decision frame */
  objectiveMarkers?: AIObjectiveMarkerInfo[];
  /** Character's current knowledge */
  knowledge: CharacterKnowledge;
  /** AI configuration */
  config: AIControllerConfig;
  /** Predicted scoring context for strategic decision-making (R1.5) */
  scoringContext?: {
    /** My side's predicted key scores */
    myKeyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>;
    /** Best opponent's predicted key scores */
    opponentKeyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }>;
    /** Am I leading in overall VP? */
    amILeading: boolean;
    /** VP lead margin */
    vpMargin: number;
    /** Which keys am I winning? */
    winningKeys: string[];
    /** Which keys am I losing? */
    losingKeys: string[];
  };
}

export interface AIObjectiveMarkerInfo {
  id: string;
  name: string;
  state: string;
  position?: Position;
  carriedBy?: string;
  scoringSideId?: string;
  controlledBy?: string;
  omTypes: string[];
  switchState?: string;
  isNeutral?: boolean;
  interactable?: boolean;
  missionSource?: string;
}

export interface AIResult {
  /** Action decision */
  decision: ActionDecision;
  /** Debug information */
  debug?: {
    consideredActions: string[];
    scores: Record<string, number>;
    actionAvailability?: Record<string, number>;
    reasoning: string;
  };
}

export interface ReactResult {
  /** Whether to react */
  shouldReact: boolean;
  /** React action type */
  reactType: ReactActionType;
  /** Priority score */
  priority: number;
}

/**
 * Base AI Controller Interface
 * 
 * All AI controllers must implement these methods.
 */
export interface IAIController {
  /**
   * Get the best action for a character this activation
   */
  decideAction(context: AIContext): AIResult;

  /**
   * Evaluate react opportunities
   */
  evaluateReact(context: AIContext, opportunity: ReactOpportunity): ReactResult;

  /**
   * Update character knowledge based on current battlefield state
   */
  updateKnowledge(context: AIContext): CharacterKnowledge;

  /**
   * Get AI configuration
   */
  getConfig(): AIControllerConfig;

  /**
   * Set AI configuration
   */
  setConfig(config: Partial<AIControllerConfig>): void;
}

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AIControllerConfig = {
  aggression: 0.5,
  caution: 0.5,
  accuracyModifier: 0,
  godMode: true, // Default to perfect knowledge
  personalitySeed: undefined,
  allowKOdAttacks: false,
  visibilityOrMu: 16,
  maxOrm: 3,
  allowConcentrateRangeExtension: true,
  perCharacterFovLos: false,
  missionRole: 'neutral',
  doctrineEngagement: 'balanced',
  doctrinePlanning: 'balanced',
  doctrineAggression: 'balanced',
};

/**
 * Validate AI configuration values
 */
export function validateAIConfig(config: AIControllerConfig): AIControllerConfig {
  return {
    aggression: Math.max(0, Math.min(1, config.aggression)),
    caution: Math.max(0, Math.min(1, config.caution)),
    accuracyModifier: Math.max(-1, Math.min(1, config.accuracyModifier)),
    godMode: config.godMode ?? true,
    personalitySeed: config.personalitySeed,
    allowKOdAttacks: config.allowKOdAttacks ?? false,
    kodControllerTraitsByCharacterId: config.kodControllerTraitsByCharacterId,
    kodCoordinatorTraitsByCharacterId: config.kodCoordinatorTraitsByCharacterId,
    visibilityOrMu: Math.max(0.5, config.visibilityOrMu ?? 16),
    maxOrm: Math.max(0, Math.floor(config.maxOrm ?? 3)),
    allowConcentrateRangeExtension: config.allowConcentrateRangeExtension ?? true,
    perCharacterFovLos: config.perCharacterFovLos ?? false,
    missionId: config.missionId,
    missionRole: config.missionRole ?? 'neutral',
    doctrineEngagement: config.doctrineEngagement ?? 'balanced',
    doctrinePlanning: config.doctrinePlanning ?? 'balanced',
    doctrineAggression: config.doctrineAggression ?? 'balanced',
  };
}

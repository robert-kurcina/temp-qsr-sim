import { Position } from '../battlefield/Position';
import { MissionSide } from '../mission/MissionSide';

/**
 * Mission Configuration - Data-driven mission definition
 * Loaded from JSON configuration files
 */
export interface MissionConfig {
  /** JSON Schema reference */
  $schema?: string;
  /** Unique mission identifier (e.g., QAI_21) */
  id: string;
  /** Mission display name */
  name: string;
  /** Mission description for players */
  description: string;
  /** Number of sides supported */
  sides: { min: number; max: number };
  /** Default game size */
  defaultGameSize: GameSize;
  /** Battlefield configuration */
  battlefield?: BattlefieldConfig;
  /** Victory conditions */
  victoryConditions: VictoryConditionConfig[];
  /** Scoring rules */
  scoringRules: ScoringRuleConfig[];
  /** Special rules */
  specialRules?: SpecialRuleConfig[];
  /** Turn limit (0 = unlimited) */
  turnLimit: number;
  /** End game die roll enabled */
  endGameDieRoll: boolean;
  /** End game die roll starts at turn */
  endGameDieStart: number;
  /** Size-specific configuration */
  sizeConfig?: Record<GameSize, SizeSpecificConfig>;
  /** Balance hints (ignored by engine) */
  _balance?: BalanceHints;
}

/**
 * Game size enumeration
 */
export enum GameSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
}

/**
 * Battlefield configuration
 */
export interface BattlefieldConfig {
  /** Zone configurations */
  zones?: ZoneConfig[];
  /** Deployment type */
  deployment?: DeploymentType;
}

/**
 * Deployment type
 */
export enum DeploymentType {
  OPPOSING_EDGES = 'opposing_edges',
  CORNERS = 'corners',
  CUSTOM = 'custom',
}

/**
 * Zone configuration
 */
export interface ZoneConfig {
  /** Zone type */
  type: ZoneType;
  /** Number of zones */
  count: number;
  /** Formation pattern */
  formation?: FormationType;
  /** Spacing between zones (MU) */
  spacing?: number;
  /** Zone radius (MU) */
  radius?: number;
}

/**
 * Zone type
 */
export enum ZoneType {
  POI = 'poi',
  SIGNAL = 'signal',
  CACHE = 'cache',
  FOCAL_NODE = 'focal_node',
  THRESHOLD = 'threshold',
  MECHANISM = 'mechanism',
}

/**
 * Formation pattern
 */
export enum FormationType {
  TRIANGLE = 'triangle',
  DIAMOND = 'diamond',
  CIRCLE = 'circle',
  LINE = 'line',
  CUSTOM = 'custom',
}

/**
 * Victory condition configuration
 */
export interface VictoryConditionConfig {
  /** Victory condition type */
  type: VictoryConditionType;
  /** VP threshold (if applicable) */
  threshold?: number;
  /** Immediate victory on completion */
  immediate?: boolean;
  /** Description for players */
  description?: string;
}

/**
 * Victory condition type
 */
export enum VictoryConditionType {
  ELIMINATION = 'elimination',
  DOMINANCE = 'dominance',
  EXTRACTION = 'extraction',
  SURVIVAL = 'survival',
  VP_MAJORITY = 'vp_majority',
  COURIER = 'courier',
  RUPTURE = 'rupture',
  HARVEST = 'harvest',
}

/**
 * Scoring rule configuration
 */
export interface ScoringRuleConfig {
  /** Scoring trigger */
  trigger: ScoringTrigger;
  /** VP amount (or function) */
  vp: number | { per: string };
  /** Description for players */
  description?: string;
}

/**
 * Scoring trigger
 */
export enum ScoringTrigger {
  TURN_END = 'turn.end',
  TURN_END_ZONE_CONTROL = 'turn.end.zone_control',
  MODEL_ELIMINATED = 'model.eliminated',
  ZONE_CAPTURED = 'zone.captured',
  COURIER_EDGE_REACH = 'courier.edge_reach',
  VIP_EXTRACTED = 'vip.extracted',
  VP_DESTROYED = 'vp.destroyed',
  CACHE_HARVESTED = 'cache.harvested',
  FIRST_BLOOD = 'first_blood',
  OBJECTIVE_COMPLETE = 'objective.complete',
}

/**
 * Special rule configuration
 */
export interface SpecialRuleConfig {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule effect description */
  effect?: string;
  /** Rule-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Size-specific configuration
 */
export interface SizeSpecificConfig {
  /** VP threshold for victory */
  vpThreshold?: number;
  /** Number of zones */
  zoneCount?: number;
  /** Minimum BP */
  bpMin?: number;
  /** Maximum BP */
  bpMax?: number;
  /** Minimum models */
  modelMin?: number;
  /** Maximum models */
  modelMax?: number;
}

/**
 * Balance hints (for authors, ignored by engine)
 */
export interface BalanceHints {
  /** Expected game length in turns */
  expectedTurns?: number;
  /** Difficulty rating */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Design notes */
  notes?: string;
}

/**
 * Mission State - Runtime state during mission execution
 */
export interface MissionState {
  /** Current turn number */
  currentTurn: number;
  /** Current round number */
  currentRound: number;
  /** Sides in the mission */
  sides: MissionSide[];
  /** VP by side */
  vpBySide: Map<string, number>;
  /** Mission ended */
  ended: boolean;
  /** Winner side ID */
  winner?: string;
  /** End reason */
  endReason?: string;
  /** Custom state for special rules */
  customState: Record<string, unknown>;
}

/**
 * Victory result
 */
export interface VictoryResult {
  /** Victory achieved */
  achieved: boolean;
  /** Winning side ID (if applicable) */
  winner?: string;
  /** Reason for victory */
  reason?: string;
}

/**
 * Scoring result
 */
export interface ScoringResult {
  /** VP awarded */
  vpAwarded: number;
  /** Side that received VP */
  sideId?: string;
  /** Reason for scoring */
  reason?: string;
}

/**
 * Zone instance (runtime)
 */
export interface ZoneInstance {
  /** Zone ID */
  id: string;
  /** Zone type */
  type: ZoneType;
  /** Zone position */
  position: Position;
  /** Zone radius */
  radius: number;
  /** Controlling side ID */
  controller?: string;
  /** Zone state */
  state: Record<string, unknown>;
}

import {
  EventTriggerType,
  EventConditionType,
  EventEffectType,
  EventCondition,
  EventEffect,
  createVictoryConditionHook,
  createTurnEventHook,
  createEndTurnEventHook,
} from './mission-event-hooks';
import { MissionSide } from './MissionSide';

/**
 * Mission definition interface
 */
export interface MissionDefinition {
  /** Unique mission identifier */
  id: string;
  /** Display name */
  name: string;
  /** Mission description */
  description: string;
  /** Minimum number of sides required */
  minSides: number;
  /** Maximum number of sides allowed */
  maxSides: number;
  /** Default game size */
  defaultGameSize: string;
  /** Victory conditions (OR'd - any can win) */
  victoryConditions: VictoryCondition[];
  /** Scoring rules */
  scoring: ScoringRule[];
  /** Special rules for this mission */
  specialRules: SpecialRule[];
  /** Turn limit (0 = unlimited) */
  turnLimit: number;
  /** End game die roll enabled */
  endGameDieRoll: boolean;
  /** End game die roll starts at turn */
  endGameDieStart: number;
  /** Mission keys/scoring features enabled */
  keys: string[];
  /** Scoring configuration by game size */
  sizes: Record<string, {
    dominanceVP?: number;
    sanctuaryVP?: number;
    courierVP?: number;
    collectionVP?: number;
    poiVP?: number;
  }>;
}

/**
 * Victory condition definition
 */
export interface VictoryCondition {
  /** Condition type */
  type: VictoryConditionType;
  /** Side this applies to (or 'any') */
  side: string;
  /** Threshold value */
  threshold?: number;
  /** Victory points awarded (if not instant win) */
  victoryPoints?: number;
  /** Is this an instant win condition? */
  instantWin?: boolean;
  /** Description */
  description: string;
}

/**
 * Victory condition types
 */
export enum VictoryConditionType {
  /** All enemy models eliminated */
  AllEnemiesEliminated = 'AllEnemiesEliminated',
  /** Control N zones */
  ControlZones = 'ControlZones',
  /** Have N victory points */
  VictoryPoints = 'VictoryPoints',
  /** VIP extracted */
  VIPExtracted = 'VIPExtracted',
  /** VIP survived */
  VIPSurvived = 'VIPSurvived',
  /** Hold objective for N turns */
  HoldObjective = 'HoldObjective',
  /** First to N points */
  FirstToPoints = 'FirstToPoints',
  /** Most points at game end */
  MostPoints = 'MostPoints',
}

/**
 * Scoring rule definition
 */
export interface ScoringRule {
  /** Scoring type */
  type: ScoringType;
  /** When this scoring is applied */
  timing: ScoringTiming;
  /** VP amount or multiplier */
  value: number;
  /** Target (zone, marker, etc.) */
  target?: string;
  /** Description */
  description: string;
}

/**
 * Scoring types
 */
export enum ScoringType {
  /** VP per enemy eliminated */
  PerElimination = 'PerElimination',
  /** VP per zone controlled at turn end */
  PerZoneControlled = 'PerZoneControlled',
  /** VP per marker controlled */
  PerMarkerControlled = 'PerMarkerControlled',
  /** VP for first control of zone */
  FirstControl = 'FirstControl',
  /** VP for VIP extraction */
  VIPExtraction = 'VIPExtraction',
  /** VP for holding objective */
  HoldObjective = 'HoldObjective',
  /** Flat VP bonus */
  Bonus = 'Bonus',
}

/**
 * When scoring is applied
 */
export enum ScoringTiming {
  /** Score immediately when condition met */
  Immediate = 'Immediate',
  /** Score at end of turn */
  EndTurn = 'EndTurn',
  /** Score at end of game */
  EndGame = 'EndGame',
}

/**
 * Special rule definition
 */
export interface SpecialRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** When rule applies */
  trigger?: string;
  /** Rule effect */
  effect: string;
}

/**
 * Create event hooks for a mission definition
 */
export function createMissionEventHooks(
  mission: MissionDefinition,
  sides: MissionSide[]
): Array<{ id: string; hook: ReturnType<typeof createVictoryConditionHook> | ReturnType<typeof createTurnEventHook> | ReturnType<typeof createEndTurnEventHook> }> {
  const hooks: Array<{ id: string; hook: ReturnType<typeof createVictoryConditionHook> | ReturnType<typeof createTurnEventHook> | ReturnType<typeof createEndTurnEventHook> }> = [];

  // Create victory condition hooks
  for (const condition of mission.victoryConditions) {
    const hook = createVictoryConditionForCondition(condition, sides);
    if (hook) {
      hooks.push({ id: `victory-${condition.type}`, hook });
    }
  }

  // Create scoring hooks
  for (const scoring of mission.scoring) {
    if (scoring.timing === ScoringTiming.EndTurn) {
      const hook = createScoringHookForRule(scoring, sides);
      if (hook) {
        hooks.push({ id: `scoring-${scoring.type}`, hook });
      }
    }
  }

  return hooks;
}

/**
 * Create victory condition hook from victory condition
 */
function createVictoryConditionForCondition(
  condition: VictoryCondition,
  sides: MissionSide[]
): ReturnType<typeof createVictoryConditionHook> | null {
  switch (condition.type) {
    case VictoryConditionType.AllEnemiesEliminated:
      return createEliminationVictoryCondition(condition, sides);

    case VictoryConditionType.VictoryPoints:
      return createVPVictoryCondition(condition);

    case VictoryConditionType.FirstToPoints:
      return createFirstToPointsCondition(condition);

    default:
      return null;
  }
}

/**
 * Create elimination victory condition
 */
function createEliminationVictoryCondition(
  condition: VictoryCondition,
  sides: MissionSide[]
): ReturnType<typeof createVictoryConditionHook> {
  // For each side, check if all enemies are eliminated
  const conditions: EventCondition[] = [];

  for (const side of sides) {
    // Check that this side has at least 1 model remaining
    conditions.push({
      type: EventConditionType.ModelsRemaining,
      sideId: side.id,
      threshold: 1,
    });

    // Check that all other sides have 0 models
    for (const otherSide of sides) {
      if (otherSide.id !== side.id) {
        conditions.push({
          type: EventConditionType.ModelsRemaining,
          sideId: otherSide.id,
          threshold: 1,
          invert: true,
        });
      }
    }
  }

  return createVictoryConditionHook(
    conditions,
    condition.side === 'any' ? sides[0]?.id ?? '' : condition.side,
    {
      name: `Elimination Victory - ${condition.description}`,
      vpAward: condition.victoryPoints,
    }
  );
}

/**
 * Create VP-based victory condition
 */
function createVPVictoryCondition(
  condition: VictoryCondition
): ReturnType<typeof createVictoryConditionHook> {
  return createVictoryConditionHook(
    [
      {
        type: EventConditionType.VictoryPoints,
        sideId: condition.side,
        threshold: condition.threshold,
      },
    ],
    condition.side,
    {
      name: `VP Victory - ${condition.description}`,
      instantWin: condition.instantWin,
    }
  );
}

/**
 * Create first-to-points victory condition
 */
function createFirstToPointsCondition(
  condition: VictoryCondition
): ReturnType<typeof createVictoryConditionHook> {
  return createVictoryConditionHook(
    [
      {
        type: EventConditionType.VictoryPoints,
        sideId: condition.side,
        threshold: condition.threshold,
      },
    ],
    condition.side,
    {
      name: `First to ${condition.threshold} VP`,
      instantWin: true,
    }
  );
}

/**
 * Create scoring hook from scoring rule
 */
function createScoringHookForRule(
  scoring: ScoringRule,
  sides: MissionSide[]
): ReturnType<typeof createEndTurnEventHook> | null {
  switch (scoring.type) {
    case ScoringType.PerElimination:
      // This is handled immediately, not at end of turn
      return null;

    case ScoringType.PerZoneControlled:
      return createEndTurnEventHook(
        sides.map(side => ({
          type: EventEffectType.AwardVP,
          sideId: side.id,
          vpAmount: scoring.value,
        })),
        {
          name: `Zone Control Scoring - ${scoring.description}`,
          repeatable: true,
        }
      );

    default:
      return null;
  }
}

/**
 * Get immediate scoring effects (for elimination, etc.)
 */
export function getImmediateScoringEffects(
  scoring: ScoringRule,
  context: {
    sideId: string;
    eliminatedModelSideId?: string;
  }
): EventEffect[] {
  const effects: EventEffect[] = [];

  switch (scoring.type) {
    case ScoringType.PerElimination:
      if (context.eliminatedModelSideId !== context.sideId) {
        effects.push({
          type: EventEffectType.AwardVP,
          sideId: context.sideId,
          vpAmount: scoring.value,
        });
      }
      break;
  }

  return effects;
}

/**
 * Get a mission definition by ID
 */
export function getMissionDefinition(missionId: string): MissionDefinition | null {
  if (isEliminationMission(missionId)) {
    return getEliminationMission();
  }

  // TODO: Add more mission definitions as they are implemented
  // QAI_12: Convergence
  // QAI_13: Assault
  // QAI_14: Dominion
  // QAI_15: Recovery
  // QAI_16: Escort
  // QAI_17: Triumvirate
  // QAI_18: Stealth
  // QAI_19: Defiance
  // QAI_20: Breach

  return null;
}

/**
 * Get all available mission definitions
 */
export function getAllMissionDefinitions(): MissionDefinition[] {
  return [
    getEliminationMission(),
    // Add more missions as they are implemented
  ];
}

/**
 * Check if a mission ID is valid
 */
export function isValidMission(missionId: string): boolean {
  return getMissionDefinition(missionId) !== null;
}

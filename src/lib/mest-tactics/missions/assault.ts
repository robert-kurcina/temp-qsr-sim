import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from '../mission-definitions';

/**
 * QAI Mission 13: Assault
 *
 * Infiltrate enemy territory and assault key objectives.
 * Target markers are placed around the battlefield.
 * Score VP by assaulting markers or harvesting resources.
 * First side to assault all objectives OR most VP at game end wins.
 */
export const AssaultMission: MissionDefinition = {
  id: 'QAI_13',
  name: 'Assault',
  description: 'Infiltrate enemy territory and assault key objectives. Target markers are placed around the battlefield. Score VP by assaulting markers or harvesting resources.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [
    {
      type: VictoryConditionType.ControlZones,
      side: 'any',
      threshold: 0, // All target markers (dynamic)
      instantWin: true,
      description: 'Assault all objective markers',
    },
    {
      type: VictoryConditionType.MostPoints,
      side: 'any',
      description: 'Most victory points at game end',
    },
  ],
  scoring: [
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 3,
      target: 'assault',
      description: 'Score 3 VP for each successful assault action',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 1,
      target: 'harvest',
      description: 'Score 1 VP for each resource harvest action',
    },
  ],
  specialRules: [
    {
      id: 'assault_objectives',
      name: 'Assault Objectives',
      description: 'Target markers are placed around the battlefield. Models must spend an action to assault a marker.',
      effect: '3 VP per assault, marker is removed after assault',
    },
    {
      id: 'resource_harvest',
      name: 'Resource Harvest',
      description: 'Some markers provide resources that can be harvested instead of assaulted.',
      effect: '1 VP per harvest, marker remains available',
    },
    {
      id: 'contested_assault',
      name: 'Contested Assault',
      description: 'If enemy models are within engagement range, assault actions may fail.',
      effect: 'Assault requires disengaged model',
    },
  ],
  turnLimit: 8,
  endGameDieRoll: true,
  endGameDieStart: 5,
  keys: ['Assault', 'Harvest'], // Uses assault/harvest event system
  sizes: {
    VERY_SMALL: {
      assaultVP: 3,
      harvestVP: 1,
      markerCount: 3,
    },
    SMALL: {
      assaultVP: 3,
      harvestVP: 1,
      markerCount: 4,
    },
    MEDIUM: {
      assaultVP: 3,
      harvestVP: 1,
      markerCount: 5,
    },
    LARGE: {
      assaultVP: 3,
      harvestVP: 1,
      markerCount: 6,
    },
    VERY_LARGE: {
      assaultVP: 3,
      harvestVP: 1,
      markerCount: 6,
    },
  },
};

/**
 * Get the Assault mission definition
 */
export function getAssaultMission(): MissionDefinition {
  return AssaultMission;
}

/**
 * Check if a mission is the Assault mission
 */
export function isAssaultMission(missionId: string): boolean {
  return missionId === 'QAI_13';
}

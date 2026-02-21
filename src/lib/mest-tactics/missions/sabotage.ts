import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from '../mission-definitions';

/**
 * QAI Mission 13: Sabotage
 * 
 * Infiltrate enemy territory and sabotage key objectives.
 * Sabotage markers are placed around the battlefield.
 * Score VP by sabotaging markers or harvesting resources.
 * First side to sabotage all objectives OR most VP at game end wins.
 */
export const SabotageMission: MissionDefinition = {
  id: 'QAI_13',
  name: 'Sabotage',
  description: 'Infiltrate enemy territory and sabotage key objectives. Sabotage markers are placed around the battlefield. Score VP by sabotaging markers or harvesting resources.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [
    {
      type: VictoryConditionType.ControlZones,
      side: 'any',
      threshold: 0, // All sabotage markers (dynamic)
      instantWin: true,
      description: 'Sabotage all objective markers',
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
      target: 'sabotage',
      description: 'Score 3 VP for each successful sabotage action',
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
      id: 'sabotage_objectives',
      name: 'Sabotage Objectives',
      description: 'Sabotage markers are placed around the battlefield. Models must spend an action to sabotage a marker.',
      effect: '3 VP per sabotage, marker is removed after sabotage',
    },
    {
      id: 'resource_harvest',
      name: 'Resource Harvest',
      description: 'Some markers provide resources that can be harvested instead of sabotaged.',
      effect: '1 VP per harvest, marker remains available',
    },
    {
      id: 'contested_sabotage',
      name: 'Contested Sabotage',
      description: 'If enemy models are within engagement range, sabotage actions may fail.',
      effect: 'Sabotage requires disengaged model',
    },
  ],
  turnLimit: 8,
  endGameDieRoll: true,
  endGameDieStart: 5,
  keys: ['Sabotage', 'Harvest'], // Uses sabotage/harvest event system
  sizes: {
    VERY_SMALL: {
      sabotageVP: 3,
      harvestVP: 1,
      markerCount: 3,
    },
    SMALL: {
      sabotageVP: 3,
      harvestVP: 1,
      markerCount: 4,
    },
    MEDIUM: {
      sabotageVP: 3,
      harvestVP: 1,
      markerCount: 5,
    },
    LARGE: {
      sabotageVP: 3,
      harvestVP: 1,
      markerCount: 6,
    },
    VERY_LARGE: {
      sabotageVP: 3,
      harvestVP: 1,
      markerCount: 6,
    },
  },
};

/**
 * Get the Sabotage mission definition
 */
export function getSabotageMission(): MissionDefinition {
  return SabotageMission;
}

/**
 * Check if a mission is the Sabotage mission
 */
export function isSabotageMission(missionId: string): boolean {
  return missionId === 'QAI_13';
}

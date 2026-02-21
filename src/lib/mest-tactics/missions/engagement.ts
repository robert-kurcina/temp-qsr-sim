import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from '../mission-definitions';

/**
 * QAI Mission 12: Engagement
 * 
 * Control engagement zones to score victory points.
 * Zones are contested areas where models fight for control.
 * Control a zone by having the only active models in it.
 * First to control all zones OR most zones at game end wins.
 */
export const EngagementMission: MissionDefinition = {
  id: 'QAI_12',
  name: 'Engagement',
  description: 'Control engagement zones to score victory points. Zones are contested areas where models fight for control. Control a zone by having the only active models in it.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [
    {
      type: VictoryConditionType.ControlZones,
      side: 'any',
      threshold: 0, // All zones (dynamic based on mission setup)
      instantWin: true,
      description: 'Control all engagement zones',
    },
    {
      type: VictoryConditionType.MostPoints,
      side: 'any',
      description: 'Most victory points at game end',
    },
  ],
  scoring: [
    {
      type: ScoringType.PerZoneControlled,
      timing: ScoringTiming.EndTurn,
      value: 2,
      description: 'Score 2 VP for each engagement zone controlled at end of turn',
    },
    {
      type: ScoringType.FirstControl,
      timing: ScoringTiming.Immediate,
      value: 1,
      target: 'zone',
      description: 'Score 1 VP for first control of each engagement zone',
    },
  ],
  specialRules: [
    {
      id: 'engagement_zones',
      name: 'Engagement Zones',
      description: 'The battlefield contains 2-4 engagement zones. Models in these zones contest control.',
      effect: 'Zones are controlled by the side with the only active models inside',
    },
    {
      id: 'zone_contest',
      name: 'Zone Contest',
      description: 'If both sides have models in a zone, it is contested and scores no VP.',
      effect: 'Contested zones do not award VP to any side',
    },
    {
      id: 'zone_denial',
      name: 'Zone Denial',
      description: 'A side can deny zone control by keeping at least one model alive in the zone.',
      effect: 'Even one model prevents enemy from controlling the zone',
    },
  ],
  turnLimit: 8,
  endGameDieRoll: true,
  endGameDieStart: 5,
  keys: ['POI'], // Uses POI/Zone control system
  sizes: {
    VERY_SMALL: {
      poiVP: 2,
      firstControlVP: 1,
      zoneCount: 2,
    },
    SMALL: {
      poiVP: 2,
      firstControlVP: 1,
      zoneCount: 3,
    },
    MEDIUM: {
      poiVP: 2,
      firstControlVP: 1,
      zoneCount: 4,
    },
    LARGE: {
      poiVP: 2,
      firstControlVP: 1,
      zoneCount: 4,
    },
    VERY_LARGE: {
      poiVP: 2,
      firstControlVP: 1,
      zoneCount: 4,
    },
  },
};

/**
 * Get the Engagement mission definition
 */
export function getEngagementMission(): MissionDefinition {
  return EngagementMission;
}

/**
 * Check if a mission is the Engagement mission
 */
export function isEngagementMission(missionId: string): boolean {
  return missionId === 'QAI_12';
}

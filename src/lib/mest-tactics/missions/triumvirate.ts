import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';

/**
 * QAI Mission 17: Triad
 * 
 * Control three strategic zones to achieve dominance.
 * Three zones are placed in a triangle formation across the battlefield.
 * Controlling all three zones grants instant victory.
 * Partial control grants VP per turn.
 */
export const TriadMission: MissionDefinition = {
  id: 'QAI_17',
  name: 'Triad',
  description: 'Control three strategic zones to achieve dominance. Three zones are placed in a triangle formation across the battlefield.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'MEDIUM',
  victoryConditions: [
    {
      type: VictoryConditionType.ControlZones,
      side: 'any',
      threshold: 3,
      instantWin: true,
      description: 'Control all three triad zones',
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
      value: 3,
      description: 'Score 3 VP for each triad zone controlled at end of turn',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 5,
      target: 'full_triad',
      description: 'Score 5 VP bonus for controlling all three zones simultaneously',
    },
  ],
  specialRules: [
    {
      id: 'triad_zones',
      name: 'Triad Zones',
      description: 'Three zones are placed in triangle formation. Each zone is equally valuable.',
      effect: '3 zones, each worth 3 VP per turn',
    },
    {
      id: 'triad_dominance',
      name: 'Triad Dominance',
      description: 'Controlling all three zones grants instant victory.',
      effect: 'Full triad control = instant win',
    },
    {
      id: 'zone_contest',
      name: 'Zone Contest',
      description: 'Zones with models from multiple sides are contested and score no VP.',
      effect: 'Contested zones = 0 VP',
    },
  ],
  turnLimit: 10,
  endGameDieRoll: true,
  endGameDieStart: 6,
  keys: ['POI', 'Encroachment'], // Zone control + first to cross midline
  sizes: {
    VERY_SMALL: {
      poiVP: 3,
      fullTriadVP: 5,
      zoneCount: 3,
    },
    SMALL: {
      poiVP: 3,
      fullTriadVP: 5,
      zoneCount: 3,
    },
    MEDIUM: {
      poiVP: 3,
      fullTriadVP: 5,
      zoneCount: 3,
    },
    LARGE: {
      poiVP: 3,
      fullTriadVP: 5,
      zoneCount: 3,
    },
    VERY_LARGE: {
      poiVP: 3,
      fullTriadVP: 5,
      zoneCount: 3,
    },
    Small: {
      poiVP: 3,
      fullTriadVP: 5,
      zoneCount: 3,
    },
  },
};

/**
 * Get the Triad mission definition
 */
export function getTriadMission(): MissionDefinition {
  return TriadMission;
}

/**
 * Check if a mission is the Triad mission
 */
export function isTriadMission(missionId: string): boolean {
  return missionId === 'QAI_17';
}

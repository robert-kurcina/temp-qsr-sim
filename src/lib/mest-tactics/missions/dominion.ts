import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';

/**
 * QAI Mission 14: Beacon
 * 
 * Secure and control beacon zones scattered across the battlefield.
 * Beacons emit signals that must be controlled to score victory points.
 * Control a beacon by having the only active models within it.
 * First to control all beacons OR most VP at game end wins.
 */
export const BeaconMission: MissionDefinition = {
  id: 'QAI_14',
  name: 'Beacon',
  description: 'Secure and control beacon zones scattered across the battlefield. Beacons emit signals that must be controlled to score victory points.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [
    {
      type: VictoryConditionType.ControlZones,
      side: 'any',
      threshold: 0, // All beacons (dynamic)
      instantWin: true,
      description: 'Control all beacon zones',
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
      description: 'Score 2 VP for each beacon controlled at end of turn',
    },
    {
      type: ScoringType.FirstControl,
      timing: ScoringTiming.Immediate,
      value: 2,
      target: 'beacon',
      description: 'Score 2 VP for first control of each beacon',
    },
  ],
  specialRules: [
    {
      id: 'beacon_zones',
      name: 'Beacon Zones',
      description: 'The battlefield contains 3-5 beacon zones. Models in these zones contest control.',
      effect: 'Beacons are controlled by the side with the only active models inside',
    },
    {
      id: 'beacon_signal',
      name: 'Beacon Signal',
      description: 'Beacons emit signals that can be detected by models within range.',
      effect: 'Models within 6 MU of a beacon they do not control may attempt to contest it',
    },
    {
      id: 'beacon_contest',
      name: 'Beacon Contest',
      description: 'If multiple sides have models in a beacon zone, it is contested and scores no VP.',
      effect: 'Contested beacons do not award VP to any side',
    },
  ],
  turnLimit: 8,
  endGameDieRoll: true,
  endGameDieStart: 5,
  keys: ['Dominance', 'Sanctuary', 'POI', 'Encroachment'], // Zone control + first to cross midline
  sizes: {
    VERY_SMALL: {
      poiVP: 2,
      firstControlVP: 2,
      beaconCount: 3,
      dominanceVP: 0,
      sanctuaryVP: 0,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
    SMALL: {
      poiVP: 2,
      firstControlVP: 2,
      beaconCount: 4,
      dominanceVP: 0,
      sanctuaryVP: 0,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
    MEDIUM: {
      poiVP: 2,
      firstControlVP: 2,
      beaconCount: 5,
      dominanceVP: 0,
      sanctuaryVP: 0,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
    LARGE: {
      poiVP: 2,
      firstControlVP: 2,
      beaconCount: 5,
      dominanceVP: 0,
      sanctuaryVP: 0,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
    VERY_LARGE: {
      poiVP: 2,
      firstControlVP: 2,
      beaconCount: 5,
      dominanceVP: 0,
      sanctuaryVP: 0,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
    Small: {
      poiVP: 2,
      firstControlVP: 2,
      beaconCount: 4,
      dominanceVP: 0,
      sanctuaryVP: 0,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
  },
};

/**
 * Get the Beacon mission definition
 */
export function getBeaconMission(): MissionDefinition {
  return BeaconMission;
}

/**
 * Check if a mission is the Beacon mission
 */
export function isBeaconMission(missionId: string): boolean {
  return missionId === 'QAI_14';
}

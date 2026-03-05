import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';

/**
 * QAI Mission 20: Breach
 *
 * Control objective markers that switch allegiance over time.
 * Markers change control automatically at certain turns.
 * Adapt your strategy as the battlefield shifts.
 * Most control at game end wins.
 */
export const BreachMission: MissionDefinition = {
  id: 'QAI_20',
  name: 'Breach',
  description: 'Control objective markers that switch allegiance over time. Markers change control automatically at certain turns.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'MEDIUM',
  victoryConditions: [
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
      description: 'Score 3 VP for each marker controlled at end of turn',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.Immediate,
      value: 5,
      target: 'marker_switch',
      description: 'Score 5 VP when a marker switches to your control',
    },
    {
      type: ScoringType.Bonus,
      timing: ScoringTiming.EndTurn,
      value: 10,
      target: 'full_control',
      description: 'Score 10 VP bonus for controlling all markers at end of turn',
    },
  ],
  specialRules: [
    {
      id: 'switchback_markers',
      name: 'Switchback Markers',
      description: 'Markers automatically switch control on turns 4 and 8. Plan accordingly.',
      effect: 'Turn 4 and 8 = automatic marker switch',
    },
    {
      id: 'marker_control',
      name: 'Marker Control',
      description: 'Markers are controlled by the side with models in range. Contested = no control.',
      effect: 'Physical control + automatic switches',
    },
    {
      id: 'switch_bonus',
      name: 'Switch Bonus',
      description: 'When a marker switches to your control automatically, gain 5 VP.',
      effect: '5 VP per automatic switch to your side',
    },
  ],
  turnLimit: 10,
  endGameDieRoll: true,
  endGameDieStart: 7,
  keys: ['POI', 'Events'], // Uses POI/Markers + automatic switch events
  sizes: {
    VERY_SMALL: {
      markerVP: 3,
      switchVP: 5,
      fullControlVP: 10,
      markerCount: 3,
      switchTurns: [4, 8],
    },
    SMALL: {
      markerVP: 3,
      switchVP: 5,
      fullControlVP: 10,
      markerCount: 4,
      switchTurns: [4, 8],
    },
    MEDIUM: {
      markerVP: 3,
      switchVP: 5,
      fullControlVP: 10,
      markerCount: 5,
      switchTurns: [4, 8],
    },
    LARGE: {
      markerVP: 3,
      switchVP: 5,
      fullControlVP: 10,
      markerCount: 5,
      switchTurns: [4, 8],
    },
    VERY_LARGE: {
      markerVP: 3,
      switchVP: 5,
      fullControlVP: 10,
      markerCount: 6,
      switchTurns: [4, 8],
    },
    Small: {
      markerVP: 3,
      switchVP: 5,
      fullControlVP: 10,
      markerCount: 4,
      switchTurns: [4, 8],
    },
  } as any,
};

/**
 * Get the Breach mission definition
 */
export function getBreachMission(): MissionDefinition {
  return BreachMission;
}

/**
 * Check if a mission is the Breach mission
 */
export function isBreachMission(missionId: string): boolean {
  return missionId === 'QAI_20';
}

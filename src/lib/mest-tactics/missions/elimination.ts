import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming, SpecialRule } from './mission-definitions';

/**
 * QAI Mission 11: Elimination
 * 
 * The default mission. Eliminate all enemy models to win.
 * Score 1 VP for each enemy model eliminated.
 * Last side with models remaining wins.
 */
export const EliminationMission: MissionDefinition = {
  id: 'QAI_11',
  name: 'Elimination',
  description: 'The default mission: eliminate opposing models. The last side with models remaining wins.',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'VERY_SMALL',
  victoryConditions: [
    {
      type: VictoryConditionType.AllEnemiesEliminated,
      side: 'any',
      instantWin: true,
      description: 'All enemy models are eliminated',
    },
    {
      type: VictoryConditionType.MostPoints,
      side: 'any',
      description: 'Most victory points at game end',
    },
  ],
  scoring: [
    {
      type: ScoringType.PerElimination,
      timing: ScoringTiming.Immediate,
      value: 1,
      description: 'Score 1 VP for each enemy model eliminated',
    },
  ],
  specialRules: [
    {
      id: 'last_stand',
      name: 'Last Stand',
      description: 'When only one model remains on a side, that model fights to the end.',
      effect: 'No special mechanical effect - narrative flavor',
    },
    {
      id: 'honorable_defeat',
      name: 'Honorable Defeat',
      description: 'A side that is completely eliminated scores 0 VP.',
      effect: 'Eliminated sides cannot score victory points',
    },
  ],
  turnLimit: 10,
  endGameDieRoll: true,
  endGameDieStart: 6,
  keys: [], // Elimination uses basic scoring only
  sizes: {
    VERY_SMALL: {},
    SMALL: {},
    MEDIUM: {},
    LARGE: {},
    VERY_LARGE: {},
  },
};

/**
 * Get the Elimination mission definition
 */
export function getEliminationMission(): MissionDefinition {
  return EliminationMission;
}

/**
 * Check if a mission is the Elimination mission
 */
export function isEliminationMission(missionId: string): boolean {
  return missionId === 'QAI_11';
}

import { MissionDefinition, VictoryConditionType, ScoringType, ScoringTiming } from './mission-definitions';
import { getEliminationMission, isEliminationMission } from './missions/elimination';

/**
 * Mission registry - maps mission IDs to their definitions
 */
const missionRegistry: Map<string, () => MissionDefinition> = new Map();

// Register Elimination mission
missionRegistry.set('QAI_1', getEliminationMission);

// Stub missions for testing (to be replaced with real implementations)
missionRegistry.set('QAI_13', () => ({
  id: 'QAI_13',
  name: 'Sabotage (Stub)',
  description: 'Sabotage mission stub for testing',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [],
  scoring: [],
  specialRules: [],
  turnLimit: 10,
  endGameDieRoll: false,
  endGameDieStart: 6,
  keys: ['Sabotage', 'Harvest'],
  sizes: {
    SMALL: { collectionVP: 1, poiVP: 1 },
  },
}));

missionRegistry.set('QAI_14', () => ({
  id: 'QAI_14',
  name: 'Beacon (Stub)',
  description: 'Beacon mission stub for testing',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [],
  scoring: [],
  specialRules: [],
  turnLimit: 10,
  endGameDieRoll: false,
  endGameDieStart: 6,
  keys: ['Dominance', 'Sanctuary', 'POI'],
  sizes: {
    SMALL: { 
      dominanceVP: 1, 
      sanctuaryVP: 1, 
      poiVP: 2,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
    Small: { 
      dominanceVP: 1, 
      sanctuaryVP: 1, 
      poiVP: 2,
      dominanceWinVp: 5,
      sanctuaryWinVp: 5,
    },
  },
}));

missionRegistry.set('QAI_15', () => ({
  id: 'QAI_15',
  name: 'Extraction Point (Stub)',
  description: 'Extraction Point mission stub for testing',
  minSides: 2,
  maxSides: 4,
  defaultGameSize: 'SMALL',
  victoryConditions: [],
  scoring: [],
  specialRules: [],
  turnLimit: 10,
  endGameDieRoll: false,
  endGameDieStart: 6,
  keys: ['Exit', 'Flawless'],
  sizes: {
    SMALL: { collectionVP: 1 },
  },
}));

/**
 * Get a mission definition by ID
 */
export function getMissionDefinition(missionId: string): MissionDefinition | null {
  const factory = missionRegistry.get(missionId);
  if (factory) {
    return factory();
  }
  return null;
}

/**
 * Get all available mission definitions
 */
export function getAllMissionDefinitions(): MissionDefinition[] {
  return Array.from(missionRegistry.values()).map(factory => factory());
}

/**
 * Check if a mission ID is valid
 */
export function isValidMission(missionId: string): boolean {
  return missionRegistry.has(missionId);
}

/**
 * Register a new mission definition
 */
export function registerMission(missionId: string, factory: () => MissionDefinition): void {
  missionRegistry.set(missionId, factory);
}

/**
 * Get list of all registered mission IDs
 */
export function getRegisteredMissionIds(): string[] {
  return Array.from(missionRegistry.keys());
}

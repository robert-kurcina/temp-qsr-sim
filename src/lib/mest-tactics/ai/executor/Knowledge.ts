import type { CharacterKnowledge } from '../core/AIController';

export function createEmptyKnowledge(turn: number): CharacterKnowledge {
  return {
    knownEnemies: new Map(),
    knownTerrain: new Map(),
    lastKnownPositions: new Map(),
    threatZones: [],
    safeZones: [],
    lastUpdated: turn,
  };
}

import { describe, expect, it } from 'vitest';
import { createEmptyKnowledge } from './Knowledge';

describe('createEmptyKnowledge', () => {
  it('creates an empty knowledge snapshot bound to turn', () => {
    const knowledge = createEmptyKnowledge(4);
    expect(knowledge.lastUpdated).toBe(4);
    expect(knowledge.knownEnemies.size).toBe(0);
    expect(knowledge.knownTerrain.size).toBe(0);
    expect(knowledge.lastKnownPositions.size).toBe(0);
    expect(knowledge.threatZones).toEqual([]);
    expect(knowledge.safeZones).toEqual([]);
  });
});

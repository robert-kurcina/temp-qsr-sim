import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattlefieldFactory } from './BattlefieldFactory';
import { gameData } from '../../data';

describe('BattlefieldFactory coverage', () => {
  let originalRandom: () => number;

  beforeEach(() => {
    originalRandom = Math.random;
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  });

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('should cover at least 50% of the battlefield with trees at densityRatio 100', () => {
    const width = 24;
    const height = 24;
    const battlefield = BattlefieldFactory.create(width, height, {
      densityRatio: 100,
      areaDensityRatio: 0,
      blockLos: 0,
      fitnessRetries: 0,
      terrain: {
        area: 0,
        shrub: 0,
        tree: 100,
        rocks: 0,
        wall: 0,
        building: 0,
      },
    });

    const treeInfo = (gameData.terrain_info as Record<string, any>)['Tree'];
    const diameter = treeInfo.dimensions.diameter;
    const treeArea = Math.PI * Math.pow(diameter / 2, 2);

    const treeCount = battlefield.terrain.filter(feature => feature.meta?.category === 'tree').length;
    const coveredArea = treeCount * treeArea;
    const targetArea = width * height * 0.5;

    expect(coveredArea).toBeGreaterThanOrEqual(targetArea);
  });

  it('should compute openness stats for multiple density ratios', () => {
    const width = 24;
    const height = 24;
    const densities = [20, 50, 100];
    const makeRandom = (seedStart: number) => {
      let seed = seedStart;
      return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
    };

    for (const densityRatio of densities) {
      Math.random = makeRandom(42);
      const battlefield = BattlefieldFactory.create(width, height, {
        densityRatio,
        areaDensityRatio: 0,
        blockLos: 0,
        fitnessRetries: 0,
        terrain: {
          area: 0,
          shrub: 0,
          tree: 100,
          rocks: 0,
          wall: 0,
          building: 0,
        },
      });
      const stats = battlefield.opennessStats;
      expect(stats).toBeTruthy();
      expect(stats?.meanChunkLongLosRatio).toBeGreaterThanOrEqual(0);
      expect(stats?.meanChunkLongLosRatio).toBeLessThanOrEqual(1);
      expect(stats?.longLosPairRatio).toBeGreaterThanOrEqual(0);
      expect(stats?.longLosPairRatio).toBeLessThanOrEqual(1);
    }
  });
});

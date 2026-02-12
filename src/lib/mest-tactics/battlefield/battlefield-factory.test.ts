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

    console.log(width, height, targetArea, coveredArea);
    expect(coveredArea).toBeGreaterThanOrEqual(targetArea);
  });
});

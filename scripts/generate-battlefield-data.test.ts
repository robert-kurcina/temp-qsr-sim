import { describe, expect, it } from 'vitest';
import { parseBattlefieldGenerateArgs } from './generate-battlefield-data';

describe('parseBattlefieldGenerateArgs', () => {
  it('defaults to VERY_SMALL and zero layer densities', () => {
    const parsed = parseBattlefieldGenerateArgs([]);
    expect(parsed.gameSizes).toEqual(['VERY_SMALL']);
    expect(parsed.mode).toBe('balanced');
    expect(parsed.densities).toEqual({
      area: 0,
      buildings: 0,
      walls: 0,
      rocks: 0,
      shrubs: 0,
      trees: 0,
    });
  });

  it('supports multiple game sizes via --game-sizes and quantizes tokens', () => {
    const parsed = parseBattlefieldGenerateArgs([
      '--game-sizes',
      'VERY_SMALL,LARGE',
      'A17',
      'B73',
      'W50',
      '--mode',
      'fast',
      '--seed',
      '424242',
    ]);

    expect(parsed.gameSizes).toEqual(['VERY_SMALL', 'LARGE']);
    expect(parsed.mode).toBe('fast');
    expect(parsed.seed).toBe(424242);
    expect(parsed.densities.area).toBe(20);
    expect(parsed.densities.buildings).toBe(80);
    expect(parsed.densities.walls).toBe(60);
  });
});

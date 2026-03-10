import { describe, expect, it, vi } from 'vitest';
import { parseBattlefieldGenerateArgs } from './BattlefieldGenerateCli';

describe('parseBattlefieldGenerateArgs', () => {
  it('defaults to VERY_SMALL with zeroed densities', () => {
    const parsed = parseBattlefieldGenerateArgs([]);
    expect(parsed.gameSizes).toEqual(['VERY_SMALL']);
    expect(parsed.mode).toBe('balanced');
    expect(parsed.seed).toBeUndefined();
    expect(parsed.densities).toEqual({
      area: 0,
      buildings: 0,
      walls: 0,
      rocks: 0,
      shrubs: 0,
      trees: 0,
    });
  });

  it('supports short flags and quantizes density tokens', () => {
    const parsed = parseBattlefieldGenerateArgs([
      'SMALL',
      '-m',
      'fast',
      '-s',
      '99',
      'A17',
      'B73',
      'W50',
    ]);

    expect(parsed.gameSizes).toEqual(['SMALL']);
    expect(parsed.mode).toBe('fast');
    expect(parsed.seed).toBe(99);
    expect(parsed.densities).toEqual({
      area: 20,
      buildings: 80,
      walls: 60,
      rocks: 0,
      shrubs: 0,
      trees: 0,
    });
  });

  it('invokes unknown-token callback when provided', () => {
    const onUnknownToken = vi.fn();
    parseBattlefieldGenerateArgs(['NOPE', '--wat'], { onUnknownToken });
    expect(onUnknownToken).toHaveBeenCalledWith('NOPE');
    expect(onUnknownToken).toHaveBeenCalledWith('--wat');
  });
});


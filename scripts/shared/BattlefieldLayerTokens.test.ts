import { describe, expect, it, vi } from 'vitest';
import { applyBattlefieldLayerToken, parseBattlefieldLayerArgs } from './BattlefieldLayerTokens';
import { EMPTY_BATTLEFIELD_DENSITIES } from './BattlefieldPaths';

describe('BattlefieldLayerTokens', () => {
  it('quantizes layer token values to nearest 20', () => {
    const parsed = parseBattlefieldLayerArgs(['A17', 'B73', 'W50', 'R0', 'S99', 'T1']);
    expect(parsed).toEqual({
      area: 20,
      buildings: 80,
      walls: 60,
      rocks: 0,
      shrubs: 100,
      trees: 0,
    });
  });

  it('accepts bare tokens as zero values', () => {
    const parsed = parseBattlefieldLayerArgs(['A', 'B', 'W', 'R', 'S', 'T']);
    expect(parsed).toEqual(EMPTY_BATTLEFIELD_DENSITIES);
  });

  it('calls unknown token callback for non-layer tokens', () => {
    const onUnknown = vi.fn();
    parseBattlefieldLayerArgs(['A20', 'NOPE', '--seed', '42'], onUnknown);
    expect(onUnknown).toHaveBeenCalledWith('NOPE');
    expect(onUnknown).toHaveBeenCalledWith('--seed');
    expect(onUnknown).toHaveBeenCalledWith('42');
  });

  it('returns false when applying invalid tokens', () => {
    const densities = { ...EMPTY_BATTLEFIELD_DENSITIES };
    expect(applyBattlefieldLayerToken('X20', densities)).toBe(false);
    expect(densities).toEqual(EMPTY_BATTLEFIELD_DENSITIES);
  });
});

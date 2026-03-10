import {
  EMPTY_BATTLEFIELD_DENSITIES,
  normalizeBattlefieldDensities,
  quantizeDensity,
  type BattlefieldDensityConfig,
} from './BattlefieldPaths';

type LayerKey = keyof BattlefieldDensityConfig;

const LAYER_TOKEN_TO_KEY: Record<string, LayerKey> = {
  A: 'area',
  B: 'buildings',
  W: 'walls',
  R: 'rocks',
  S: 'shrubs',
  T: 'trees',
};

export function applyBattlefieldLayerToken(token: string, densities: BattlefieldDensityConfig): boolean {
  const match = String(token || '')
    .trim()
    .toUpperCase()
    .match(/^([ABWRST])(\d{0,3})$/);
  if (!match) return false;

  const key = LAYER_TOKEN_TO_KEY[match[1]];
  const rawValue = match[2] === '' ? 0 : Number.parseInt(match[2], 10);
  densities[key] = quantizeDensity(rawValue);
  return true;
}

export function parseBattlefieldLayerArgs(args: string[] = [], onUnknown?: (token: string) => void): BattlefieldDensityConfig {
  const densities: BattlefieldDensityConfig = { ...EMPTY_BATTLEFIELD_DENSITIES };
  for (const token of args) {
    if (!applyBattlefieldLayerToken(token, densities) && onUnknown) {
      onUnknown(token);
    }
  }
  return normalizeBattlefieldDensities(densities);
}

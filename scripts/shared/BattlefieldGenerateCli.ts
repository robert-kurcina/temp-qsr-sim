import { type TerrainPlacementOptions } from '../../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { CANONICAL_GAME_SIZE_ORDER } from '../../src/lib/mest-tactics/mission/game-size-canonical';
import {
  EMPTY_BATTLEFIELD_DENSITIES,
  normalizeBattlefieldDensities,
  normalizeGameSizeSegment,
  type BattlefieldDensityConfig,
} from './BattlefieldPaths';
import { applyBattlefieldLayerToken } from './BattlefieldLayerTokens';

export type BattlefieldGenerateCliOptions = {
  gameSizes: string[];
  mode: TerrainPlacementOptions['mode'];
  seed?: number;
  densities: BattlefieldDensityConfig;
};

interface ParseBattlefieldGenerateCliOptions {
  onUnknownToken?: (token: string) => void;
}

function parseGameSizes(value: string | undefined): string[] {
  const raw = String(value || '')
    .split(',')
    .map(segment => normalizeGameSizeSegment(segment))
    .filter(Boolean);
  const valid = raw.filter(size =>
    CANONICAL_GAME_SIZE_ORDER.includes(size as (typeof CANONICAL_GAME_SIZE_ORDER)[number])
  );
  return Array.from(new Set(valid));
}

export function parseBattlefieldGenerateArgs(
  argv: string[],
  options: ParseBattlefieldGenerateCliOptions = {}
): BattlefieldGenerateCliOptions {
  const gameSizes: string[] = [];
  const densities = { ...EMPTY_BATTLEFIELD_DENSITIES };
  let mode: TerrainPlacementOptions['mode'] = 'balanced';
  let seed: number | undefined;
  const onUnknownToken = options.onUnknownToken;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (
      (arg === '--mode' || arg === '-m') &&
      next &&
      (next === 'fast' || next === 'balanced' || next === 'thorough')
    ) {
      mode = next;
      i++;
      continue;
    }

    if ((arg === '--seed' || arg === '-s') && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        seed = parsed;
      }
      i++;
      continue;
    }

    if ((arg === '--game-size' || arg === '--game-sizes') && next) {
      const parsedSizes = parseGameSizes(next);
      for (const size of parsedSizes) {
        gameSizes.push(size);
      }
      i++;
      continue;
    }

    const upper = normalizeGameSizeSegment(arg);
    if (CANONICAL_GAME_SIZE_ORDER.includes(upper as (typeof CANONICAL_GAME_SIZE_ORDER)[number])) {
      gameSizes.push(upper);
      continue;
    }

    if (applyBattlefieldLayerToken(arg, densities)) {
      continue;
    }

    if (onUnknownToken) {
      onUnknownToken(arg);
    }
  }

  const normalizedSizes = Array.from(new Set(gameSizes.length > 0 ? gameSizes : ['VERY_SMALL']));
  return {
    gameSizes: normalizedSizes,
    mode,
    seed,
    densities: normalizeBattlefieldDensities(densities),
  };
}


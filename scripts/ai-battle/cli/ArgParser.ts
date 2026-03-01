/**
 * Argument Parser
 *
 * CLI argument parsing functions for AI battle setup.
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { LightingCondition } from '../../../src/lib/mest-tactics/utils/visibility';

/**
 * Parse lighting condition argument
 */
export function parseLightingArg(value: string | undefined): LightingCondition {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'Day, Clear';
  if (
    normalized === '2' ||
    normalized === 'twilight' ||
    normalized === 'twilight_overcast' ||
    normalized === 'twilight-overcast'
  ) {
    return 'Twilight, Overcast';
  }
  return 'Day, Clear';
}

/**
 * Parse loadout profile argument
 */
export function parseLoadoutProfileArg(value: string | undefined): 'default' | 'melee_only' {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'default';
  if (normalized === 'melee' || normalized === 'melee_only' || normalized === 'melee-only') {
    return 'melee_only';
  }
  return 'default';
}

/**
 * Parse tactical doctrine argument
 */
export function parseDoctrineArg(value: string | undefined, fallback: TacticalDoctrine = TacticalDoctrine.Operative): TacticalDoctrine {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  for (const doctrine of Object.values(TacticalDoctrine)) {
    if (String(doctrine).toLowerCase() === normalized) {
      return doctrine;
    }
  }
  return fallback;
}

/**
 * Parse doctrine pair arguments (supports comma-separated or separate args)
 */
export function parseDoctrinePairArgs(
  doctrineArg: string | undefined,
  doctrineArgBravo: string | undefined,
  fallback: TacticalDoctrine
): [TacticalDoctrine, TacticalDoctrine] {
  const raw = (doctrineArg ?? '').trim();
  if (!raw) {
    return [fallback, fallback];
  }

  if (raw.includes(',')) {
    const [left, right] = raw.split(',', 2);
    const alpha = parseDoctrineArg(left, fallback);
    const bravo = parseDoctrineArg(right, alpha);
    return [alpha, bravo];
  }

  const alpha = parseDoctrineArg(raw, fallback);
  const bravo = parseDoctrineArg(doctrineArgBravo, alpha);
  return [alpha, bravo];
}

/**
 * Parse mission ID argument
 */
export function parseMissionIdArg(value: string | undefined, fallback: string = 'QAI_11'): string {
  const normalized = (value ?? '').trim().toUpperCase().replace('-', '_');
  if (!normalized) return fallback;
  if (/^QAI_[0-9]+$/.test(normalized)) {
    return normalized;
  }
  return fallback;
}

/**
 * Parse game size argument
 */
export function parseGameSizeArg(value: string | undefined): GameSize {
  const normalized = (value ?? '').toUpperCase();
  const toGameSize: Record<string, GameSize> = {
    VERY_SMALL: GameSize.VERY_SMALL,
    SMALL: GameSize.SMALL,
    MEDIUM: GameSize.MEDIUM,
    LARGE: GameSize.LARGE,
    VERY_LARGE: GameSize.VERY_LARGE,
  };
  return toGameSize[normalized] ?? GameSize.VERY_LARGE;
}

/**
 * Parse integer argument with fallback
 */
export function parseIntArg(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Parse positive integer argument with fallback
 */
export function parsePositiveIntArg(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

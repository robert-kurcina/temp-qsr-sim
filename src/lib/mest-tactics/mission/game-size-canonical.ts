import { gameData } from '../../data';

export const CANONICAL_GAME_SIZE_ORDER = [
  'VERY_SMALL',
  'SMALL',
  'MEDIUM',
  'LARGE',
  'VERY_LARGE'
] as const;

export type CanonicalGameSize = (typeof CANONICAL_GAME_SIZE_ORDER)[number];

export interface CanonicalGameSizeRow {
  name: string;
  minBP: number;
  maxBP: number;
  minModels: number;
  maxModels: number;
  battlefieldWidthMU: number;
  battlefieldHeightMU: number;
  endGameTrigger: number;
}

const rawGameSizes = gameData.game_sizes as Record<string, unknown>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseGameSizeRow(size: CanonicalGameSize, value: unknown): CanonicalGameSizeRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid canonical game size row for ${size}`);
  }

  const row = value as Record<string, unknown>;
  const parsed: CanonicalGameSizeRow = {
    name: String(row.name ?? size),
    minBP: Number(row.minBP),
    maxBP: Number(row.maxBP),
    minModels: Number(row.minModels),
    maxModels: Number(row.maxModels),
    battlefieldWidthMU: Number(row.battlefieldWidthMU),
    battlefieldHeightMU: Number(row.battlefieldHeightMU),
    endGameTrigger: Number(row.endGameTrigger),
  };

  const requiredNumbers = [
    parsed.minBP,
    parsed.maxBP,
    parsed.minModels,
    parsed.maxModels,
    parsed.battlefieldWidthMU,
    parsed.battlefieldHeightMU,
    parsed.endGameTrigger,
  ];
  if (!requiredNumbers.every(isFiniteNumber)) {
    throw new Error(`Invalid numeric fields in canonical game size row for ${size}`);
  }

  return parsed;
}

function parseCanonicalGameSizes(raw: Record<string, unknown>): Record<CanonicalGameSize, CanonicalGameSizeRow> {
  const parsed = {} as Record<CanonicalGameSize, CanonicalGameSizeRow>;
  for (const size of CANONICAL_GAME_SIZE_ORDER) {
    parsed[size] = parseGameSizeRow(size, raw[size]);
  }
  return parsed;
}

function findSizeByMinimumThreshold(
  value: number,
  getMin: (size: CanonicalGameSize) => number
): CanonicalGameSize {
  let resolved: any = CANONICAL_GAME_SIZE_ORDER[0];
  for (const size of CANONICAL_GAME_SIZE_ORDER) {
    if (value >= getMin(size)) {
      resolved = size;
      continue;
    }
    break;
  }
  return resolved;
}

function moveOneStepToward(
  source: CanonicalGameSize,
  target: CanonicalGameSize
): CanonicalGameSize {
  if (source === target) {
    return source;
  }

  const sourceIndex = CANONICAL_GAME_SIZE_ORDER.indexOf(source);
  const targetIndex = CANONICAL_GAME_SIZE_ORDER.indexOf(target);
  if (targetIndex > sourceIndex) {
    return CANONICAL_GAME_SIZE_ORDER[Math.min(sourceIndex + 1, CANONICAL_GAME_SIZE_ORDER.length - 1)];
  }
  return CANONICAL_GAME_SIZE_ORDER[Math.max(sourceIndex - 1, 0)];
}

export const CANONICAL_GAME_SIZES = parseCanonicalGameSizes(rawGameSizes);

export function determineCanonicalGameSize(bpPerSide: number, modelsPerSide: number): CanonicalGameSize {
  const bpSize = findSizeByMinimumThreshold(bpPerSide, size => CANONICAL_GAME_SIZES[size].minBP);
  const modelSize = findSizeByMinimumThreshold(modelsPerSide, size => CANONICAL_GAME_SIZES[size].minModels);

  if (bpSize === modelSize) {
    return bpSize;
  }
  return moveOneStepToward(bpSize, modelSize);
}

export function getCanonicalEndGameTriggerTurn(gameSize: CanonicalGameSize): number {
  return CANONICAL_GAME_SIZES[gameSize].endGameTrigger;
}

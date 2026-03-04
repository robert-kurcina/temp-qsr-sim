
export interface HindranceSources {
  woundTokens?: number;
  wounds?: number;
  fearTokens?: number;
  delayTokens?: number;
  statusTokens?: Record<string, number>;
}

const ADVANCED_HINDRANCE_STATUS_KEYS = new Set([
  'acid',
  'blinded',
  'burn',
  'burned',
  'confused',
  'entangled',
  'held',
  'poison',
  'poisoned',
  'transfixed',
]);

function hasAnyToken(value: number | undefined): boolean {
  return (value ?? 0) > 0;
}

function isAdvancedHindranceStatus(statusName: string): boolean {
  return ADVANCED_HINDRANCE_STATUS_KEYS.has(statusName.trim().toLowerCase());
}

/**
 * Calculates the hindrance penalty by counting the number of active hindrance *types*.
 * @param sources - An object containing the counts of various hindrance tokens.
 * @returns The total number of active hindrance types.
 */
export function calculateHindrancePenalty(sources: HindranceSources): number {
  const hindranceTypes = new Set<string>();

  const woundTokens = sources.woundTokens ?? sources.wounds ?? 0;
  if (hasAnyToken(woundTokens)) hindranceTypes.add('wounds');
  if (hasAnyToken(sources.fearTokens)) hindranceTypes.add('fear');
  if (hasAnyToken(sources.delayTokens)) hindranceTypes.add('delay');

  for (const [statusName, count] of Object.entries(sources.statusTokens ?? {})) {
    if (!hasAnyToken(count)) continue;
    if (!isAdvancedHindranceStatus(statusName)) continue;
    hindranceTypes.add(statusName.trim().toLowerCase());
  }

  return hindranceTypes.size;
}

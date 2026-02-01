
import { DicePool, DiceType } from '../dice-roller';

export interface HindranceSources {
  woundTokens: number;
  fearTokens: number;
  delayTokens: number;
}

/**
 * Calculates the hindrance penalty by counting the number of active hindrance *types*.
 * @param sources - An object containing the counts of various hindrance tokens.
 * @returns The total number of active hindrance types.
 */
export function calculateHindrancePenalty(sources: HindranceSources): number {
  let totalHindranceTypes = 0;
  
  if (sources.woundTokens > 0) {
    totalHindranceTypes++;
  }
  if (sources.fearTokens > 0) {
    totalHindranceTypes++;
  }
  if (sources.delayTokens > 0) {
    totalHindranceTypes++;
  }

  // Future hindrances can be added here by checking new properties on the HindranceSources interface.

  return totalHindranceTypes;
}

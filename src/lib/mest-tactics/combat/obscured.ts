const OBSCURED_THRESHOLDS = [1, 2, 5, 10] as const;

/**
 * QSR Obscured penalty thresholds are cumulative:
 * reaching each threshold contributes -1 Modifier die.
 */
export function calculateObscuredPenalty(modelsInLof: number | undefined): number {
  if (!modelsInLof || modelsInLof <= 0) return 0;
  let penalty = 0;
  for (const threshold of OBSCURED_THRESHOLDS) {
    if (modelsInLof >= threshold) penalty += 1;
  }
  return penalty;
}


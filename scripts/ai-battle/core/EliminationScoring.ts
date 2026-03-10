import type { Character } from '../../../src/lib/mest-tactics/core/Character';

interface ApplyEliminationScoringParams {
  casualty: 'ko' | 'eliminated';
  defender: Character;
  sideIndex: number;
  missionSideIds: string[];
  eliminatedBPBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  firstBloodAwarded: boolean;
  verbose: boolean;
  log?: (message: string) => void;
}

interface ApplyEliminationScoringResult {
  firstBloodAwarded: boolean;
}

export function applyEliminationScoringForRunner(
  params: ApplyEliminationScoringParams
): ApplyEliminationScoringResult {
  const eliminatingSideId = params.missionSideIds[params.sideIndex];
  const eliminatedBP =
    (params.defender as any).profile?.totalBp ??
    (params.defender as any).profile?.bp ??
    0;
  if (!eliminatingSideId || eliminatedBP <= 0) {
    return { firstBloodAwarded: params.firstBloodAwarded };
  }

  params.eliminatedBPBySide[eliminatingSideId] = (params.eliminatedBPBySide[eliminatingSideId] ?? 0) + eliminatedBP;

  let firstBloodAwarded = params.firstBloodAwarded;
  if (!firstBloodAwarded) {
    params.missionRpBySide[eliminatingSideId] = (params.missionRpBySide[eliminatingSideId] ?? 0) + 1;
    firstBloodAwarded = true;
    if (params.verbose) {
      params.log?.(`    → First Blood! +1 RP to ${eliminatingSideId}`);
    }
  }

  if (params.verbose) {
    params.log?.(
      `    → ${params.casualty === 'eliminated' ? 'Eliminated' : 'KO'} ${(params.defender as any).profile?.name ?? params.defender.id} (${eliminatedBP} BP). ` +
      `Total BP by ${eliminatingSideId}: ${params.eliminatedBPBySide[eliminatingSideId]}`
    );
  }

  return { firstBloodAwarded };
}

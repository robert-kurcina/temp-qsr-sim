export interface MissionEndScoringResult {
  missionVpBySide: Record<string, number>;
  eliminationKeyWinner?: {
    sideId: string;
    eliminatedBP: number;
  };
  rpKeyAward?: {
    sideId: string;
    topRp: number;
    secondRp: number | null;
    rpMargin: number | null;
    totalVpAwarded: 1 | 2;
  };
}

export function applyMissionEndScoringForRunner(args: {
  missionVpBySide: Record<string, number>;
  missionRpBySide: Record<string, number>;
  eliminatedBPBySide: Record<string, number>;
}): MissionEndScoringResult {
  const missionVpBySide = { ...args.missionVpBySide };
  let eliminationKeyWinner: MissionEndScoringResult['eliminationKeyWinner'];
  let rpKeyAward: MissionEndScoringResult['rpKeyAward'];

  const eliminationEntries = Object.entries(args.eliminatedBPBySide);
  if (eliminationEntries.length > 0) {
    const highestEliminatedBp = Math.max(...eliminationEntries.map(([, eliminatedBP]) => eliminatedBP));
    if (highestEliminatedBp > 0) {
      const eliminationLeaders = eliminationEntries.filter(([, eliminatedBP]) => eliminatedBP === highestEliminatedBp);
      if (eliminationLeaders.length === 1) {
        const [winnerSideId, eliminatedBP] = eliminationLeaders[0];
        missionVpBySide[winnerSideId] = (missionVpBySide[winnerSideId] ?? 0) + 1;
        eliminationKeyWinner = {
          sideId: winnerSideId,
          eliminatedBP,
        };
      }
    }
  }

  const rpEntries = Object.entries(args.missionRpBySide).sort((a, b) => b[1] - a[1]);
  if (rpEntries.length >= 2) {
    const topRp = rpEntries[0];
    const secondRp = rpEntries[1];
    const rpMargin = topRp[1] - secondRp[1];
    const hasUniqueTopRp = rpMargin > 0;
    const dominantRpLead = hasUniqueTopRp && topRp[1] >= secondRp[1] * 2 && rpMargin >= 3;

    if (hasUniqueTopRp) {
      missionVpBySide[topRp[0]] = (missionVpBySide[topRp[0]] ?? 0) + 1;
      if (dominantRpLead) {
        missionVpBySide[topRp[0]] = (missionVpBySide[topRp[0]] ?? 0) + 1;
      }

      rpKeyAward = {
        sideId: topRp[0],
        topRp: topRp[1],
        secondRp: secondRp[1],
        rpMargin,
        totalVpAwarded: dominantRpLead ? 2 : 1,
      };
    }
  }

  return {
    missionVpBySide,
    eliminationKeyWinner,
    rpKeyAward,
  };
}

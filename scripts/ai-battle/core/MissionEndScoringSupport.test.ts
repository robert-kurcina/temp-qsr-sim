import { describe, expect, it } from 'vitest';
import { applyMissionEndScoringForRunner } from './MissionEndScoringSupport';

describe('MissionEndScoringSupport', () => {
  it('awards elimination VP and RP dominance VP', () => {
    const result = applyMissionEndScoringForRunner({
      missionVpBySide: { Alpha: 0, Bravo: 0 },
      missionRpBySide: { Alpha: 20, Bravo: 9 },
      eliminatedBPBySide: { Alpha: 30, Bravo: 10 },
    });

    expect(result.missionVpBySide.Alpha).toBe(3);
    expect(result.missionVpBySide.Bravo).toBe(0);
    expect(result.eliminationKeyWinner).toEqual({
      sideId: 'Alpha',
      eliminatedBP: 30,
    });
    expect(result.rpKeyAward).toEqual({
      sideId: 'Alpha',
      topRp: 20,
      secondRp: 9,
      rpMargin: 11,
      totalVpAwarded: 2,
    });
  });

  it('awards only +1 RP VP when dominance threshold is not reached', () => {
    const result = applyMissionEndScoringForRunner({
      missionVpBySide: { Alpha: 1, Bravo: 2 },
      missionRpBySide: { Alpha: 10, Bravo: 7 },
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
    });

    expect(result.missionVpBySide.Alpha).toBe(2);
    expect(result.missionVpBySide.Bravo).toBe(2);
    expect(result.eliminationKeyWinner).toBeUndefined();
    expect(result.rpKeyAward?.totalVpAwarded).toBe(1);
  });

  it('does not award RP VP when fewer than two sides are present', () => {
    const result = applyMissionEndScoringForRunner({
      missionVpBySide: { Solo: 5 },
      missionRpBySide: { Solo: 12 },
      eliminatedBPBySide: { Solo: 0 },
    });

    expect(result.missionVpBySide.Solo).toBe(5);
    expect(result.rpKeyAward).toBeUndefined();
  });

  it('does not award elimination VP when elimination BP is tied', () => {
    const result = applyMissionEndScoringForRunner({
      missionVpBySide: { Alpha: 2, Bravo: 1 },
      missionRpBySide: { Alpha: 0, Bravo: 0 },
      eliminatedBPBySide: { Alpha: 12, Bravo: 12 },
    });

    expect(result.missionVpBySide.Alpha).toBe(2);
    expect(result.missionVpBySide.Bravo).toBe(1);
    expect(result.eliminationKeyWinner).toBeUndefined();
    expect(result.rpKeyAward).toBeUndefined();
  });

  it('does not award RP VP when top RP is tied', () => {
    const result = applyMissionEndScoringForRunner({
      missionVpBySide: { Alpha: 3, Bravo: 3 },
      missionRpBySide: { Alpha: 5, Bravo: 5 },
      eliminatedBPBySide: { Alpha: 0, Bravo: 0 },
    });

    expect(result.missionVpBySide.Alpha).toBe(3);
    expect(result.missionVpBySide.Bravo).toBe(3);
    expect(result.rpKeyAward).toBeUndefined();
  });
});

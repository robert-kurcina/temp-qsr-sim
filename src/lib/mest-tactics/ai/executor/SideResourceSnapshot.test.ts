import { describe, expect, it } from 'vitest';
import {
  buildResourceSnapshotForCharacterSide,
  cloneSideResourceMaps,
} from './SideResourceSnapshot';

describe('SideResourceSnapshot helpers', () => {
  const missionSides = [
    { id: 'Alpha', state: { victoryPoints: 2, resourcePoints: 5 } },
    { id: 'Bravo', state: { victoryPoints: 1, resourcePoints: 3 } },
  ];

  it('builds snapshot for known side including vp/rp maps and maxTurns', () => {
    const snapshot = buildResourceSnapshotForCharacterSide(missionSides, 'Alpha', 8);
    expect(snapshot.maxTurns).toBe(8);
    expect(snapshot.vpBySide).toEqual({ Alpha: 2, Bravo: 1 });
    expect(snapshot.rpBySide).toEqual({ Alpha: 5, Bravo: 3 });
  });

  it('omits maps when side is unknown but keeps maxTurns', () => {
    const snapshot = buildResourceSnapshotForCharacterSide(missionSides, 'Charlie', undefined, 6);
    expect(snapshot.maxTurns).toBe(6);
    expect(snapshot.vpBySide).toBeUndefined();
    expect(snapshot.rpBySide).toBeUndefined();
  });

  it('returns empty snapshot when side is missing', () => {
    const snapshot = buildResourceSnapshotForCharacterSide(missionSides, null, 7);
    expect(snapshot).toEqual({});
  });

  it('clones resource maps defensively', () => {
    const sourceVp = { Alpha: 4 };
    const sourceRp = { Alpha: 9 };
    const cloned = cloneSideResourceMaps(sourceVp, sourceRp);
    expect(cloned.vpBySide).toEqual({ Alpha: 4 });
    expect(cloned.rpBySide).toEqual({ Alpha: 9 });
    sourceVp.Alpha = 0;
    sourceRp.Alpha = 0;
    expect(cloned.vpBySide.Alpha).toBe(4);
    expect(cloned.rpBySide.Alpha).toBe(9);
  });
});

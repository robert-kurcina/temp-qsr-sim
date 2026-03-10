export interface MissionSideResourceLike {
  id: string;
  state: {
    victoryPoints?: number;
    resourcePoints?: number;
  };
}

export interface SideResourceSnapshot {
  vpBySide?: Record<string, number>;
  rpBySide?: Record<string, number>;
  maxTurns?: number;
}

export function buildResourceSnapshotForCharacterSide(
  missionSides: MissionSideResourceLike[],
  sideId: string | null | undefined,
  maxTurns: number | undefined,
  fallbackMaxTurns: number = 6
): SideResourceSnapshot {
  if (!sideId) {
    return {};
  }

  const snapshot: SideResourceSnapshot = {
    maxTurns: maxTurns ?? fallbackMaxTurns,
  };

  const hasSide = missionSides.some(side => side.id === sideId);
  if (!hasSide) {
    return snapshot;
  }

  const vpBySide: Record<string, number> = {};
  const rpBySide: Record<string, number> = {};
  for (const side of missionSides) {
    vpBySide[side.id] = side.state.victoryPoints ?? 0;
    rpBySide[side.id] = side.state.resourcePoints ?? 0;
  }

  snapshot.vpBySide = vpBySide;
  snapshot.rpBySide = rpBySide;
  return snapshot;
}

export function cloneSideResourceMaps(
  vpBySide: Record<string, number> | undefined,
  rpBySide: Record<string, number> | undefined
): { vpBySide: Record<string, number>; rpBySide: Record<string, number> } {
  return {
    vpBySide: { ...(vpBySide ?? {}) },
    rpBySide: { ...(rpBySide ?? {}) },
  };
}

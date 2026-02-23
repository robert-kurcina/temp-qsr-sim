import { Position } from '../battlefield/Position';
import { ObjectiveMarker } from '../mission/objective-markers';

export interface MissionZone {
  id: string;
  center: Position;
  radius: number;
}

export interface MissionModel {
  id: string;
  sideId: string;
  position: Position;
  baseDiameter?: number;
  bp?: number;
  isKOd?: boolean;
  isEliminated?: boolean;
  isOrdered?: boolean;
  isAttentive?: boolean;
}

export interface MissionScoreDelta {
  vpBySide: Record<string, number>;
  rpBySide: Record<string, number>;
  immediateWinnerSideId?: string;
}

export interface DominanceState {
  vpBySide: Record<string, number>;
}

export interface CourierState {
  vpBySide: Record<string, number>;
  deliveredBySide: Record<string, boolean>;
  revokedBySide: Record<string, boolean>;
}

export interface SanctuaryState {
  vpBySide: Record<string, number>;
}

export interface KeyEventState {
  firstBloodSideId?: string;
  catalystSideId?: string;
  encroachmentSideId?: string;
  acquisitionSideId?: string;
  targetedSideId?: string;
}

export interface ExitState {
  exitedCountBySide: Record<string, number>;
  startingCountBySide: Record<string, number>;
}

export function createEmptyDelta(): MissionScoreDelta {
  return { vpBySide: {}, rpBySide: {} };
}

export function addDelta(target: MissionScoreDelta, sideId: string, vp = 0, rp = 0): MissionScoreDelta {
  if (vp !== 0) target.vpBySide[sideId] = (target.vpBySide[sideId] || 0) + vp;
  if (rp !== 0) target.rpBySide[sideId] = (target.rpBySide[sideId] || 0) + rp;
  return target;
}

export function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isWithinZone(model: MissionModel, zone: MissionZone): boolean {
  return distance(model.position, zone.center) <= zone.radius;
}

export function computeZoneControl(models: MissionModel[], zones: MissionZone[]): Record<string, string | null> {
  const control: Record<string, string | null> = {};
  for (const zone of zones) {
    const presentBySide = new Map<string, number>();
    for (const model of models) {
      if (model.isEliminated) continue;
      if (!isWithinZone(model, zone)) continue;
      presentBySide.set(model.sideId, (presentBySide.get(model.sideId) || 0) + 1);
    }
    if (presentBySide.size === 1) {
      control[zone.id] = Array.from(presentBySide.keys())[0];
    } else {
      control[zone.id] = null;
    }
  }
  return control;
}

export function applyDominanceTurn(
  state: DominanceState,
  controlByZone: Record<string, string | null>,
  winVp?: number
): MissionScoreDelta {
  const delta = createEmptyDelta();
  for (const controller of Object.values(controlByZone)) {
    if (!controller) continue;
    state.vpBySide[controller] = (state.vpBySide[controller] || 0) + 1;
    addDelta(delta, controller, 1, 0);
  }
  if (winVp) {
    for (const [sideId, vp] of Object.entries(state.vpBySide)) {
      if (vp >= winVp) {
        delta.immediateWinnerSideId = sideId;
        break;
      }
    }
  }
  return delta;
}

export function applySanctuaryTurn(
  state: SanctuaryState,
  models: MissionModel[],
  zones: MissionZone[],
  startingBpBySide: Record<string, number>,
  thresholdRatio = 0.25,
  winVp?: number
): MissionScoreDelta {
  const delta = createEmptyDelta();
  const bpBySide: Record<string, number> = {};

  for (const model of models) {
    if (model.isEliminated) continue;
    const inZone = zones.some(zone => isWithinZone(model, zone));
    if (!inZone) continue;
    const bp = model.bp ?? 0;
    bpBySide[model.sideId] = (bpBySide[model.sideId] || 0) + bp;
  }

  for (const [sideId, bp] of Object.entries(bpBySide)) {
    const threshold = (startingBpBySide[sideId] || 0) * thresholdRatio;
    if (bp >= threshold && threshold > 0) {
      state.vpBySide[sideId] = (state.vpBySide[sideId] || 0) + 1;
      addDelta(delta, sideId, 1, 0);
    }
  }

  if (winVp) {
    for (const [sideId, vp] of Object.entries(state.vpBySide)) {
      if (vp >= winVp) {
        delta.immediateWinnerSideId = sideId;
        break;
      }
    }
  }
  return delta;
}

export interface CourierTurnInfo {
  sideId: string;
  inZone: boolean;
  eliminated: boolean;
}

export function applyCourierTurn(
  state: CourierState,
  infos: CourierTurnInfo[],
  options: { revokeOnElimination?: boolean } = {}
): MissionScoreDelta {
  const delta = createEmptyDelta();
  for (const info of infos) {
    if (info.eliminated && options.revokeOnElimination) {
      if (!state.revokedBySide[info.sideId] && (state.vpBySide[info.sideId] || 0) > 0) {
        const revoke = state.vpBySide[info.sideId] || 0;
        state.vpBySide[info.sideId] = 0;
        state.revokedBySide[info.sideId] = true;
        addDelta(delta, info.sideId, -revoke, 0);
      }
      continue;
    }
    if (!info.inZone) continue;
    const delivered = state.deliveredBySide[info.sideId] || false;
    state.vpBySide[info.sideId] = (state.vpBySide[info.sideId] || 0) + 1;
    state.deliveredBySide[info.sideId] = true;
    addDelta(delta, info.sideId, 1, 0);
    if (!delivered) {
      // immediate first delivery already counted above
      continue;
    }
  }
  return delta;
}

export function applyPoiMajority(
  controlByPoi: Record<string, string | null>
): MissionScoreDelta {
  const delta = createEmptyDelta();
  const counts: Record<string, number> = {};
  for (const controller of Object.values(controlByPoi)) {
    if (!controller) continue;
    counts[controller] = (counts[controller] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return delta;
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return delta;
  addDelta(delta, entries[0][0], 1, 0);
  return delta;
}

export function applyCollectionScores(markers: ObjectiveMarker[]): MissionScoreDelta {
  const delta = createEmptyDelta();
  const counts: Record<string, number> = {};
  for (const marker of markers) {
    if (marker.state === 'Destroyed') continue;
    if (!marker.scoringSideId) continue;
    counts[marker.scoringSideId] = (counts[marker.scoringSideId] || 0) + 1;
    addDelta(delta, marker.scoringSideId, 0, 1);
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return delta;
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return delta;
  addDelta(delta, entries[0][0], 1, 0);
  return delta;
}

export function applyAcquisition(state: KeyEventState, sideId: string): MissionScoreDelta {
  const delta = createEmptyDelta();
  if (state.acquisitionSideId) return delta;
  state.acquisitionSideId = sideId;
  addDelta(delta, sideId, 1, 0);
  return delta;
}

export function applyCatalyst(state: KeyEventState, sideId: string): MissionScoreDelta {
  const delta = createEmptyDelta();
  if (state.catalystSideId) return delta;
  state.catalystSideId = sideId;
  addDelta(delta, sideId, 1, 0);
  return delta;
}

export function applyTargeted(state: KeyEventState, sideId: string): MissionScoreDelta {
  const delta = createEmptyDelta();
  if (state.targetedSideId) return delta;
  state.targetedSideId = sideId;
  addDelta(delta, sideId, 1, 0);
  return delta;
}

export function applyEncroachment(state: KeyEventState, sideId: string): MissionScoreDelta {
  const delta = createEmptyDelta();
  if (state.encroachmentSideId) return delta;
  state.encroachmentSideId = sideId;
  addDelta(delta, sideId, 1, 0);
  return delta;
}

export function applySabotage(sideId: string, vpPer = 2): MissionScoreDelta {
  const delta = createEmptyDelta();
  addDelta(delta, sideId, vpPer, 0);
  return delta;
}

export function applyHarvest(sideId: string, vpPer = 1): MissionScoreDelta {
  const delta = createEmptyDelta();
  addDelta(delta, sideId, vpPer, 0);
  return delta;
}

export function applyVipResult(
  protectorSideId: string | null,
  eliminatedBySideId?: string
): MissionScoreDelta {
  const delta = createEmptyDelta();
  if (eliminatedBySideId) {
    addDelta(delta, eliminatedBySideId, 2, 0);
    return delta;
  }
  if (protectorSideId) {
    addDelta(delta, protectorSideId, 1, 0);
  }
  return delta;
}

export function applyExitResult(state: ExitState, sideId: string, exitedCount = 1): MissionScoreDelta {
  const delta = createEmptyDelta();
  state.exitedCountBySide[sideId] = (state.exitedCountBySide[sideId] || 0) + exitedCount;
  const starting = state.startingCountBySide[sideId] || 0;
  if (starting > 0 && state.exitedCountBySide[sideId] >= Math.ceil(starting / 2)) {
    addDelta(delta, sideId, 1, 0);
  }
  return delta;
}

export function applyFlawless(models: MissionModel[]): MissionScoreDelta {
  const delta = createEmptyDelta();
  const activeSides = new Set<string>();
  for (const model of models) {
    if (model.isEliminated || model.isKOd) continue;
    activeSides.add(model.sideId);
  }
  if (activeSides.size === 1) {
    const winner = Array.from(activeSides)[0];
    delta.immediateWinnerSideId = winner;
  }
  return delta;
}

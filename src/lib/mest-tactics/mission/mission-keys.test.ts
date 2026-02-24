import { describe, it, expect } from 'vitest';
import {
  applyAcquisition,
  applyCatalyst,
  applyCollectionScores,
  applyCourierTurn,
  applyDominanceTurn,
  applyEncroachment,
  applyFlawless,
  applyPoiMajority,
  applySanctuaryTurn,
  applyTargeted,
  applyVipResult,
  computeZoneControl,
  createEmptyDelta,
  CourierState,
  DominanceState,
  KeyEventState,
  MissionZone,
  SanctuaryState,
} from '../missions/mission-keys';
import { createObjectiveMarker, ObjectiveMarkerKind } from '../mission/objective-markers';

describe('mission-keys', () => {
  it('computes zone control for dominance', () => {
    const zones: MissionZone[] = [{ id: 'z1', center: { x: 0, y: 0 }, radius: 4 }];
    const control = computeZoneControl([
      { id: 'a', sideId: 'A', position: { x: 1, y: 1 } },
      { id: 'b', sideId: 'B', position: { x: 10, y: 10 } },
    ], zones);
    expect(control.z1).toBe('A');
  });

  it('awards dominance VP and declares winner at threshold', () => {
    const state: DominanceState = { vpBySide: {} };
    const delta = applyDominanceTurn(state, { z1: 'A', z2: null }, 2);
    expect(delta.vpBySide.A).toBe(1);
    const delta2 = applyDominanceTurn(state, { z1: 'A' }, 2);
    expect(delta2.immediateWinnerSideId).toBe('A');
  });

  it('awards sanctuary VP based on BP threshold', () => {
    const state: SanctuaryState = { vpBySide: {} };
    const zones: MissionZone[] = [{ id: 's1', center: { x: 0, y: 0 }, radius: 4 }];
    const delta = applySanctuaryTurn(state, [
      { id: 'a', sideId: 'A', position: { x: 1, y: 1 }, bp: 50 },
      { id: 'b', sideId: 'A', position: { x: 10, y: 10 }, bp: 20 },
    ], zones, { A: 100 }, 0.25);
    expect(delta.vpBySide.A).toBe(1);
  });

  it('awards courier VP per turn and can revoke on elimination', () => {
    const state: CourierState = { vpBySide: {}, deliveredBySide: {}, revokedBySide: {} };
    const delta = applyCourierTurn(state, [{ sideId: 'A', inZone: true, eliminated: false }], { revokeOnElimination: true });
    expect(delta.vpBySide.A).toBe(1);
    const delta2 = applyCourierTurn(state, [{ sideId: 'A', inZone: true, eliminated: true }], { revokeOnElimination: true });
    expect(delta2.vpBySide.A).toBeLessThan(0);
  });

  it('awards POI majority at end game', () => {
    const delta = applyPoiMajority({ p1: 'A', p2: 'A', p3: 'B' });
    expect(delta.vpBySide.A).toBe(1);
  });

  it('awards collection VP and RP from objectives', () => {
    const markers = [
      createObjectiveMarker({ id: 'om1', omTypes: [ObjectiveMarkerKind.Small], position: { x: 0, y: 0 }, scoringSideId: 'A' }),
      createObjectiveMarker({ id: 'om2', omTypes: [ObjectiveMarkerKind.Small], position: { x: 0, y: 0 }, scoringSideId: 'A' }),
      createObjectiveMarker({ id: 'om3', omTypes: [ObjectiveMarkerKind.Small], position: { x: 0, y: 0 }, scoringSideId: 'B' }),
    ];
    const delta = applyCollectionScores(markers);
    expect(delta.vpBySide.A).toBe(1);
    expect(delta.rpBySide.A).toBe(2);
    expect(delta.rpBySide.B).toBe(1);
  });

  it('awards event keys only once', () => {
    const state: KeyEventState = {};
    const delta = applyCatalyst(state, 'A');
    const delta2 = applyCatalyst(state, 'B');
    expect(delta.vpBySide.A).toBe(1);
    expect(delta2.vpBySide.B).toBeUndefined();
    const enc = applyEncroachment(state, 'A');
    const enc2 = applyEncroachment(state, 'B');
    expect(enc.vpBySide.A).toBe(1);
    expect(enc2.vpBySide.B).toBeUndefined();
  });

  it('awards acquisition and targeted events', () => {
    const state: KeyEventState = {};
    const acq = applyAcquisition(state, 'A');
    const targeted = applyTargeted(state, 'B');
    expect(acq.vpBySide.A).toBe(1);
    expect(targeted.vpBySide.B).toBe(1);
  });

  it('awards VIP protection or elimination', () => {
    const protectedDelta = applyVipResult('A');
    expect(protectedDelta.vpBySide.A).toBe(1);
    const eliminatedDelta = applyVipResult(null, 'B');
    expect(eliminatedDelta.vpBySide.B).toBe(2);
  });

  it('declares flawless winner when only one side remains', () => {
    const delta = applyFlawless([
      { id: 'a', sideId: 'A', position: { x: 0, y: 0 }, isEliminated: false, isKOd: false },
      { id: 'b', sideId: 'B', position: { x: 0, y: 0 }, isEliminated: true, isKOd: false },
    ]);
    expect(delta.immediateWinnerSideId).toBe('A');
  });

  it('returns empty delta helper', () => {
    const delta = createEmptyDelta();
    expect(delta.vpBySide).toEqual({});
  });
});

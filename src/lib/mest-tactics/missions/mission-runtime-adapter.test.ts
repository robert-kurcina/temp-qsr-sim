import { describe, it, expect, beforeEach } from 'vitest';
import { buildOpposingSides } from '../mission/MissionSideBuilder';
import { createMissionRuntimeAdapter, createDefaultObjectiveMarker } from './mission-runtime-adapter';

describe('MissionRuntimeAdapter event forwarding semantics', () => {
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];

  beforeEach(() => {
    const sides = buildOpposingSides(
      'Alpha',
      [{ archetypeName: 'Veteran', count: 1 }],
      'Bravo',
      [{ archetypeName: 'Militia', count: 1 }]
    );
    sideA = sides.sideA;
    sideB = sides.sideB;
  });

  it('records first blood exactly once across repeated attacks', () => {
    const adapter = createMissionRuntimeAdapter('QAI_11', [sideA, sideB]);

    const first = adapter.recordAttack(sideA.id, 1);
    expect(first.firstBloodSideId).toBe(sideA.id);
    expect(first.delta.vpBySide).toEqual({} as any); // VP awarded by mission-flow, not here

    const second = adapter.recordAttack(sideB.id, 2);
    // firstBloodSideId remains set to first side, no VP awarded
    expect(second.firstBloodSideId).toBe(first.firstBloodSideId);
    expect(second.delta.vpBySide).toEqual({} as any); // No VP awarded
  });

  it('awards targeted elimination bonus exactly once for the same model', () => {
    const adapter = createMissionRuntimeAdapter('QAI_12', [sideA, sideB]);
    const attackerId = sideA.members[0]?.character.id;
    const victimId = sideB.members[0]?.character.id;
    if (!attackerId || !victimId) {
      throw new Error('Missing test members');
    }

    const first = adapter.onModelEliminated(victimId, attackerId);
    expect(first.delta.vpBySide[sideA.id] ?? 0).toBe(1);

    const second = adapter.onModelEliminated(victimId, attackerId);
    expect(second.delta.vpBySide[sideA.id] ?? 0).toBe(0);
  });

  it('drops carried physical markers on KO/elimination and clears scoring side ownership', () => {
    const adapter = createMissionRuntimeAdapter('QAI_11', [sideA, sideB]);
    const carrierId = sideB.members[0]?.character.id;
    if (!carrierId) {
      throw new Error('Missing carrier model');
    }

    const marker = createDefaultObjectiveMarker('om-carried', { x: 2, y: 2 });
    marker.scoringSideId = sideB.id;
    adapter.objectiveMarkers.addMarker(marker);
    adapter.objectiveMarkers.pickUpMarker(marker.id, carrierId);

    adapter.onCarrierDown(carrierId, { x: 5, y: 5 }, false);
    const droppedAfterKo = adapter.objectiveMarkers.getMarker(marker.id);
    expect(droppedAfterKo).toBeDefined();
    expect(droppedAfterKo?.carriedBy).toBeUndefined();
    expect(droppedAfterKo?.position).toEqual({ x: 5, y: 5 });
    expect(droppedAfterKo?.scoringSideId).toBeUndefined();

    adapter.objectiveMarkers.pickUpMarker(marker.id, carrierId);
    adapter.onCarrierDown(carrierId, { x: 6, y: 6 }, true);
    const droppedAfterElim = adapter.objectiveMarkers.getMarker(marker.id);
    expect(droppedAfterElim).toBeDefined();
    expect(droppedAfterElim?.carriedBy).toBeUndefined();
    expect(droppedAfterElim?.position).toEqual({ x: 6, y: 6 });
    expect(droppedAfterElim?.scoringSideId).toBeUndefined();
  });
});

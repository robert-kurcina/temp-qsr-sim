import { describe, it, expect } from 'vitest';
import { initMissionEngine, applyTurnEnd, applyObjectiveMarkerScoring, applyPoiMajorityScoring, applyFlawlessScoring, applySabotageEvent, applyHarvestEvent } from './mission-engine';
import { createObjectiveMarker } from './mission-objectives';

describe('mission-engine', () => {
  it('applies dominance and sanctuary at turn end', () => {
    const state = initMissionEngine({
      missionId: 'QAI_14',
      gameSize: 'Small',
      sides: [
        { id: 'A', name: 'A', assemblies: [], members: [], totalBP: 100 },
        { id: 'B', name: 'B', assemblies: [], members: [], totalBP: 100 },
      ],
      dominanceZones: [{ id: 'z1', center: { x: 0, y: 0 }, radius: 4 }],
      sanctuaryZones: [{ id: 's1', center: { x: 10, y: 10 }, radius: 4 }],
      startingBpBySide: { A: 100, B: 100 },
    });

    const delta = applyTurnEnd(state, {
      models: [
        { id: 'a1', sideId: 'A', position: { x: 1, y: 1 }, bp: 50 },
        { id: 'a2', sideId: 'A', position: { x: 10, y: 10 }, bp: 50 },
      ],
    });

    expect(delta.vpBySide.A).toBe(2);
    expect(state.vpBySide.A).toBe(2);
  });

  it('scores collection and POI majority', () => {
    const state = initMissionEngine({
      missionId: 'QAI_15',
      gameSize: 'Small',
      sides: [
        { id: 'A', name: 'A', assemblies: [], members: [], totalBP: 100 },
        { id: 'B', name: 'B', assemblies: [], members: [], totalBP: 100 },
      ],
      poiZones: [{ id: 'p1', center: { x: 0, y: 0 }, radius: 4 }],
      objectiveMarkers: [
        createObjectiveMarker({ id: 'om1', kinds: ['Small'], position: { x: 0, y: 0 }, scoringSideId: 'A' }),
        createObjectiveMarker({ id: 'om2', kinds: ['Small'], position: { x: 0, y: 0 }, scoringSideId: 'A' }),
      ],
    });

    const collection = applyObjectiveMarkerScoring(state);
    expect(collection.vpBySide.A).toBe(1);
    expect(collection.rpBySide.A).toBe(2);

    const poi = applyPoiMajorityScoring(state, [
      { id: 'a1', sideId: 'A', position: { x: 1, y: 1 } },
    ]);
    expect(poi.vpBySide.A).toBe(1);
  });

  it('applies flawless end game winner', () => {
    const state = initMissionEngine({
      missionId: 'QAI_1',
      gameSize: 'Small',
      sides: [
        { id: 'A', name: 'A', assemblies: [], members: [], totalBP: 100 },
        { id: 'B', name: 'B', assemblies: [], members: [], totalBP: 100 },
      ],
    });

    const delta = applyFlawlessScoring(state, [
      { id: 'a1', sideId: 'A', position: { x: 0, y: 0 }, isEliminated: false, isKOd: false },
      { id: 'b1', sideId: 'B', position: { x: 0, y: 0 }, isEliminated: true, isKOd: false },
    ]);
    expect(delta.immediateWinnerSideId).toBe('A');
  });

  it('records sabotage and harvest events', () => {
    const state = initMissionEngine({
      missionId: 'QAI_13',
      gameSize: 'Small',
      sides: [
        { id: 'A', name: 'A', assemblies: [], members: [], totalBP: 100 },
        { id: 'B', name: 'B', assemblies: [], members: [], totalBP: 100 },
      ],
    });

    const sabotage = applySabotageEvent(state, { sideId: 'A' });
    const harvest = applyHarvestEvent(state, { sideId: 'B' });
    expect(sabotage.vpBySide.A).toBe(2);
    expect(harvest.vpBySide.B).toBe(1);
  });
});

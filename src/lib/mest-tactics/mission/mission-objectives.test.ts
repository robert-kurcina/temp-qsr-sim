import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObjectiveMarkerKind,
  MarkerState,
  ObjectiveMarkerManager,
  createObjectiveMarker,
} from '../missions/mission-objectives';

describe('mission-objectives', () => {
  let manager: ObjectiveMarkerManager;

  beforeEach(() => {
    manager = new ObjectiveMarkerManager();
  });

  it('acquires a physical objective marker', () => {
    const marker = createObjectiveMarker({ id: 'om1', omTypes: [ObjectiveMarkerKind.Small], position: { x: 0, y: 0 } });
    manager.addMarker(marker);
    const result = manager.acquireMarker('om1', 'A1', 'SideA', { isFree: true });
    expect(result.success).toBe(true);
    expect(result.marker.state).toBe(MarkerState.Carried);
    expect(result.marker.carriedBy).toBe('A1');
    expect(result.marker.scoringSideId).toBe('SideA');
  });

  it('toggles switch objectives and records scoring side', () => {
    const marker = createObjectiveMarker({ id: 'sw1', omTypes: [ObjectiveMarkerKind.Switch], position: { x: 0, y: 0 } });
    manager.addMarker(marker);
    const result = manager.acquireMarker('sw1', 'A1', 'SideA', { isFree: true });
    expect(result.success).toBe(true);
    expect(result.marker.switchState).toBe('On');
    expect(result.marker.scoringSideId).toBe('SideA');
  });

  it('blocks lock toggles without keys', () => {
    const marker = createObjectiveMarker({ id: 'lock1', omTypes: [ObjectiveMarkerKind.Lock], position: { x: 0, y: 0 }, keyIds: ['keyA'] });
    manager.addMarker(marker);
    const result = manager.acquireMarker('lock1', 'A1', 'SideA', { isFree: true, keyIdsInHand: [] });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('Missing required key(s)');
  });

  it('shares idea objectives with hindrance cost', () => {
    const marker = createObjectiveMarker({ id: 'idea1', omTypes: [ObjectiveMarkerKind.Idea], position: { x: 0, y: 0 } });
    manager.addMarker(marker);
    manager.acquireMarker('idea1', 'A1', 'SideA', { isFree: true });
    const result = manager.shareIdea('idea1', 'A1', 'B1', 'SideA', 1);
    expect(result.success).toBe(true);
    expect(result.apCost).toBe(2);
    expect(result.marker.ideaHoldersBySide?.SideA?.sort()).toEqual(['A1', 'B1']);
  });

  it('transfers physical objectives between sides', () => {
    const marker = createObjectiveMarker({
      id: 'om2',
      omTypes: [ObjectiveMarkerKind.Small],
      position: { x: 0, y: 0 },
    });
    manager.addMarker(marker);
    manager.acquireMarker('om2', 'A1', 'SideA', { isFree: true });
    const result = manager.transferMarker('om2', 'B1', 'SideB', { opposingTransfer: true });
    expect(result.success).toBe(true);
    expect(result.marker.carriedBy).toBe('B1');
    expect(result.marker.isNeutral).toBe(true);
  });

  it('drops physical objectives on KO', () => {
    const marker = createObjectiveMarker({
      id: 'om3',
      omTypes: [ObjectiveMarkerKind.Small],
      position: { x: 0, y: 0 },
    });
    manager.addMarker(marker);
    manager.acquireMarker('om3', 'A1', 'SideA', { isFree: true });
    const dropped = manager.dropAllPhysicalMarkers('A1', { x: 2, y: 3 });
    expect(dropped[0].state).toBe(MarkerState.Dropped);
    expect(dropped[0].scoringSideId).toBeUndefined();
    expect(dropped[0].position).toEqual({ x: 2, y: 3 });
  });

  it('destroys physical objectives', () => {
    const marker = createObjectiveMarker({ id: 'om4', omTypes: [ObjectiveMarkerKind.Small], position: { x: 0, y: 0 } });
    manager.addMarker(marker);
    const result = manager.destroyMarker('om4');
    expect(result).toBe(true);
    expect(manager.getMarker('om4')?.state).toBe(MarkerState.Destroyed);
  });
});

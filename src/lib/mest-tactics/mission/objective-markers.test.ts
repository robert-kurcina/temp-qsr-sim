import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObjectiveMarkerManager,
  ObjectiveMarker,
  ObjectiveMarkerType,
  ObjectiveMarkerKind,
  MarkerState,
  createObjectiveMarker,
  createStandardMarkers,
  createBeaconMarkers,
  createIntelMarkers,
  getMarkerAcquireApCost,
} from './objective-markers';

describe('ObjectiveMarkerManager', () => {
  let manager: ObjectiveMarkerManager;

  beforeEach(() => {
    manager = new ObjectiveMarkerManager();
  });

  describe('createObjectiveMarker', () => {
    it('should create a marker with defaults', () => {
      const marker = createObjectiveMarker();

      expect(marker.type).toBe(ObjectiveMarkerType.Standard);
      expect(marker.state).toBe(MarkerState.Scored); // No position = scored
      expect(marker.victoryPoints).toBe(1);
      expect(marker.omTypes).toContain(ObjectiveMarkerKind.Tiny);
    });

    it('should create a marker with custom config', () => {
      const marker = createObjectiveMarker({
        id: 'test-marker',
        name: 'Test Marker',
        type: ObjectiveMarkerType.HighValue,
        omTypes: [ObjectiveMarkerKind.Small],
        victoryPoints: 3,
        position: { x: 5, y: 5 },
        placedBy: 'SideA',
      });

      expect(marker.id).toBe('test-marker');
      expect(marker.name).toBe('Test Marker');
      expect(marker.type).toBe(ObjectiveMarkerType.HighValue);
      expect(marker.omTypes).toContain(ObjectiveMarkerKind.Small);
      expect(marker.victoryPoints).toBe(3);
      expect(marker.position).toEqual({ x: 5, y: 5 });
      expect(marker.placedBy).toBe('SideA');
      expect(marker.state).toBe(MarkerState.Available);
    });
  });

  describe('addMarker / getMarker', () => {
    it('should add and retrieve a marker', () => {
      const marker = createObjectiveMarker({ id: 'test-1' });
      manager.addMarker(marker);

      const retrieved = manager.getMarker('test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('test-1');
    });

    it('should return undefined for unknown marker', () => {
      const retrieved = manager.getMarker('unknown');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllMarkers', () => {
    it('should return all markers', () => {
      manager.addMarker(createObjectiveMarker({ id: 'm1' }));
      manager.addMarker(createObjectiveMarker({ id: 'm2' }));
      manager.addMarker(createObjectiveMarker({ id: 'm3' }));

      const all = manager.getAllMarkers();
      expect(all.length).toBe(3);
    });
  });

  describe('getMarkersByState', () => {
    it('should return markers with specified state', () => {
      const available = createObjectiveMarker({ id: 'avail', position: { x: 1, y: 1 } });
      const carried = createObjectiveMarker({ id: 'carried' });
      carried.state = MarkerState.Carried;
      const scored = createObjectiveMarker({ id: 'scored' });
      scored.state = MarkerState.Scored;

      manager.addMarker(available);
      manager.addMarker(carried);
      manager.addMarker(scored);

      const availableMarkers = manager.getMarkersByState(MarkerState.Available);
      expect(availableMarkers.length).toBe(1);
      expect(availableMarkers[0].id).toBe('avail');
    });
  });

  describe('getMarkersByType', () => {
    it('should return markers with specified type', () => {
      const standard = createObjectiveMarker({ id: 'std', type: ObjectiveMarkerType.Standard });
      const beacon = createObjectiveMarker({ id: 'beacon', type: ObjectiveMarkerType.Beacon });
      const intel = createObjectiveMarker({ id: 'intel', type: ObjectiveMarkerType.Intel });

      manager.addMarker(standard);
      manager.addMarker(beacon);
      manager.addMarker(intel);

      const beacons = manager.getMarkersByType(ObjectiveMarkerType.Beacon);
      expect(beacons.length).toBe(1);
      expect(beacons[0].id).toBe('beacon');
    });
  });

  describe('getMarkersControlledBy', () => {
    it('should return markers controlled by a side', () => {
      const markerA1 = createObjectiveMarker({ id: 'a1', position: { x: 1, y: 1 } });
      const markerA2 = createObjectiveMarker({ id: 'a2', position: { x: 2, y: 2 } });
      const markerB = createObjectiveMarker({ id: 'b', position: { x: 3, y: 3 } });

      markerA1.controlledBy = 'SideA';
      markerA2.controlledBy = 'SideA';
      markerB.controlledBy = 'SideB';

      manager.addMarker(markerA1);
      manager.addMarker(markerA2);
      manager.addMarker(markerB);

      const sideAMarkers = manager.getMarkersControlledBy('SideA');
      expect(sideAMarkers.length).toBe(2);
    });
  });

  describe('getMarkersCarriedBy', () => {
    it('should return markers carried by a model', () => {
      const marker1 = createObjectiveMarker({ id: 'm1' });
      const marker2 = createObjectiveMarker({ id: 'm2' });
      const marker3 = createObjectiveMarker({ id: 'm3' });

      marker1.carriedBy = 'model-1';
      marker1.state = MarkerState.Carried;
      marker2.carriedBy = 'model-1';
      marker2.state = MarkerState.Carried;
      marker3.carriedBy = 'model-2';
      marker3.state = MarkerState.Carried;

      manager.addMarker(marker1);
      manager.addMarker(marker2);
      manager.addMarker(marker3);

      const carried = manager.getMarkersCarriedBy('model-1');
      expect(carried.length).toBe(2);
    });
  });

  describe('placeMarker', () => {
    it('should place a marker on the battlefield', () => {
      const marker = createObjectiveMarker({ id: 'm1' });
      marker.state = MarkerState.Carried;
      manager.addMarker(marker);

      const result = manager.placeMarker('m1', { x: 5, y: 5 });

      expect(result.success).toBe(true);
      expect(result.marker.position).toEqual({ x: 5, y: 5 });
      expect(result.marker.state).toBe(MarkerState.Available);
      expect(result.marker.carriedBy).toBeUndefined();
    });

    it('should fail for unknown marker', () => {
      const result = manager.placeMarker('unknown', { x: 5, y: 5 });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Marker not found');
    });
  });

  describe('pickUpMarker', () => {
    it('should pick up an available marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      manager.addMarker(marker);

      const result = manager.pickUpMarker('m1', 'model-1');

      expect(result.success).toBe(true);
      expect(result.marker.carriedBy).toBe('model-1');
      expect(result.marker.state).toBe(MarkerState.Carried);
      expect(result.marker.position).toBeUndefined();
    });

    it('should pick up a dropped marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      marker.state = MarkerState.Dropped;
      manager.addMarker(marker);

      const result = manager.pickUpMarker('m1', 'model-1');

      expect(result.success).toBe(true);
      expect(result.marker.carriedBy).toBe('model-1');
    });

    it('should fail for already carried marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', omTypes: [ObjectiveMarkerKind.Tiny] });
      marker.state = MarkerState.Carried;
      marker.carriedBy = 'other-model';
      manager.addMarker(marker);

      const result = manager.pickUpMarker('m1', 'model-1');

      expect(result.success).toBe(false);
    });

    it('should fail for scored marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', omTypes: [ObjectiveMarkerKind.Tiny] });
      marker.state = MarkerState.Scored;
      manager.addMarker(marker);

      const result = manager.pickUpMarker('m1', 'model-1');

      expect(result.success).toBe(false);
    });
  });

  describe('dropMarker', () => {
    it('should drop a carried marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', omTypes: [ObjectiveMarkerKind.Tiny] });
      marker.state = MarkerState.Carried;
      marker.carriedBy = 'model-1';
      manager.addMarker(marker);

      const result = manager.dropMarker('m1', { x: 5, y: 5 });

      expect(result.success).toBe(true);
      expect(result.marker.position).toEqual({ x: 5, y: 5 });
      expect(result.marker.state).toBe(MarkerState.Dropped);
      expect(result.marker.carriedBy).toBeUndefined();
    });

    it('should fail for non-carried marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      manager.addMarker(marker);

      const result = manager.dropMarker('m1', { x: 5, y: 5 });

      expect(result.success).toBe(false);
    });
  });

  describe('scoreMarker', () => {
    it('should score a marker and award VP', () => {
      const marker = createObjectiveMarker({ id: 'm1', victoryPoints: 2, position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      manager.addMarker(marker);

      const result = manager.scoreMarker('m1', 'SideA');

      expect(result.success).toBe(true);
      expect(result.marker.state).toBe(MarkerState.Scored);
      expect(result.marker.controlledBy).toBe('SideA');
      expect(result.victoryPointsAwarded).toBe(2);
      expect(result.newController).toBe('SideA');
    });

    it('should track previous controller', () => {
      const marker = createObjectiveMarker({ id: 'm1', position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      marker.controlledBy = 'SideB';
      manager.addMarker(marker);

      const result = manager.scoreMarker('m1', 'SideA');

      expect(result.previousController).toBe('SideB');
      expect(result.newController).toBe('SideA');
    });
  });

  describe('transferControl', () => {
    it('should transfer control without scoring', () => {
      const marker = createObjectiveMarker({ id: 'm1', position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      marker.controlledBy = 'SideB';
      manager.addMarker(marker);

      const result = manager.transferControl('m1', 'SideA');

      expect(result.success).toBe(true);
      expect(result.marker.controlledBy).toBe('SideA');
      expect(result.marker.state).toBe(MarkerState.Available); // Not scored
      expect(result.victoryPointsAwarded).toBe(0);
    });
  });

  describe('destroyMarker', () => {
    it('should destroy a marker', () => {
      const marker = createObjectiveMarker({ id: 'm1', position: { x: 5, y: 5 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      manager.addMarker(marker);

      const result = manager.destroyMarker('m1');

      expect(result).toBe(true);
      expect(manager.getMarker('m1')?.state).toBe(MarkerState.Destroyed);
    });

    it('should return false for unknown marker', () => {
      const result = manager.destroyMarker('unknown');
      expect(result).toBe(false);
    });
  });

  describe('getTotalVictoryPoints', () => {
    it('should calculate total VP for a side', () => {
      const marker1 = createObjectiveMarker({ id: 'm1', victoryPoints: 1, position: { x: 1, y: 1 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      const marker2 = createObjectiveMarker({ id: 'm2', victoryPoints: 2, position: { x: 2, y: 2 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      const marker3 = createObjectiveMarker({ id: 'm3', victoryPoints: 3, position: { x: 3, y: 3 }, omTypes: [ObjectiveMarkerKind.Tiny] });

      marker1.controlledBy = 'SideA';
      marker2.controlledBy = 'SideA';
      marker3.controlledBy = 'SideB';

      manager.addMarker(marker1);
      manager.addMarker(marker2);
      manager.addMarker(marker3);

      const sideAVP = manager.getTotalVictoryPoints('SideA');
      const sideBVP = manager.getTotalVictoryPoints('SideB');

      expect(sideAVP).toBe(3); // 1 + 2
      expect(sideBVP).toBe(3);
    });
  });

  describe('getCountByState', () => {
    it('should return count of markers in a state', () => {
      const available = createObjectiveMarker({ id: 'a', position: { x: 1, y: 1 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      const carried1 = createObjectiveMarker({ id: 'c1', omTypes: [ObjectiveMarkerKind.Tiny] });
      const carried2 = createObjectiveMarker({ id: 'c2', omTypes: [ObjectiveMarkerKind.Tiny] });
      carried1.state = MarkerState.Carried;
      carried2.state = MarkerState.Carried;

      manager.addMarker(available);
      manager.addMarker(carried1);
      manager.addMarker(carried2);

      expect(manager.getCountByState(MarkerState.Available)).toBe(1);
      expect(manager.getCountByState(MarkerState.Carried)).toBe(2);
    });
  });

  describe('exportState / importState', () => {
    it('should export and import marker state', () => {
      const marker1 = createObjectiveMarker({ id: 'm1', position: { x: 1, y: 1 }, omTypes: [ObjectiveMarkerKind.Tiny] });
      const marker2 = createObjectiveMarker({ id: 'm2', victoryPoints: 2, omTypes: [ObjectiveMarkerKind.Tiny] });
      marker2.controlledBy = 'SideA';

      manager.addMarker(marker1);
      manager.addMarker(marker2);

      const exported = manager.exportState();
      const newManager = new ObjectiveMarkerManager();
      newManager.importState(exported);

      expect(newManager.getMarker('m1')?.position).toEqual({ x: 1, y: 1 });
      expect(newManager.getMarker('m2')?.victoryPoints).toBe(2);
      expect(newManager.getMarker('m2')?.controlledBy).toBe('SideA');
    });
  });

  describe('clear', () => {
    it('should remove all markers', () => {
      manager.addMarker(createObjectiveMarker({ id: 'm1', omTypes: [ObjectiveMarkerKind.Tiny] }));
      manager.addMarker(createObjectiveMarker({ id: 'm2', omTypes: [ObjectiveMarkerKind.Tiny] }));

      manager.clear();

      expect(manager.getAllMarkers().length).toBe(0);
    });
  });
});

describe('QSR OM actions', () => {
  let manager: ObjectiveMarkerManager;

  beforeEach(() => {
    manager = new ObjectiveMarkerManager();
  });

  it('should toggle a Switch OM and award scoring side', () => {
    const marker = createObjectiveMarker({
      id: 'switch-1',
      position: { x: 2, y: 2 },
      omTypes: [ObjectiveMarkerKind.Switch],
    });
    manager.addMarker(marker);

    const result = manager.acquireMarker('switch-1', 'model-1', 'SideA', { isFree: true });
    expect(result.success).toBe(true);
    expect(result.switchToggled).toBe(true);
    expect(result.marker.scoringSideId).toBe('SideA');
  });

  it('should acquire a Tiny Physical OM with 2 AP cost', () => {
    const marker = createObjectiveMarker({
      id: 'tiny-1',
      position: { x: 2, y: 2 },
      omTypes: [ObjectiveMarkerKind.Tiny],
    });
    manager.addMarker(marker);

    const result = manager.acquireMarker('tiny-1', 'model-1', 'SideA');
    expect(result.success).toBe(true);
    expect(result.apCost).toBe(2);
    expect(result.marker.state).toBe(MarkerState.Carried);
  });

  it('should acquire an Idea OM and track holders', () => {
    const marker = createObjectiveMarker({
      id: 'idea-1',
      position: { x: 2, y: 2 },
      omTypes: [ObjectiveMarkerKind.Idea],
    });
    manager.addMarker(marker);

    const result = manager.acquireMarker('idea-1', 'model-1', 'SideA');
    expect(result.success).toBe(true);
    expect(result.marker.ideaHoldersBySide?.SideA).toContain('model-1');
  });

  it('should share an Idea OM with AP cost', () => {
    const marker = createObjectiveMarker({
      id: 'idea-2',
      position: { x: 2, y: 2 },
      omTypes: [ObjectiveMarkerKind.Idea],
    });
    manager.addMarker(marker);

    manager.acquireMarker('idea-2', 'model-1', 'SideA');
    const result = manager.shareIdea('idea-2', 'model-1', 'model-2', 'SideA', 2);
    expect(result.success).toBe(true);
    expect(result.apCost).toBe(3);
    expect(result.marker.ideaHoldersBySide?.SideA).toContain('model-2');
  });

  it('should mark transferred Physical OM as neutral when opposing', () => {
    const marker = createObjectiveMarker({
      id: 'phys-1',
      position: { x: 2, y: 2 },
      omTypes: [ObjectiveMarkerKind.Small],
    });
    manager.addMarker(marker);

    manager.acquireMarker('phys-1', 'model-1', 'SideA');
    const transfer = manager.transferMarker('phys-1', 'model-2', 'SideB', { opposingTransfer: true });
    expect(transfer.success).toBe(true);
    expect(transfer.marker.isNeutral).toBe(true);
  });

  it('should drop all physical markers and clear scoring side on KO', () => {
    const marker = createObjectiveMarker({
      id: 'phys-2',
      position: { x: 2, y: 2 },
      omTypes: [ObjectiveMarkerKind.Large],
    });
    manager.addMarker(marker);

    manager.acquireMarker('phys-2', 'model-1', 'SideA');
    const dropped = manager.dropAllPhysicalMarkers('model-1', { x: 5, y: 5 });
    expect(dropped.length).toBe(1);
    expect(dropped[0].state).toBe(MarkerState.Dropped);
    expect(dropped[0].scoringSideId).toBeUndefined();
  });

  it('should calculate AP cost for Tiny OM', () => {
    const marker = createObjectiveMarker({
      id: 'tiny-2',
      omTypes: [ObjectiveMarkerKind.Tiny],
    });
    expect(getMarkerAcquireApCost(marker)).toBe(2);
  });
});

describe('Marker creation helpers', () => {
  describe('createStandardMarkers', () => {
    it('should create standard markers', () => {
      const markers = createStandardMarkers(3, { victoryPoints: 1 });

      expect(markers.length).toBe(3);
      expect(markers.every(m => m.type === ObjectiveMarkerType.Standard)).toBe(true);
      expect(markers.every(m => m.victoryPoints === 1)).toBe(true);
    });

    it('should create markers with positions', () => {
      const positions = [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
      const markers = createStandardMarkers(3, { positions });

      expect(markers[0].position).toEqual({ x: 1, y: 1 });
      expect(markers[1].position).toEqual({ x: 2, y: 2 });
      expect(markers[2].position).toEqual({ x: 3, y: 3 });
    });
  });

  describe('createBeaconMarkers', () => {
    it('should create beacon markers', () => {
      const markers = createBeaconMarkers(3);

      expect(markers.length).toBe(3);
      expect(markers.every(m => m.type === ObjectiveMarkerType.Beacon)).toBe(true);
      expect(markers.every(m => m.victoryPoints === 2)).toBe(true);
    });
  });

  describe('createIntelMarkers', () => {
    it('should create intel markers', () => {
      const markers = createIntelMarkers(3);

      expect(markers.length).toBe(3);
      expect(markers.every(m => m.type === ObjectiveMarkerType.Intel)).toBe(true);
      expect(markers.every(m => m.victoryPoints === 3)).toBe(true);
    });
  });
});

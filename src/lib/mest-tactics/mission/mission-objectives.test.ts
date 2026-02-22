import { describe, it, expect } from 'vitest';
import {
  acquireObjectiveMarker,
  createObjectiveMarker,
  dropObjectiveMarker,
  shareObjectiveMarker,
  transferObjectiveMarker,
  destroyObjectiveMarker,
} from '../missions/mission-objectives';

describe('mission-objectives', () => {
  it('acquires a physical objective marker', () => {
    const marker = createObjectiveMarker({ id: 'om1', kinds: ['Small'], position: { x: 0, y: 0 } });
    const result = acquireObjectiveMarker(marker, {
      actorId: 'A1',
      sideId: 'SideA',
      apAvailable: 2,
      isFree: true,
      isAttentive: true,
      isOrdered: true,
      opposingAttentiveInContact: 0,
    });
    expect(result.success).toBe(true);
    expect(result.marker.state).toBe('Carried');
    expect(result.marker.ownerSideId).toBe('SideA');
    expect(result.marker.carrierId).toBe('A1');
    expect(result.marker.scoringSideId).toBe('SideA');
  });

  it('toggles switch objectives and records scoring side', () => {
    const marker = createObjectiveMarker({ id: 'sw1', kinds: ['Switch'], position: { x: 0, y: 0 } });
    const result = acquireObjectiveMarker(marker, {
      actorId: 'A1',
      sideId: 'SideA',
      apAvailable: 1,
      isFree: true,
      isAttentive: true,
      isOrdered: true,
      opposingAttentiveInContact: 0,
    });
    expect(result.success).toBe(true);
    expect(result.marker.switchState).toBe('On');
    expect(result.marker.scoringSideId).toBe('SideA');
  });

  it('blocks lock toggles without keys', () => {
    const marker = createObjectiveMarker({ id: 'lock1', kinds: ['Lock'], position: { x: 0, y: 0 }, keyId: 'keyA' });
    const result = acquireObjectiveMarker(marker, {
      actorId: 'A1',
      sideId: 'SideA',
      apAvailable: 1,
      isFree: true,
      isAttentive: true,
      isOrdered: true,
      opposingAttentiveInContact: 0,
    });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('missing-key');
  });

  it('shares idea objectives with hindrance cost', () => {
    const marker = createObjectiveMarker({ id: 'idea1', kinds: ['Idea'], position: { x: 0, y: 0 } });
    const result = shareObjectiveMarker(marker, {
      actorId: 'A1',
      sideId: 'SideA',
      apAvailable: 3,
      isFree: true,
      isAttentive: true,
      isOrdered: true,
      opposingAttentiveInContact: 0,
      hindrance: 1,
    }, 'SideB');
    expect(result.success).toBe(true);
    expect(result.apCost).toBe(2);
    expect(result.marker.sharedSideIds?.sort()).toEqual(['SideA', 'SideB']);
  });

  it('transfers physical objectives between sides', () => {
    const marker = createObjectiveMarker({
      id: 'om2',
      kinds: ['Small'],
      position: { x: 0, y: 0 },
      state: 'Carried',
      carrierId: 'A1',
      ownerSideId: 'SideA',
    });
    const result = transferObjectiveMarker(marker, {
      actorId: 'A1',
      sideId: 'SideA',
      apAvailable: 1,
      isFree: true,
      isAttentive: true,
      isOrdered: true,
      opposingAttentiveInContact: 0,
    }, 'SideB', 'B1');
    expect(result.success).toBe(true);
    expect(result.marker.ownerSideId).toBe('SideB');
    expect(result.marker.carrierId).toBe('B1');
  });

  it('drops physical objectives on KO', () => {
    const marker = createObjectiveMarker({
      id: 'om3',
      kinds: ['Small'],
      position: { x: 0, y: 0 },
      state: 'Carried',
      carrierId: 'A1',
      ownerSideId: 'SideA',
    });
    const dropped = dropObjectiveMarker(marker, { x: 2, y: 3 });
    expect(dropped.state).toBe('Neutral');
    expect(dropped.ownerSideId).toBeUndefined();
    expect(dropped.position).toEqual({ x: 2, y: 3 });
  });

  it('destroys physical objectives', () => {
    const marker = createObjectiveMarker({ id: 'om4', kinds: ['Small'], position: { x: 0, y: 0 } });
    const result = destroyObjectiveMarker(marker, {
      actorId: 'A1',
      sideId: 'SideA',
      apAvailable: 1,
      isFree: true,
      isAttentive: true,
      isOrdered: true,
      opposingAttentiveInContact: 0,
    });
    expect(result.success).toBe(true);
    expect(result.marker.state).toBe('Destroyed');
  });
});

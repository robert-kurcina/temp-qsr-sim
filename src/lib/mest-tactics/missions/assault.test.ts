import { describe, it, expect, beforeEach } from 'vitest';
import { createAssaultMission, AssaultMissionManager } from './assault-manager';
import { buildOpposingSides } from '../mission/MissionSideBuilder';
import { ModelSlotStatus } from '../mission/MissionSide';
import { Position } from '../battlefield/Position';

describe('Assault Mission', () => {
  let manager: AssaultMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];

  const toSpatialModel = (member: { id: string; position?: Position | null }) => ({
    id: member.id,
    position: member.position ?? { x: 0, y: 0 },
    baseDiameter: 1,
    siz: 3,
  });

  beforeEach(() => {
    const result = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 3 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 3 }]
    );
    sideA = result.sideA;
    sideB = result.sideB;

    const markerPositions: Position[] = [
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 6, y: 18 },
      { x: 18, y: 18 },
    ];

    manager = createAssaultMission([sideA, sideB], markerPositions);
  });

  describe('createAssaultMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should create assault markers', () => {
      const markers = manager.getAllMarkers();
      expect(markers.length).toBe(4);
      expect(markers[0].id).toBe('assault-1');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should have first marker as high value', () => {
      const markers = manager.getAllMarkers();
      expect(markers[0].assaultVP).toBe(5);
    });

    it('should have resource markers', () => {
      const markers = manager.getAllMarkers();
      // Every 3rd marker is a resource (0-indexed: 0, 3, 6...)
      const resources = markers.filter(m => m.type === 'Resource' as any);
      expect(resources.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('assaultMarker', () => {
    it('should successfully assault a marker', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // Adjacent to marker 1

      const result = manager.assaultMarker(sideA.members[0].id, 'assault-1');

      expect(result.success).toBe(true);
      expect(result.vpAwarded).toBe(5); // High value marker
      expect(manager.getMarker('assault-1')?.assaulted).toBe(true);
    });

    it('should award VP for assault', () => {
      sideA.members[0].position = { x: 6, y: 6 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1');

      expect(manager.getVictoryPoints(sideA.id)).toBe(5);
    });

    it('should fail if marker already assaulted', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      manager.assaultMarker(sideA.members[0].id, 'assault-1');

      const result = manager.assaultMarker(sideA.members[0].id, 'assault-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Marker already assaulted');
    });

    it('should fail if model not adjacent to marker', () => {
      sideA.members[0].position = { x: 20, y: 20 }; // Far from marker

      const result = manager.assaultMarker(sideA.members[0].id, 'assault-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Model not adjacent to marker');
    });

    it('should track assault count', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 6 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1');
      manager.assaultMarker(sideA.members[1].id, 'assault-2');

      expect(manager.getAssaultCount(sideA.id)).toBe(2);
    });
  });

  describe('harvestMarker', () => {
    it('should successfully harvest a resource marker', () => {
      // Marker 4 (index 3) is a resource (i % 3 === 0, but i=0 is HighValue)
      sideA.members[0].position = { x: 18, y: 18 };

      const result = manager.harvestMarker(sideA.members[0].id, 'assault-4');

      expect(result.success).toBe(true);
      expect(result.vpAwarded).toBe(1);
    });

    it('should fail if marker is not a resource', () => {
      sideA.members[0].position = { x: 18, y: 6 }; // Marker 2 is not a resource

      const result = manager.harvestMarker(sideA.members[0].id, 'assault-2');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Marker is not a resource');
    });

    it('should allow multiple harvests of resource', () => {
      sideA.members[0].position = { x: 18, y: 18 }; // Marker 4 is resource

      const result1 = manager.harvestMarker(sideA.members[0].id, 'assault-4');
      const result2 = manager.harvestMarker(sideA.members[0].id, 'assault-4');
      const result3 = manager.harvestMarker(sideA.members[0].id, 'assault-4');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });

    it('should fail when resource is depleted', () => {
      sideA.members[0].position = { x: 18, y: 18 };

      manager.harvestMarker(sideA.members[0].id, 'assault-4');
      manager.harvestMarker(sideA.members[0].id, 'assault-4');
      manager.harvestMarker(sideA.members[0].id, 'assault-4');
      const result4 = manager.harvestMarker(sideA.members[0].id, 'assault-4');

      expect(result4.success).toBe(false);
      expect(result4.reason).toBe('Resource depleted');
    });

    it('should track harvest count', () => {
      sideA.members[0].position = { x: 18, y: 18 };

      manager.harvestMarker(sideA.members[0].id, 'assault-4');
      manager.harvestMarker(sideA.members[0].id, 'assault-4');

      expect(manager.getHarvestCount(sideA.id)).toBe(2);
    });
  });

  describe('checkForVictory', () => {
    it('should detect victory when one side assaults all markers', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 6 };
      sideA.members[2].position = { x: 6, y: 18 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1');
      manager.assaultMarker(sideA.members[1].id, 'assault-2');
      manager.assaultMarker(sideA.members[2].id, 'assault-3');

      // Assault the 4th marker
      sideA.members[0].position = { x: 18, y: 18 };
      manager.assaultMarker(sideA.members[0].id, 'assault-4');

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Assaulted all objectives');
    });

    it('should end game when all markers are assaulted by any sides', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideB.members[0].position = { x: 18, y: 6 };
      sideA.members[1].position = { x: 6, y: 18 };
      sideB.members[1].position = { x: 18, y: 18 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1');
      manager.assaultMarker(sideB.members[0].id, 'assault-2');
      manager.assaultMarker(sideA.members[1].id, 'assault-3');
      manager.assaultMarker(sideB.members[1].id, 'assault-4');

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      // Winner determined by VP
      expect(manager.getWinner()).toBeDefined();
      expect(manager.getEndReason()).toBe('All objectives assaulted');
    });

    it('should not end if markers remain', () => {
      sideA.members[0].position = { x: 6, y: 6 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1');

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });
  });

  describe('endMission', () => {
    it('should end mission with winner', () => {
      manager.endMission(sideA.id, 'Test victory');

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Test victory');
    });

    it('should determine VP winner if no winner specified', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      manager.assaultMarker(sideA.members[0].id, 'assault-1');

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should only consider active models for VP victory', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      manager.assaultMarker(sideA.members[0].id, 'assault-1');

      sideA.members.forEach(m => m.status = ModelSlotStatus.Eliminated);
      manager.endMission(undefined, 'Turn limit');

      // Side B should win by default (only active side)
      expect(manager.getWinner()).toBe(sideB.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideB.members[0].position = { x: 18, y: 6 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1'); // 5 VP
      manager.assaultMarker(sideB.members[0].id, 'assault-2'); // 3 VP

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].sideId).toBe(sideA.id);
      expect(standings[0].vp).toBe(5);
      expect(standings[1].sideId).toBe(sideB.id);
      expect(standings[1].vp).toBe(3);
    });

    it('should include assault and harvest counts', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 18 };

      manager.assaultMarker(sideA.members[0].id, 'assault-1');
      manager.harvestMarker(sideA.members[1].id, 'assault-4');

      const standings = manager.getVPStandings();

      expect(standings[0].assaults).toBe(1);
      expect(standings[0].harvests).toBe(1);
    });
  });
});

describe('Assault Mission - Edge Cases', () => {
  describe('Multiple markers', () => {
    it('should handle 6 markers', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 6 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 6 }]
      );

      const markerPositions: Position[] = [
        { x: 6, y: 6 },
        { x: 18, y: 6 },
        { x: 6, y: 18 },
        { x: 18, y: 18 },
        { x: 12, y: 12 },
        { x: 12, y: 3 },
      ];

      const manager = createAssaultMission([result.sideA, result.sideB], markerPositions, 6);

      const markers = manager.getAllMarkers();
      expect(markers.length).toBe(6);

      // Assault all 6 markers
      result.sideA.members.forEach((m, i) => {
        m.position = markerPositions[i];
      });

      for (let i = 0; i < 6; i++) {
        manager.assaultMarker(result.sideA.members[i].id, `assault-${i + 1}`);
      }

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });

  describe('Mixed assault and harvest', () => {
    it('should allow both strategies', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );

      // Use 4 markers so marker 4 (index 3) is a resource
      const manager = createAssaultMission([result.sideA, result.sideB], [
        { x: 6, y: 6 },
        { x: 18, y: 6 },
        { x: 6, y: 18 },
        { x: 18, y: 18 }, // Resource marker (index 3, 3 % 3 === 0)
      ], 4);

      result.sideA.members[0].position = { x: 18, y: 18 }; // Resource marker

      // Harvest 3 times
      manager.harvestMarker(result.sideA.members[0].id, 'assault-4');
      manager.harvestMarker(result.sideA.members[0].id, 'assault-4');
      manager.harvestMarker(result.sideA.members[0].id, 'assault-4');

      // Now assault it
      const assaultResult = manager.assaultMarker(result.sideA.members[0].id, 'assault-4');

      expect(assaultResult.success).toBe(true);
      expect(manager.getVictoryPoints(result.sideA.id)).toBe(6); // 3 harvest (1 VP each) + 3 assault
    });
  });
});

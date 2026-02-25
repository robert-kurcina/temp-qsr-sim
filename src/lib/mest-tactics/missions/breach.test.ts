import { describe, it, expect, beforeEach } from 'vitest';
import { createBreachMission, BreachMissionManager } from './breach-manager';
import { buildOpposingSides } from '../mission/MissionSideBuilder';
import { ModelSlotStatus } from '../mission/MissionSide';
import { Position } from '../battlefield/Position';

describe('Breach Mission', () => {
  let manager: BreachMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];

  beforeEach(() => {
    const result = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 4 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 4 }]
    );
    sideA = result.sideA;
    sideB = result.sideB;

    manager = createBreachMission([sideA, sideB]);
  });

  describe('createBreachMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should create markers', () => {
      const markers = manager.getMarkers();
      expect(markers.length).toBe(5);
      expect(markers[0].name).toContain('Breach Marker');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should initialize markers as uncontrolled', () => {
      const controllers = manager.getMarkerControllers();
      expect(controllers.size).toBeGreaterThanOrEqual(5);
      for (const controller of controllers.values()) {
        expect(controller).toBeNull();
      }
    });

    it('should set breach turns to [4, 8] by default', () => {
      const breachTurns = manager.getBreachTurns();
      expect(breachTurns).toEqual([4, 8]);
    });
  });

  describe('updateMarkerControl', () => {
    it('should control marker with single side present', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // In marker 1

      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      expect(manager.getMarkerController('breach-marker-1')).toBe(sideA.id);
    });

    it('should contest marker with multiple sides present', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      expect(manager.getMarkerController('breach-marker-1')).toBeNull();
    });

    it('should uncontrol marker with no models', () => {
      sideA.members[0].position = { x: 3, y: 3 }; // Not in any marker

      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      expect(manager.getMarkerController('breach-marker-1')).toBeNull();
    });
  });

  describe('attemptControlMarker', () => {
    it('should allow manual marker control when actor side is alone in zone', () => {
      sideA.members[0].position = { x: 12, y: 6 };

      const result = manager.attemptControlMarker(sideA.members[0].id, 'breach-marker-1');

      expect(result.success).toBe(true);
      expect(result.newController).toBe(sideA.id);
      expect(manager.getMarkerController('breach-marker-1')).toBe(sideA.id);
    });

    it('should fail manual control when marker is contested', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      const result = manager.attemptControlMarker(sideA.members[0].id, 'breach-marker-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('contested');
      expect(manager.getMarkerController('breach-marker-1')).toBeNull();
    });

    it('should fail manual control when marker is already controlled by actor side', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const result = manager.attemptControlMarker(sideA.members[0].id, 'breach-marker-1');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('already controlled');
    });
  });

  describe('executeSwitches', () => {
    it('should not switch on non-switch turns', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const results = manager.executeSwitches(2);

      expect(results.length).toBe(0);
    });

    it('should switch markers on turn 4', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const results = manager.executeSwitches(4);

      // Should have switched from Side A to Side B
      const switched = results.find(r => r.markerId === 'breach-marker-1');
      expect(switched?.switched).toBe(true);
      expect(switched?.vpAwarded).toBe(5);
    });

    it('should award 5 VP for automatic switch', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      manager.executeSwitches(4);

      // Side B should get 5 VP for the switch
      expect(manager.getVictoryPoints(sideB.id)).toBe(5);
    });

    it('should switch markers on turn 8', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const results = manager.executeSwitches(8);

      const switched = results.find(r => r.markerId === 'breach-marker-1');
      expect(switched?.switched).toBe(true);
    });

    it('should rotate through all sides', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const threeSideManager = createBreachMission([result.sideA, result.sideB]);

      result.sideA.members[0].position = { x: 12, y: 6 };
      threeSideManager.updateMarkerControl([{ id: result.sideA.members[0].id, position: result.sideA.members[0].position! }]);

      // Turn 4: A -> B
      threeSideManager.executeSwitches(4);
      expect(threeSideManager.getMarkerController('breach-marker-1')).toBe(result.sideB.id);

      // Turn 8: B -> A
      threeSideManager.executeSwitches(8);
      expect(threeSideManager.getMarkerController('breach-marker-1')).toBe(result.sideA.id);
    });
  });

  describe('awardTurnVP', () => {
    it('should award 3 VP per marker controlled', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Marker 1
      sideA.members[1].position = { x: 6, y: 12 }; // Marker 2

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(6);
      expect(manager.getVictoryPoints(sideA.id)).toBe(6);
    });

    it('should not award VP for contested markers', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
    });

    it('should award VP to multiple sides for different markers', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Marker 1
      sideB.members[0].position = { x: 6, y: 12 }; // Marker 2

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(3);
      expect(vpAwarded.get(sideB.id)).toBe(3);
    });

    it('should award 10 VP bonus for full control', () => {
      // Need more members to control all 5 markers
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 5 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const testManager = createBreachMission([result.sideA, result.sideB]);

      // Control all 5 markers with correct positions
      const markerPositions = [
        { x: 12, y: 6 },   // Marker 1
        { x: 6, y: 12 },   // Marker 2
        { x: 18, y: 12 },  // Marker 3
        { x: 6, y: 18 },   // Marker 4
        { x: 18, y: 18 },  // Marker 5
      ];

      for (let i = 0; i < 5; i++) {
        result.sideA.members[i].position = markerPositions[i];
      }

      testManager.updateMarkerControl(
        result.sideA.members.slice(0, 5).map((m, i) => ({ id: m.id, position: markerPositions[i] }))
      );

      const vpAwarded = testManager.awardTurnVP();

      // 5 markers × 3 VP + 10 VP bonus = 25 VP
      expect(vpAwarded.get(result.sideA.id)).toBe(25);
    });

    it('should reset markers controlled count each turn', () => {
      sideA.members[0].position = { x: 12, y: 6 };

      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.awardTurnVP();

      expect(manager.getMarkersControlledThisTurn(sideA.id)).toBe(1);

      // Next turn, no markers controlled
      sideA.members[0].position = { x: 3, y: 3 };
      manager.updateMarkerControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.awardTurnVP();

      expect(manager.getMarkersControlledThisTurn(sideA.id)).toBe(0);
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
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);
      manager.awardTurnVP();

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 6, y: 12 };

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].vp).toBe(3);
      expect(standings[1].vp).toBe(3);
    });

    it('should include markers controlled this turn', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateMarkerControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings[0].markersControlled).toBe(2);
    });
  });
});

describe('Breach Mission - Edge Cases', () => {
  describe('Custom switch turns', () => {
    it('should handle custom switch turns', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const manager = createBreachMission([result.sideA, result.sideB], undefined, [3, 7]);

      expect(manager.getBreachTurns()).toEqual([3, 7]);

      // Should not switch on turn 4
      result.sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: result.sideA.members[0].id, position: result.sideA.members[0].position! }]);

      const results4 = manager.executeSwitches(4);
      expect(results4.length).toBe(0);

      // Should switch on turn 3
      const results3 = manager.executeSwitches(3);
      expect(results3.length).toBeGreaterThan(0);
    });
  });

  describe('Marker switching', () => {
    it('should handle multiple switches', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const manager = createBreachMission([result.sideA, result.sideB]);

      result.sideA.members[0].position = { x: 12, y: 6 };
      manager.updateMarkerControl([{ id: result.sideA.members[0].id, position: result.sideA.members[0].position! }]);

      // Turn 4: A -> B
      manager.executeSwitches(4);
      expect(manager.getMarkerController('breach-marker-1')).toBe(result.sideB.id);

      // Turn 8: B -> A
      manager.executeSwitches(8);
      expect(manager.getMarkerController('breach-marker-1')).toBe(result.sideA.id);
    });
  });

  describe('Full control bonus', () => {
    it('should award bonus only when controlling all markers', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 5 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 5 }]
      );

      const manager = createBreachMission([result.sideA, result.sideB]);

      // Control 4 out of 5 markers
      const markerPositions = [
        { x: 12, y: 6 },   // Marker 1
        { x: 6, y: 12 },   // Marker 2
        { x: 18, y: 12 },  // Marker 3
        { x: 6, y: 18 },   // Marker 4
      ];

      for (let i = 0; i < 4; i++) {
        result.sideA.members[i].position = markerPositions[i];
      }

      manager.updateMarkerControl(
        result.sideA.members.slice(0, 4).map((m, i) => ({ id: m.id, position: markerPositions[i] }))
      );

      const vpAwarded = manager.awardTurnVP();

      // 4 markers × 3 VP = 12 VP (no bonus)
      expect(vpAwarded.get(result.sideA.id)).toBe(12);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createTriadMission, TriadMissionManager } from './triad-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';

describe('Triad Mission', () => {
  let manager: TriadMissionManager;
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

    const zonePositions: Position[] = [
      { x: 12, y: 4 },   // Top center
      { x: 4, y: 18 },   // Bottom left
      { x: 20, y: 18 },  // Bottom right
    ];

    manager = createTriadMission([sideA, sideB], zonePositions);
  });

  describe('createTriadMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should create three triad zones', () => {
      const zones = manager.getZones();
      expect(zones.length).toBe(3);
      expect(zones[0].name).toBe('Triad Zone 1');
      expect(zones[1].name).toBe('Triad Zone 2');
      expect(zones[2].name).toBe('Triad Zone 3');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should initialize zones as uncontrolled', () => {
      const controllers = manager.getZoneControllers();
      expect(controllers.size).toBe(3);
      for (const controller of controllers.values()) {
        expect(controller).toBeNull();
      }
    });
  });

  describe('updateZoneControl', () => {
    it('should control zone with single side present', () => {
      sideA.members[0].position = { x: 12, y: 4 }; // In zone 1

      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      expect(manager.getZoneController('triad-zone-1')).toBe(sideA.id);
    });

    it('should contest zone with multiple sides present', () => {
      sideA.members[0].position = { x: 12, y: 4 };
      sideB.members[0].position = { x: 12, y: 4 };

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      expect(manager.getZoneController('triad-zone-1')).toBeNull();
    });

    it('should uncontrol zone with no models', () => {
      sideA.members[0].position = { x: 12, y: 12 }; // Not in any zone

      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      expect(manager.getZoneController('triad-zone-1')).toBeNull();
    });
  });

  describe('awardTurnVP', () => {
    it('should award 3 VP per controlled zone', () => {
      sideA.members[0].position = { x: 12, y: 4 }; // Zone 1
      sideA.members[1].position = { x: 4, y: 18 }; // Zone 2

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(6); // 2 zones × 3 VP
      expect(manager.getVictoryPoints(sideA.id)).toBe(6);
    });

    it('should not award VP for contested zones', () => {
      sideA.members[0].position = { x: 12, y: 4 };
      sideB.members[0].position = { x: 12, y: 4 };

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
    });

    it('should award VP to multiple sides for different zones', () => {
      sideA.members[0].position = { x: 12, y: 4 }; // Zone 1
      sideB.members[0].position = { x: 4, y: 18 }; // Zone 2

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(3);
      expect(vpAwarded.get(sideB.id)).toBe(3);
    });

    it('should reset zones controlled count each turn', () => {
      sideA.members[0].position = { x: 12, y: 4 };

      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.awardTurnVP();

      expect(manager.getZonesControlledThisTurn(sideA.id)).toBe(1);

      // Next turn, no zones controlled
      sideA.members[0].position = { x: 12, y: 12 };
      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.awardTurnVP();

      expect(manager.getZonesControlledThisTurn(sideA.id)).toBe(0);
    });
  });

  describe('checkForFullTriad', () => {
    it('should detect full triad and award bonus VP', () => {
      sideA.members[0].position = { x: 12, y: 4 }; // Zone 1
      sideA.members[1].position = { x: 4, y: 18 }; // Zone 2
      sideA.members[2].position = { x: 20, y: 18 }; // Zone 3

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
        { id: sideA.members[2].id, position: sideA.members[2].position! },
      ]);

      expect(manager.hasFullTriad(sideA.id)).toBe(true);
      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Achieved full triad control');
    });

    it('should not trigger full triad with only 2 zones', () => {
      sideA.members[0].position = { x: 12, y: 4 }; // Zone 1
      sideA.members[1].position = { x: 4, y: 18 }; // Zone 2

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);

      expect(manager.hasFullTriad(sideA.id)).toBe(false);
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
      sideA.members[0].position = { x: 12, y: 4 };
      sideA.members[1].position = { x: 4, y: 18 };

      manager.updateZoneControl([
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
      sideA.members[0].position = { x: 12, y: 4 };
      sideB.members[0].position = { x: 4, y: 18 };

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].vp).toBe(3);
      expect(standings[1].vp).toBe(3);
    });

    it('should include zones controlled and full triad status', () => {
      sideA.members[0].position = { x: 12, y: 4 };
      sideA.members[1].position = { x: 4, y: 18 };
      sideA.members[2].position = { x: 20, y: 18 };

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
        { id: sideA.members[2].id, position: sideA.members[2].position! },
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings[0].zonesControlled).toBe(3);
      expect(standings[0].hasFullTriad).toBe(true);
    });
  });
});

describe('Triad Mission - Edge Cases', () => {
  describe('Zone contest', () => {
    it('should prevent VP when zone is contested', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const manager = createTriadMission([result.sideA, result.sideB]);

      // Both sides in same zone
      result.sideA.members[0].position = { x: 12, y: 4 };
      result.sideB.members[0].position = { x: 12, y: 4 };

      manager.updateZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position! },
        { id: result.sideB.members[0].id, position: result.sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(result.sideA.id)).toBe(0);
      expect(vpAwarded.get(result.sideB.id)).toBe(0);
    });
  });

  describe('Full triad bonus', () => {
    it('should award 5 VP bonus for full triad', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 3 }]
      );

      const manager = createTriadMission([result.sideA, result.sideB]);

      result.sideA.members[0].position = { x: 12, y: 4 };
      result.sideA.members[1].position = { x: 4, y: 18 };
      result.sideA.members[2].position = { x: 20, y: 18 };

      manager.updateZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position! },
        { id: result.sideA.members[1].id, position: result.sideA.members[1].position! },
        { id: result.sideA.members[2].id, position: result.sideA.members[2].position! },
      ]);

      // Full triad triggers instant win with 5 VP bonus
      // Note: Turn VP is not awarded since game ends immediately
      expect(manager.getVictoryPoints(result.sideA.id)).toBe(5);
    });
  });

  describe('Multiple zones control', () => {
    it('should handle controlling all 3 zones', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 3 }]
      );

      const manager = createTriadMission([result.sideA, result.sideB]);

      const zonePositions: Position[] = [
        { x: 12, y: 4 },
        { x: 4, y: 18 },
        { x: 20, y: 18 },
      ];

      result.sideA.members.forEach((m, i) => {
        m.position = zonePositions[i];
      });

      manager.updateZoneControl(
        result.sideA.members.map(m => ({ id: m.id, position: m.position! }))
      );

      const controllers = manager.getZoneControllers();
      for (const controller of controllers.values()) {
        expect(controller).toBe(result.sideA.id);
      }
    });
  });
});

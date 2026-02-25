import { describe, it, expect, beforeEach } from 'vitest';
import { createDominionMission, DominionMissionManager } from './dominion-manager';
import { buildOpposingSides } from '../mission/MissionSideBuilder';
import { ModelSlotStatus } from '../mission/MissionSide';
import { Position } from '../battlefield/Position';

describe('Dominion Mission', () => {
  let manager: DominionMissionManager;
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

    const zonePositions: Position[] = [
      { x: 12, y: 6 },   // Top center
      { x: 6, y: 12 },   // Left center
      { x: 18, y: 12 },  // Right center
      { x: 12, y: 18 },  // Bottom center
    ];

    manager = createDominionMission([sideA, sideB], zonePositions);
  });

  describe('createDominionMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should create dominion zones', () => {
      const zones = manager.getZones();
      expect(zones.length).toBe(4);
      expect(zones[0].name).toBe('Dominion Zone 1');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });
  });

  describe('updateZoneControl', () => {
    it('should control zone with single side present', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // In zone 1

      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      expect(manager.getZoneController('zone-1')).toBe(sideA.id);
    });

    it('should contest zone with multiple sides present', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      expect(manager.getZoneController('zone-1')).toBeNull(); // Contested
    });

    it('should uncontrol zone with no models', () => {
      sideA.members[0].position = { x: 20, y: 20 }; // Outside all zones

      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      expect(manager.getZoneController('zone-1')).toBeNull();
    });

    it('should track first control', () => {
      sideA.members[0].position = { x: 12, y: 6 };

      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      expect(manager.getFirstController('zone-1')).toBe(sideA.id);
    });

    it('should not change first control after zone is lost and regained', () => {
      // Side A controls first
      sideA.members[0].position = { x: 12, y: 6 };
      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);
      expect(manager.getFirstController('zone-1')).toBe(sideA.id);

      // Zone becomes uncontrolled
      sideA.members[0].position = { x: 20, y: 20 };
      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);

      // Side B controls
      sideB.members[0].position = { x: 12, y: 6 };
      manager.updateZoneControl([toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position })]);

      // First controller should still be Side A
      expect(manager.getFirstController('zone-1')).toBe(sideA.id);
    });
  });

  describe('awardTurnVP', () => {
    it('should award 2 VP per controlled zone', () => {
      // Side A controls 2 zones
      sideA.members[0].position = { x: 12, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 6, y: 12 }; // Zone 2

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);

      const vpAwarded = manager.awardTurnVP();

      // awardTurnVP returns 2 VP per zone = 4 VP
      // First control bonus (2 VP per zone) was already awarded in updateZoneControl
      expect(vpAwarded.get(sideA.id)).toBe(4);
      // Total VP = 4 (turn) + 4 (first control: 2 zones × 2 VP) = 8
      expect(manager.getVictoryPoints(sideA.id)).toBe(8);
    });

    it('should not award VP for contested zones', () => {
      // Zone is contested
      sideA.members[0].position = { x: 12, y: 6 };
      sideB.members[0].position = { x: 12, y: 6 };

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
      expect(vpAwarded.get(sideB.id)).toBe(0);
    });

    it('should award VP to multiple sides for different zones', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Zone 1 - Side A
      sideB.members[0].position = { x: 6, y: 12 }; // Zone 2 - Side B

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(2);
      expect(vpAwarded.get(sideB.id)).toBe(2);
    });

    it('should reset zones controlled count each turn', () => {
      sideA.members[0].position = { x: 12, y: 6 };

      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);
      manager.awardTurnVP();

      expect(manager.getZonesControlledThisTurn(sideA.id)).toBe(1);

      // Next turn, no zones controlled
      sideA.members[0].position = { x: 20, y: 20 };
      manager.updateZoneControl([toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position })]);
      manager.awardTurnVP();

      expect(manager.getZonesControlledThisTurn(sideA.id)).toBe(0);
    });
  });

  describe('checkForVictory', () => {
    it('should detect victory when controlling all zones', () => {
      // Use only 3 zones for simpler test
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 1 }]
      );

      const zonePositions: Position[] = [
        { x: 12, y: 6 },
        { x: 6, y: 12 },
        { x: 18, y: 12 },
      ];

      const testManager = createDominionMission([result.sideA, result.sideB], zonePositions, 3);

      result.sideA.members[0].position = { x: 12, y: 6 }; // Zone 1
      result.sideA.members[1].position = { x: 6, y: 12 }; // Zone 2
      result.sideA.members[2].position = { x: 18, y: 12 }; // Zone 3

      testManager.updateZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[1].id, position: result.sideA.members[1].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[2].id, position: result.sideA.members[2].position!, baseDiameter: 1, siz: 3 },
      ]);

      testManager.checkForVictory();

      expect(testManager.hasEnded()).toBe(true);
      expect(testManager.getWinner()).toBe(result.sideA.id);
      expect(testManager.getEndReason()).toBe('Controlled all dominion zones');
    });

    it('should not end if any zone is contested', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 6, y: 12 }; // Zone 2
      sideA.members[2].position = { x: 18, y: 12 }; // Zone 3
      sideB.members[0].position = { x: 18, y: 12 }; // Contest Zone 3

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
        toSpatialModel({ id: sideA.members[2].id, position: sideA.members[2].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });

    it('should not end if any zone is uncontrolled', () => {
      sideA.members[0].position = { x: 12, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 6, y: 12 }; // Zone 2
      // Zone 3 and 4 are empty

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);

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
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);
      manager.awardTurnVP();

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should only consider active models for VP victory', () => {
      // Side A has more VP but is eliminated
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);
      manager.awardTurnVP();

      sideA.members.forEach(m => m.status = ModelSlotStatus.Eliminated);
      manager.endMission(undefined, 'Turn limit');

      // Side B should win by default (only active side)
      expect(manager.getWinner()).toBe(sideB.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };
      sideB.members[0].position = { x: 18, y: 12 };

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
        toSpatialModel({ id: sideB.members[0].id, position: sideB.members[0].position }),
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].sideId).toBe(sideA.id);
      // Side A: 2 zones × 2 VP + 2 zones × 2 VP first control = 8 VP
      expect(standings[0].vp).toBe(8);
      // Side B: 1 zone × 2 VP + 1 zone × 2 VP first control = 4 VP
      expect(standings[1].vp).toBe(4);
    });

    it('should include zones controlled this turn', () => {
      sideA.members[0].position = { x: 12, y: 6 };
      sideA.members[1].position = { x: 6, y: 12 };

      manager.updateZoneControl([
        toSpatialModel({ id: sideA.members[0].id, position: sideA.members[0].position }),
        toSpatialModel({ id: sideA.members[1].id, position: sideA.members[1].position }),
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings[0].zonesControlled).toBe(2);
    });
  });
});

describe('Dominion Mission - Edge Cases', () => {
  describe('Zone denial', () => {
    it('should prevent enemy victory with single model', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );

      const zonePositions: Position[] = [
        { x: 12, y: 6 },
        { x: 6, y: 12 },
        { x: 18, y: 12 },
      ];

      const manager = createDominionMission([result.sideA, result.sideB], zonePositions);

      // Side A controls 2 zones, Side B denies 1
      result.sideA.members[0].position = { x: 12, y: 6 }; // Zone 1
      result.sideA.members[1].position = { x: 6, y: 12 }; // Zone 2
      result.sideB.members[0].position = { x: 18, y: 12 }; // Zone 3 - denial

      manager.updateZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[1].id, position: result.sideA.members[1].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideB.members[0].id, position: result.sideB.members[0].position!, baseDiameter: 1, siz: 3 },
      ]);

      manager.checkForVictory();

      // Side A should NOT win because Zone 3 is contested
      expect(manager.hasEnded()).toBe(false);
    });
  });

  describe('Multiple zones', () => {
    it('should handle 5 zones', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 5 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 5 }]
      );

      const zonePositions: Position[] = [
        { x: 12, y: 6 },   // Top center
        { x: 6, y: 12 },   // Left center
        { x: 18, y: 12 },  // Right center
        { x: 12, y: 18 },  // Bottom center
        { x: 12, y: 12 },  // Center
      ];

      const manager = createDominionMission([result.sideA, result.sideB], zonePositions, 5);

      const zones = manager.getZones();
      expect(zones.length).toBe(5);

      // Control all 5 zones
      result.sideA.members.forEach((m, i) => {
        m.position = zonePositions[i];
      });

      // Update all at once
      const models = result.sideA.members.map(m => ({
        id: m.id,
        position: m.position!,
        baseDiameter: 1,
        siz: 3,
      }));
      manager.updateZoneControl(models);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createEngagementMission, EngagementMissionManager } from './engagement-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';
import { SpatialModel } from '../battlefield/spatial-rules';

describe('Engagement Mission', () => {
  let manager: EngagementMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];

  const toSpatialModel = (member: { id: string; position?: Position | null }): SpatialModel => ({
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
      { x: 6, y: 6 },
      { x: 18, y: 6 },
      { x: 12, y: 12 },
    ];

    manager = createEngagementMission([sideA, sideB], zonePositions);
  });

  describe('createEngagementMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should create engagement zones', () => {
      const zones = manager.getZones();
      expect(zones.length).toBe(3);
      expect(zones[0].name).toBe('Engagement Zone 1');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });
  });

  describe('updateZoneControl', () => {
    it('should control zone with single side present', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // In zone 1

      const models: SpatialModel[] = [toSpatialModel(sideA.members[0])];
      manager.updateZoneControl(models);

      expect(manager.getZoneController('zone-1')).toBe(sideA.id);
    });

    it('should contest zone with multiple sides present', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideB.members[0].position = { x: 6, y: 6 };

      const models: SpatialModel[] = [
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideB.members[0]),
      ];

      manager.updateZoneControl(models);

      expect(manager.getZoneController('zone-1')).toBeNull(); // Contested
    });

    it('should uncontrol zone with no models', () => {
      sideA.members[0].position = { x: 20, y: 20 }; // Outside all zones

      const models: SpatialModel[] = [toSpatialModel(sideA.members[0])];
      manager.updateZoneControl(models);

      expect(manager.getZoneController('zone-1')).toBeNull();
    });

    it('should track first control', () => {
      sideA.members[0].position = { x: 6, y: 6 };

      const models: SpatialModel[] = [toSpatialModel(sideA.members[0])];
      manager.updateZoneControl(models);

      expect(manager.getFirstController('zone-1')).toBe(sideA.id);
    });

    it('should not change first control after zone is lost and regained', () => {
      // Side A controls first
      sideA.members[0].position = { x: 6, y: 6 };
      manager.updateZoneControl([toSpatialModel(sideA.members[0])]);
      expect(manager.getFirstController('zone-1')).toBe(sideA.id);

      // Zone becomes uncontrolled
      sideA.members[0].position = { x: 20, y: 20 };
      manager.updateZoneControl([toSpatialModel(sideA.members[0])]);

      // Side B controls
      sideB.members[0].position = { x: 6, y: 6 };
      manager.updateZoneControl([toSpatialModel(sideB.members[0])]);

      // First controller should still be Side A
      expect(manager.getFirstController('zone-1')).toBe(sideA.id);
    });
  });

  describe('awardTurnVP', () => {
    it('should award 2 VP per controlled zone', () => {
      // Side A controls 2 zones
      sideA.members[0].position = { x: 6, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 18, y: 6 }; // Zone 2

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
      ]);

      const vpAwarded = manager.awardTurnVP();

      // awardTurnVP returns 2 VP per zone = 4 VP
      // First control bonus (1 VP per zone) was already awarded in updateZoneControl
      expect(vpAwarded.get(sideA.id)).toBe(4);
      // Total VP = 4 (turn) + 2 (first control) = 6
      expect(manager.getVictoryPoints(sideA.id)).toBe(6);
    });

    it('should not award VP for contested zones', () => {
      // Zone is contested
      sideA.members[0].position = { x: 6, y: 6 };
      sideB.members[0].position = { x: 6, y: 6 };

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideB.members[0]),
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
      expect(vpAwarded.get(sideB.id)).toBe(0);
    });

    it('should award VP to multiple sides for different zones', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // Zone 1 - Side A
      sideB.members[0].position = { x: 18, y: 6 }; // Zone 2 - Side B

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideB.members[0]),
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(2);
      expect(vpAwarded.get(sideB.id)).toBe(2);
    });

    it('should reset zones controlled count each turn', () => {
      sideA.members[0].position = { x: 6, y: 6 };

      manager.updateZoneControl([toSpatialModel(sideA.members[0])]);
      manager.awardTurnVP();

      expect(manager.getZonesControlledThisTurn(sideA.id)).toBe(1);

      // Next turn, no zones controlled
      sideA.members[0].position = { x: 20, y: 20 };
      manager.updateZoneControl([toSpatialModel(sideA.members[0])]);
      manager.awardTurnVP();

      expect(manager.getZonesControlledThisTurn(sideA.id)).toBe(0);
    });
  });

  describe('checkForVictory', () => {
    it('should detect victory when controlling all zones', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 18, y: 6 }; // Zone 2
      sideA.members[2].position = { x: 12, y: 12 }; // Zone 3

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
        toSpatialModel(sideA.members[2]),
      ]);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Controlled all engagement zones');
    });

    it('should not end if any zone is contested', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 18, y: 6 }; // Zone 2
      sideA.members[2].position = { x: 12, y: 12 }; // Zone 3
      sideB.members[0].position = { x: 12, y: 12 }; // Contest Zone 3

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
        toSpatialModel(sideA.members[2]),
        toSpatialModel(sideB.members[0]),
      ]);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });

    it('should not end if any zone is uncontrolled', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // Zone 1
      sideA.members[1].position = { x: 18, y: 6 }; // Zone 2
      // Zone 3 is empty

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
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
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 6 };

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
      ]);
      manager.awardTurnVP();

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should only consider active models for VP victory', () => {
      // Side A has more VP but is eliminated
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 6 };

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
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
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 6 };
      sideB.members[0].position = { x: 12, y: 12 };

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
        toSpatialModel(sideB.members[0]),
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].sideId).toBe(sideA.id);
      // Side A: 2 zones × 2 VP + 2 zones × 1 VP first control = 6 VP
      expect(standings[0].vp).toBe(6);
      // Side B: 1 zone × 2 VP + 1 zone × 1 VP first control = 3 VP
      expect(standings[1].vp).toBe(3);
    });

    it('should include zones controlled this turn', () => {
      sideA.members[0].position = { x: 6, y: 6 };
      sideA.members[1].position = { x: 18, y: 6 };

      manager.updateZoneControl([
        toSpatialModel(sideA.members[0]),
        toSpatialModel(sideA.members[1]),
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings[0].zonesControlled).toBe(2);
    });
  });
});

describe('Engagement Mission - Edge Cases', () => {
  describe('Zone denial', () => {
    it('should prevent enemy victory with single model', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );

      const zonePositions: Position[] = [
        { x: 6, y: 6 },
        { x: 18, y: 6 },
        { x: 12, y: 12 },
      ];

      const manager = createEngagementMission([result.sideA, result.sideB], zonePositions);

      // Side A controls 2 zones, Side B denies 1
      result.sideA.members[0].position = { x: 6, y: 6 }; // Zone 1
      result.sideA.members[1].position = { x: 18, y: 6 }; // Zone 2
      result.sideB.members[0].position = { x: 12, y: 12 }; // Zone 3 - denial

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
    it('should handle 4 zones', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 4 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 4 }]
      );

      const zonePositions: Position[] = [
        { x: 6, y: 6 },
        { x: 18, y: 6 },
        { x: 6, y: 18 },
        { x: 18, y: 18 },
      ];

      const manager = createEngagementMission([result.sideA, result.sideB], zonePositions, 4);

      const zones = manager.getZones();
      expect(zones.length).toBe(4);

      // Control all 4 zones
      result.sideA.members[0].position = { x: 6, y: 6 };
      result.sideA.members[1].position = { x: 18, y: 6 };
      result.sideA.members[2].position = { x: 6, y: 18 };
      result.sideA.members[3].position = { x: 18, y: 18 };

      manager.updateZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[1].id, position: result.sideA.members[1].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[2].id, position: result.sideA.members[2].position!, baseDiameter: 1, siz: 3 },
        { id: result.sideA.members[3].id, position: result.sideA.members[3].position!, baseDiameter: 1, siz: 3 },
      ]);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });
});

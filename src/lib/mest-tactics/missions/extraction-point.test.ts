import { describe, it, expect, beforeEach } from 'vitest';
import { createExtractionPointMission, ExtractionPointMissionManager } from './extraction-point-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';

describe('Extraction Point Mission', () => {
  let manager: ExtractionPointMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];
  let vipMemberIdA: string;
  let vipMemberIdB: string;

  beforeEach(() => {
    const result = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 3 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 3 }]
    );
    sideA = result.sideA;
    sideB = result.sideB;

    // Designate first member of each side as VIP
    vipMemberIdA = sideA.members[0].id;
    vipMemberIdB = sideB.members[0].id;

    const vipMemberIds = new Map([
      [sideA.id, vipMemberIdA],
      [sideB.id, vipMemberIdB],
    ]);

    const zonePositions: Position[] = [
      { x: 3, y: 3 },
      { x: 21, y: 3 },
      { x: 12, y: 21 },
    ];

    manager = createExtractionPointMission([sideA, sideB], vipMemberIds, zonePositions);
  });

  describe('createExtractionPointMission', () => {
    it('should create mission manager with sides and VIPs', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);

      const vipA = manager.getVIPForSide(sideA.id);
      const vipB = manager.getVIPForSide(sideB.id);

      expect(vipA).toBeDefined();
      expect(vipB).toBeDefined();
    });

    it('should create extraction zones', () => {
      const zones = manager.getZones();
      expect(zones.length).toBe(3);
      expect(zones[0].name).toBe('Extraction Zone 1');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });
  });

  describe('startExtraction', () => {
    it('should start extraction when VIP is in controlled zone', () => {
      sideA.members[0].position = { x: 3, y: 3 }; // In zone 1

      // Control the zone
      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const result = manager.startExtraction(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('start_extract');
      expect(manager.getExtractionProgress(vipMemberIdA)).toBe(1);
    });

    it('should fail if VIP not in extraction zone', () => {
      sideA.members[0].position = { x: 12, y: 12 }; // Not in any zone

      const result = manager.startExtraction(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP not in extraction zone');
    });

    it('should fail if zone not controlled', () => {
      sideA.members[0].position = { x: 3, y: 3 };
      sideB.members[0].position = { x: 3, y: 3 }; // Contest zone

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const result = manager.startExtraction(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Zone not controlled by VIP side');
    });
  });

  describe('continueExtraction', () => {
    it('should complete extraction on second turn', () => {
      sideA.members[0].position = { x: 3, y: 3 };

      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.startExtraction(vipMemberIdA);

      const result = manager.continueExtraction(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('complete_extract');
      expect(result.vpAwarded).toBe(5);
      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should fail if extraction not started', () => {
      const result = manager.continueExtraction(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Extraction not started');
    });

    it('should fail if VIP leaves zone', () => {
      sideA.members[0].position = { x: 3, y: 3 };

      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.startExtraction(vipMemberIdA);

      // VIP moves out of zone
      sideA.members[0].position = { x: 12, y: 12 };

      const result = manager.continueExtraction(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP no longer in extraction zone');
    });
  });

  describe('awardTurnVP', () => {
    it('should award 1 VP per controlled zone', () => {
      sideA.members[0].position = { x: 3, y: 3 }; // Zone 1
      sideA.members[1].position = { x: 21, y: 3 }; // Zone 2

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(2);
      expect(manager.getVictoryPoints(sideA.id)).toBe(2);
    });

    it('should not award VP for contested zones', () => {
      sideA.members[0].position = { x: 3, y: 3 };
      sideB.members[0].position = { x: 3, y: 3 };

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
    });
  });

  describe('checkForVIPElimination', () => {
    it('should end mission when VIP is eliminated', () => {
      sideA.members[0].status = ModelSlotStatus.Eliminated;

      manager.checkForVIPElimination();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideB.id);
      expect(manager.getEndReason()).toBe('Enemy VIP eliminated');
    });

    it('should not end if VIP is alive', () => {
      manager.checkForVIPElimination();

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
      sideA.members[0].position = { x: 3, y: 3 };
      manager.updateZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.awardTurnVP();

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      sideA.members[0].position = { x: 3, y: 3 };
      sideB.members[0].position = { x: 21, y: 3 };

      manager.updateZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].vp).toBe(1);
      expect(standings[1].vp).toBe(1);
    });
  });
});

describe('Extraction Point Mission - Edge Cases', () => {
  describe('VIP protection', () => {
    it('should award win to side with VIP when enemy VIP dies', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([
        [result.sideA.id, result.sideA.members[0].id],
        [result.sideB.id, result.sideB.members[0].id],
      ]);

      const manager = createExtractionPointMission([result.sideA, result.sideB], vipMemberIds);

      // Eliminate Side B VIP
      result.sideB.members[0].status = ModelSlotStatus.Eliminated;
      manager.checkForVIPElimination();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });

  describe('Multiple extraction zones', () => {
    it('should handle 4 extraction zones', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 4 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 4 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);

      const zonePositions: Position[] = [
        { x: 3, y: 3 },
        { x: 21, y: 3 },
        { x: 3, y: 21 },
        { x: 21, y: 21 },
      ];

      const manager = createExtractionPointMission([result.sideA, result.sideB], vipMemberIds, zonePositions, 4);

      const zones = manager.getZones();
      expect(zones.length).toBe(4);

      // Control all 4 zones
      result.sideA.members.forEach((m, i) => {
        m.position = zonePositions[i];
      });

      manager.updateZoneControl(
        result.sideA.members.map(m => ({ id: m.id, position: m.position! }))
      );

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(result.sideA.id)).toBe(4);
    });
  });

  describe('Extraction interruption', () => {
    it('should fail extraction if zone is contested', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const manager = createExtractionPointMission([result.sideA, result.sideB], vipMemberIds);

      // Start extraction
      result.sideA.members[0].position = { x: 3, y: 3 };
      manager.updateZoneControl([{ id: result.sideA.members[0].id, position: result.sideA.members[0].position! }]);
      const startResult = manager.startExtraction(result.sideA.members[0].id);
      
      expect(startResult.success).toBe(true);
      expect(manager.getExtractionProgress(result.sideA.members[0].id)).toBe(1);

      // Enemy contests zone
      result.sideB.members[0].position = { x: 3, y: 3 };
      manager.updateZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position! },
        { id: result.sideB.members[0].id, position: result.sideB.members[0].position! },
      ]);

      const result2 = manager.continueExtraction(result.sideA.members[0].id);

      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('Zone no longer controlled');
    });
  });
});

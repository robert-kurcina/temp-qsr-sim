import { describe, it, expect, beforeEach } from 'vitest';
import { createExfilMission, ExfilMissionManager } from './exfil-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { buildAssembly, buildProfile } from '../assembly-builder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';

describe('Exfil Mission', () => {
  let manager: ExfilMissionManager;
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

    // Create reinforcement rosters
    const reinforcementRosters = new Map();
    const reinforceProfile = buildProfile('Average');
    const reinforceRosterA = buildAssembly('Reinforcements A', [reinforceProfile, reinforceProfile]);
    const reinforceRosterB = buildAssembly('Reinforcements B', [reinforceProfile, reinforceProfile]);
    reinforcementRosters.set(sideA.id, reinforceRosterA);
    reinforcementRosters.set(sideB.id, reinforceRosterB);

    const exfilZonePosition: Position = { x: 12, y: 12 };

    manager = createExfilMission([sideA, sideB], vipMemberIds, reinforcementRosters, exfilZonePosition);
  });

  describe('createExfilMission', () => {
    it('should create mission manager with sides and VIPs', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);

      const vipA = manager.getVIPForSide(sideA.id);
      const vipB = manager.getVIPForSide(sideB.id);

      expect(vipA).toBeDefined();
      expect(vipB).toBeDefined();
    });

    it('should create exfil zone', () => {
      const zone = manager.getExfilZone();
      expect(zone).toBeDefined();
      expect(zone?.name).toBe('Exfiltration Zone');
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should initialize reinforcements as not arrived', () => {
      expect(manager.haveReinforcementsArrived(sideA.id)).toBe(false);
      expect(manager.haveReinforcementsArrived(sideB.id)).toBe(false);
    });
  });

  describe('startExfil', () => {
    it('should start exfil when VIP is in controlled zone', () => {
      sideA.members[0].position = { x: 12, y: 12 }; // In exfil zone

      // Control the zone
      manager.updateExfilZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const result = manager.startExfil(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('start_exfil');
      expect(manager.getExfilProgress(vipMemberIdA)).toBe(1);
    });

    it('should fail if VIP not in exfil zone', () => {
      sideA.members[0].position = { x: 3, y: 3 }; // Not in exfil zone

      const result = manager.startExfil(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP not in exfil zone');
    });

    it('should fail if zone not controlled', () => {
      sideA.members[0].position = { x: 12, y: 12 };
      sideB.members[0].position = { x: 12, y: 12 }; // Contest zone

      manager.updateExfilZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const result = manager.startExfil(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Exfil zone not controlled');
    });
  });

  describe('continueExfil', () => {
    it('should complete exfil on second turn', () => {
      sideA.members[0].position = { x: 12, y: 12 };

      manager.updateExfilZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.startExfil(vipMemberIdA);

      const result = manager.continueExfil(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('complete_exfil');
      expect(result.vpAwarded).toBe(10);
      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should fail if exfil not started', () => {
      const result = manager.continueExfil(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Exfil not started');
    });

    it('should fail if VIP leaves zone', () => {
      sideA.members[0].position = { x: 12, y: 12 };

      manager.updateExfilZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.startExfil(vipMemberIdA);

      // VIP moves out of zone
      sideA.members[0].position = { x: 3, y: 3 };

      const result = manager.continueExfil(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP no longer in exfil zone');
    });
  });

  describe('awardTurnVP', () => {
    it('should award 2 VP per turn for VIP alive', () => {
      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(2);
      expect(vpAwarded.get(sideB.id)).toBe(2);
      expect(manager.getVictoryPoints(sideA.id)).toBe(2);
      expect(manager.getVictoryPoints(sideB.id)).toBe(2);
    });

    it('should not award VP for eliminated VIP', () => {
      sideA.members[0].status = ModelSlotStatus.Eliminated;
      // Sync VIP state
      const vipA = manager.getVIPForSide(sideA.id);
      if (vipA) vipA.state = 'Eliminated' as any;

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
      expect(vpAwarded.get(sideB.id)).toBe(2);
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

  describe('checkReinforcements', () => {
    it('should trigger reinforcement arrival on appropriate turn', () => {
      // Turn 6 should definitely trigger reinforcements (range is 4-6, guaranteed at max)
      const arrived = manager.checkReinforcements(6);

      expect(arrived.size).toBeGreaterThan(0);
      expect(manager.haveReinforcementsArrived(Array.from(arrived.keys())[0])).toBe(true);
    });

    it('should not trigger reinforcements before turn range', () => {
      const arrived = manager.checkReinforcements(2);

      expect(arrived.size).toBe(0);
    });

    it('should not trigger reinforcements twice', () => {
      manager.checkReinforcements(6);
      const arrived2 = manager.checkReinforcements(7);

      expect(arrived2.size).toBe(0);
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
      manager.awardTurnVP();
      manager.awardTurnVP();

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBeDefined();
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      manager.awardTurnVP();
      manager.awardTurnVP();

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].vp).toBeGreaterThanOrEqual(standings[1].vp);
    });

    it('should include reinforcement arrival status', () => {
      // Trigger reinforcements
      manager.checkReinforcements(6);

      const standings = manager.getVPStandings();

      expect(standings.some(s => s.reinforcementsArrived)).toBe(true);
    });
  });
});

describe('Exfil Mission - Edge Cases', () => {
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

      const reinforcementRosters = new Map();
      const reinforceProfile = buildProfile('Average');
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [reinforceProfile]));
      reinforcementRosters.set(result.sideB.id, buildAssembly('Reinf B', [reinforceProfile]));

      const manager = createExfilMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      // Eliminate Side B VIP
      result.sideB.members[0].status = ModelSlotStatus.Eliminated;
      manager.checkForVIPElimination();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });

  describe('Exfil interruption', () => {
    it('should fail exfil if zone is contested', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));

      const manager = createExfilMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      // Start exfil
      result.sideA.members[0].position = { x: 12, y: 12 };
      manager.updateExfilZoneControl([{ id: result.sideA.members[0].id, position: result.sideA.members[0].position! }]);
      const startResult = manager.startExfil(result.sideA.members[0].id);

      expect(startResult.success).toBe(true);

      // Enemy contests zone
      result.sideB.members[0].position = { x: 12, y: 12 };
      manager.updateExfilZoneControl([
        { id: result.sideA.members[0].id, position: result.sideA.members[0].position! },
        { id: result.sideB.members[0].id, position: result.sideB.members[0].position! },
      ]);

      const result2 = manager.continueExfil(result.sideA.members[0].id);

      expect(result2.success).toBe(false);
      expect(result2.reason).toBe('Exfil zone no longer controlled');
    });
  });

  describe('Reinforcement timing', () => {
    it('should handle custom reinforcement turn range', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));

      const manager = createExfilMission(
        [result.sideA, result.sideB],
        vipMemberIds,
        reinforcementRosters,
        { x: 12, y: 12 },
        [6, 8] // Custom turn range
      );

      // Should not arrive on turn 4
      const arrived4 = manager.checkReinforcements(4);
      expect(arrived4.size).toBe(0);

      // Should arrive on turn 8 (guaranteed at max of range)
      const arrived8 = manager.checkReinforcements(8);
      expect(arrived8.size).toBeGreaterThan(0);
    });
  });
});

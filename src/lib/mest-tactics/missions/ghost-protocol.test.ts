import { describe, it, expect, beforeEach } from 'vitest';
import { createGhostProtocolMission, GhostProtocolMissionManager, DetectionState } from './ghost-protocol-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { buildAssembly, buildProfile } from '../assembly-builder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';

describe('Ghost Protocol Mission', () => {
  let manager: GhostProtocolMissionManager;
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

    vipMemberIdA = sideA.members[0].id;
    vipMemberIdB = sideB.members[0].id;

    const vipMemberIds = new Map([
      [sideA.id, vipMemberIdA],
      [sideB.id, vipMemberIdB],
    ]);

    const reinforcementRosters = new Map();
    const reinforceProfile = buildProfile('Average');
    reinforcementRosters.set(sideA.id, buildAssembly('Reinf A', [reinforceProfile]));
    reinforcementRosters.set(sideB.id, buildAssembly('Reinf B', [reinforceProfile]));

    manager = createGhostProtocolMission([sideA, sideB], vipMemberIds, reinforcementRosters);
  });

  describe('createGhostProtocolMission', () => {
    it('should create mission manager with sides and VIPs', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);

      const vipA = manager.getVIPForSide(sideA.id);
      const vipB = manager.getVIPForSide(sideB.id);

      expect(vipA).toBeDefined();
      expect(vipB).toBeDefined();
    });

    it('should create stealth zones and exfil zone', () => {
      const zones = manager.getZones();
      expect(zones.length).toBeGreaterThanOrEqual(4); // 3 stealth + 1 exfil
    });

    it('should initialize VIPs as hidden', () => {
      expect(manager.getVIPDetectionState(vipMemberIdA)).toBe(DetectionState.Hidden);
      expect(manager.getVIPDetectionState(vipMemberIdB)).toBe(DetectionState.Hidden);
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });
  });

  describe('detectVIP', () => {
    it('should increase detection state from Hidden to Suspected', () => {
      const result = manager.detectVIP(vipMemberIdA, sideB.id);

      expect(result.detected).toBe(true);
      expect(result.newState).toBe(DetectionState.Suspected);
      expect(manager.getVIPDetectionState(vipMemberIdA)).toBe(DetectionState.Suspected);
    });

    it('should increase detection state from Suspected to Confirmed', () => {
      manager.detectVIP(vipMemberIdA, sideB.id);
      const result = manager.detectVIP(vipMemberIdA, sideB.id);

      expect(result.newState).toBe(DetectionState.Confirmed);
    });

    it('should fail detection if VIP is in stealth zone', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // In stealth zone

      const result = manager.detectVIP(vipMemberIdA, sideB.id);

      expect(result.detected).toBe(false);
      expect(result.newState).toBe(DetectionState.Hidden);
    });

    it('should award 5 VP for detection', () => {
      manager.detectVIP(vipMemberIdA, sideB.id);

      expect(manager.getVictoryPoints(sideB.id)).toBe(5);
    });

    it('should trigger reinforcements on first detection', () => {
      manager.detectVIP(vipMemberIdA, sideB.id);

      expect(manager.haveReinforcementsArrived(sideA.id)).toBe(true);
    });

    it('should track that VIP was detected', () => {
      manager.detectVIP(vipMemberIdA, sideB.id);

      expect(manager.wasVIPDetected(vipMemberIdA)).toBe(true);
    });
  });

  describe('startExfil', () => {
    it('should start exfil when VIP is in controlled exfil zone', () => {
      sideA.members[0].position = { x: 12, y: 2 }; // In exfil zone

      manager.updateStealthZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);

      const result = manager.startExfil(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('start_exfil');
      expect(manager.getExfilProgress(vipMemberIdA)).toBe(1);
    });

    it('should fail if VIP not in exfil zone', () => {
      sideA.members[0].position = { x: 3, y: 3 };

      const result = manager.startExfil(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('VIP not in exfil zone');
    });

    it('should fail if exfil zone not controlled', () => {
      sideA.members[0].position = { x: 12, y: 2 };
      sideB.members[0].position = { x: 12, y: 2 }; // Contest zone

      manager.updateStealthZoneControl([
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
      sideA.members[0].position = { x: 12, y: 2 };

      manager.updateStealthZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.startExfil(vipMemberIdA);

      const result = manager.continueExfil(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('complete_exfil');
      expect(result.vpAwarded).toBe(15); // Ghost bonus (never detected)
      expect(result.isGhostBonus).toBe(true);
      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should award only 8 VP if VIP was detected', () => {
      // Detect VIP first
      manager.detectVIP(vipMemberIdA, sideB.id);

      sideA.members[0].position = { x: 12, y: 2 };
      manager.updateStealthZoneControl([{ id: sideA.members[0].id, position: sideA.members[0].position! }]);
      manager.startExfil(vipMemberIdA);

      const result = manager.continueExfil(vipMemberIdA);

      expect(result.success).toBe(true);
      expect(result.vpAwarded).toBe(8); // No ghost bonus
      expect(result.isGhostBonus).toBe(false);
    });

    it('should fail if exfil not started', () => {
      const result = manager.continueExfil(vipMemberIdA);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Exfil not started');
    });
  });

  describe('awardTurnVP', () => {
    it('should award 2 VP per stealth zone controlled', () => {
      sideA.members[0].position = { x: 6, y: 6 }; // Stealth zone 1
      sideA.members[1].position = { x: 18, y: 6 }; // Stealth zone 2

      manager.updateStealthZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);

      const vpAwarded = manager.awardTurnVP();

      expect(vpAwarded.get(sideA.id)).toBe(4);
      expect(manager.getVictoryPoints(sideA.id)).toBe(4);
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
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      manager.detectVIP(vipMemberIdA, sideB.id);

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].vp).toBeGreaterThanOrEqual(standings[1].vp);
    });

    it('should include VIP detection status', () => {
      manager.detectVIP(vipMemberIdA, sideB.id);

      const standings = manager.getVPStandings();
      const sideAStanding = standings.find(s => s.sideId === sideA.id);

      expect(sideAStanding?.vipDetected).toBe(true);
    });
  });
});

describe('Ghost Protocol Mission - Edge Cases', () => {
  describe('Ghost bonus', () => {
    it('should award 15 VP for ghost exfiltration', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));

      const manager = createGhostProtocolMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      // Go straight to exfil without being detected
      result.sideA.members[0].position = { x: 12, y: 2 };
      manager.updateStealthZoneControl([{ id: result.sideA.members[0].id, position: result.sideA.members[0].position! }]);
      manager.startExfil(result.sideA.members[0].id);
      manager.continueExfil(result.sideA.members[0].id);

      expect(manager.getVictoryPoints(result.sideA.id)).toBe(15);
      expect(manager.wasVIPDetected(result.sideA.members[0].id)).toBe(false);
    });
  });

  describe('Stealth zone protection', () => {
    it('should protect VIP from detection in stealth zone', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      const manager = createGhostProtocolMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      // VIP in stealth zone
      result.sideA.members[0].position = { x: 6, y: 6 };

      // Try to detect multiple times
      manager.detectVIP(result.sideA.members[0].id, result.sideB.id);
      manager.detectVIP(result.sideA.members[0].id, result.sideB.id);
      manager.detectVIP(result.sideA.members[0].id, result.sideB.id);

      expect(manager.getVIPDetectionState(result.sideA.members[0].id)).toBe(DetectionState.Hidden);
      expect(manager.wasVIPDetected(result.sideA.members[0].id)).toBe(false);
    });
  });

  describe('Reinforcement trigger', () => {
    it('should only trigger reinforcements on first detection', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));

      const manager = createGhostProtocolMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      // First detection triggers reinforcements
      manager.detectVIP(result.sideA.members[0].id, result.sideB.id);
      expect(manager.haveReinforcementsArrived(result.sideA.id)).toBe(true);

      // Second detection should not change reinforcement status
      manager.detectVIP(result.sideA.members[0].id, result.sideB.id);
      expect(manager.haveReinforcementsArrived(result.sideA.id)).toBe(true);
    });
  });
});

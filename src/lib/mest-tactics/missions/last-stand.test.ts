import { describe, it, expect, beforeEach } from 'vitest';
import { createLastStandMission, LastStandMissionManager } from './last-stand-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { buildAssembly, buildProfile } from '../assembly-builder';
import { ModelSlotStatus } from '../MissionSide';
import { Position } from '../battlefield/Position';

describe('Last Stand Mission', () => {
  let manager: LastStandMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];
  let vipMemberIdA: string;
  let vipMemberIdB: string;

  beforeEach(() => {
    const result = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 4 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 4 }]
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
    reinforcementRosters.set(sideA.id, buildAssembly('Reinf A', [reinforceProfile, reinforceProfile]));
    reinforcementRosters.set(sideB.id, buildAssembly('Reinf B', [reinforceProfile, reinforceProfile]));

    manager = createLastStandMission([sideA, sideB], vipMemberIds, reinforcementRosters);
  });

  describe('createLastStandMission', () => {
    it('should create mission manager with sides and VIPs', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);

      const vipA = manager.getVIPForSide(sideA.id);
      const vipB = manager.getVIPForSide(sideB.id);

      expect(vipA).toBeDefined();
      expect(vipB).toBeDefined();
    });

    it('should create defense zones', () => {
      const zones = manager.getZones();
      expect(zones.length).toBeGreaterThanOrEqual(4);
      expect(zones[0].name).toContain('Defense Zone');
    });

    it('should initialize VIP survival turns to 0', () => {
      expect(manager.getVIPSurvivalTurns(vipMemberIdA)).toBe(0);
      expect(manager.getVIPSurvivalTurns(vipMemberIdB)).toBe(0);
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should set reinforcement turn to 6 by default', () => {
      expect(manager.getReinforcementTurn()).toBe(6);
    });
  });

  describe('endTurn', () => {
    it('should award 10 VP per turn for VIP survival', () => {
      const vpAwarded = manager.endTurn(1);

      expect(vpAwarded.get(sideA.id)).toBe(10);
      expect(vpAwarded.get(sideB.id)).toBe(10);
      expect(manager.getVictoryPoints(sideA.id)).toBe(10);
      expect(manager.getVIPSurvivalTurns(vipMemberIdA)).toBe(1);
    });

    it('should not award VP for eliminated VIP', () => {
      sideA.members[0].status = ModelSlotStatus.Eliminated;
      // Sync VIP state
      const vipA = manager.getVIPForSide(sideA.id);
      if (vipA) vipA.state = 'Eliminated' as any;

      const vpAwarded = manager.endTurn(1);

      expect(vpAwarded.get(sideA.id)).toBe(0);
      expect(vpAwarded.get(sideB.id)).toBe(10);
    });

    it('should accumulate survival turns', () => {
      manager.endTurn(1);
      manager.endTurn(2);
      manager.endTurn(3);

      expect(manager.getVIPSurvivalTurns(vipMemberIdA)).toBe(3);
      expect(manager.getVictoryPoints(sideA.id)).toBe(30);
    });
  });

  describe('checkReinforcements', () => {
    it('should trigger reinforcements on turn 6', () => {
      manager.endTurn(1);
      manager.endTurn(2);
      manager.endTurn(3);
      manager.endTurn(4);
      manager.endTurn(5);

      const arrived = manager.checkReinforcements(6);

      expect(arrived.size).toBeGreaterThan(0);
      expect(manager.haveReinforcementsArrived(Array.from(arrived.keys())[0])).toBe(true);
    });

    it('should award 20 VP survival bonus when reinforcements arrive', () => {
      // Go to turn 6
      for (let i = 1; i <= 6; i++) {
        manager.endTurn(i);
      }

      manager.checkReinforcements(6);

      // 6 turns × 10 VP + 20 VP bonus = 80 VP
      expect(manager.getVictoryPoints(sideA.id)).toBe(80);
    });

    it('should not trigger reinforcements before turn 6', () => {
      const arrived = manager.checkReinforcements(4);

      expect(arrived.size).toBe(0);
    });

    it('should not trigger reinforcements twice', () => {
      for (let i = 1; i <= 6; i++) {
        manager.endTurn(i);
      }

      manager.checkReinforcements(6);
      const arrived2 = manager.checkReinforcements(7);

      expect(arrived2.size).toBe(0);
    });
  });

  describe('awardZoneVP', () => {
    it('should award 2 VP per defense zone controlled', () => {
      sideA.members[0].position = { x: 12, y: 12 }; // Defense zone 1
      sideA.members[1].position = { x: 6, y: 6 }; // Defense zone 2

      manager.updateDefenseZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideA.members[1].id, position: sideA.members[1].position! },
      ]);

      const vpAwarded = manager.awardZoneVP();

      expect(vpAwarded.get(sideA.id)).toBe(4);
      expect(manager.getVictoryPoints(sideA.id)).toBe(4);
    });

    it('should not award VP for contested zones', () => {
      sideA.members[0].position = { x: 12, y: 12 };
      sideB.members[0].position = { x: 12, y: 12 };

      manager.updateDefenseZoneControl([
        { id: sideA.members[0].id, position: sideA.members[0].position! },
        { id: sideB.members[0].id, position: sideB.members[0].position! },
      ]);

      const vpAwarded = manager.awardZoneVP();

      expect(vpAwarded.get(sideA.id)).toBe(0);
    });
  });

  describe('handleVIPElimination', () => {
    it('should award 5 VP for eliminating enemy VIP', () => {
      manager.handleVIPElimination(vipMemberIdA, sideB.id);

      expect(manager.getVictoryPoints(sideB.id)).toBe(5);
    });

    it('should not award VP for self-elimination', () => {
      manager.handleVIPElimination(vipMemberIdA, sideA.id);

      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
    });
  });

  describe('checkForLastVIPStanding', () => {
    it('should end mission when only one VIP remains', () => {
      sideB.members[0].status = ModelSlotStatus.Eliminated;

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Last VIP standing');
    });

    it('should not end if multiple VIPs remain', () => {
      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });

    it('should end with VP winner if all VIPs eliminated', () => {
      sideA.members[0].status = ModelSlotStatus.Eliminated;
      sideB.members[0].status = ModelSlotStatus.Eliminated;

      // Award some VP first
      manager.endTurn(1);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBeDefined();
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      manager.endTurn(1);
      manager.endTurn(2);

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].vp).toBeGreaterThanOrEqual(standings[1].vp);
    });

    it('should include VIP status and survival turns', () => {
      manager.endTurn(1);
      manager.endTurn(2);

      const standings = manager.getVPStandings();
      const sideAStanding = standings.find(s => s.sideId === sideA.id);

      expect(sideAStanding?.vipAlive).toBe(true);
      expect(sideAStanding?.survivalTurns).toBe(2);
    });
  });
});

describe('Last Stand Mission - Edge Cases', () => {
  describe('VIP survival bonus', () => {
    it('should award bonus only once when reinforcements arrive', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));

      const manager = createLastStandMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      // Go to turn 6
      for (let i = 1; i <= 6; i++) {
        manager.endTurn(i);
      }

      // Trigger reinforcements multiple times
      manager.checkReinforcements(6);
      manager.checkReinforcements(7);

      // Should only get bonus once: 6 × 10 + 20 = 80 VP
      expect(manager.getVictoryPoints(result.sideA.id)).toBe(80);
    });
  });

  describe('Custom reinforcement turn', () => {
    it('should handle custom reinforcement turn', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      const vipMemberIds = new Map([[result.sideA.id, result.sideA.members[0].id]]);
      const reinforcementRosters = new Map();
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));

      const manager = createLastStandMission(
        [result.sideA, result.sideB],
        vipMemberIds,
        reinforcementRosters,
        undefined,
        8 // Custom reinforcement turn
      );

      expect(manager.getReinforcementTurn()).toBe(8);

      // Should not arrive on turn 6
      const arrived6 = manager.checkReinforcements(6);
      expect(arrived6.size).toBe(0);

      // Should arrive on turn 8
      for (let i = 1; i <= 8; i++) {
        manager.endTurn(i);
      }
      const arrived8 = manager.checkReinforcements(8);
      expect(arrived8.size).toBeGreaterThan(0);
    });
  });

  describe('Multiple VIPs', () => {
    it('should track survival separately for each VIP', () => {
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
      reinforcementRosters.set(result.sideA.id, buildAssembly('Reinf A', [buildProfile('Average')]));
      reinforcementRosters.set(result.sideB.id, buildAssembly('Reinf B', [buildProfile('Average')]));

      const manager = createLastStandMission([result.sideA, result.sideB], vipMemberIds, reinforcementRosters);

      manager.endTurn(1);
      manager.endTurn(2);
      manager.endTurn(3);

      expect(manager.getVIPSurvivalTurns(result.sideA.members[0].id)).toBe(3);
      expect(manager.getVIPSurvivalTurns(result.sideB.members[0].id)).toBe(3);
      expect(manager.getVictoryPoints(result.sideA.id)).toBe(30);
      expect(manager.getVictoryPoints(result.sideB.id)).toBe(30);
    });
  });
});

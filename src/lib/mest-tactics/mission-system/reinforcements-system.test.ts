import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReinforcementsManager,
  ReinforcementGroup,
  ReinforcementTrigger,
  ArrivalEdge,
  createReinforcementGroup,
  createTurnReinforcements,
  createRandomReinforcements,
  createConditionReinforcements,
} from './reinforcements-system';
import { buildProfile } from './assembly-builder';
import { MissionSide } from './MissionSide';
import { createMissionSide } from './MissionSide';
import { buildAssembly } from './assembly-builder';

describe('ReinforcementsManager', () => {
  let manager: ReinforcementsManager;
  let group: ReinforcementGroup;

  beforeEach(() => {
    manager = new ReinforcementsManager();
    const profile = buildProfile('Veteran');
    const roster = buildAssembly('Test Group', [profile]);
    group = createReinforcementGroup({
      sideId: 'SideA',
      roster,
      trigger: ReinforcementTrigger.OnTurn,
      turnNumber: 3,
    });
    manager.addGroup(group);
  });

  describe('createReinforcementGroup', () => {
    it('should create a group with defaults', () => {
      const profile = buildProfile('Militia');
      const newGroup = createReinforcementGroup({
        sideId: 'SideA',
        profiles: [profile],
      });

      expect(newGroup.trigger).toBe(ReinforcementTrigger.OnTurn);
      expect(newGroup.arrivalEdge).toBe(ArrivalEdge.DeploymentZone);
      expect(newGroup.hasArrived).toBe(false);
      expect(newGroup.canBeDelayed).toBe(true);
    });

    it('should create a group with custom config', () => {
      const profile = buildProfile('Militia');
      const newGroup = createReinforcementGroup({
        id: 'custom-reinforce',
        name: 'Custom Reinforcements',
        sideId: 'SideB',
        profiles: [profile],
        trigger: ReinforcementTrigger.Random,
        turnRange: [2, 5],
        arrivalEdge: ArrivalEdge.North,
        canBeDelayed: false,
      });

      expect(newGroup.id).toBe('custom-reinforce');
      expect(newGroup.trigger).toBe(ReinforcementTrigger.Random);
      expect(newGroup.turnRange).toEqual([2, 5]);
      expect(newGroup.arrivalEdge).toBe(ArrivalEdge.North);
    });
  });

  describe('addGroup / getGroup', () => {
    it('should add and retrieve a group', () => {
      const retrieved = manager.getGroup(group.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(group.id);
    });

    it('should return undefined for unknown group', () => {
      const retrieved = manager.getGroup('unknown');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllGroups', () => {
    it('should return all groups', () => {
      const profile = buildProfile('Militia');
      const roster = buildAssembly('Group 2', [profile]);
      const group2 = createReinforcementGroup({ sideId: 'SideA', roster });
      manager.addGroup(group2);

      const all = manager.getAllGroups();
      expect(all.length).toBe(2);
    });
  });

  describe('getGroupsForSide', () => {
    it('should return groups for specified side', () => {
      const profile = buildProfile('Militia');
      const roster = buildAssembly('Group B', [profile]);
      const groupB = createReinforcementGroup({ sideId: 'SideB', roster });
      manager.addGroup(groupB);

      const sideAGroups = manager.getGroupsForSide('SideA');
      const sideBGroups = manager.getGroupsForSide('SideB');

      expect(sideAGroups.length).toBe(1);
      expect(sideBGroups.length).toBe(1);
    });
  });

  describe('getPendingGroups / getArrivedGroups', () => {
    it('should separate pending and arrived groups', () => {
      manager.triggerArrival(group.id, 1);

      const pending = manager.getPendingGroups();
      const arrived = manager.getArrivedGroups();

      expect(pending.length).toBe(0);
      expect(arrived.length).toBe(1);
    });
  });

  describe('shouldArriveThisTurn', () => {
    it('should return true for OnTurn trigger at correct turn', () => {
      const result = manager.shouldArriveThisTurn(group, 3);
      expect(result).toBe(true);
    });

    it('should return false for OnTurn trigger at wrong turn', () => {
      const result = manager.shouldArriveThisTurn(group, 2);
      expect(result).toBe(false);
    });

    it('should return false for already arrived group', () => {
      manager.triggerArrival(group.id, 1);
      const result = manager.shouldArriveThisTurn(group, 3);
      expect(result).toBe(false);
    });

    it('should handle AfterTurns trigger', () => {
      const profile = buildProfile('Militia');
      const roster = buildAssembly('After Group', [profile]);
      const afterGroup = createReinforcementGroup({
        sideId: 'SideA',
        roster,
        trigger: ReinforcementTrigger.AfterTurns,
        turnNumber: 2,
      });

      expect(manager.shouldArriveThisTurn(afterGroup, 2)).toBe(false);
      expect(manager.shouldArriveThisTurn(afterGroup, 3)).toBe(true);
    });

    it('should handle Random trigger', () => {
      const profile = buildProfile('Militia');
      const roster = buildAssembly('Random Group', [profile]);
      const randomGroup = createReinforcementGroup({
        sideId: 'SideA',
        roster,
        trigger: ReinforcementTrigger.Random,
        turnRange: [2, 4],
      });

      // Before range
      expect(manager.shouldArriveThisTurn(randomGroup, 1)).toBe(false);

      // In range - may arrive (probabilistic)
      const result3 = manager.shouldArriveThisTurn(randomGroup, 3, () => 0.1);
      expect(result3).toBe(true); // Low RNG = arrives

      // At max - guaranteed
      const result4 = manager.shouldArriveThisTurn(randomGroup, 4);
      expect(result4).toBe(true);
    });

    it('should return false for Manual trigger', () => {
      const profile = buildProfile('Militia');
      const roster = buildAssembly('Manual Group', [profile]);
      const manualGroup = createReinforcementGroup({
        sideId: 'SideA',
        roster,
        trigger: ReinforcementTrigger.Manual,
      });

      expect(manager.shouldArriveThisTurn(manualGroup, 1)).toBe(false);
      expect(manager.shouldArriveThisTurn(manualGroup, 10)).toBe(false);
    });
  });

  describe('checkTurnArrivals', () => {
    it('should return groups arriving this turn', () => {
      const profile = buildProfile('Militia');
      const roster = buildAssembly('Turn 3 Group', [profile]);
      const turn3Group = createReinforcementGroup({
        sideId: 'SideA',
        roster,
        trigger: ReinforcementTrigger.OnTurn,
        turnNumber: 3,
      });
      manager.addGroup(turn3Group);

      const arriving = manager.checkTurnArrivals(3);

      expect(arriving.length).toBe(2); // Both groups turn 3
      expect(arriving.map(g => g.id)).toContain(group.id);
    });

    it('should return empty for turns with no arrivals', () => {
      const arriving = manager.checkTurnArrivals(1);
      expect(arriving.length).toBe(0);
    });
  });

  describe('triggerArrival', () => {
    it('should trigger arrival for a group', () => {
      const result = manager.triggerArrival(group.id, 2);

      expect(result.success).toBe(true);
      expect(result.arrived).toBe(true);
      expect(group.hasArrived).toBe(true);
      expect(group.arrivalTurn).toBe(2);
    });

    it('should fail for already arrived group', () => {
      manager.triggerArrival(group.id, 1);
      const result = manager.triggerArrival(group.id, 2);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Group has already arrived');
    });

    it('should fail for unknown group', () => {
      const result = manager.triggerArrival('unknown', 1);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Group not found');
    });
  });

  describe('calculateArrivalPositions', () => {
    it('should calculate positions for North edge', () => {
      group.arrivalEdge = ArrivalEdge.North;
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(true);
      expect(result.positions.length).toBe(1);
      expect(result.positions[0].y).toBeCloseTo(0.5, 1);
    });

    it('should calculate positions for South edge', () => {
      group.arrivalEdge = ArrivalEdge.South;
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(true);
      expect(result.positions[0].y).toBeCloseTo(23.5, 1);
    });

    it('should calculate positions for East edge', () => {
      group.arrivalEdge = ArrivalEdge.East;
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(true);
      expect(result.positions[0].x).toBeCloseTo(23.5, 1);
    });

    it('should calculate positions for West edge', () => {
      group.arrivalEdge = ArrivalEdge.West;
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(true);
      expect(result.positions[0].x).toBeCloseTo(0.5, 1);
    });

    it('should calculate positions for Specific arrival', () => {
      group.arrivalEdge = ArrivalEdge.Specific;
      group.arrivalPosition = { x: 10, y: 10 };
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(true);
      // Positions have random offset of ±1 MU
      expect(result.positions[0].x).toBeGreaterThanOrEqual(9);
      expect(result.positions[0].x).toBeLessThanOrEqual(11);
      expect(result.positions[0].y).toBeGreaterThanOrEqual(9);
      expect(result.positions[0].y).toBeLessThanOrEqual(11);
    });

    it('should calculate positions for DeploymentZone arrival', () => {
      group.arrivalEdge = ArrivalEdge.DeploymentZone;
      const zones = [{ bounds: { x: 0, y: 0, width: 4, height: 24 } }];
      const result = manager.calculateArrivalPositions(group, 24, 24, zones);

      expect(result.success).toBe(true);
      expect(result.positions[0].x).toBeGreaterThanOrEqual(0);
      expect(result.positions[0].x).toBeLessThanOrEqual(4);
    });

    it('should fail for Specific without position', () => {
      group.arrivalEdge = ArrivalEdge.Specific;
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Specific arrival requires arrivalPosition');
    });

    it('should fail for DeploymentZone without zones', () => {
      group.arrivalEdge = ArrivalEdge.DeploymentZone;
      const result = manager.calculateArrivalPositions(group, 24, 24);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No deployment zones available');
    });
  });

  describe('addReinforcementsToSide', () => {
    it('should add reinforcements to side members', () => {
      const profile = buildProfile('Veteran');
      const roster = buildAssembly('Test', [profile]);
      const reinforceGroup = createReinforcementGroup({
        sideId: 'Test Side',
        roster,
      });

      const side = createMissionSide('Test Side', [roster]);
      const positions = [{ x: 5, y: 5 }];

      const result = manager.addReinforcementsToSide(reinforceGroup, side, positions);

      expect(result.success).toBe(true);
      expect(result.addedCount).toBe(1);
      expect(side.members[0].position).toEqual({ x: 5, y: 5 });
    });

    it('should fail for wrong side', () => {
      const profile = buildProfile('Veteran');
      const roster = buildAssembly('Test', [profile]);
      const reinforceGroup = createReinforcementGroup({
        sideId: 'SideA',
        roster,
      });
      const side = createMissionSide('SideB', [roster]);

      const result = manager.addReinforcementsToSide(reinforceGroup, side, []);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Group does not belong to this side');
    });
  });

  describe('getPendingBP / getArrivedBP', () => {
    it('should calculate pending BP', () => {
      const pendingBP = manager.getPendingBP('SideA');
      expect(pendingBP).toBe(group.roster.assembly.totalBP);
    });

    it('should calculate arrived BP', () => {
      manager.triggerArrival(group.id, 1);
      const arrivedBP = manager.getArrivedBP('SideA');
      expect(arrivedBP).toBe(group.roster.assembly.totalBP);
    });
  });

  describe('exportState / importState', () => {
    it('should export and import state', () => {
      manager.triggerArrival(group.id, 2);

      const exported = manager.exportState();
      const newManager = new ReinforcementsManager();
      newManager.importState(exported);

      const imported = newManager.getGroup(group.id);
      expect(imported?.hasArrived).toBe(true);
      expect(imported?.arrivalTurn).toBe(2);
    });
  });
});

describe('Reinforcement creation helpers', () => {
  describe('createTurnReinforcements', () => {
    it('should create turn-based reinforcements', () => {
      const profile = buildProfile('Veteran');
      const group = createTurnReinforcements('SideA', 3, [profile], {
        name: 'Turn 3',
        arrivalEdge: ArrivalEdge.North,
      });

      expect(group.trigger).toBe(ReinforcementTrigger.OnTurn);
      expect(group.turnNumber).toBe(3);
      expect(group.arrivalEdge).toBe(ArrivalEdge.North);
      expect(group.name).toBe('Turn 3');
    });
  });

  describe('createRandomReinforcements', () => {
    it('should create random arrival reinforcements', () => {
      const profile = buildProfile('Veteran');
      const group = createRandomReinforcements('SideA', [2, 5], [profile], {
        name: 'Random',
        arrivalEdge: ArrivalEdge.East,
      });

      expect(group.trigger).toBe(ReinforcementTrigger.Random);
      expect(group.turnRange).toEqual([2, 5]);
      expect(group.arrivalEdge).toBe(ArrivalEdge.East);
    });
  });

  describe('createConditionReinforcements', () => {
    it('should create condition-based reinforcements', () => {
      const profile = buildProfile('Veteran');
      const group = createConditionReinforcements('SideA', 'vip-extracted', [profile], {
        name: 'VIP Extracted',
      });

      expect(group.trigger).toBe(ReinforcementTrigger.OnCondition);
      expect(group.conditionId).toBe('vip-extracted');
    });
  });
});

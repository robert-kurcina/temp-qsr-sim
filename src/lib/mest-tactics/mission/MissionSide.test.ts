import { describe, it, expect, beforeEach } from 'vitest';
import {
  MissionSide,
  ModelSlotStatus,
  createMissionSide,
  placeMember,
  moveMember,
  setMemberStatus,
  activateMember,
  resetTurnState,
  getMembersByStatus,
  getReadyMembers,
  getActiveMembers,
  getVIPMember,
  assignObjectiveMarker,
  removeObjectiveMarker,
  getMarkerCarriers,
} from './MissionSide';
import { buildMissionSide, buildOpposingSides, createDeploymentZone, createStandardDeploymentZones } from './MissionSideBuilder';
import { buildAssembly, buildProfile, GameSize } from './assembly-builder';
import { Battlefield } from '../battlefield/Battlefield';
import {
  createSideSpatialBinding,
  placeMember as spatialPlaceMember,
  moveMember as spatialMoveMember,
  getMemberEngagementState,
  getEngagedMembers,
} from './side-spatial-binding';

describe('MissionSide', () => {
  let side: MissionSide;

  beforeEach(() => {
    const profile1 = buildProfile('Veteran', { itemNames: ['Sword, Broad'] });
    const profile2 = buildProfile('Militia', { itemNames: ['Rifle, Light, Semi/A'] });
    const roster = buildAssembly('Test Assembly', [profile1, profile2]);

    side = createMissionSide('Test Side', [roster]);
  });

  describe('createMissionSide', () => {
    it('should create a side with members', () => {
      expect(side.id).toBe('Test Side');
      expect(side.name).toBe('Test Side');
      expect(side.members.length).toBe(2);
      expect(side.totalBP).toBeGreaterThan(0);
    });

    it('should assign unique IDs to members', () => {
      const ids = side.members.map((m: any) => m.id);
      expect(ids[0]).not.toBe(ids[1]);
    });

    it('should initialize members with Ready status', () => {
      for (const member of side.members) {
        expect(member.status).toBe(ModelSlotStatus.Ready);
      }
    });

    it('should initialize side state', () => {
      expect(side.state.currentTurn).toBe(0);
      expect(side.state.readyModels.size).toBe(2);
      expect(side.state.activatedModels.size).toBe(0);
      expect(side.state.victoryPoints).toBe(0);
    });
  });

  describe('placeMember', () => {
    it('should place a member at a position', () => {
      const memberId = side.members[0].id;
      const result = placeMember(side, memberId, { x: 5, y: 5 });

      expect(result).toBe(true);
      expect(side.members[0].position).toEqual({ x: 5, y: 5 });
    });

    it('should fail for unknown member', () => {
      const result = placeMember(side, 'Unknown', { x: 5, y: 5 });
      expect(result).toBe(false);
    });

    it('should respect deployment zones', () => {
      const zone = createDeploymentZone('zone-1', 'Test Zone', {
        x: 0, y: 0, width: 4, height: 24,
      }, side.id);
      side.deploymentZones = [zone];

      const memberId = side.members[0].id;
      
      // Valid placement in zone
      const validResult = placeMember(side, memberId, { x: 2, y: 5 });
      expect(validResult).toBe(true);

      // Reset position
      side.members[0].position = undefined;

      // Invalid placement outside zone
      const invalidResult = placeMember(side, memberId, { x: 10, y: 5 });
      expect(invalidResult).toBe(false);
    });
  });

  describe('moveMember', () => {
    it('should move a placed member', () => {
      const memberId = side.members[0].id;
      placeMember(side, memberId, { x: 5, y: 5 });

      const result = moveMember(side, memberId, { x: 7, y: 5 });

      expect(result).toBe(true);
      expect(side.members[0].position).toEqual({ x: 7, y: 5 });
    });

    it('should fail for unplaced member', () => {
      const memberId = side.members[0].id;
      const result = moveMember(side, memberId, { x: 7, y: 5 });
      expect(result).toBe(false);
    });
  });

  describe('setMemberStatus', () => {
    it('should update member status', () => {
      const memberId = side.members[0].id;
      setMemberStatus(side, memberId, ModelSlotStatus.Done);

      expect(side.members[0].status).toBe(ModelSlotStatus.Done);
    });

    it('should update readyModels when status changes', () => {
      const memberId = side.members[0].id;
      setMemberStatus(side, memberId, ModelSlotStatus.Done);

      expect(side.state.readyModels.has(memberId)).toBe(false);
    });

    it('should track eliminations', () => {
      const memberId = side.members[0].id;
      setMemberStatus(side, memberId, ModelSlotStatus.Eliminated);

      expect(side.state.eliminatedModels).toContain(memberId);
    });
  });

  describe('activateMember', () => {
    it('should mark member as activated', () => {
      const memberId = side.members[0].id;
      const result = activateMember(side, memberId);

      expect(result).toBe(true);
      expect(side.state.activatedModels.has(memberId)).toBe(true);
      expect(side.members[0].status).toBe(ModelSlotStatus.Done);
    });

    it('should fail for already activated member', () => {
      const memberId = side.members[0].id;
      activateMember(side, memberId);
      const result = activateMember(side, memberId);

      expect(result).toBe(false);
    });

    it('should fail for KO member', () => {
      const memberId = side.members[0].id;
      setMemberStatus(side, memberId, ModelSlotStatus.KO);
      const result = activateMember(side, memberId);

      expect(result).toBe(false);
    });
  });

  describe('resetTurnState', () => {
    it('should increment turn counter', () => {
      resetTurnState(side);
      expect(side.state.currentTurn).toBe(1);
    });

    it('should clear activated models', () => {
      activateMember(side, side.members[0].id);
      resetTurnState(side);
      expect(side.state.activatedModels.size).toBe(0);
    });

    it('should reset ready models', () => {
      activateMember(side, side.members[0].id);
      resetTurnState(side);
      expect(side.state.readyModels.has(side.members[0].id)).toBe(true);
    });

    it('should not reset KO models', () => {
      setMemberStatus(side, side.members[0].id, ModelSlotStatus.KO);
      resetTurnState(side);
      expect(side.members[0].status).toBe(ModelSlotStatus.KO);
    });
  });

  describe('getMembersByStatus', () => {
    it('should return members with specified status', () => {
      setMemberStatus(side, side.members[0].id, ModelSlotStatus.Done);

      const doneMembers = getMembersByStatus(side, ModelSlotStatus.Done);
      expect(doneMembers.length).toBe(1);
      expect(doneMembers[0].id).toBe(side.members[0].id);
    });
  });

  describe('getReadyMembers', () => {
    it('should return all ready members', () => {
      const ready = getReadyMembers(side);
      expect(ready.length).toBe(2);
    });

    it('should exclude non-ready members', () => {
      setMemberStatus(side, side.members[0].id, ModelSlotStatus.Done);
      const ready = getReadyMembers(side);
      expect(ready.length).toBe(1);
    });
  });

  describe('getActiveMembers', () => {
    it('should exclude eliminated and KO members', () => {
      setMemberStatus(side, side.members[0].id, ModelSlotStatus.Eliminated);
      setMemberStatus(side, side.members[1].id, ModelSlotStatus.KO);

      const active = getActiveMembers(side);
      expect(active.length).toBe(0);
    });
  });

  describe('VIP functionality', () => {
    it('should identify VIP member', () => {
      const profile1 = buildProfile('Veteran', { itemNames: ['Sword, Broad'] });
      const roster = buildAssembly('Test Assembly', [profile1]);
      // The member ID will be the portrait callsign, not the original character ID
      // So we need to create the side first, then get the first member's ID
      const vipSide = createMissionSide('VIP Side', [roster]);
      const vipMemberId = vipSide.members[0].id;
      
      // Recreate with VIP ID
      const roster2 = buildAssembly('Test Assembly 2', [profile1]);
      const vipSide2 = createMissionSide('VIP Side 2', [roster2], {
        vipModelId: vipMemberId,
      });

      const vip = getVIPMember(vipSide2);
      expect(vip).toBeDefined();
      expect(vip?.isVIP).toBe(true);
    });
  });

  describe('Objective Markers', () => {
    it('should assign marker to member', () => {
      const memberId = side.members[0].id;
      const result = assignObjectiveMarker(side, memberId, 'marker-1');

      expect(result).toBe(true);
      expect(side.members[0].objectiveMarkers).toContain('marker-1');
    });

    it('should remove marker from member', () => {
      const memberId = side.members[0].id;
      assignObjectiveMarker(side, memberId, 'marker-1');
      const result = removeObjectiveMarker(side, memberId, 'marker-1');

      expect(result).toBe(true);
      expect(side.members[0].objectiveMarkers).not.toContain('marker-1');
    });

    it('should get marker carriers', () => {
      assignObjectiveMarker(side, side.members[0].id, 'marker-1');
      const carriers = getMarkerCarriers(side);

      expect(carriers.length).toBe(1);
      expect(carriers[0].id).toBe(side.members[0].id);
    });
  });
});

describe('MissionSideBuilder', () => {
  describe('buildMissionSide', () => {
    it('should build side from rosters', () => {
      const profile = buildProfile('Veteran');
      const roster = buildAssembly('Test', [profile]);
      const side = buildMissionSide('Test Side', [roster]);

      expect(side.name).toBe('Test Side');
      expect(side.members.length).toBe(1);
    });

    it('should merge assemblies when requested', () => {
      const roster1 = buildAssembly('Assembly 1', [buildProfile('Veteran')]);
      const roster2 = buildAssembly('Assembly 2', [buildProfile('Militia')]);

      const side = buildMissionSide('Merged Side', [roster1, roster2], {
        mergeAssemblies: true,
      });

      expect(side.assemblies.length).toBe(1);
      expect(side.assemblies[0].name).toBe('Merged Side Combined');
    });
  });

  describe('buildOpposingSides', () => {
    it('should create two opposing sides', () => {
      const { sideA, sideB } = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 2 }],
        'Side B',
        [{ archetypeName: 'Militia', count: 2 }]
      );

      expect(sideA.members.length).toBe(2);
      expect(sideB.members.length).toBe(2);
      expect(sideA.id).not.toBe(sideB.id);
    });

    it('should create deployment zones', () => {
      const { sideA, sideB } = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran' }],
        'Side B',
        [{ archetypeName: 'Militia' }],
        { battlefieldWidth: 24, battlefieldHeight: 24 }
      );

      expect(sideA.deploymentZones.length).toBe(1);
      expect(sideB.deploymentZones.length).toBe(1);
      expect(sideA.deploymentZones[0].sideId).toBe(sideA.id);
      expect(sideB.deploymentZones[0].sideId).toBe(sideB.id);
    });
  });

  describe('createStandardDeploymentZones', () => {
    it('should create zones for both sides', () => {
      const zones = createStandardDeploymentZones(24, 24, 'A', 'B', 4);

      expect(zones.length).toBe(2);
      expect(zones[0].bounds.x).toBe(0);
      expect(zones[1].bounds.x).toBe(20); // 24 - 4
    });
  });
});

describe('Side Spatial Binding', () => {
  let battlefield: Battlefield;
  let side: MissionSide;
  let binding: ReturnType<typeof createSideSpatialBinding>;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    const profile1 = buildProfile('Veteran', { itemNames: ['Sword, Broad'] });
    const profile2 = buildProfile('Militia', { itemNames: ['Rifle, Light, Semi/A'] });
    const roster = buildAssembly('Test Assembly', [profile1, profile2]);
    side = createMissionSide('Test Side', [roster]);

    binding = createSideSpatialBinding(side, battlefield);
  });

  describe('createSideSpatialBinding', () => {
    it('should create binding with registry', () => {
      expect(binding.registry).toBeDefined();
      expect(binding.engagementManager).toBeDefined();
      expect(binding.moveValidator).toBeDefined();
    });

    it('should register placed members', () => {
      placeMember(side, side.members[0].id, { x: 5, y: 5 });
      const newBinding = createSideSpatialBinding(side, battlefield);

      const model = newBinding.registry.getModel(side.members[0].id);
      expect(model).toBeDefined();
    });
  });

  describe('placeMember (spatial)', () => {
    it('should place member and register in spatial system', () => {
      const memberId = side.members[0].id;
      const result = spatialPlaceMember(binding, memberId, { x: 5, y: 5 });

      expect(result).toBe(true);
      expect(side.members[0].position).toEqual({ x: 5, y: 5 });

      const model = binding.registry.getModel(memberId);
      expect(model).toBeDefined();
    });
  });

  describe('moveMember (spatial)', () => {
    it('should validate and execute move', () => {
      const memberId = side.members[0].id;
      spatialPlaceMember(binding, memberId, { x: 5, y: 5 });

      const result = spatialMoveMember(binding, memberId, { x: 5, y: 5 }, { x: 7, y: 5 });

      expect(result.success).toBe(true);
      expect(side.members[0].position).toEqual({ x: 7, y: 5 });
    });

    it('should detect engagement breaking', () => {
      const memberId = side.members[0].id;
      const enemyId = side.members[1].id;

      // Place in base contact
      spatialPlaceMember(binding, memberId, { x: 5, y: 5 });
      spatialPlaceMember(binding, enemyId, { x: 5.9, y: 5 });

      const result = spatialMoveMember(binding, memberId, { x: 5, y: 5 }, { x: 10, y: 5 }, {
        allowEngagementBreak: false,
      });

      expect(result.success).toBe(false);
      expect(result.engagementBroken).toBe(true);
    });
  });

  describe('getMemberEngagementState', () => {
    it('should return engagement state', () => {
      const memberId = side.members[0].id;
      spatialPlaceMember(binding, memberId, { x: 5, y: 5 });

      const opposingIds = new Set([side.members[1].id]);
      const state = getMemberEngagementState(binding, memberId, opposingIds);

      expect(state.isEngaged).toBeDefined();
    });

    it('should detect engagement', () => {
      const memberId = side.members[0].id;
      const enemyId = side.members[1].id;

      spatialPlaceMember(binding, memberId, { x: 5, y: 5 });
      spatialPlaceMember(binding, enemyId, { x: 5.9, y: 5 });

      const opposingIds = new Set([enemyId]);
      const state = getMemberEngagementState(binding, memberId, opposingIds);

      expect(state.isEngaged).toBe(true);
    });
  });

  describe('getEngagedMembers', () => {
    it('should return all engaged members', () => {
      spatialPlaceMember(binding, side.members[0].id, { x: 5, y: 5 });
      spatialPlaceMember(binding, side.members[1].id, { x: 5.9, y: 5 });

      const opposingIds = new Set([side.members[1].id]);
      const engaged = getEngagedMembers(binding, opposingIds);

      expect(engaged.length).toBe(1);
    });
  });
});

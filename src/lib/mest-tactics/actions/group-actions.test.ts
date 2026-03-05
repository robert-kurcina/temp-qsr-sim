import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGroupAction,
  buildGroupActionContext,
  validateGroupCohesion,
  calculateGroupBonus,
  executeGroupRangedAttack,
  executeGroupCloseCombat,
  executeGroupMove,
  GroupAction,
} from './group-actions';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Position } from '../battlefield/Position';

// Helper to create a test character
function createTestCharacter(name: string, cca: number = 2, ref: number = 2): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca,
        rca: 2,
        ref,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp: 50,
    },
    items: [],
    equipment: [],
    totalBp: 50,
    adjustedBp: 50,
    physicality: 3,
    durability: 3,
    burden: { totalBurden: 0, items: [] },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
  
  const character = new Character(profile);
  character.state.isAttentive = true;
  character.state.isOrdered = true;
  return character;
}

describe('Group Actions - Creation', () => {
  let leader: Character;
  let member1: Character;
  let member2: Character;

  beforeEach(() => {
    leader = createTestCharacter('Leader');
    member1 = createTestCharacter('Member1');
    member2 = createTestCharacter('Member2');
  });

  describe('createGroupAction', () => {
    it('should create a group with leader and members', () => {
      const group = createGroupAction(leader, [member1, member2]);
      
      expect(group.leader).toBe(leader);
      expect(group.members).toHaveLength(3);
      expect(group.members).toContain(leader);
      expect(group.members).toContain(member1);
      expect(group.members).toContain(member2);
    });

    it('should ensure leader is included even if not in members list', () => {
      const group = createGroupAction(leader, [member1]);
      
      expect(group.members).toContain(leader);
    });

    it('should exclude non-Attentive characters', () => {
      member1.state.isAttentive = false;
      
      const group = createGroupAction(leader, [member1, member2]);
      
      expect(group.members).not.toContain(member1);
      expect(group.members).toHaveLength(2);
    });

    it('should exclude non-Ordered characters', () => {
      member1.state.isOrdered = false;
      
      const group = createGroupAction(leader, [member1, member2]);
      
      expect(group.members).not.toContain(member1);
      expect(group.members).toHaveLength(2);
    });

    it('should handle duplicate members', () => {
      const group = createGroupAction(leader, [member1, member1, member2]);
      
      // Should deduplicate
      expect(group.members).toHaveLength(3);
    });
  });

  describe('buildGroupActionContext', () => {
    it('should add isGroupAction flag to context', () => {
      const context = buildGroupActionContext();
      expect(context.isGroupAction).toBe(true);
    });

    it('should preserve existing context properties', () => {
      const context = buildGroupActionContext({ isConcentrating: true });
      expect(context.isGroupAction).toBe(true);
      expect(context.isConcentrating).toBe(true);
    });
  });
});

describe('Group Actions - Cohesion', () => {
  let leader: Character;
  let member1: Character;
  let member2: Character;
  let positions: Map<string, Position>;
  let getPosition: (c: Character) => Position | undefined;

  beforeEach(() => {
    leader = createTestCharacter('Leader');
    member1 = createTestCharacter('Member1');
    member2 = createTestCharacter('Member2');

    positions = new Map();
    positions.set(leader.id, { x: 0, y: 0 });
    positions.set(member1.id, { x: 2, y: 0 }); // Within 4 MU
    positions.set(member2.id, { x: 3, y: 3 }); // Within 4 MU (4.24 MU)
    
    getPosition = (c) => positions.get(c.id);
  });

  describe('validateGroupCohesion', () => {
    it('should validate when all members within cohesion', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      
      const valid = validateGroupCohesion(group, getPosition);
      
      expect(valid).toBe(true);
    });

    it('should fail when member out of cohesion', () => {
      positions.set(member2.id, { x: 10, y: 10 }); // Out of 4 MU cohesion
      
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      
      const valid = validateGroupCohesion(group, getPosition);
      
      expect(valid).toBe(false);
    });

    it('should fail when leader has no position', () => {
      positions.delete(leader.id);
      
      const group: GroupAction = { leader, members: [leader, member1] } as any;
      
      const valid = validateGroupCohesion(group, getPosition);
      
      expect(valid).toBe(false);
    });

    it('should fail when member has no position', () => {
      positions.delete(member1.id);
      
      const group: GroupAction = { leader, members: [leader, member1] } as any;
      
      const valid = validateGroupCohesion(group, getPosition);
      
      expect(valid).toBe(false);
    });

    it('should use 4 MU minimum cohesion distance', () => {
      // Place member at exactly 4 MU
      positions.set(member1.id, { x: 4, y: 0 });
      
      const group: GroupAction = { leader, members: [leader, member1] } as any;
      
      const valid = validateGroupCohesion(group, getPosition);
      
      expect(valid).toBe(true);
    });

    it('should allow cohesion up to 8 MU (half of 16 MU visibility)', () => {
      // Place member at 8 MU
      positions.set(member1.id, { x: 8, y: 0 });
      
      const group: GroupAction = { leader, members: [leader, member1] } as any;
      
      const valid = validateGroupCohesion(group, getPosition);
      
      expect(valid).toBe(true);
    });
  });
});

describe('Group Actions - Bonuses', () => {
  let leader: Character;
  let member1: Character;
  let member2: Character;

  beforeEach(() => {
    leader = createTestCharacter('Leader');
    member1 = createTestCharacter('Member1');
    member2 = createTestCharacter('Member2');
  });

  describe('calculateGroupBonus', () => {
    it('should return 0 for solo character', () => {
      const group: GroupAction = { leader, members: [leader] } as any;
      
      const bonus = calculateGroupBonus(group);
      
      expect(bonus).toBe(0);
    });

    it('should return +1 for two members', () => {
      const group: GroupAction = { leader, members: [leader, member1] } as any;
      
      const bonus = calculateGroupBonus(group);
      
      expect(bonus).toBe(1);
    });

    it('should return +2 for three members', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      
      const bonus = calculateGroupBonus(group);
      
      expect(bonus).toBe(2);
    });

    it('should scale with group size', () => {
      const member3 = createTestCharacter('Member3');
      const member4 = createTestCharacter('Member4');
      const group: GroupAction = { 
        leader, 
        members: [leader, member1, member2, member3, member4] 
      };
      
      const bonus = calculateGroupBonus(group);
      
      expect(bonus).toBe(4);
    });
  });
});

describe('Group Actions - Execution', () => {
  let leader: Character;
  let member1: Character;
  let member2: Character;
  let target: Character;

  beforeEach(() => {
    leader = createTestCharacter('Leader', 3);
    member1 = createTestCharacter('Member1', 2);
    member2 = createTestCharacter('Member2', 2);
    target = createTestCharacter('Target');
  });

  describe('executeGroupRangedAttack', () => {
    it('should execute attacks for all members', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const attackResults = [
        { hit: true, score: 5 },
        { hit: false, score: 2 },
        { hit: true, score: 4 },
      ];
      let attackIndex = 0;
      
      const attackFunction = () => attackResults[attackIndex++];
      
      const result = executeGroupRangedAttack(group, target, attackFunction);
      
      expect(result.success).toBe(true); // At least one hit
      expect(result.memberResults).toHaveLength(3);
      expect(result.groupBonus).toBe(2);
    });

    it('should fail if all members miss', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const attackResults = [
        { hit: false, score: 2 },
        { hit: false, score: 1 },
        { hit: false, score: 0 },
      ];
      let attackIndex = 0;
      
      const attackFunction = () => attackResults[attackIndex++];
      
      const result = executeGroupRangedAttack(group, target, attackFunction);
      
      expect(result.success).toBe(false);
    });

    it('should track best score', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const attackResults = [
        { hit: true, score: 3 },
        { hit: true, score: 7 },
        { hit: true, score: 5 },
      ];
      let attackIndex = 0;
      
      const attackFunction = () => attackResults[attackIndex++];
      
      const result = executeGroupRangedAttack(group, target, attackFunction);
      
      expect(result.memberResults[1].score).toBe(7); // Best score
    });
  });

  describe('executeGroupCloseCombat', () => {
    it('should apply group bonus to all attacks', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const bonusesApplied: any[] = [];
      
      const attackFunction = (_: Character, __: Character, bonus: number) => {
        bonusesApplied.push(bonus);
        return {  hit: true, score: 5  } as any;
      };
      
      executeGroupCloseCombat(group, target, attackFunction);
      
      expect(bonusesApplied).toHaveLength(3);
      expect(bonusesApplied.every(b => b === 2)).toBe(true);
    });

    it('should succeed if any member hits', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const attackResults = [
        { hit: false, score: 2 },
        { hit: true, score: 5 },
        { hit: false, score: 1 },
      ];
      let attackIndex = 0;
      
      const attackFunction = () => attackResults[attackIndex++];
      
      const result = executeGroupCloseCombat(group, target, attackFunction);
      
      expect(result.success).toBe(true);
    });
  });

  describe('executeGroupMove', () => {
    let positions: Map<string, Position>;
    let getPosition: (c: Character) => Position | undefined;
    let moveFunction: (character: Character, dest: Position) => boolean;

    beforeEach(() => {
      positions = new Map();
      positions.set(leader.id, { x: 0, y: 0 });
      positions.set(member1.id, { x: 1, y: 0 });
      positions.set(member2.id, { x: 2, y: 0 });
      
      getPosition = (c) => positions.get(c.id);
      
      moveFunction = (character: Character, dest: Position) => {
        positions.set(character.id, dest);
        return true;
      };
    });

    it('should move all members maintaining formation', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const destination: Position = { x: 10, y: 10 } as any;
      
      const result = executeGroupMove(group, destination, moveFunction, getPosition);
      
      expect(result.success).toBe(true);
      expect(result.memberResults).toHaveLength(3);
      expect(result.memberResults.every(r => r.success)).toBe(true);
      
      // Check final positions maintain formation
      const leaderFinal = positions.get(leader.id);
      const member1Final = positions.get(member1.id);
      const member2Final = positions.get(member2.id);
      
      expect(leaderFinal).toEqual({ x: 10, y: 10 });
      expect(member1Final).toEqual({ x: 11, y: 10 }); // 1 MU offset maintained
      expect(member2Final).toEqual({ x: 12, y: 10 }); // 2 MU offset maintained
    });

    it('should fail if any member cannot move', () => {
      const group: GroupAction = { leader, members: [leader, member1, member2] } as any;
      const destination: Position = { x: 10, y: 10 } as any;
      
      // Member1 blocked
      moveFunction = (character: Character, _: Position) => {
        return character.id !== member1.id;
      };
      
      const result = executeGroupMove(group, destination, moveFunction, getPosition);
      
      expect(result.success).toBe(false);
    });

    it('should fail if leader has no position', () => {
      positions.delete(leader.id);
      
      const group: GroupAction = { leader, members: [leader, member1] } as any;
      const destination: Position = { x: 10, y: 10 } as any;
      
      const result = executeGroupMove(group, destination, moveFunction, getPosition);
      
      expect(result.success).toBe(false);
    });
  });
});

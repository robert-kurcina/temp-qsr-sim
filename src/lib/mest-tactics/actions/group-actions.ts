/**
 * Group Actions System (QSR)
 * 
 * Multiple models can coordinate to perform actions together.
 * When performing Group Actions:
 * - One model is designated as the Leader
 * - All members must be Attentive and Ordered
 * - Members must be within Cohesion of the Leader
 * - Group actions receive bonuses based on number of participants
 */

import { Character } from '../core/Character';
import { TestContext } from '../utils/TestContext';
import { Position } from '../battlefield/Position';

export interface GroupAction {
  /** Leader character coordinating the action */
  leader: Character;
  /** All participating members (includes leader) */
  members: Character[];
  /** Target of the group action (if applicable) */
  target?: Character;
  /** Action type being performed */
  actionType?: 'move' | 'ranged' | 'close-combat' | 'disengage';
}

export interface GroupActionResult {
  /** Whether the group action was successful */
  success: boolean;
  /** Individual results for each member */
  memberResults: Array<{
    character: Character;
    success: boolean;
    score?: number;
  }>;
  /** Group bonus applied */
  groupBonus: number;
}

/**
 * Create a group action from a leader and members
 */
export function createGroupAction(leader: Character, members: Character[]): GroupAction {
  const uniq = new Map<string, Character>();
  for (const member of members) {
    if (!member) continue;
    // Only include Attentive and Ordered characters
    if (member.state.isAttentive && member.state.isOrdered) {
      uniq.set(member.id, member);
    }
  }
  // Ensure leader is included
  if (!uniq.has(leader.id) && leader.state.isAttentive && leader.state.isOrdered) {
    uniq.set(leader.id, leader);
  }
  return { 
    leader, 
    members: Array.from(uniq.values()),
  };
}

/**
 * Build context for group action tests
 */
export function buildGroupActionContext(context: TestContext = {}): TestContext {
  return { ...context, isGroupAction: true };
}

/**
 * Check if all members are within Cohesion of the leader
 * QSR: Cohesion = half Visibility (rounded), max 8 MU (Line 1168)
 */
export function validateGroupCohesion(
  group: GroupAction,
  getCharacterPosition: (character: Character) => Position | undefined,
  visibilityOrMu: number = 16 // Default: Day Clear
): boolean {
  const leaderPos = getCharacterPosition(group.leader);
  if (!leaderPos) {
    return false;
  }

  // QSR: Cohesion = half Visibility OR, max 8 MU
  const cohesionDistance = Math.min(8, Math.floor(visibilityOrMu / 2));

  for (const member of group.members) {
    if (member.id === group.leader.id) {
      continue;
    }

    const memberPos = getCharacterPosition(member);
    if (!memberPos) {
      return false;
    }

    const distance = Math.sqrt(
      Math.pow(memberPos.x - leaderPos.x, 2) +
      Math.pow(memberPos.y - leaderPos.y, 2)
    );

    if (distance > cohesionDistance) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate group action bonus based on number of participants
 * QSR: Outnumber - +1 Wild die per extra Friendly in Melee Range
 * For group actions, apply similar logic
 */
export function calculateGroupBonus(group: GroupAction): number {
  // Base bonus: +1 per additional member beyond the first
  return Math.max(0, group.members.length - 1);
}

/**
 * Execute a group ranged attack
 * All members attack the same target, best roll counts
 */
export function executeGroupRangedAttack(
  group: GroupAction,
  target: Character,
  attackFunction: (attacker: Character, defender: Character) => { hit: boolean; score?: number },
  context: TestContext = {}
): GroupActionResult {
  const memberResults: Array<{
    character: Character;
    success: boolean;
    score?: number;
  }> = [];

  let bestScore = -Infinity;
  let anyHit = false;

  for (const member of group.members) {
    const result = attackFunction(member, target);
    memberResults.push({
      character: member,
      success: result.hit,
      score: result.score,
    });

    if (result.hit) {
      anyHit = true;
    }
    if (result.score !== undefined && result.score > bestScore) {
      bestScore = result.score;
    }
  }

  return {
    success: anyHit,
    memberResults,
    groupBonus: calculateGroupBonus(group),
  };
}

/**
 * Execute a group close combat attack
 * All members attack the same target, bonuses stack
 */
export function executeGroupCloseCombat(
  group: GroupAction,
  target: Character,
  attackFunction: (attacker: Character, defender: Character, bonus: number) => { hit: boolean; score?: number },
  context: TestContext = {}
): GroupActionResult {
  const groupBonus = calculateGroupBonus(group);
  const memberResults: Array<{
    character: Character;
    success: boolean;
    score?: number;
  }> = [];

  let anyHit = false;

  for (const member of group.members) {
    const result = attackFunction(member, target, groupBonus);
    memberResults.push({
      character: member,
      success: result.hit,
      score: result.score,
    });

    if (result.hit) {
      anyHit = true;
    }
  }

  return {
    success: anyHit,
    memberResults,
    groupBonus,
  };
}

/**
 * Execute a group move action
 * All members move together, maintaining cohesion
 */
export function executeGroupMove(
  group: GroupAction,
  destination: Position,
  moveFunction: (character: Character, dest: Position) => boolean,
  getCharacterPosition: (character: Character) => Position | undefined
): GroupActionResult {
  const memberResults: Array<{
    character: Character;
    success: boolean;
    score?: number;
  }> = [];

  let allSuccess = true;

  // Calculate offset for each member to maintain formation
  const leaderPos = getCharacterPosition(group.leader);
  if (!leaderPos) {
    return {
      success: false,
      memberResults: [],
      groupBonus: 0,
    };
  }

  for (const member of group.members) {
    const memberPos = getCharacterPosition(member);
    if (!memberPos) {
      allSuccess = false;
      memberResults.push({
        character: member,
        success: false,
      });
      continue;
    }

    // Calculate relative position from leader
    const offsetX = memberPos.x - leaderPos.x;
    const offsetY = memberPos.y - leaderPos.y;

    // Target position for this member
    const targetPos: Position = {
      x: destination.x + offsetX,
      y: destination.y + offsetY,
    };

    const moved = moveFunction(member, targetPos);
    memberResults.push({
      character: member,
      success: moved,
    });

    if (!moved) {
      allSuccess = false;
    }
  }

  return {
    success: allSuccess,
    memberResults,
    groupBonus: 0,
  };
}

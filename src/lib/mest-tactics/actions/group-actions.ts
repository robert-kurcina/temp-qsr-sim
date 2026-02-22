import { Character } from '../core/Character';
import { TestContext } from '../utils/TestContext';

export interface GroupAction {
  leader: Character;
  members: Character[];
}

export function createGroupAction(leader: Character, members: Character[]): GroupAction {
  const uniq = new Map<string, Character>();
  for (const member of members) {
    if (!member) continue;
    uniq.set(member.id, member);
  }
  if (!uniq.has(leader.id)) {
    uniq.set(leader.id, leader);
  }
  return { leader, members: Array.from(uniq.values()) };
}

export function buildGroupActionContext(context: TestContext = {}): TestContext {
  return { ...context, isGroupAction: true };
}

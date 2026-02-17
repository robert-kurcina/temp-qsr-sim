import { Character } from '../Character';
import { Item } from '../Item';
import { GroupAction, buildGroupActionContext, createGroupAction } from '../group-actions';
import { TestContext } from '../TestContext';

export interface GroupActionDeps {
  executeRangedAttack: (
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: { context?: TestContext }
  ) => unknown;
  executeCloseCombatAttack: (
    attacker: Character,
    defender: Character,
    weapon: Item,
    options: { context?: TestContext }
  ) => unknown;
}

export function createGroupActionWrapper(leader: Character, members: Character[]): GroupAction {
  return createGroupAction(leader, members);
}

export function executeGroupRangedAttack(
  deps: GroupActionDeps,
  group: GroupAction,
  defender: Character,
  weapon: Item,
  options: { context?: TestContext } = {}
) {
  const context = buildGroupActionContext(options.context ?? {});
  return deps.executeRangedAttack(group.leader, defender, weapon, {
    ...options,
    context,
  });
}

export function executeGroupCloseCombatAttack(
  deps: GroupActionDeps,
  group: GroupAction,
  defender: Character,
  weapon: Item,
  options: { context?: TestContext } = {}
) {
  const context = buildGroupActionContext(options.context ?? {});
  return deps.executeCloseCombatAttack(group.leader, defender, weapon, {
    ...options,
    context,
  });
}

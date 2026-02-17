import { describe, it, expect } from 'vitest';
import { Character } from './Character';
import type { Profile } from './Profile';
import { createGroupAction, buildGroupActionContext } from './group-actions';

const makeProfile = (name: string): Profile => ({
  name,
  archetype: { attributes: { cca: 0, rca: 0, ref: 2, int: 0, pow: 0, str: 0, for: 0, mov: 4, siz: 3 } },
  items: [],
  totalBp: 0,
  adjustedBp: 0,
  adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
  physicality: 0,
  adjPhysicality: 0,
  durability: 0,
  adjDurability: 0,
  burden: { totalLaden: 0, totalBurden: 0 },
  totalHands: 0,
  totalDeflect: 0,
  totalAR: 0,
  finalTraits: [],
  allTraits: [],
});

describe('group-actions', () => {
  it('should ensure leader is included and members are unique', () => {
    const leader = new Character(makeProfile('Leader'));
    const ally = new Character(makeProfile('Ally'));
    const group = createGroupAction(leader, [ally, leader]);
    expect(group.members.length).toBe(2);
  });

  it('should mark context as group action', () => {
    const context = buildGroupActionContext({});
    expect(context.isGroupAction).toBe(true);
  });
});

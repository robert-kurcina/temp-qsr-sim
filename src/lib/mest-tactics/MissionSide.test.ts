import { describe, it, expect } from 'vitest';
import { buildAssembly, buildProfile } from './assembly-builder';
import { createMissionSide } from './MissionSide';

const archetypeName = 'Veteran';
const itemName = 'Sword, Broad';

describe('MissionSide', () => {
  it('assigns call signs and portrait coordinates', () => {
    const profileOptions = { itemNames: [itemName] };
    const profile = buildProfile(archetypeName, profileOptions);
    const profiles = [profile];
    const assemblyName = 'Demo Assembly';
    const roster = buildAssembly(assemblyName, profiles);
    const rosters = [roster];
    const sideName = 'Side A';
    const side = createMissionSide(sideName, rosters);
    const expectedName = 'AA-00';
    const expectedColumn = 0;
    const expectedRow = 0;

    const expectedMembers = 1;
    expect(side.name).toBe(sideName);
    expect(side.members.length).toBe(expectedMembers);

    const member = side.members[0];
    expect(member.id).toBe(expectedName);
    expect(member.character.id).toBe(expectedName);
    expect(member.character.name).toBe(expectedName);
    expect(member.portrait.column).toBe(expectedColumn);
    expect(member.portrait.row).toBe(expectedRow);
  });
});

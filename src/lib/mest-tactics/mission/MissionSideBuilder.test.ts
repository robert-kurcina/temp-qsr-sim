import { describe, it, expect } from 'vitest';
import { buildAssembly, buildProfile } from './assembly-builder';
import { buildMissionSide, formatMissionSideSummary, formatMissionSideCompactSummary } from './MissionSideBuilder';

describe('MissionSideBuilder', () => {
  it('merges assemblies when requested', () => {
    const archetypeName = 'Veteran';
    const swordName = 'Sword, Broad';
    const rifleName = 'Rifle, Medium, Semi/A';
    const profileOneOptions = { itemNames: [swordName] };
    const profileTwoOptions = { itemNames: [rifleName] };
    const profileOne = buildProfile(archetypeName, profileOneOptions);
    const profileTwo = buildProfile(archetypeName, profileTwoOptions);
    const rosterOneName = 'Alpha';
    const rosterTwoName = 'Bravo';
    const rosterOneProfiles = [profileOne];
    const rosterTwoProfiles = [profileTwo];
    const rosterOne = buildAssembly(rosterOneName, rosterOneProfiles);
    const rosterTwo = buildAssembly(rosterTwoName, rosterTwoProfiles);
    const rosters = [rosterOne, rosterTwo];
    const sideName = 'Merged Side';
    const options = { mergeAssemblies: true };

    const side = buildMissionSide(sideName, rosters, options);

    const expectedAssemblies = 1;
    const expectedMembers = 2;
    const firstId = 'AA-00';
    const secondId = 'AA-10';

    expect(side.assemblies.length).toBe(expectedAssemblies);
    expect(side.members.length).toBe(expectedMembers);
    expect(side.members[0].id).toBe(firstId);
    expect(side.members[1].id).toBe(secondId);
  });

  it('formats a compact mission side summary', () => {
    const archetypeName = 'Veteran';
    const itemName = 'Sword, Broad';
    const profileOptions = { itemNames: [itemName] };
    const profile = buildProfile(archetypeName, profileOptions);
    const rosterName = 'Alpha';
    const rosterProfiles = [profile];
    const roster = buildAssembly(rosterName, rosterProfiles);
    const rosters = [roster];
    const sideName = 'Summary Side';
    const side = buildMissionSide(sideName, rosters);

    const summary = formatMissionSideSummary(side);
    const expectedMemberId = 'AA-00';
    const expectedAssemblies = 1;
    const expectedMembers = 1;

    expect(summary.id).toBe(sideName);
    expect(summary.assemblies.length).toBe(expectedAssemblies);
    expect(summary.members.length).toBe(expectedMembers);
    expect(summary.members[0].id).toBe(expectedMemberId);
    expect(summary.members[0].portrait.column).toBe(0);
    expect(summary.members[0].portrait.row).toBe(0);
  });

  it('formats a compact summary without member detail', () => {
    const archetypeName = 'Veteran';
    const itemName = 'Sword, Broad';
    const profileOptions = { itemNames: [itemName] };
    const profile = buildProfile(archetypeName, profileOptions);
    const rosterName = 'Alpha';
    const rosterProfiles = [profile];
    const roster = buildAssembly(rosterName, rosterProfiles);
    const rosters = [roster];
    const sideName = 'Compact Side';
    const side = buildMissionSide(sideName, rosters);

    const summary = formatMissionSideCompactSummary(side);
    const expectedMembers = 1;
    const expectedAssemblies = 1;

    expect(summary.totalCharacters).toBe(expectedMembers);
    expect(summary.assemblies.length).toBe(expectedAssemblies);
  });
});

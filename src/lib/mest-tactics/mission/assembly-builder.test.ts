import { describe, it, expect } from 'vitest';
import { buildAssembly, buildProfile, GameSize, mergeAssemblyRosters } from './assembly-builder';
import { gameData } from '../../data';

describe('assembly-builder', () => {
  it('buildProfile should create a profile with equipment populated', () => {
    const archetypeName = 'Veteran';
    const itemName = 'Sword, Broad';
    const options = { itemNames: [itemName] };
    const profile = buildProfile(archetypeName, options);

    expect(profile.name).toContain('veteran');
    expect(profile.items?.length).toBe(1);
    expect(profile.items?.[0].name).toBe(itemName);
    expect(profile.equipment).toEqual(profile.items);
  });

  it('buildAssembly should create characters and totals from profiles', () => {
    const archetypeName = 'Veteran';
    const swordName = 'Sword, Broad';
    const rifleName = 'Rifle, Medium, Semi/A';

    const profileOneOptions = { itemNames: [swordName] };
    const profileTwoOptions = { itemNames: [rifleName] };
    const profileOne = buildProfile(archetypeName, profileOneOptions);
    const profileTwo = buildProfile(archetypeName, profileTwoOptions);
    const profiles = [profileOne, profileTwo];

    const name = 'Test Assembly';
    const roster = buildAssembly(name, profiles);

    const expectedTotalBp = (profileOne.adjustedBp ?? profileOne.totalBp ?? 0)
      + (profileTwo.adjustedBp ?? profileTwo.totalBp ?? 0);

    expect(roster.assembly.name).toBe(name);
    expect(roster.assembly.totalCharacters).toBe(2);
    expect(roster.assembly.totalBP).toBe(expectedTotalBp);
    expect(roster.characters.length).toBe(2);
    expect(roster.assembly.characters).toEqual([profileOne.name, profileTwo.name]);
    expect(roster.assembly.config).toEqual({
      bpLimitMin: 125,
      bpLimitMax: 250,
      characterLimitMin: 2,
      characterLimitMax: 4,
      gameSize: GameSize.VERY_SMALL,
    });
  });

  it('buildAssembly should honor gameSize defaults', () => {
    const archetypeName = 'Veteran';
    const itemName = 'Sword, Broad';
    const profileOptions = { itemNames: [itemName] };
    const profile = buildProfile(archetypeName, profileOptions);
    const assemblyName = 'Sized Assembly';
    const profiles = [profile];
    const config = { gameSize: GameSize.SMALL };
    const roster = buildAssembly(assemblyName, profiles, config);

    expect(roster.assembly.config).toEqual({
      bpLimitMin: 250,
      bpLimitMax: 500,
      characterLimitMin: 4,
      characterLimitMax: 8,
      gameSize: GameSize.SMALL,
    });
  });

  it('buildAssembly should allow config overrides', () => {
    const archetypeName = 'Veteran';
    const itemName = 'Sword, Broad';
    const profileOptions = { itemNames: [itemName] };
    const profile = buildProfile(archetypeName, profileOptions);
    const assemblyName = 'Override Assembly';
    const profiles = [profile];
    const config = {
      bpLimitMin: 300,
      bpLimitMax: 600,
      characterLimitMin: 3,
      characterLimitMax: 7,
      gameSize: GameSize.MEDIUM,
    };
    const roster = buildAssembly(assemblyName, profiles, config);

    expect(roster.assembly.config).toEqual({
      bpLimitMin: 300,
      bpLimitMax: 600,
      characterLimitMin: 3,
      characterLimitMax: 7,
      gameSize: GameSize.MEDIUM,
    });
  });

  it('mergeAssemblyRosters should combine totals and configs', () => {
    const archetypeName = 'Veteran';
    const swordName = 'Sword, Broad';
    const rifleName = 'Rifle, Medium, Semi/A';
    const profileOneOptions = { itemNames: [swordName] };
    const profileTwoOptions = { itemNames: [rifleName] };
    const profileOne = buildProfile(archetypeName, profileOneOptions);
    const profileTwo = buildProfile(archetypeName, profileTwoOptions);
    const firstRosterName = 'Alpha';
    const secondRosterName = 'Bravo';
    const firstRosterProfiles = [profileOne];
    const secondRosterProfiles = [profileTwo];
    const firstRoster = buildAssembly(firstRosterName, firstRosterProfiles);
    const secondRoster = buildAssembly(secondRosterName, secondRosterProfiles);
    const rosters = [firstRoster, secondRoster];
    const mergedName = 'Combined';

    const merged = mergeAssemblyRosters(mergedName, rosters);

    const expectedTotalBp = (profileOne.adjustedBp ?? profileOne.totalBp ?? 0)
      + (profileTwo.adjustedBp ?? profileTwo.totalBp ?? 0);

    expect(merged.assembly.name).toBe(mergedName);
    expect(merged.assembly.totalCharacters).toBe(2);
    expect(merged.assembly.totalBP).toBe(expectedTotalBp);
    expect(merged.characters.length).toBe(2);
    expect(merged.assembly.config).toEqual({
      bpLimitMin: 250,
      bpLimitMax: 500,
      characterLimitMin: 4,
      characterLimitMax: 8,
      gameSize: 'MERGED',
    });
  });
});

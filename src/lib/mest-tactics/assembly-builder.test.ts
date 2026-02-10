import { describe, it, expect } from 'vitest';
import { buildAssembly, buildProfile, GameSize } from './assembly-builder';
import { gameData } from '../data';

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

    const profileOne = buildProfile(archetypeName, { itemNames: [swordName] });
    const profileTwo = buildProfile(archetypeName, { itemNames: [rifleName] });
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
    const profile = buildProfile('Veteran', { itemNames: ['Sword, Broad'] });
    const roster = buildAssembly('Sized Assembly', [profile], { gameSize: GameSize.SMALL });

    expect(roster.assembly.config).toEqual({
      bpLimitMin: 250,
      bpLimitMax: 500,
      characterLimitMin: 4,
      characterLimitMax: 8,
      gameSize: GameSize.SMALL,
    });
  });

  it('buildAssembly should allow config overrides', () => {
    const profile = buildProfile('Veteran', { itemNames: ['Sword, Broad'] });
    const roster = buildAssembly('Override Assembly', [profile], {
      bpLimitMin: 300,
      bpLimitMax: 600,
      characterLimitMin: 3,
      characterLimitMax: 7,
      gameSize: GameSize.MEDIUM,
    });

    expect(roster.assembly.config).toEqual({
      bpLimitMin: 300,
      bpLimitMax: 600,
      characterLimitMin: 3,
      characterLimitMax: 7,
      gameSize: GameSize.MEDIUM,
    });
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { createProfiles } from './profile-generator';
import { Archetype } from './Archetype';
import { gameData } from '../data'; // Using the bundled data

describe('createProfiles', () => {
  let veteranArchetypeData: Archetype;
  const veteranArchetypeName = 'Veteran';

  beforeEach(() => {
    veteranArchetypeData = {
      species: 'Humanoid',
      attributes: { cca: 3, rca: 3, ref: 3, int: 2, pow: 3, str: 2, for: 2, mov: 2, siz: 3 },
      traits: ['Grit'],
      bp: 61,
      class: 'Common'
    };
  });

  it('should create a single profile with a specified primary item', () => {
    const primaryItemName = 'Sword, Broad';
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], primaryItemName);

    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.name).toBe('veteran-sword-broad');
    
    // Verify the nested archetype structure
    expect(profile.archetype).toHaveProperty(veteranArchetypeName);
    expect(profile.archetype[veteranArchetypeName]).toEqual(veteranArchetypeData);

    expect(profile.items).toHaveLength(1);
    expect(profile.items[0].name).toBe(primaryItemName);

    // Verify the BP calculation and trait combination
    const swordData = gameData.melee_weapons['Sword, Broad'];
    expect(profile.totalBp).toBe(veteranArchetypeData.bp + swordData.bp);
    expect(profile.finalTraits).toEqual(['Grit']);
  });

  it('should combine and level up traits correctly', () => {
    veteranArchetypeData.traits.push('Grit'); 
    const primaryItemName = 'Sword, Broad';

    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], primaryItemName);
    const profile = profiles[0];

    expect(profile.finalTraits).toEqual(['Grit 2']);
  });

  it('should handle traits that already have levels', () => {
    veteranArchetypeData.traits.push('Grit 2');
    const primaryItemName = 'Sword, Broad';

    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], primaryItemName);
    const profile = profiles[0];

    expect(profile.finalTraits).toContain('Grit 3');
  });

  it('should generate profiles for all allowed item classes', () => {
    const allowedClasses = ['Melee'];
    const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, allowedClasses);

    expect(profiles.length).toBeGreaterThan(0);

    profiles.forEach(profile => {
      const item = profile.items[0];
      const isAllowed = item.classification.includes('Melee') || item.name === 'Unarmed' || item.name === 'Improvised Weapon';
      expect(isAllowed).toBe(true);
    });
  });
});

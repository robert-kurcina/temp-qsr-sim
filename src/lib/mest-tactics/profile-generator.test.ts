
import { describe, it, expect } from 'vitest';
import { createProfiles } from './profile-generator';
import { Archetype } from './Archetype';
import { gameData } from '../data';

describe('createProfiles', () => {
  const veteranArchetype: Archetype = {
    species: 'Humanoid',
    ...gameData.archetypes.Veteran,
  };

  it('should generate a single profile for a specific primary item', () => {
    const profiles = createProfiles(veteranArchetype, [], 'Sword, Broad');
    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.name).toBe('Humanoid-sword-broad');
    expect(profile.equipment).toHaveLength(1);
    expect(profile.equipment[0].name).toBe('Sword, Broad');
    expect(profile.totalBp).toBe(veteranArchetype.bp + gameData.melee_weapons['Sword, Broad'].bp);
  });

  it('should generate profiles for allowed item classes', () => {
    const allowedClasses = ['Melee'];
    const profiles = createProfiles(veteranArchetype, allowedClasses);

    // 1. Check that a reasonable number of profiles are generated.
    const expectedMinimum = 2; // Unarmed and Improvised
    expect(profiles.length).toBeGreaterThan(expectedMinimum);

    // 2. Check that a specific, known melee weapon is included.
    const broadSwordProfile = profiles.find(p => p.equipment[0].name === 'Sword, Broad');
    expect(broadSwordProfile).toBeDefined();
    expect(broadSwordProfile?.totalBp).toBe(veteranArchetype.bp + gameData.melee_weapons['Sword, Broad'].bp);

    // 3. Check that all generated profiles are of the correct classification.
    const areAllMeleeOrUnarmed = profiles.every(p => 
        p.equipment[0].classification === 'Melee' || 
        p.equipment[0].classification === 'Natural' ||
        p.equipment[0].name === 'Unarmed'
    );
    expect(areAllMeleeOrUnarmed).toBe(true);
  });

  it('should always include Unarmed and Improvised items', () => {
    const profiles = createProfiles(veteranArchetype, []);
    const unarmedProfile = profiles.find(p => p.equipment[0].name === 'Unarmed');
    const improvisedProfile = profiles.find(p => p.equipment.some(e => e.name.includes('Improvised')));
    expect(unarmedProfile).toBeDefined();
    expect(improvisedProfile).toBeDefined();
  });

  it('should throw an error for an invalid primary item name', () => {
    expect(() => createProfiles(veteranArchetype, [], 'Non-existent Item')).toThrow(
      'Primary item "Non-existent Item" not found.'
    );
  });
});

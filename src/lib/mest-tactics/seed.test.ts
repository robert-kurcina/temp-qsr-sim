
import { describe, it, expect, beforeAll } from 'vitest';
import { databaseService } from './database';

describe('Seeded Database Content', () => {

  beforeAll(async () => {
    await databaseService.read();
  });

  it('should contain 183 profiles', () => {
    console.log('Number of profiles found:', databaseService.profiles.length);
    console.log('Sample profiles:', JSON.stringify(databaseService.profiles.slice(0, 5), null, 2));
    expect(databaseService.profiles.length).toBe(183);
  });

  it('should contain 20 assemblies', () => {
    expect(databaseService.assemblies.length).toBe(20);
  });

  it('all profiles should have a name and an archetype', () => {
    for (const profile of databaseService.profiles) {
      console.log('Inspecting profile:', JSON.stringify(profile, null, 2));
      expect(profile.name).toBeTypeOf('string');
      expect(profile.name.length).toBeGreaterThan(0);
      expect(profile.archetype).toBeDefined();

      if (profile.archetype.attributes) {
        expect(typeof profile.archetype.name).toBe('string');
      } else {
        const archetypeKey = Object.keys(profile.archetype)[0];
        expect(archetypeKey).toBeTypeOf('string');
        expect(profile.archetype[archetypeKey].attributes).toBeDefined();
      }
    }
  });

  it('all assemblies should have a name and an array of character IDs', () => {
    for (const assembly of databaseService.assemblies) {
      expect(assembly.name).toBeTypeOf('string');
      expect(assembly.name.length).toBeGreaterThan(0);
      expect(Array.isArray(assembly.characters)).toBe(true);
      expect(assembly.characters.length).toBeGreaterThan(0);
    }
  });

  it('all character IDs in assemblies should correspond to an existing character', () => {
    const characterIds = new Set(databaseService.characters.map(c => c.id));
    for (const assembly of databaseService.assemblies) {
      for (const characterId of assembly.characters) {
        expect(characterIds.has(characterId)).toBe(true);
      }
    }
  });

  it('all characters should have a name, profile, and final attributes', () => {
    for (const character of databaseService.characters) {
        expect(character.name).toBeTypeOf('string');
        expect(character.profile).toBeDefined();
        expect(character.finalAttributes).toBeDefined();
    }
  });
});


import { describe, it, expect, beforeAll } from 'vitest';
import { databaseService } from './database';
import { Profile } from './Profile';
import { Assembly } from './Assembly';
import { Character } from './Character';

describe('Seeded Database Validation', () => {
  beforeAll(async () => {
    // Ensure the database is loaded before running tests
    await databaseService.read();
  });

  it('should contain 183 profiles', () => {
    expect(databaseService.profiles.length).toBe(183);
  });

  it('should contain 20 assemblies', () => {
    expect(databaseService.assemblies.length).toBe(20);
  });

  it('should contain a non-zero number of characters', () => {
    expect(databaseService.characters.length).toBeGreaterThan(0);
  });

  it('should have valid profile structures', () => {
    for (const profile of databaseService.profiles) {
      expect(profile).toBeDefined();
      expect(typeof profile.name).toBe('string');
      expect(profile.archetype).toBeDefined();
      if (profile.archetype.attributes) {
        expect(typeof profile.archetype.name).toBe('string');
      } else {
        const archetypeKey = Object.keys(profile.archetype)[0];
        if (!archetypeKey) {
          console.error('Invalid profile:', profile);
        }
        expect(archetypeKey).toBeTypeOf('string');
        expect(profile.archetype[archetypeKey]).toBeDefined();
        expect(profile.archetype[archetypeKey].attributes).toBeDefined();
      }
    }
  });

  it('should have valid assembly structures', () => {
    // Check the first assembly for the correct structure
    const assembly = databaseService.assemblies[0];
    expect(assembly).toBeDefined();
    expect(typeof assembly.name).toBe('string');
    expect(Array.isArray(assembly.characters)).toBe(true);
    expect(assembly.characters.length).toBeGreaterThan(0);
    expect(typeof assembly.totalBP).toBe('number');
    expect(typeof assembly.totalCharacters).toBe('number');
  });

  it('assembly character IDs should correspond to actual characters', () => {
    const assembly = databaseService.assemblies[0];
    const characterIds = new Set(databaseService.characters.map(c => c.id));
    
    for (const charId of assembly.characters) {
      expect(characterIds.has(charId)).toBe(true);
    }
  });
});

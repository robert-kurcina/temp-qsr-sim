import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';

/**
 * Factory function to create a Character from a Profile.
 * This function ensures that:
 * 1. The Character is properly initialized with attributes from the archetype
 * 2. The finalAttributes are set correctly
 * 3. The profile's archetype is properly stored
 */
export async function createCharacter(profile: Profile): Promise<Character> {
  // Create the character - the constructor will handle extracting attributes from archetype
  const character = new Character(profile);
  return character;
}

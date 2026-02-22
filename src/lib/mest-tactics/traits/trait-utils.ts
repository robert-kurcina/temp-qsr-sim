
import { Trait } from '../core/Trait';

/**
 * Finds a specific trait by name from a list of traits.
 * @param traits - The list of traits to search.
 * @param traitName - The base name of the trait to find (e.g., "Fear").
 * @returns The found trait or undefined.
 */
export function findTrait(traits: Trait[], traitName: string): Trait | undefined {
  return traits.find(t => t.name.toLowerCase() === traitName.toLowerCase());
}

/**
 * Finds a trait that starts with a specific prefix.
 * Useful for traits with values like "Fear X".
 * @param traits - The list of traits to search.
 * @param prefix - The prefix to search for (e.g., "Fear").
 * @returns The found trait or undefined.
 */
export function findTraitByPrefix(traits: Trait[], prefix: string): Trait | undefined {
    // We want to match "Fear" but not "Fearless", so we check for a space or the end of the string.
    const pattern = new RegExp(`^${prefix.toLowerCase()}(\\s|$)`);
    return traits.find(t => t.name.toLowerCase().match(pattern));
}


/**
 * Parses the numeric value from a trait name (e.g., "Fear 3" -> 3).
 * If the trait exists but has no number, it's considered to have a value of 0.
 * If the trait doesn't exist, it returns 0.
 * @param trait - The trait to parse.
 * @returns The numeric value or 0 if not found/specified.
 */
export function getTraitValue(trait: Trait | undefined): number {
  if (!trait) {
    return 0;
  }
  // Match a number at the end of the string.
  const match = trait.name.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

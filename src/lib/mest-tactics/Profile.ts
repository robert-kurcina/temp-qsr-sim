import { Archetype } from './Archetype';
import { Item } from './Item';

/**
 * Represents an Archetype that has been equipped with a specific loadout of Items.
 * This is a standardized, battlefield-ready role.
 */
export interface Profile {
  /**
   * The name of the profile, e.g., "Veteran with Spear".
   */
  name: string;

  /**
   * The base archetype for this profile.
   */
  archetype: Archetype;

  /**
   * The list of items that make up this profile's loadout.
   */
  equipment: Item[];

  /**
   * The total Build Point cost of the profile (archetype bp + equipment bp).
   */
  totalBp: number;
}

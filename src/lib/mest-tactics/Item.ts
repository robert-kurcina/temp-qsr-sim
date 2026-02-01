import { Trait } from './Trait';

/**
 * Represents a single piece of equipment, such as a weapon, armor, or other gear.
 */
export interface Item {
  /**
   * The unique name of the item, e.g., "Axe, Battle".
   */
  name: string;

  /**
   * The item's classification, e.g., "Melee", "Armor", "Natural".
   */
  class: string;

  /**
   * The Build Point cost of the item.
   */
  bp: number;

  /**
   * The range of the item, which can be a number or a formula string like "STR+2".
   */
  or?: string | number;

  /**
   * The accuracy modifier of the item, e.g., "-", "+1m".
   */
  accuracy?: string;

  /**
   * The impact value of the item, which reduces armor.
   */
  impact?: number;

  /**
   * The damage formula for the item, e.g., "STR+1w", "2+1b".
   */
  dmg?: string;

  /**
   * The raw list of trait strings associated with the item.
   * These will be parsed into structured Trait objects.
   */
  traits: string[];
}

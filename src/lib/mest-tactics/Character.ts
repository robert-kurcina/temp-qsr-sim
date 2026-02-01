
import { Item } from './Item';
import { Profile } from './Profile';
import { Trait } from './Trait';

/**
 * Represents the final, calculated attributes of a character after applying
 * all modifiers from their archetype and equipment.
 */
export type FinalAttributes = Record<string, number>;

/**
 * Represents the state of a character's armor, broken down by type.
 * This is calculated from their equipped armor items.
 */
export interface ArmorState {
  total: number;
  suit: number;
  gear: number;
  shield: number;
  helm: number;
}

/**
 * Represents a single character in the game, combining their profile,
 * final attributes, and current game state.
 */
export interface Character {
  /**
   * A unique identifier for the character instance.
   */
  id: string;

  /**
   * The character's name, e.g., "Grom the Fierce".
   */
  name: string;

  /**
   * The base profile from which the character was created, including their
   * archetype and equipment.
   */
  profile: Profile;

  /**
   * The final, calculated attributes (e.g., CCA, STR, FOR) after all
   * modifiers have been applied.
   */
  finalAttributes: FinalAttributes;

  /**
   * The structured list of all traits the character possesses, parsed from both
   * the archetype and all of its equipment.
   */
  allTraits: Trait[];

  /**
   * Tracks the character's current state during a game.
   */
  state: {
    wounds: number;
    delayTokens: number;
    fearTokens: number;
    isHidden: boolean;
    isWaiting: boolean;
    isDisordered: boolean;
    isDistracted: boolean;
    statusEffects: string[]; // e.g., ['Confused']
    
    /**
     * The character's current armor rating, calculated from their equipment.
     */
    armor: ArmorState;
  };
}

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

import { FinalAttributes } from './Attributes';

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

// Re-export FinalAttributes for convenience
export { FinalAttributes };

import { Attributes } from './Attributes';

/**
 * Represents a base template for a unit, containing its core attributes and traits.
 * This is the raw data loaded from archetypes.json.
 */
export interface Archetype {
  name?: string; // Backward compatibility
  attributes: Attributes;
  traits: string[];
  bp: number;
  species: string;
  class?: string;
}

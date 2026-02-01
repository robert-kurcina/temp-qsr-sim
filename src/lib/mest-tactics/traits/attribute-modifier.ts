import { Attributes } from '../Attributes';
import { Trait } from '../Trait';

// A type guard to ensure we are only dealing with valid attribute keys.
// This prevents a trait like "Sword 2" from trying to modify a non-existent attribute.
type AttributeKey = keyof Attributes;
const validAttributeKeys = new Set<string>(['cca', 'rca', 'ref', 'int', 'pow', 'str', 'for', 'mov', 'siz']);

export const attributeModifier = {
  /**
   * A generic hook for traits that directly modify a primary attribute.
   * It handles traits like "INT 3", "STR 2", "cca 1", etc.
   * The logic is case-insensitive regarding the trait name.
   * @param attributes The character's attributes object to be modified.
   * @param trait The structured trait object (e.g., { name: 'INT', level: 3 }).
   */
  onAttributeCalculation: (attributes: Attributes, trait: Trait) => {
    const attributeKey = trait.name.toLowerCase() as AttributeKey;

    // We validate that the trait name is actually a valid attribute key and has a level.
    if (validAttributeKeys.has(attributeKey) && trait.level) {
      // Dynamically access and modify the correct attribute.
      attributes[attributeKey] += trait.level;
    }
  },
};

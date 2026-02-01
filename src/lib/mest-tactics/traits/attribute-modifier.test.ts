
import { describe, it, expect } from 'vitest';
import { attributeModifier } from './attribute-modifier';
import type { Attributes } from '../Attributes';
import type { Trait } from '../Trait';

describe('attributeModifier.onAttributeCalculation', () => {

  // Helper function to create a base set of attributes for each test
  const createBaseAttributes = (): Attributes => ({
    cca: 1, rca: 1, ref: 1, int: 1, pow: 1, str: 1, 'for': 1, mov: 1, siz: 1,
  });

  it('should correctly increase the specified attribute', () => {
    const attributes = createBaseAttributes();
    const trait: Trait = { name: 'STR', level: 3, source: 'STR 3' };

    attributeModifier.onAttributeCalculation(attributes, trait);

    expect(attributes.str).toBe(4); // 1 + 3
  });

  it('should be case-insensitive to the trait name', () => {
    const attributes = createBaseAttributes();
    const trait: Trait = { name: 'pOw', level: 2, source: 'pOw 2' };

    attributeModifier.onAttributeCalculation(attributes, trait);

    expect(attributes.pow).toBe(3); // 1 + 2
  });

  it('should not modify other attributes', () => {
    const attributes = createBaseAttributes();
    const trait: Trait = { name: 'REF', level: 5, source: 'REF 5' };

    attributeModifier.onAttributeCalculation(attributes, trait);

    expect(attributes.ref).toBe(6); // Changed
    expect(attributes.cca).toBe(1); // Unchanged
    expect(attributes.int).toBe(1); // Unchanged
  });

  it('should do nothing if the trait name is not a valid attribute', () => {
    const attributes = createBaseAttributes();
    const originalAttributes = { ...attributes };
    const trait: Trait = { name: 'Sturdy', level: 2, source: 'Sturdy 2' };

    attributeModifier.onAttributeCalculation(attributes, trait);

    expect(attributes).toEqual(originalAttributes);
  });

  it('should do nothing if the trait does not have a level', () => {
    const attributes = createBaseAttributes();
    const originalAttributes = { ...attributes };
    const trait: Trait = { name: 'FOR', source: 'FOR' }; // No level property

    attributeModifier.onAttributeCalculation(attributes, trait);

    expect(attributes).toEqual(originalAttributes);
  });

  it('should handle a level of 0 correctly', () => {
    const attributes = createBaseAttributes();
    attributes.mov = 5;
    const trait: Trait = { name: 'MOV', level: 0, source: 'MOV 0' };

    attributeModifier.onAttributeCalculation(attributes, trait);

    expect(attributes.mov).toBe(5); // 5 + 0
  });
});

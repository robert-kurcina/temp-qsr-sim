
import { describe, it, expect } from 'vitest';
import { traitLogicRegistry } from './trait-logic-registry';
import { attributeModifier } from './traits/attribute-modifier';

describe('traitLogicRegistry', () => {
  const expectedAttributes = [
    'cca', 'rca', 'ref', 'int', 'pow', 'str', 'for', 'mov', 'siz'
  ];

  it('should be a defined object', () => {
    expect(traitLogicRegistry).toBeDefined();
    expect(typeof traitLogicRegistry).toBe('object');
  });

  it('should contain entries for all primary attributes', () => {
    expectedAttributes.forEach(attr => {
      expect(traitLogicRegistry).toHaveProperty(attr);
    });
  });

  it('should map all primary attribute keys to the attributeModifier logic module', () => {
    expectedAttributes.forEach(attr => {
      expect(traitLogicRegistry[attr]).toBe(attributeModifier);
    });
  });

  it('should not have entries for other undefined traits', () => {
    expect(traitLogicRegistry['sturdy']).toBeUndefined();
    expect(traitLogicRegistry['nonexistent']).toBeUndefined();
  });
});

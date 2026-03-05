
import { describe, it, expect } from 'vitest';
import { traitLogicRegistry } from './trait-logic-registry';
import { attributeModifier } from './attribute-modifier';

describe('traitLogicRegistry', () => {
  const expectedAttributes = [
    'cca', 'rca', 'ref', 'int', 'pow', 'str', 'for', 'mov', 'siz'
  ];

  it('should be a defined object', () => {
    expect(traitLogicRegistry).toBeDefined();
    expect(typeof traitLogicRegistry).toBe('object');
  });

  it('should contain entries for all primary attributes', () => {
    expectedAttributes.forEach((attr: any) => {
      expect(traitLogicRegistry).toHaveProperty(attr);
    });
  });

  it('should map all primary attribute keys to the attributeModifier logic module', () => {
    expectedAttributes.forEach((attr: any) => {
      expect((traitLogicRegistry as any)[attr]).toBe(attributeModifier);
    });
  });

  it('should not have entries for other undefined traits', () => {
    expect((traitLogicRegistry as any)['sturdy']).toBeUndefined();
    expect((traitLogicRegistry as any)['nonexistent']).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { Archetype } from './Archetype';
import archetypesData from '../../data/archetypes.json';

describe('Archetype', () => {
  it('should load a common archetype', () => {
    const vet = new Archetype('Veteran');
    expect(vet.name).toBe('Veteran');
    expect(vet.bp).toBe(61);
    expect(vet.class).toBe('Common');
    expect(vet.attributes.str).toBe(3);
    expect(vet.traits).toEqual(['Grit']);
  });

  it('should load variants for an archetype', () => {
    const vet = new Archetype('Veteran');
    expect(vet.variants).toHaveProperty('Wise');
    expect(vet.variants['Wise']).toEqual({
      bp: 20,
      adds: ['Leadership']
    });
  });

  it('should throw an error for an unknown archetype', () => {
    expect(() => new Archetype('Unknown')).toThrow('Unknown archetype: Unknown');
  });

  it('getVariant() should return variant data', () => {
    const vet = new Archetype('Veteran');
    const variantData = vet.getVariant('Wise');
    expect(variantData).not.toBeNull();
    expect(variantData.bp).toBe(20);
    expect(variantData.adds).toEqual(['Leadership']);
  });
  
  it('getTrait() should return the first trait', () => {
    const vet = new Archetype('Veteran');
    expect(vet.getTrait()).toBe('Grit');
    const untrained = new Archetype('Untrained');
    expect(untrained.getTrait()).toBeNull();
  });
});

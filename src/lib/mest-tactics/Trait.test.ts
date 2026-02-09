
import { describe, it, expect } from 'vitest';
import type { Trait } from './Trait';

describe('Trait Interface', () => {
  it('should correctly type a simple trait with a level', () => {
    const simpleTrait: Trait = {
      name: 'Sturdy',
      level: 3,
      source: 'Sturdy 3',
    };

    expect(simpleTrait.name).toBe('Sturdy');
    expect(simpleTrait.level).toBe(3);
    expect(simpleTrait.type).toBeUndefined();
    expect(simpleTrait.list).toBeUndefined();
    expect(simpleTrait.source).toBe('Sturdy 3');
  });

  it('should correctly type a trait with a specific type', () => {
    const typedTrait: Trait = {
      name: 'Damper',
      level: 4,
      type: 'Fear',
      source: 'Damper 4 > Fear',
    };

    expect(typedTrait.name).toBe('Damper');
    expect(typedTrait.level).toBe(4);
    expect(typedTrait.type).toBe('Fear');
    expect(typedTrait.list).toBeUndefined();
    expect(typedTrait.source).toBe('Damper 4 > Fear');
  });

  it('should correctly type a trait with a list', () => {
    const listTrait: Trait = {
      name: 'Augment',
      level: 2,
      list: ['Grit', 'Fight'],
      source: 'Augment 2 > [Grit, Fight]',
    };

    expect(listTrait.name).toBe('Augment');
    expect(listTrait.level).toBe(2);
    expect(listTrait.type).toBeUndefined();
    expect(listTrait.list).toEqual(['Grit', 'Fight']);
    expect(listTrait.source).toBe('Augment 2 > [Grit, Fight]');
  });

  it('should correctly type a trait with no level (e.g., an attribute)', () => {
    const attributeAsTrait: Trait = {
      name: 'STR',
      source: 'STR',
    };

    expect(attributeAsTrait.name).toBe('STR');
    expect(attributeAsTrait.level).toBeUndefined();
    expect(attributeAsTrait.source).toBe('STR');
  });
});


import { describe, it, expect } from 'vitest';
import { parseTrait } from './trait-parser';

describe('parseTrait', () => {
  it('should parse a simple trait with a numeric level', () => {
    const source = 'Sturdy 3';
    const trait = parseTrait(source);

    expect(trait.name).toBe('Sturdy');
    expect(trait.level).toBe(3);
    expect(trait.value).toBeUndefined(); // Verify the incorrect property is not used
    expect(trait.type).toBeUndefined();
    expect(trait.list).toBeUndefined();
    expect(trait.source).toBe(source);
  });

  it('should parse a simple trait without a numeric level', () => {
    const source = 'Fleet';
    const trait = parseTrait(source);

    expect(trait.name).toBe('Fleet');
    expect(trait.level).toBeUndefined();
    expect(trait.source).toBe(source);
  });

  it('should parse a trait with a specific type', () => {
    const source = 'Damper 4 > Fear';
    const trait = parseTrait(source);

    expect(trait.name).toBe('Damper');
    expect(trait.level).toBe(4);
    expect(trait.type).toBe('Fear');
    expect(trait.list).toBeUndefined();
    expect(trait.source).toBe(source);
  });

  it('should parse a trait with a list of keywords', () => {
    const source = 'Augment 2 > [Grit, Fight]';
    const trait = parseTrait(source);

    expect(trait.name).toBe('Augment');
    expect(trait.level).toBe(2);
    expect(trait.list).toEqual(['Grit', 'Fight']);
    expect(trait.type).toBeUndefined();
    expect(trait.source).toBe(source);
  });

  it('should handle extra whitespace gracefully', () => {
    const source = '  STR   5  ';
    const trait = parseTrait(source);

    expect(trait.name).toBe('STR');
    expect(trait.level).toBe(5);
    expect(trait.source).toBe(source);
  });

  it('should parse a complex list trait with extra spacing', () => {
    const source = '  Commander 1 > [ Tactical, Social ]  ';
    const trait = parseTrait(source);

    expect(trait.name).toBe('Commander');
    expect(trait.level).toBe(1);
    expect(trait.list).toEqual(['Tactical', 'Social']);
    expect(trait.source).toBe(source);
  });

  it('should return the source string as the name if no other pattern matches', () => {
    const source = 'Malformed Trait';
    const trait = parseTrait(source);

    expect(trait.name).toBe('Malformed Trait');
    expect(trait.level).toBeUndefined();
    expect(trait.type).toBeUndefined();
    expect(trait.list).toBeUndefined();
  });
});

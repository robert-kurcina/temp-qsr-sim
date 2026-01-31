import { describe, test, expect } from 'vitest';
import { TraitParser, Trait, TraitPackage } from './trait-parser.js';

describe('TraitParser', () => {
  test('should parse a simple trait', () => {
    const trait = TraitParser.parse('Flint');
    expect(trait.name).toBe('Flint');
    expect(trait.level).toBe(1);
    expect(trait.isDisability).toBe(false);
  });

  test('should parse a trait with a level', () => {
    const trait = TraitParser.parse('Armor 4');
    expect(trait.name).toBe('Armor');
    expect(trait.level).toBe(4);
  });

  test('should parse a trait with a default level', () => {
    const trait = TraitParser.parse('Armor X');
    expect(trait.name).toBe('Armor');
    expect(trait.level).toBe(1);
  });

  test('should parse a disability trait', () => {
    const trait = TraitParser.parse('[Blinders]');
    expect(trait.name).toBe('Blinders');
    expect(trait.isDisability).toBe(true);
  });
  
  test('should parse a disability trait with a level', () => {
    const trait = TraitParser.parse('[Laden 2]');
    expect(trait.name).toBe('Laden');
    expect(trait.level).toBe(2);
    expect(trait.isDisability).toBe(true);
  });

  test('should parse multiple disability traits', () => {
    const traits = TraitParser.parse('[Stub, Awkward]');
    expect(traits).toHaveLength(2);
    expect(traits[0].name).toBe('Stub');
    expect(traits[0].isDisability).toBe(true);
    expect(traits[1].name).toBe('Awkward');
    expect(traits[1].isDisability).toBe(true);
  });

  test('should parse a trait with a variation', () => {
    const trait = TraitParser.parse('Discard+');
    expect(trait.name).toBe('Discard');
    expect(trait.variation).toBe('+');
  });

  test('should parse a trait with dependencies', () => {
    const trait = TraitParser.parse('Claws > Poison');
    expect(trait.name).toBe('Claws');
    expect(trait.dependencies).toEqual(['Poison']);
  });

  test('should parse a trait with complex dependencies', () => {
    const trait = TraitParser.parse('ROF > {[Jitter, Feed, Jam]. Burst}');
    expect(trait.name).toBe('ROF');
    expect(trait.dependencies).toEqual(['[Jitter, Feed, Jam]', 'Burst']);
  });

  test('should parse a trait with a synonym', () => {
    const trait = TraitParser.parse('Carapaced (Medium Armor)');
    expect(trait.name).toBe('Carapaced');
    expect(trait.synonymFor).toBe('Medium Armor');
  });

  test('should parse a trait with classifiers and a see reference', () => {
    const trait = TraitParser.parse('Throwable — Asset. see [Discard]');
    expect(trait.name).toBe('Throwable');
    expect(trait.classifiers).toEqual(['asset']);
    expect(trait.see).toBe('[Discard]');
  });
});

describe('TraitParser.parsePackage', () => {
    test('should parse a simple trait package', () => {
        const pkg = TraitParser.parsePackage('Warrior { Melee 2, [Tough] }');
        expect(pkg.name).toBe('Warrior');
        expect(pkg.traits).toHaveLength(2);
        expect(pkg.traits[0].name).toBe('Melee');
        expect(pkg.traits[0].level).toBe(2);
        expect(pkg.traits[1].name).toBe('Tough');
        expect(pkg.traits[1].isDisability).toBe(true);
    });

    test('should parse a trait package with complex traits', () => {
        const pkg = TraitParser.parsePackage('Gunslinger { Ranged 3, ROF > {[Jitter, Feed, Jam]. Burst}, [Awkward] }');
        expect(pkg.name).toBe('Gunslinger');
        expect(pkg.traits).toHaveLength(3);
        expect(pkg.traits[1].name).toBe('ROF');
        expect(pkg.traits[1].dependencies).toEqual(['[Jitter, Feed, Jam]', 'Burst']);
        expect(pkg.traits[2].name).toBe('Awkward');
        expect(pkg.traits[2].isDisability).toBe(true);
    });

    test('should handle an empty trait package', () => {
        const pkg = TraitParser.parsePackage('Empty {}');
        expect(pkg.name).toBe('Empty');
        expect(pkg.traits).toHaveLength(0);
    });
});

import { describe, it, expect } from 'vitest';
import { Armor } from './Armor';

describe('Armor', () => {
  it('should load armor data correctly', () => {
    const armor = new Armor('Armor, Field');
    expect(armor.name).toBe('Armor, Field');
    expect(armor.armorClass).toBe('Armor - Suit');
    expect(armor.bp).toBe(22);
    expect(armor.ar).toBe(4);
  });

  it('should correctly parse armor traits', () => {
    const armor = new Armor('Armor, Field Advanced');
    expect(armor.traits).toHaveLength(3);
    expect(armor.traits).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Laden', value: 4 }),
      expect.objectContaining({ name: 'Armor', value: 4 }),
      expect.objectContaining({ name: 'Deflect', value: 1 }),
    ]));
  });

  it('should handle armor with no traits', () => {
    const armor = new Armor('Armor, Heavy');
    expect(armor.traits).toHaveLength(0);
  });

  it('should return the correct Laden penalty', () => {
    const armorWithLaden = new Armor('Armor, Field');
    expect(armorWithLaden.getLadenPenalty()).toBe(4);

    const armorWithoutLaden = new Armor('Armor, Combat Suit');
    expect(armorWithoutLaden.getLadenPenalty()).toBe(0);
  });

  it('should throw an error for non-existent armor', () => {
    expect(() => new Armor('Non-existent Armor')).toThrow('Armor with name "Non-existent Armor" not found.');
  });

  it('should throw an error if no name is provided', () => {
    expect(() => new Armor()).toThrow('Armor name must be provided.');
  });
});

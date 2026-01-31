import { describe, it, expect } from 'vitest';
import { Equipment } from './Equipment';

describe('Equipment', () => {
  it('should load equipment data correctly', () => {
    const equipment = new Equipment('Medicinals, Alcohol');
    expect(equipment.name).toBe('Medicinals, Alcohol');
    expect(equipment.bp).toBe(17);
  });

  it('should correctly parse equipment traits', () => {
    const equipment = new Equipment('Medicinals, Alcohol');
    expect(equipment.traits).toHaveLength(1);
    expect(equipment.traits).toEqual(expect.arrayContaining([
        'Grit'
    ]));
  });

  it('should handle equipment with no traits', () => {
    const equipment = new Equipment('Amulet of Eyes');
    expect(equipment.traits).toHaveLength(0);
  });

  it('should correctly check for effects', () => {
    const equipment = new Equipment('Medicinals, Alcohol');
    expect(equipment.hasEffect('Grit')).toBe(true);
    expect(equipment.hasEffect('NonExistentEffect')).toBe(false);
  });

  it('should throw an error for non-existent equipment', () => {
    expect(() => new Equipment('Non-existent Equipment')).toThrow('Unknown equipment: Non-existent Equipment');
  });
});

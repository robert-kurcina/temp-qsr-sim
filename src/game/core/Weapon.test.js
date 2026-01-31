import { describe, it, expect } from 'vitest';
import { Weapon } from './Weapon';

describe('Weapon', () => {
  it('should load weapon data correctly', () => {
    const weapon = new Weapon('Axe');
    expect(weapon.name).toBe('Axe');
    expect(weapon.class).toBe('Melee');
    expect(weapon.or).toBe('STR\"');
    expect(weapon.accuracy).toBe('-');
    expect(weapon.impact).toBe(1);
    expect(weapon.damage).toBe('STR + 1w');
    expect(weapon.bp).toBe(15);
  });

  it('should correctly parse weapon traits', () => {
    const weapon = new Weapon('Axe');
    expect(weapon.traits).toHaveLength(4);
    expect(weapon.traits).toEqual(expect.arrayContaining([
        '[1H]', '[Hafted]', 'Cleave', 'Throwable'
    ]));
  });

  it('should handle weapons with no traits', () => {
    const weapon = new Weapon('Unarmed');
    expect(weapon.traits).toHaveLength(1);
    expect(weapon.traits).toEqual(expect.arrayContaining([
        '[Stub]'
    ]));
  });

  it('should return the correct OR value', () => {
    const axe = new Weapon('Axe');
    expect(axe.getOR(5)).toBe(5);

    const acidCarbine = new Weapon('Acid Carbine');
    expect(acidCarbine.getOR(5)).toBe(11);

    const improvisedMelee = new Weapon('Improvised Melee');
    expect(improvisedMelee.getOR(5)).toBe(4);

    const bow = new Weapon('Bow, Long');
    expect(bow.getOR(3)).toBe(11)
  });

  it('should correctly check for traits', () => {
    const axe = new Weapon('Axe');
    expect(axe.hasTrait('Cleave')).toBe(true);
    expect(axe.hasTrait('[Hafted]')).toBe(true);
    expect(axe.hasTrait('NonExistentTrait')).toBe(false);
  });

  it('should throw an error for non-existent weapon', () => {
    expect(() => new Weapon('Non-existent Weapon')).toThrow('Unknown weapon: Non-existent Weapon');
  });
});

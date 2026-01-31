import { describe, it, expect } from 'vitest';
import { Character } from './Character.js';

describe('Character', () => {
  const config = {
    archetype: 'Veteran',
    weapons: ['Axe', 'Assault Rifle, Light'],
    armor: {
        helm: null,
        suit: 'Armor, Light',
        shield: null,
    },
    equipment: 'Kit, Medical, Tactical',
    variant: 'Fighter'
  }

  it('should create a new character with the correct properties', () => {
    const character = new Character(config);

    expect(character.archetype.name).toBe('Veteran');
    expect(character.variantName).toBe('Fighter');
    expect(character.weapons[0].name).toBe('Axe');
    expect(character.weapons[1].name).toBe('Assault Rifle, Light');
    expect(character.armor.suit.name).toBe('Armor, Light');
    expect(character.armor.helm).toBeNull();
    expect(character.armor.shield).toBeNull();
    expect(character.equipment.name).toBe('Kit, Medical, Tactical');
  });

  it('should calculate the correct bp', () => {
    const character = new Character(config);
    expect(character.getBP()).toBe(143);
  });

  it('should calculate the correct armor rating (ar)', () => {
    const character = new Character(config);
    expect(character.getAR()).toBe(2);
  });

  it('should get the correct laden penalty', () => {
    const character = new Character(config);
    expect(character.getLadenPenalty()).toBe(1);
  });

  it('should get the correct traits', () => {
    const character = new Character(config);
    const traits = character.getTraits();
    expect(traits).toEqual(expect.arrayContaining([
        'Grit',
        'Fight',
        '[1H]',
        '[Hafted]',
        'Cleave',
        'Throwable',
        '[Reveal]',
        'ROF X=2',
        '[Feed X=1]',
        'Burst X=2',
        'Armor X=2',
        '[Laden X=1]',
        'Advantage Heal X=1'
    ]));
  });

  it('should correctly check for traits', () => {
    const character = new Character(config);
    expect(character.hasTrait('Grit')).toBe(true);
    expect(character.hasTrait('Fight')).toBe(true);
    expect(character.hasTrait('NonExistentTrait')).toBe(false);
  });
});

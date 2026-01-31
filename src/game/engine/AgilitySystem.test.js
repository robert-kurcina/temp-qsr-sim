import { describe, test, expect } from 'vitest';
import { Character } from '../core/Character.js';
import { AgilitySystem } from './AgilitySystem.js';

const createTestCharacter = (mov) => {
  // Using a real archetype to prevent 'Unknown archetype' errors
  const character = new Character({ archetype: 'Militia' });
  // Manually override the MOV for this test case
  character.archetype.attributes.MOV = mov;
  return character;
};

describe('AgilitySystem', () => {

  test('should correctly calculate Agility for odd MOV values', () => {
    // MOV: 5 => 5 * 0.5 = 2.5 MU
    const character = createTestCharacter(5);
    const expectedAgility = 2.5;
    const calculatedAgility = AgilitySystem.calculateAgility(character);
    expect(calculatedAgility).toBe(expectedAgility);
  });

  test('should correctly calculate Agility for even MOV values', () => {
    // MOV: 6 => 6 * 0.5 = 3 MU
    const character = createTestCharacter(6);
    const expectedAgility = 3;
    const calculatedAgility = AgilitySystem.calculateAgility(character);
    expect(calculatedAgility).toBe(expectedAgility);
  });

  test('should return 0 Agility for a character with 0 MOV', () => {
    const character = createTestCharacter(0);
    const expectedAgility = 0;
    const calculatedAgility = AgilitySystem.calculateAgility(character);
    expect(calculatedAgility).toBe(expectedAgility);
  });

  test('should handle character objects without a MOV attribute gracefully', () => {
    const character = createTestCharacter(undefined);
    // In the absence of a MOV attribute, Agility should default to 0
    const calculatedAgility = AgilitySystem.calculateAgility(character);
    expect(calculatedAgility).toBe(0);
  });

});

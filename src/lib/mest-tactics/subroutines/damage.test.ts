
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Character } from '../core/Character';
import type { Item } from '../core/Item';
import { resolveDamageTest } from './damage';
import * as diceRoller from '../subroutines/dice-roller';

// Mock the dice-roller module to control the outcome of resolveTest
vi.mock('../subroutines/dice-roller', () => ({
  resolveTest: vi.fn().mockReturnValue({ pass: false, cascades: 0 }), // Default mock
}));

describe('resolveDamageTest', () => {
  let attacker: Character;
  let defender: Character;
  let weapon: Item;

  beforeEach(() => {
    vi.clearAllMocks();
    attacker = {
      id: 'attacker', name: 'Attacker', archetype: 'soldier',
      attributes: { str: 3, pow: 3, int: 3, for: 3, siz: 10, cca: 0, rca: 0, ref: 0, mov: 0 },
      finalAttributes: { str: 3, pow: 3, int: 3, for: 3, siz: 10, cca: 0, rca: 0, ref: 0, mov: 0 },
      state: { wounds: 0, delayTokens: 0, isKOd: false, isEliminated: false, armor: { total: 0 } },
      items: [],
    };
    defender = {
      id: 'defender', name: 'Defender', archetype: 'soldier',
      attributes: { str: 3, pow: 3, int: 3, for: 3, siz: 5, cca: 0, rca: 0, ref: 0, mov: 0 },
      finalAttributes: { str: 3, pow: 3, int: 3, for: 3, siz: 5, cca: 0, rca: 0, ref: 0, mov: 0 },
      state: { wounds: 0, delayTokens: 0, isKOd: false, isEliminated: false, armor: { total: 0 } },
      items: [],
    };
    weapon = {
      id: 'weapon', name: 'Sword', type: 'weapon', dmg: 'STR+1', impact: 1,
    };
  });

  it('should calculate wounds based on cascades and effective armor', () => {
    defender.state.armor.total = 2;
    vi.mocked(diceRoller.resolveTest).mockReturnValue({ pass: true, cascades: 3, carryOverDice: {} });
    const result = resolveDamageTest(attacker, defender, weapon, 0);
    expect(result.wounds).toBe(2);
    expect(defender.state.wounds).toBe(2);
  });

  it('should apply KO status when total wounds equal SIZ', () => {
    defender.state.wounds = 3;
    defender.finalAttributes.siz = 5;
    vi.mocked(diceRoller.resolveTest).mockReturnValue({ pass: true, cascades: 2, carryOverDice: {} });
    resolveDamageTest(attacker, defender, weapon, 0);
    expect(defender.state.isKOd).toBe(true);
  });

  it('should apply Eliminated status when total wounds equal or exceed SIZ + 3', () => {
    defender.state.wounds = 6;
    defender.finalAttributes.siz = 5;
    vi.mocked(diceRoller.resolveTest).mockReturnValue({ pass: true, cascades: 2, carryOverDice: {} });
    resolveDamageTest(attacker, defender, weapon, 0);
    expect(defender.state.isEliminated).toBe(true);
  });

  it('should correctly parse and use dice modifiers in the damage formula', () => {
    // Arrange: Corrected to use a valid dice specifier 'b' instead of 'd'
    weapon.dmg = 'STR+2b'; // Damage includes 2 bonus base dice
    attacker.finalAttributes.str = 4;

    // Act
    resolveDamageTest(attacker, defender, weapon, 0);

    // Assert
    expect(diceRoller.resolveTest).toHaveBeenCalledWith(
      expect.objectContaining({
        attributeValue: 4,
        bonusDice: { base: 2, modifier: 0, wild: 0 },
      }),
      expect.any(Object)
    );
  });

  it('should add hit cascades to the damage roll dice pool', () => {
    // Arrange
    const hitCascades = 3; // 3 cascades from the preceding Hit Test

    // Act
    resolveDamageTest(attacker, defender, weapon, hitCascades);

    // Assert: Check that hit cascades are passed as carry-over dice
    expect(diceRoller.resolveTest).toHaveBeenCalledWith(
      expect.objectContaining({
        carryOverDice: { base: 3, modifier: 0, wild: 0 },
      }),
      expect.any(Object)
    );
  });
});

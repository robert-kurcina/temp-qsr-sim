import { describe, it, expect } from 'vitest';
import { DieType, getDieSuccesses, performTest, TestDice } from './dice-roller';

describe('Dice Roller', () => {
  describe('getDieSuccesses', () => {
    it('should calculate Base die successes correctly', () => {
      expect(getDieSuccesses(DieType.Base, 1)).toEqual({ successes: 0, carryOver: null });
      expect(getDieSuccesses(DieType.Base, 4)).toEqual({ successes: 1, carryOver: null });
      expect(getDieSuccesses(DieType.Base, 6)).toEqual({ successes: 2, carryOver: DieType.Base });
    });

    it('should calculate Modifier die successes correctly', () => {
      expect(getDieSuccesses(DieType.Modifier, 3)).toEqual({ successes: 0, carryOver: null });
      expect(getDieSuccesses(DieType.Modifier, 5)).toEqual({ successes: 1, carryOver: null });
      expect(getDieSuccesses(DieType.Modifier, 6)).toEqual({ successes: 1, carryOver: DieType.Modifier });
    });

    it('should calculate Wild die successes correctly', () => {
      expect(getDieSuccesses(DieType.Wild, 3)).toEqual({ successes: 0, carryOver: null });
      expect(getDieSuccesses(DieType.Wild, 4)).toEqual({ successes: 1, carryOver: DieType.Wild });
      expect(getDieSuccesses(DieType.Wild, 6)).toEqual({ successes: 3, carryOver: DieType.Wild });
    });
  });

  describe('performTest', () => {
    it('should perform a test with various dice and return the correct score and carry-over', () => {
      const dice: TestDice = { base: 2, modifier: 1, wild: 1 };
      const attributeValue = 3;
      const rolls = [4, 6, 5, 6]; // Base, Base, Modifier, Wild

      const result = performTest(dice, attributeValue, rolls);

      // Base(4) = 1 success
      // Base(6) = 2 successes, 1 base carry-over
      // Modifier(5) = 1 success
      // Wild(6) = 3 successes, 1 wild carry-over
      // Total Successes = 1 + 2 + 1 + 3 = 7
      // Score = 3 (attribute) + 7 (successes) = 10
      expect(result.score).toBe(10);
      expect(result.carryOverDice).toEqual({ base: 1, modifier: 0, wild: 1 });
    });
  });
});

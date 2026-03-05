import { describe, it, expect } from 'vitest';
import { DiceType, getDieSuccesses, performTest, TestDice } from './dice-roller';

describe('Dice Roller', () => {
  describe('getDieSuccesses', () => {
    it('should calculate Base die successes correctly', () => {
      expect(getDieSuccesses(DiceType.Base, 1)).toEqual({ successes: 0, carryOver: null });
      expect(getDieSuccesses(DiceType.Base, 4)).toEqual({ successes: 1, carryOver: null });
      expect(getDieSuccesses(DiceType.Base, 6)).toEqual({ successes: 2, carryOver: DiceType.Base });
    });

    it('should calculate Modifier die successes correctly', () => {
      expect(getDieSuccesses(DiceType.Modifier, 3)).toEqual({ successes: 0, carryOver: null });
      expect(getDieSuccesses(DiceType.Modifier, 5)).toEqual({ successes: 1, carryOver: null });
      expect(getDieSuccesses(DiceType.Modifier, 6)).toEqual({ successes: 1, carryOver: DiceType.Modifier });
    });

    it('should calculate Wild die successes correctly', () => {
      expect(getDieSuccesses(DiceType.Wild, 3)).toEqual({ successes: 0, carryOver: null });
      expect(getDieSuccesses(DiceType.Wild, 4)).toEqual({ successes: 1, carryOver: DiceType.Wild });
      expect(getDieSuccesses(DiceType.Wild, 6)).toEqual({ successes: 3, carryOver: DiceType.Wild });
    });
  });

  describe('performTest', () => {
    it('should perform a test with various dice and return the correct score and carry-over', () => {
      const dice: TestDice = { base: 2, modifier: 1, wild: 1 } as any;
      const rolls = [4, 6, 5, 6]; // Base(4), Base(6), Modifier(5), Wild(6)
      const attributeValue = 0;

      const result = performTest(dice, attributeValue, rolls);

      // Base(4) = 1 success
      // Base(6) = 2 successes, 1 base carry-over
      // Modifier(5) = 1 success
      // Wild(6) = 3 successes, 1 wild carry-over
      // ---
      // Total Successes = 1 + 2 + 1 + 3 = 7
      // Carry-over Dice = { base: 1, modifier: 0, wild: 1 }
      expect(result.score).toBe(7);
      expect(result.carryOverDice).toEqual({ base: 1, modifier: 0, wild: 1 });
    });
  });
});

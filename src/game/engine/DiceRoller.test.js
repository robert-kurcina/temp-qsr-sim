import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Die, DiceRoller, TestResult } from './DiceRoller.js';

// Mocking Math.random to control dice rolls
const mockRandom = (values) => {
  let i = 0;
  return () => {
    if (i >= values.length) {
      throw new Error('Mocked random values exhausted');
    }
    return (values[i++] - 1) / 6;
  };
};

describe('DiceRoller System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Die Class', () => {
    it('should score a Base die correctly', () => {
      const die = new Die('base');
      expect(die.mockRoll(1).score).toBe(0);
      expect(die.mockRoll(3).score).toBe(0);
      expect(die.mockRoll(4).score).toBe(1);
      expect(die.mockRoll(5).score).toBe(1);
      expect(die.mockRoll(6).score).toBe(2);
      expect(die.mockRoll(6).carryOver).toBe(true);
    });

    it('should score a Modifier die correctly', () => {
      const die = new Die('modifier');
      expect(die.mockRoll(3).score).toBe(0);
      expect(die.mockRoll(4).score).toBe(1);
      expect(die.mockRoll(6).score).toBe(1);
      expect(die.mockRoll(6).carryOver).toBe(true);
      expect(die.mockRoll(5).carryOver).toBe(false);
    });

    it('should score a Wild die correctly', () => {
      const die = new Die('wild');
      expect(die.mockRoll(3).score).toBe(0);
      expect(die.mockRoll(4).score).toBe(1);
      expect(die.mockRoll(5).score).toBe(1);
      expect(die.mockRoll(6).score).toBe(3);
      expect(die.mockRoll(4).carryOver).toBe(true);
      expect(die.mockRoll(6).carryOver).toBe(true);
      expect(die.mockRoll(3).carryOver).toBe(false);
    });
  });

  describe('DiceRoller.flattenDice', () => {
    it('should cancel out matching dice types', () => {
      const active = { base: 3, modifier: 2, wild: 1 };
      const passive = { base: 4, modifier: 1, wild: 1 };
      const { flatActivePool, flatPassivePool } = DiceRoller.flattenDice(active, passive);

      // Modifiers: 2 vs 1 -> 1 vs 0
      // Wilds: 1 vs 1 -> 0 vs 0
      expect(flatActivePool.modifier).toBe(1);
      expect(flatPassivePool.modifier).toBe(0);
      expect(flatActivePool.wild).toBe(0);
      expect(flatPassivePool.wild).toBe(0);
    });

    it('should not flatten the last 2 base dice for each player', () => {
      const active = { base: 3, modifier: 1, wild: 0 };
      const passive = { base: 5, modifier: 1, wild: 0 };
      const { flatActivePool, flatPassivePool } = DiceRoller.flattenDice(active, passive);

      // Active has 1 base die to spare (3-2). Passive has 3 (5-2).
      // They cancel 1 base die.
      expect(flatActivePool.base).toBe(2); // 3 - 1
      expect(flatPassivePool.base).toBe(4); // 5 - 1
    });

    it('should handle zero dice pools', () => {
      const active = { base: 2, modifier: 0, wild: 0 };
      const passive = { base: 2, modifier: 0, wild: 0 };
      const { flatActivePool, flatPassivePool } = DiceRoller.flattenDice(active, passive);
      expect(flatActivePool).toEqual({ base: 2, modifier: 0, wild: 0 });
      expect(flatPassivePool).toEqual({ base: 2, modifier: 0, wild: 0 });
    });
  });

  describe('DiceRoller.performOpposedTest', () => {
    it('calculates success, cascades, and carry-over correctly', () => {
      vi.spyOn(Math, 'random').mockImplementation(mockRandom([6, 5, 4, 3, 2, 1])); // Active: 6,5,4; Passive: 3,2,1

      const activePool = { base: 1, modifier: 1, wild: 1 }; // Total 3 base, 1 mod, 1 wild
      const passivePool = { base: 1, modifier: 0, wild: 0 }; // Total 3 base

      const result = DiceRoller.performOpposedTest(activePool, 5, passivePool, 3);

      // Active Rolls: Base(6, score=2, carry), Base(5, score=1), Mod(4, score=1)
      // Passive Rolls: Base(3, score=0), Base(2, score=0), Base(1, score=0)
      // Active Dice Score = 2 + 1 + 1 = 4
      // Passive Dice Score = 0 + 0 + 0 = 0
      // Active Total = 4 (dice) + 5 (attr) = 9
      // Passive Total = 0 (dice) + 3 (attr) = 3

      expect(result.success).toBe(true);
      expect(result.activeScore).toBe(9);
      expect(result.passiveScore).toBe(3);
      expect(result.cascades).toBe(6);
      expect(result.misses).toBe(0);
      expect(result.carryOver).toEqual({ base: 1, modifier: 0, wild: 0 }); // Wild has carry-over but it's a wild die
    });

    it('handles ties by giving success to the active player with zero cascades', () => {
      vi.spyOn(Math, 'random').mockImplementation(mockRandom([4, 4, 4, 4]));

      const result = DiceRoller.performOpposedTest({ base: 0 }, 2, { base: 0 }, 2);
      // Active: Base(4), Base(4) -> Score 2. Total = 2 + 2 = 4
      // Passive: Base(4), Base(4) -> Score 2. Total = 2 + 2 = 4

      expect(result.success).toBe(true);
      expect(result.cascades).toBe(0);
    });

    it('calculates misses correctly on failure', () => {
        vi.spyOn(Math, 'random').mockImplementation(mockRandom([1, 1, 6, 6]));
        const result = DiceRoller.performOpposedTest({ base: 0 }, 1, { base: 0 }, 5);
        // Active: Base(1), Base(1) -> Score 0. Total = 0 + 1 = 1
        // Passive: Base(6), Base(6) -> Score 4. Total = 4 + 5 = 9

        expect(result.success).toBe(false);
        expect(result.cascades).toBe(0);
        expect(result.misses).toBe(9); // 9 - 1 + 1
    });

    it('applies Difficulty Rating (DR) to the passive score', () => {
      vi.spyOn(Math, 'random').mockImplementation(mockRandom([5, 5, 1, 1]));
      const result = DiceRoller.performOpposedTest({ base: 0 }, 2, { base: 0 }, 2, 3);
      // Active: Base(5), Base(5) -> Score 2. Total = 2 + 2 = 4
      // Passive: Base(1), Base(1) -> Score 0. Total = 0 + 2 + 3 (DR) = 5

      expect(result.success).toBe(false);
      expect(result.passiveScore).toBe(5);
      expect(result.misses).toBe(2);
    });
  });

  describe('DiceRoller.performUnopposedTest', () => {
    it('runs an unopposed test against the System correctly', () => {
      vi.spyOn(Math, 'random').mockImplementation(mockRandom([6, 6, 1, 1]));
      const result = DiceRoller.performUnopposedTest({ base: 0, modifier: 0, wild: 0 }, 5, 1);

      // Active: Base(6), Base(6) -> Score 4. Total = 4 + 5 = 9
      // System: Base(1), Base(1) -> Score 0. Total = 0 + 2 (Sys Attr) + 1 (DR) = 3

      expect(result.success).toBe(true);
      expect(result.activeScore).toBe(9);
      expect(result.passiveScore).toBe(3);
      expect(result.cascades).toBe(6);
      expect(result.carryOver.base).toBe(2);
    });
  });
});

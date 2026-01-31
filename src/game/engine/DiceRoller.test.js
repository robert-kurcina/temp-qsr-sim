
import { describe, it, expect, vi } from 'vitest';
import { DiceRoller, OpposedTestResult, Die } from './DiceRoller';

// To test the internal classes, we need to import them directly.
// In a real-world scenario, you might not export them, but for testing, it's useful.
// For this test, we'll spy on the DiceRoller's internal methods to mock rolls.

// Mocking the roll method to control outcomes
// We need to reach into the module to get the Die class instance that DiceRoller uses.
// A better way would be to inject the Die class, but for now, we'll patch Math.random.

describe('DiceRoller Logic', () => {

  describe('Die Scoring and Carry-over', () => {
    // Helper to test individual die rolls
    const testDie = (type, rollValue, expectedScore, expectedCarryOver) => {
      vi.spyOn(Math, 'random').mockReturnValueOnce((rollValue - 1) / 6);
      const die = new Die(type).roll();
      expect(die.score).toBe(expectedScore);
      expect(die.carryOver).toBe(expectedCarryOver);
      vi.restoreAllMocks();
    };

    it('should score Base dice correctly', () => {
      testDie('base', 1, 0, false); // Fail
      testDie('base', 3, 0, false); // Fail
      testDie('base', 4, 1, false); // Pass
      testDie('base', 5, 1, false); // Pass
      testDie('base', 6, 2, true);  // Pass + Carry-over
    });

    it('should score Modifier dice correctly', () => {
      testDie('modifier', 3, 0, false); // Fail
      testDie('modifier', 4, 1, false); // Pass
      testDie('modifier', 5, 1, false); // Pass
      testDie('modifier', 6, 1, true);  // Pass + Carry-over
    });

    it('should score Wild dice correctly', () => {
      testDie('wild', 3, 0, false); // Fail
      testDie('wild', 4, 1, true);  // Pass + Carry-over
      testDie('wild', 5, 1, true);  // Pass + Carry-over
      testDie('wild', 6, 1, true);  // Pass + Carry-over
    });
  });

  describe('OpposedTestResult Calculation', () => {

    it('should handle the specific example provided', () => {
      // Active Player rolls: Base(6), Base(3), Wild(4), Modifier(5)
      // Passive Player rolls: Base(2), Base(4), Base(6)

      const mockRolls = [
        // Active Player
        (6 - 1) / 6, // Base -> 6 (Score 2, CarryOver)
        (3 - 1) / 6, // Base -> 3 (Score 0)
        (4 - 1) / 6, // Wild -> 4 (Score 1, CarryOver)
        (5 - 1) / 6, // Modifier -> 5 (Score 1)
        // Passive Player
        (2 - 1) / 6, // Base -> 2 (Score 0)
        (4 - 1) / 6, // Base -> 4 (Score 1)
        (6 - 1) / 6, // Base -> 6 (Score 2, but no carry-over for passive)
      ];

      let mockIndex = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => mockRolls[mockIndex++]);

      const activePool = { base: 2, wild: 1, modifier: 1 };
      const passivePool = { base: 3, modifier: 0, wild: 0 };

      const result = DiceRoller.performOpposedTest(activePool, passivePool);

      // Verify scores
      expect(result.activeResult.totalScore).toBe(4); // 2 + 0 + 1 + 1
      expect(result.passiveResult.totalScore).toBe(3); // 0 + 1 + 2

      // Verify outcome
      expect(result.success).toBe(true);
      expect(result.cascades).toBe(1); // 4 - 3

      // Verify transferred dice
      expect(result.transferredDice).toEqual({ base: 1, modifier: 0, wild: 1 });

      vi.restoreAllMocks();
    });

    it('should handle a tie correctly (cascades = 1)', () => {
      const mockRolls = [
        (4 - 1) / 6, // Active: Base -> 4 (Score 1)
        (4 - 1) / 6, // Active: Base -> 4 (Score 1)
        (5 - 1) / 6, // Passive: Base -> 5 (Score 1)
        (5 - 1) / 6, // Passive: Base -> 5 (Score 1)
      ];
      let mockIndex = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => mockRolls[mockIndex++]);

      const result = DiceRoller.performOpposedTest({ base: 2 }, { base: 2 });

      expect(result.activeResult.totalScore).toBe(2);
      expect(result.passiveResult.totalScore).toBe(2);
      expect(result.success).toBe(true);
      expect(result.cascades).toBe(1); // Tie results in 1 cascade
      expect(result.transferredDice).toEqual({ base: 0, modifier: 0, wild: 0 });

      vi.restoreAllMocks();
    });

    it('should handle a passive player win', () => {
        const mockRolls = [
            (1 - 1) / 6, // Active: Base -> 1 (Score 0)
            (6 - 1) / 6, // Passive: Base -> 6 (Score 2)
        ];
        let mockIndex = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => mockRolls[mockIndex++]);

        const result = DiceRoller.performOpposedTest({ base: 1 }, { base: 1 });

        expect(result.success).toBe(false);
        expect(result.cascades).toBe(0);
        expect(result.transferredDice).toEqual({ base: 0, modifier: 0, wild: 0 });
        vi.restoreAllMocks();
    });

     it('should not give carry-over benefits to passive player', () => {
        const mockRolls = [
            (4-1)/6, // Active Base -> 4 (Score 1)
            (6-1)/6, // Passive Wild -> 6 (Score 1, would carry-over, but is passive)
        ];
        let mockIndex = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => mockRolls[mockIndex++]);

        const activePool = { base: 1 };
        const passivePool = { wild: 1 };
        const result = DiceRoller.performOpposedTest(activePool, passivePool);

        expect(result.success).toBe(true);
        expect(result.cascades).toBe(1); // Tie
        expect(result.passiveResult.carryOverDice.length).toBe(0);
        vi.restoreAllMocks();
    });
  });
});

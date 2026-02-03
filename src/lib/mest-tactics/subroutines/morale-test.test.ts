
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveMoraleTest } from './morale-test';
import { setRoller, resetRoller, DiceType } from '../dice-roller';
import type { Character } from '../Character';
import { gameData } from '../../data';

const { archetypes } = gameData;

// MEST QSR Anchoring: Morale Tests are Unopposed POW Tests. A score >= 0 is a pass.

describe('resolveMoraleTest', () => {
  let character: Character;

  beforeEach(() => {
    const archetype = { name: "Militia", ...archetypes["Militia"] }; // Militia has POW 2
    character = createCharacter({ archetype, equipment: [] }, 'Test Character');
    resetRoller();
  });

  it('should pass the morale test if the score is greater than 0', () => {
    setRoller((count) => [6, 6]); // 4 successes
    const result = resolveMoraleTest(character, {}, 0);
    // Character: POW(2) + Successes(4) = 6.
    // System: Difficulty(0) + Successes(0) = 0.
    // Final Score: 6 - 0 = 6. PASS.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(6);
  });

  it('should pass the morale test if the score is exactly 0 (a tie)', () => {
    setRoller((count) => [1, 2, 3]); // 0 successes
    const difficulty = 2; // Adjusted difficulty to match character's base POW
    const result = resolveMoraleTest(character, {}, difficulty);
    // Character: POW(2) + Successes(0) = 2.
    // System: Difficulty(2) + Successes(0) = 2.
    // Final Score: 2 - 2 = 0. PASS (on a tie).
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0);
  });

  it('should fail the morale test if the score is less than 0', () => {
    setRoller((count) => [1, 2, 3]); // 0 successes
    const difficulty = 4;
    const result = resolveMoraleTest(character, {}, difficulty);
    // Character: POW(2) + Successes(0) = 2.
    // System: Difficulty(4) + Successes(0) = 4.
    // Final Score: 2 - 4 = -2. FAIL.
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-2);
  });

  it('should correctly calculate misses (as p1Misses)', () => {
    setRoller((count) => [1, 1, 4]); // 2 misses, 1 success
    const result = resolveMoraleTest(character);
    expect(result.p1Misses).toBe(2);
  });

  it('should apply bonus dice and calculate misses', () => {
    // Character has POW 2 (2 Base Dice) + 2 Bonus Base Dice = 4 total Base Dice.
    const bonusDice = { [DiceType.Base]: 2 }; 
    // Rolls: [1, 1, 6, 6, 6] -> 2 misses, 6 successes (2+2+2).
    setRoller((count) => [1, 1, 6, 6, 6]); 
    const result = resolveMoraleTest(character, {}, 0, bonusDice);
    // Character: POW(2) + Successes(6) = 8.
    // System: Difficulty(0).
    // Final Score: 8 - 0 = 8. PASS.
    expect(result.pass).toBe(true);
    expect(result.p1Misses).toBe(2);
    expect(result.score).toBe(8);
  });
});

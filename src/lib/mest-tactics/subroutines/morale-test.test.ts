
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveMoraleTest } from './morale-test';
import { setRoller, resetRoller, DiceType } from '../dice-roller';
import type { Character } from '../Character';
import { gameData } from '../../data';

const { archetypes } = gameData;

describe('resolveMoraleTest', () => {
  let character: Character;

  beforeEach(() => {
    const archetype = { name: "Militia", ...archetypes["Militia"] };
    character = createCharacter({ archetype, equipment: [] }, 'Test Character');
    // Base WIL for Militia is 3
    resetRoller();
  });

  it('should pass the morale test if the score is greater than 0', () => {
    setRoller(() => [6]); // P1 gets 2 successes
    const result = resolveMoraleTest(character);
    // P1: attr(3) + succ(2) = 5. P2: 0. Score: 5. Pass.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(5);
  });

  it('should pass the morale test if the score is exactly 0 (a tie)', () => {
    setRoller(() => [1]); // P1 gets 0 successes
    const difficulty = 3; // Exactly matches the character's WIL
    const result = resolveMoraleTest(character, {}, difficulty);
    // P1: attr(3) + succ(0) = 3. P2: 0. Score: 3 - 3 = 0. Pass.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0);
  });

  it('should fail the morale test if the score is less than 0', () => {
    setRoller(() => [1]); // P1 gets 0 successes
    const difficulty = 4; // Exceeds the character's WIL
    const result = resolveMoraleTest(character, {}, difficulty);
    // P1: attr(3) + succ(0) = 3. P2: 0. Score: 3 - 4 = -1. Fail.
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-1);
  });

  it('should correctly calculate misses', () => {
    // This will roll 3 dice for the character's WIL
    setRoller((count) => [1, 1, 2]); // Two misses
    const result = resolveMoraleTest(character);
    expect(result.p1Misses).toBe(2);
  });

  it('should apply bonus dice and calculate misses', () => {
    const bonusDice = { [DiceType.Base]: 1 };
    // This will roll 4 dice (3 WIL + 1 Bonus)
    setRoller((count) => [1, 6, 1, 6]); // Two misses, four successes
    const result = resolveMoraleTest(character, {}, 0, bonusDice);
    // P1: attr(3) + succ(4) = 7. P2: 0. Score: 7. Pass.
    expect(result.pass).toBe(true);
    expect(result.p1Misses).toBe(2);
    expect(result.score).toBe(7);
  });
});

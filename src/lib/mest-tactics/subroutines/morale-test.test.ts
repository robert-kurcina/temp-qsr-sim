
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from '../character-factory';
import { resolveMoraleTest } from './morale-test';
import { setRoller, resetRoller, DiceType } from '../dice-roller';
import type { Character } from '../Character';
import type { Profile } from '../Profile';
import { gameData } from '../../data';

const { archetypes } = gameData;

// MEST QSR Anchoring: Morale Tests are Unopposed POW Tests. A score >= 0 is a pass.

describe('resolveMoraleTest', () => {
  let character: Character;

  beforeEach(async () => {
    const archetype = { name: "Militia", ...archetypes["Militia"] }; // Militia has POW 2
    const profile: Profile = { name: 'Test Profile', archetype, equipment: [] };
    character = await createCharacter(profile);
    resetRoller();
  });

  it('should pass the morale test if the score is greater than 0', () => {
    setRoller(() => [6, 6]); // 4 successes
    const result = resolveMoraleTest(character, {}, 0);
    // POW(2) + successes(4) = 6.  6 > 0 so pass.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(6);
  });

  it('should pass the morale test if the score is exactly 0 (a tie)', () => {
    setRoller(() => []); // 0 successes
    const difficulty = 2; // Adjusted difficulty to match character's base POW
    const result = resolveMoraleTest(character, {}, difficulty);
    // POW(2) + successes(0) - difficulty(2) = 0. 0 >= 0 so pass.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0);
  });

  it('should fail the morale test if the score is less than 0', () => {
    setRoller(() => []); // 0 successes
    const difficulty = 3;
    const result = resolveMoraleTest(character, {}, difficulty);
    // POW(2) + successes(0) - difficulty(3) = -1. -1 < 0 so fail.
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-1);
  });

  it('should correctly calculate misses (as p1Misses)', () => {
    setRoller((count) => [1, 1, 4]); // 2 misses, 1 success
    const result = resolveMoraleTest(character);
    expect(result.p1Misses).toBe(2);
  });

  it('should apply bonus dice and calculate misses', () => {
    const bonusDice = { [DiceType.Base]: 2 };
    setRoller((count) => (count === 4 ? [1, 1, 6, 6] : []));
    const result = resolveMoraleTest(character, {}, 0, bonusDice);
    // POW(2) + Bonus(2) = 4 dice. 2 misses, 4 successes. Score 6.
    expect(result.pass).toBe(true);
    expect(result.p1Misses).toBe(2);
    expect(result.score).toBe(6);
  });
});

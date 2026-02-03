
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTest, setRoller, resetRoller, DiceType } from './dice-roller';
import type { TestParticipant } from './dice-roller';

describe('resolveTest', () => {
  beforeEach(() => {
    resetRoller();
  });

  it('should return a PASS result when participant 1 has a higher score', () => {
    const participant1: TestParticipant = { attributeValue: 3 };
    const participant2: TestParticipant = { attributeValue: 1 };

    // P1 rolls 3 dice, P2 rolls 1 die.
    setRoller((count) => (count === 3 ? [6, 6, 1] : [4]));
    const result = resolveTest(participant1, participant2);

    // P1: attr(3) + successes(4) = 7
    // P2: attr(1) + successes(1) = 2
    // Score: 7 - 2 = 5
    expect(result.pass).toBe(true);
    expect(result.score).toBe(5);
    expect(result.participant1Score).toBe(7);
    expect(result.participant2Score).toBe(2);
  });

  it('should return a FAIL result when participant 1 has a lower score', () => {
    const participant1: TestParticipant = { attributeValue: 1 };
    const participant2: TestParticipant = { attributeValue: 3 };

    // P1 rolls 1 die, P2 rolls 3 dice.
    setRoller((count) => (count === 1 ? [4] : [6, 6, 1]));
    const result = resolveTest(participant1, participant2);

    // P1: attr(1) + successes(1) = 2
    // P2: attr(3) + successes(4) = 7
    // Score: 2 - 7 = -5
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-5);
    expect(result.participant1Score).toBe(2);
    expect(result.participant2Score).toBe(7);
  });

  it('should return a FAIL result on a TIE by default', () => {
    const participant1: TestParticipant = { attributeValue: 2 };
    const participant2: TestParticipant = { attributeValue: 2 };

    // Both roll 2 dice.
    setRoller((count) => [4, 5]); // Both get 2 successes
    const result = resolveTest(participant1, participant2);

    // P1: attr(2) + successes(2) = 4
    // P2: attr(2) + successes(2) = 4
    // Score: 4 - 4 = 0
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should return a PASS result on a TIE if passOnTie is true', () => {
    const participant1: TestParticipant = { attributeValue: 2 };
    const participant2: TestParticipant = { attributeValue: 2 };

    setRoller((count) => [4, 5]);
    const result = resolveTest(participant1, participant2, 0, true);

    // P1 Score: 4, P2 Score: 4. Final Score: 0. Pass on tie.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0);
  });

  it('should correctly apply a scoreModifier', () => {
    const participant1: TestParticipant = { attributeValue: 2 };
    const participant2: TestParticipant = { attributeValue: 2 };

    setRoller((count) => [4, 5]);
    const result = resolveTest(participant1, participant2, 1); // +1 modifier

    // P1 Score: 4, P2 Score: 4. Final Score: 4 - 4 + 1 = 1. Pass.
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should correctly calculate misses', () => {
    const participant1: TestParticipant = { attributeValue: 2 }; // rolls 2 dice
    const participant2: TestParticipant = { attributeValue: 1 }; // rolls 1 die

    setRoller((count) => (count === 2 ? [1, 2] : [1]));
    const result = resolveTest(participant1, participant2);

    // P1 rolls [1, 2] -> 1 miss.
    // P2 rolls [1] -> 1 miss.
    expect(result.p1Misses).toBe(1);
    expect(result.p2Misses).toBe(1);
  });

  it('should correctly apply bonus dice', () => {
    const participant1: TestParticipant = { attributeValue: 1, bonusDice: { [DiceType.Base]: 1 } }; // Total 2 dice
    const participant2: TestParticipant = { attributeValue: 1 }; // Total 1 die

    setRoller((count) => (count === 2 ? [6, 6] : [4]));
    const result = resolveTest(participant1, participant2);

    // P1: attr(1) + successes(4) = 5
    // P2: attr(1) + successes(1) = 2
    // Score: 5 - 2 = 3
    expect(result.participant1Score).toBe(5);
    expect(result.score).toBe(3);
  });

  it('should award penalty dice to the opponent and then flatten', () => {
    const participant1: TestParticipant = { attributeValue: 1, bonusDice: { [DiceType.Base]: 2 } };
    const participant2: TestParticipant = { attributeValue: 1, penaltyDice: { [DiceType.Base]: 2 } };

    // P2's 2 penalty dice are awarded to P1. P1 now has 4 bonus dice.
    // P1 rolls 1 (base) + 4 (bonus) = 5 dice.
    // P2 rolls 1 (base) die.
    setRoller((count) => (count === 5 ? [4, 4, 4, 4, 4] : [4])); // P1 gets 5 successes, P2 gets 1.
    const result = resolveTest(participant1, participant2);
    
    // P1: attr(1) + successes(5) = 6
    // P2: attr(1) + successes(1) = 2
    // Score: 6 - 2 = 4
    expect(result.score).toBe(4);
    expect(result.finalPools.p1FinalBonus[DiceType.Base]).toBe(4);
    expect(result.finalPools.p2FinalBonus[DiceType.Base]).toBe(0);
  });
});

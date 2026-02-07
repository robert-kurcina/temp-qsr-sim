
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTest, setRoller, resetRoller, DiceType } from './dice-roller';
import type { TestParticipant, Roller } from './dice-roller';

describe('resolveTest', () => {
  beforeEach(() => {
    resetRoller();
  });

  it('should return a PASS result when P1 score is higher', () => {
    const p1: TestParticipant = { attributeValue: 3 };
    const p2: TestParticipant = { attributeValue: 1, isSystemPlayer: true };
    setRoller(() => [4, 4]); // P1 rolls, 2 successes. Score = 3+2=5. P2 score=1. Final = 4.
    const result = resolveTest(p1, p2);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(4);
  });

  it('should return a FAIL result when P1 score is lower', () => {
    const p1: TestParticipant = { attributeValue: 1 };
    const p2: TestParticipant = { attributeValue: 5, isSystemPlayer: true };
    setRoller(() => [1, 2]); // P1 rolls, 0 successes. Score = 1. P2 score=5. Final = -4.
    const result = resolveTest(p1, p2);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(-4);
  });

  it('should FAIL on a TIE by default', () => {
    const p1: TestParticipant = { attributeValue: 2 };
    const p2: TestParticipant = { attributeValue: 4, isSystemPlayer: true };
    setRoller(() => [4, 4]); // P1 rolls, 2 successes. Score=2+2=4. P2 score=4. Final=0.
    const result = resolveTest(p1, p2);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should PASS on a TIE if passOnTie is true', () => {
    const p1: TestParticipant = { attributeValue: 2 };
    const p2: TestParticipant = { attributeValue: 4, isSystemPlayer: true };
    setRoller(() => [4, 4]); // P1 rolls, 2 successes. Score=2+2=4. P2 score=4. Final=0.
    const result = resolveTest(p1, p2, 0, true);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(0);
  });

  it('should correctly apply a scoreModifier', () => {
    const p1: TestParticipant = { attributeValue: 2 };
    const p2: TestParticipant = { attributeValue: 4, isSystemPlayer: true };
    setRoller(() => [4, 4]); // P1 rolls, 2 succ. Score=2+2+1(mod)=5. P2 score=4. Final=1.
    const result = resolveTest(p1, p2, 1);
    expect(result.pass).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should correctly calculate misses for both participants', () => {
    const p1: TestParticipant = { attributeValue: 0 };
    const p2: TestParticipant = { attributeValue: 0 };
    
    let isFirstRollerCall = true;
    const roller: Roller = () => {
      if (isFirstRollerCall) {
        isFirstRollerCall = false;
        return [1, 2, 3]; // P1 rolls, 1 miss
      }
      return [1, 1, 4]; // P2 rolls, 2 misses
    };
    setRoller(roller);
    const result = resolveTest(p1, p2);
    expect(result.p1Misses).toBe(1);
    expect(result.p2Misses).toBe(2);
  });

  it('should correctly apply bonus dice', () => {
    const p1: TestParticipant = { attributeValue: 1, bonusDice: { [DiceType.Base]: 2 } };
    const p2: TestParticipant = { attributeValue: 1, isSystemPlayer: true };
    // P1 has 2 base + 2 bonus = 4 dice. Rolls [6,6,1,1] -> 4 successes. Score=1+4=5. P2=1. Final=4.
    setRoller(() => [6, 6, 1, 1]);
    const result = resolveTest(p1, p2);
    expect(result.score).toBe(4);
    expect(result.participant1Score).toBe(5);
  });

  it('should award penalty dice to opponent and flatten', () => {
    const p1: TestParticipant = { attributeValue: 1, bonusDice: { [DiceType.Base]: 2 } };
    const p2: TestParticipant = { attributeValue: 1, penaltyDice: { [DiceType.Base]: 2 } };

    let isFirstRollerCall = true;
    const roller: Roller = (count) => {
      if (isFirstRollerCall) {
        isFirstRollerCall = false;
        return [4, 4, 4, 4, 1, 1]; // P1 rolls 6 dice (2base+2bonus+2penalty->bonus), 4 successes
      }
      return [1, 1]; // P2 rolls 2 dice, 0 successes
    };
    setRoller(roller);
    const result = resolveTest(p1, p2);
    
    // P1 score=1+4=5. P2 score=1+0=1. Final=4.
    expect(result.score).toBe(4);
    // P1 bonus:2, P2 penalty:2 -> P1 bonus pool: {base:4}. P2 bonus pool: {}. Flattening -> P1 final bonus:{base:4}.
    expect(result.finalPools.p1FinalBonus[DiceType.Base]).toBe(4);
    expect(result.finalPools.p2FinalBonus[DiceType.Base]).toBeUndefined();
  });
});

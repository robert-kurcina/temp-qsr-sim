
import { describe, it, expect } from 'vitest';
import { parseAccuracy } from './accuracy-parser';
import { DiceType } from '../subroutines/dice-roller';

describe('parseAccuracy', () => {
  it('should return empty pools for undefined input', () => {
    const { bonusDice, penaltyDice } = parseAccuracy(undefined);
    expect(bonusDice).toEqual({});
    expect(penaltyDice).toEqual({});
  });

  it('should return empty pools for an empty string', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('');
    expect(bonusDice).toEqual({});
    expect(penaltyDice).toEqual({});
  });

  it('should return empty pools for a non-matching string', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Invalid String');
    expect(bonusDice).toEqual({});
    expect(penaltyDice).toEqual({});
  });

  it('should correctly parse a positive base die bonus', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(+1b)');
    expect(bonusDice).toEqual({ [DiceType.Base]: 1 });
    expect(penaltyDice).toEqual({});
  });

  it('should correctly parse a positive modifier die bonus', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(+2m)');
    expect(bonusDice).toEqual({ [DiceType.Modifier]: 2 });
    expect(penaltyDice).toEqual({});
  });

  it('should correctly parse a positive wild die bonus', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(+3w)');
    expect(bonusDice).toEqual({ [DiceType.Wild]: 3 });
    expect(penaltyDice).toEqual({});
  });

  it('should correctly parse a negative base die penalty', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(-1b)');
    expect(bonusDice).toEqual({});
    expect(penaltyDice).toEqual({ [DiceType.Base]: 1 });
  });

  it('should correctly parse a negative modifier die penalty', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(-2m)');
    expect(bonusDice).toEqual({});
    expect(penaltyDice).toEqual({ [DiceType.Modifier]: 2 });
  });

  it('should correctly parse a negative wild die penalty', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(-3w)');
    expect(bonusDice).toEqual({});
    expect(penaltyDice).toEqual({ [DiceType.Wild]: 3 });
  });

  it('should handle multi-digit numbers', () => {
    const { bonusDice, penaltyDice } = parseAccuracy('Acc(+10b)');
    expect(bonusDice).toEqual({ [DiceType.Base]: 10 });
    expect(penaltyDice).toEqual({});
  });
});

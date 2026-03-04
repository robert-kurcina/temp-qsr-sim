import { describe, expect, it } from 'vitest';
import { calculateObscuredPenalty } from './obscured';

describe('calculateObscuredPenalty', () => {
  it('returns zero with no obscuring models', () => {
    expect(calculateObscuredPenalty(undefined)).toBe(0);
    expect(calculateObscuredPenalty(0)).toBe(0);
  });

  it('applies cumulative threshold penalties at 1, 2, 5, and 10 models', () => {
    expect(calculateObscuredPenalty(1)).toBe(1);
    expect(calculateObscuredPenalty(2)).toBe(2);
    expect(calculateObscuredPenalty(4)).toBe(2);
    expect(calculateObscuredPenalty(5)).toBe(3);
    expect(calculateObscuredPenalty(9)).toBe(3);
    expect(calculateObscuredPenalty(10)).toBe(4);
    expect(calculateObscuredPenalty(14)).toBe(4);
  });
});


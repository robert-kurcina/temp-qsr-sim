
import { describe, it, expect } from 'vitest';
import { calculateHindrancePenalty, HindranceSources } from './hindrances';

describe('calculateHindrancePenalty', () => {

  it('should return 0 when there are no hindrances', () => {
    const sources: HindranceSources = { woundTokens: 0, fearTokens: 0, delayTokens: 0 };
    expect(calculateHindrancePenalty(sources)).toBe(0);
  });

  it('should return 1 when only woundTokens are present', () => {
    const sources: HindranceSources = { woundTokens: 3, fearTokens: 0, delayTokens: 0 };
    expect(calculateHindrancePenalty(sources)).toBe(1);
  });

  it('should return 1 when only fearTokens are present', () => {
    const sources: HindranceSources = { woundTokens: 0, fearTokens: 2, delayTokens: 0 };
    expect(calculateHindrancePenalty(sources)).toBe(1);
  });

  it('should return 1 when only delayTokens are present', () => {
    const sources: HindranceSources = { woundTokens: 0, fearTokens: 0, delayTokens: 1 };
    expect(calculateHindrancePenalty(sources)).toBe(1);
  });

  it('should return 2 when two types of hindrances are present', () => {
    const sources: HindranceSources = { woundTokens: 2, fearTokens: 1, delayTokens: 0 };
    expect(calculateHindrancePenalty(sources)).toBe(2);
  });

  it('should return 2, ignoring zero-value token types', () => {
    const sources: HindranceSources = { woundTokens: 0, fearTokens: 4, delayTokens: 2 };
    expect(calculateHindrancePenalty(sources)).toBe(2);
  });

  it('should return 3 when all three types of hindrances are present', () => {
    const sources: HindranceSources = { woundTokens: 1, fearTokens: 1, delayTokens: 1 };
    expect(calculateHindrancePenalty(sources)).toBe(3);
  });

  it('should count hindrance types, not the total number of tokens', () => {
    // 5 tokens total, but only 2 types
    const sources: HindranceSources = { woundTokens: 3, fearTokens: 2, delayTokens: 0 };
    expect(calculateHindrancePenalty(sources)).toBe(2);
  });

  it('should accept character-state wound shape (wounds) used by action pipelines', () => {
    const sources: HindranceSources = { wounds: 1, fearTokens: 0, delayTokens: 0 };
    expect(calculateHindrancePenalty(sources)).toBe(1);
  });

  it('should count advanced status hindrance types and ignore non-hindrance markers', () => {
    const sources: HindranceSources = {
      woundTokens: 0,
      fearTokens: 0,
      delayTokens: 0,
      statusTokens: {
        Burn: 1,
        Poison: 2,
        rofUsesThisInitiative: 3,
      },
    };
    expect(calculateHindrancePenalty(sources)).toBe(2);
  });

  it('should stack core and advanced hindrance types together', () => {
    const sources: HindranceSources = {
      woundTokens: 1,
      fearTokens: 1,
      delayTokens: 0,
      statusTokens: {
        Confused: 1,
        Held: 1,
      },
    };
    expect(calculateHindrancePenalty(sources)).toBe(4);
  });

});

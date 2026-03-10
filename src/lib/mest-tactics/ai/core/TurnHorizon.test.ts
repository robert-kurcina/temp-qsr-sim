import { describe, expect, it } from 'vitest';
import {
  calculateSuddenDeathTimePressure,
  estimateExpectedTurnsRemaining,
  triggerSurvivalProbabilityForDice,
} from './TurnHorizon';

describe('TurnHorizon', () => {
  it('computes trigger survival probability per die count', () => {
    expect(triggerSurvivalProbabilityForDice(0)).toBeCloseTo(1, 6);
    expect(triggerSurvivalProbabilityForDice(1)).toBeCloseTo(0.5, 6);
    expect(triggerSurvivalProbabilityForDice(2)).toBeCloseTo(0.25, 6);
  });

  it('estimates deterministic turns remaining when trigger is absent', () => {
    expect(estimateExpectedTurnsRemaining(1, 6)).toBe(6);
    expect(estimateExpectedTurnsRemaining(3, 6)).toBe(4);
  });

  it('estimates sudden-death expected turns for very-small style trigger', () => {
    const early = estimateExpectedTurnsRemaining(1, 6, 3);
    const atTrigger = estimateExpectedTurnsRemaining(3, 6, 3);
    const postTrigger = estimateExpectedTurnsRemaining(4, 6, 3);

    expect(early).toBeGreaterThan(atTrigger);
    expect(atTrigger).toBeGreaterThan(postTrigger);
    expect(atTrigger).toBeLessThan(2.0);
    expect(atTrigger).toBeGreaterThan(1.5);
  });

  it('ramps pressure gradually before trigger and steeply after trigger', () => {
    const t1 = calculateSuddenDeathTimePressure(1, 6, 3);
    const t2 = calculateSuddenDeathTimePressure(2, 6, 3);
    const t3 = calculateSuddenDeathTimePressure(3, 6, 3);
    const t4 = calculateSuddenDeathTimePressure(4, 6, 3);

    expect(t1).toBeLessThan(t2);
    expect(t2).toBeLessThan(t3);
    expect(t3).toBeLessThan(t4);
    expect(t3).toBeGreaterThan(0.75);
  });
});

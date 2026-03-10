import { describe, expect, it } from 'vitest';
import { buildActivationLoopBudget } from './ActivationLoopBudget';

describe('buildActivationLoopBudget', () => {
  it('builds default budget from action count and safety floor', () => {
    const budget = buildActivationLoopBudget({
      maxActionsPerTurn: 3,
      attemptMultiplier: 4,
      minDecisionAttempts: 12,
      maxStalledDecisions: 3,
    });
    expect(budget.maxDecisionAttempts).toBe(12);
    expect(budget.maxStalledDecisions).toBe(3);
  });

  it('honors fixed decision-attempt cap when provided', () => {
    const budget = buildActivationLoopBudget({
      maxDecisionAttempts: 8,
      maxStalledDecisions: 2,
    });
    expect(budget.maxDecisionAttempts).toBe(8);
    expect(budget.maxStalledDecisions).toBe(2);
  });

  it('clamps invalid values to safe minimums', () => {
    const budget = buildActivationLoopBudget({
      maxActionsPerTurn: 0,
      attemptMultiplier: 0,
      minDecisionAttempts: 0,
      maxStalledDecisions: 0,
    });
    expect(budget.maxDecisionAttempts).toBeGreaterThanOrEqual(1);
    expect(budget.maxStalledDecisions).toBe(1);
  });
});

export interface ActivationLoopBudgetOptions {
  maxActionsPerTurn?: number;
  attemptMultiplier?: number;
  minDecisionAttempts?: number;
  maxDecisionAttempts?: number;
  maxStalledDecisions?: number;
}

export interface ActivationLoopBudget {
  maxDecisionAttempts: number;
  maxStalledDecisions: number;
}

/**
 * Shared activation-loop budget builder used by AI executors.
 * Keeps guard/stall semantics centralized while allowing each runner to
 * preserve its own caps during consolidation.
 */
export function buildActivationLoopBudget(
  options: ActivationLoopBudgetOptions = {}
): ActivationLoopBudget {
  const maxStalledDecisions = Math.max(1, options.maxStalledDecisions ?? 3);

  if (typeof options.maxDecisionAttempts === 'number' && Number.isFinite(options.maxDecisionAttempts)) {
    return {
      maxDecisionAttempts: Math.max(1, Math.floor(options.maxDecisionAttempts)),
      maxStalledDecisions,
    };
  }

  const maxActions = Math.max(1, options.maxActionsPerTurn ?? 3);
  const attemptMultiplier = Math.max(1, options.attemptMultiplier ?? 4);
  const minDecisionAttempts = Math.max(1, options.minDecisionAttempts ?? 12);

  return {
    maxDecisionAttempts: Math.max(maxActions * attemptMultiplier, minDecisionAttempts),
    maxStalledDecisions,
  };
}

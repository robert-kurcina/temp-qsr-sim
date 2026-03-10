import { describe, expect, it, vi } from 'vitest';
import { executeActivationDecisionForRunner } from './ActivationDecisionExecutionSupport';

function buildParams(overrides: Record<string, unknown> = {}) {
  const log: any[] = [];
  const profiler = {
    recordPhaseDuration: vi.fn(),
  };

  return {
    decision: { type: 'close_combat', reason: 'test-decision' },
    apBefore: 2,
    turn: 1,
    sideIndex: 0,
    sideName: 'Alpha',
    character: { id: 'c1', profile: { name: 'Alpha-1' }, state: {} },
    allies: [],
    enemies: [],
    battlefield: {},
    gameManager: {},
    config: { visibilityOrMu: 16, allowHideAction: true },
    missionSides: [],
    actionValidator: {
      validateActionDecision: vi.fn(() => ({ isValid: false, errors: ['blocked-by-validation'] })),
    },
    tracker: {
      incrementAction: vi.fn(),
      trackAttempt: vi.fn(),
      trackSuccess: vi.fn(),
      trackSituationalModifiers: vi.fn(),
      trackSituationalModifierType: vi.fn(),
    },
    profiler,
    log,
    actorStateBefore: {},
    stepInteractions: [],
    computeFallbackMovePosition: vi.fn(() => null),
    maximizeClosingMoveDestination: vi.fn((_: unknown, destination: unknown) => destination),
    executeMoveAndTrackOpportunity: vi.fn(() => ({
      moved: false,
      moveResult: {},
      opposedTest: undefined,
      details: undefined,
    })),
    executeWaitAction: vi.fn(() => ({
      executed: false,
      resultCode: 'wait=false',
      details: {},
    })),
    buildCombatActionResolutionDeps: vi.fn(() => ({})),
    sanitizeForAudit: (value: unknown) => value,
    ...overrides,
  } as any;
}

describe('ActivationDecisionExecutionSupport', () => {
  it('records failed validation decisions without executing actions', async () => {
    const params = buildParams();
    const result = await executeActivationDecisionForRunner(params);

    expect(result.actionExecuted).toBe(false);
    expect(result.resultCode).toMatch(/^close_combat=false:/);
    expect(result.vectors).toHaveLength(0);
    expect(params.log).toHaveLength(1);
    expect(params.profiler.recordPhaseDuration).toHaveBeenCalledWith('action.close_combat', expect.any(Number));
    expect(params.profiler.recordPhaseDuration).toHaveBeenCalledWith('action.total', expect.any(Number));
  });
});

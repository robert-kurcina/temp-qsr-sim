import { describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  applyActionExecutionReactPostProcessingForRunner: vi.fn(() => ({
    endPos: { x: 2, y: 3 },
    movedDistance: 1,
    stepOpposedTest: undefined,
    stepDetails: { post: true },
  })),
  finalizeActionStepForRunner: vi.fn(() => ({
    apAfter: 1,
    activationStep: { stepId: 'step-1' },
  })),
  resolveStalledDecisionRecoveryForRunner: vi.fn(() => ({
    lastKnownAp: 1,
    continueLoop: false,
    breakLoop: true,
  })),
}));

vi.mock('./ActionExecutionReactPostProcessing', () => ({
  applyActionExecutionReactPostProcessingForRunner: mocked.applyActionExecutionReactPostProcessingForRunner,
}));

vi.mock('./ActionStepFinalizationSupport', () => ({
  finalizeActionStepForRunner: mocked.finalizeActionStepForRunner,
}));

vi.mock('./StalledDecisionRecoverySupport', () => ({
  resolveStalledDecisionRecoveryForRunner: mocked.resolveStalledDecisionRecoveryForRunner,
}));

import { finalizeActivationDecisionStepForRunner } from './ActivationDecisionPostprocessSupport';

function buildParams(overrides: Record<string, unknown> = {}) {
  const activationAudit: any = { steps: [] };
  return {
    decision: { type: 'close_combat' },
    actionExecuted: true,
    resultCode: 'close_combat=true',
    apBefore: 2,
    startPos: { x: 1, y: 1 },
    turn: 1,
    sideName: 'Alpha',
    character: {
      id: 'c1',
      profile: { name: 'Alpha-1' },
      state: {},
    },
    enemies: [],
    battlefield: {},
    gameManager: {
      getApRemaining: vi.fn(() => 1),
    },
    config: {
      visibilityOrMu: 16,
    },
    activationAudit,
    sideNameByCharacterId: new Map<string, string>([['c1', 'Alpha']]),
    tracker: {
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      trackMovesWhileWaiting: vi.fn(),
      trackPassiveUsage: vi.fn(),
      trackCombatExtras: vi.fn(),
      incrementAction: vi.fn(),
    },
    profiler: {
      withPhaseTiming: vi.fn((_: string, fn: () => unknown) => fn()),
    },
    log: [],
    actorStateBefore: {},
    targetStateBefore: undefined,
    stepVectors: [],
    stepTargets: [],
    stepAffectedModels: [],
    stepInteractions: [],
    stepOpposedTest: undefined,
    stepRangeCheck: undefined,
    stepDetails: {},
    computeFallbackMovePosition: vi.fn(() => null),
    processMoveConcludedPassives: vi.fn(),
    processReacts: vi.fn(() => ({ executed: false })),
    trackReactOutcome: vi.fn(),
    sanitizeForAudit: (value: unknown) => value,
    syncMissionRuntimeForAttack: vi.fn(),
    onAttackDecision: vi.fn(),
    ...overrides,
  } as any;
}

describe('ActivationDecisionPostprocessSupport', () => {
  it('wires postprocess, finalize, and stalled recovery in order', () => {
    const params = buildParams();
    const result = finalizeActivationDecisionStepForRunner(params);

    expect(mocked.applyActionExecutionReactPostProcessingForRunner).toHaveBeenCalledTimes(1);
    expect((mocked.applyActionExecutionReactPostProcessingForRunner as any).mock.calls[0][0].startPos).toEqual({ x: 1, y: 1 });

    expect(mocked.finalizeActionStepForRunner).toHaveBeenCalledTimes(1);
    expect((mocked.finalizeActionStepForRunner as any).mock.calls[0][0].endPos).toEqual({ x: 2, y: 3 });
    expect(params.activationAudit.steps).toEqual([{ stepId: 'step-1' }]);

    expect(mocked.resolveStalledDecisionRecoveryForRunner).toHaveBeenCalledTimes(1);
    expect((mocked.resolveStalledDecisionRecoveryForRunner as any).mock.calls[0][0].apAfter).toBe(1);

    expect(result).toEqual({
      lastKnownAp: 1,
      continueLoop: false,
      breakLoop: true,
    });
  });
});

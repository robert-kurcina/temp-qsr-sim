import { describe, expect, it, vi } from 'vitest';
import { runActivationDecisionLoopForRunner } from './ActivationDecisionLoopSupport';

function buildBaseParams(overrides: Record<string, unknown> = {}) {
  const activationAudit: any = { steps: [], skippedReason: undefined };
  return {
    character: {
      id: 'c1',
      profile: { name: 'Alpha-1' },
      state: {
        isAttentive: false,
        isKOd: false,
        isEliminated: false,
        delayTokens: 0,
      },
    },
    allSides: [
      { characters: [{ id: 'c1', state: { isEliminated: false, isKOd: false } }] },
      { characters: [{ id: 'e1', state: { isEliminated: false, isKOd: false } }] },
    ],
    battlefield: {},
    gameManager: {
      getApRemaining: vi.fn(() => 1),
      getSideCoordinatorManager: vi.fn(() => null),
    },
    aiController: {
      getConfig: vi.fn(() => ({})),
      updateKnowledge: vi.fn(() => ({})),
      decideAction: vi.fn(() => ({ decision: { type: 'none' }, debug: {} })),
    },
    turn: 1,
    sideIndex: 0,
    sideName: 'Alpha',
    config: {
      maxTurns: 6,
      visibilityOrMu: 16,
      allowHideAction: true,
      verbose: false,
    },
    initialAp: 2,
    activationAudit,
    missionState: {
      missionSides: [{ id: 'A', state: {} }],
      missionVpBySide: { A: 0, B: 0 },
      missionRpBySide: { A: 0, B: 0 },
      sideNameByCharacterId: new Map<string, string>([['c1', 'Alpha'], ['e1', 'Bravo']]),
    },
    runtime: {
      tracker: {
        trackDecisionChoiceSet: vi.fn(),
      },
      profiler: {
        withPhaseTiming: vi.fn((_: string, fn: () => unknown) => fn()),
      },
      log: [],
      sanitizeForAudit: (value: unknown) => value,
      syncMissionRuntimeForAttack: vi.fn(),
      computeFallbackMovePosition: vi.fn(() => null),
      maximizeClosingMoveDestination: vi.fn((_: unknown, destination: unknown) => destination),
      processReacts: vi.fn(() => ({ executed: false })),
      trackReactOutcome: vi.fn(),
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
      processMoveConcludedPassives: vi.fn(),
      actionValidator: {
        validateActionDecision: vi.fn(() => ({ isValid: true, errors: [] })),
      },
    },
    ...overrides,
  } as any;
}

describe('ActivationDecisionLoopSupport', () => {
  it('exits immediately when AP is unavailable and pushing is not allowed', async () => {
    const params = buildBaseParams({
      initialAp: 0,
      gameManager: {
        getApRemaining: vi.fn(() => 0),
        getSideCoordinatorManager: vi.fn(() => null),
      },
    });
    const result = await runActivationDecisionLoopForRunner(params);

    expect(result.lastKnownAp).toBe(0);
    expect(params.activationAudit.skippedReason).toBeUndefined();
  });
});

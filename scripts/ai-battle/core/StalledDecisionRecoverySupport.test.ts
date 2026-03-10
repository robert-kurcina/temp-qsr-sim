import { describe, expect, it, vi } from 'vitest';
import { resolveStalledDecisionRecoveryForRunner } from './StalledDecisionRecoverySupport';

function buildBaseParams(overrides: Record<string, unknown> = {}) {
  return {
    actionExecuted: true,
    decisionType: 'move',
    apBefore: 1,
    apAfter: 1,
    character: { id: 'c1', profile: { equipment: [] } },
    enemies: [],
    battlefield: {
      getCharacterPosition: vi.fn(() => ({ x: 0, y: 0 })),
    },
    gameManager: {
      getApRemaining: vi.fn(() => 0),
      spendAp: vi.fn(() => true),
      executeMove: vi.fn(() => ({ moved: false })),
    },
    visibilityOrMu: 8,
    turn: 1,
    sideName: 'Alpha',
    computeFallbackMovePosition: vi.fn(() => ({ x: 1, y: 1 })),
    snapshotModelState: vi.fn(() => ({ isWaiting: false })),
    processReacts: vi.fn(() => ({ executed: false })),
    createMovementVector: vi.fn(() => ({ kind: 'movement', from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, distanceMu: 0 })),
    createModelEffect: vi.fn(() => null),
    sanitizeForAudit: (value: unknown) => value,
    trackPassiveUsageOpportunityAttack: vi.fn(),
    trackCombatExtras: vi.fn(),
    syncMissionRuntimeForAttack: vi.fn(),
    extractDamageResolutionFromUnknown: vi.fn(() => undefined),
    incrementMoveAction: vi.fn(),
    incrementTotalActions: vi.fn(),
    trackPathMovement: vi.fn(),
    processMoveConcludedPassives: vi.fn(),
    appendFallbackMoveLog: vi.fn(),
    trackReactOutcome: vi.fn(),
    trackMovesWhileWaiting: vi.fn(),
    appendActivationStep: vi.fn(),
    nextStepSequence: 1,
    ...overrides,
  } as any;
}

describe('StalledDecisionRecoverySupport', () => {
  it('does not attempt recovery when AP was spent', () => {
    const result = resolveStalledDecisionRecoveryForRunner(
      buildBaseParams({ apBefore: 2, apAfter: 1 })
    );
    expect(result.attempted).toBe(false);
    expect(result.breakLoop).toBe(false);
    expect(result.continueLoop).toBe(false);
    expect(result.lastKnownAp).toBe(1);
  });

  it('attempts recovery and requests loop break when fallback does not execute', () => {
    const result = resolveStalledDecisionRecoveryForRunner(buildBaseParams());
    expect(result.attempted).toBe(true);
    expect(result.breakLoop).toBe(true);
    expect(result.continueLoop).toBe(false);
  });
});

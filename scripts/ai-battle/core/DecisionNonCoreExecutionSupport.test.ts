import { describe, expect, it, vi } from 'vitest';
import { executeNonCoreDecisionForRunner } from './DecisionNonCoreExecutionSupport';

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    decision: { type: 'detect' },
    character: {
      id: 'c1',
      state: { isAttentive: true, delayTokens: 0 },
      refreshStatusFlags: vi.fn(),
    },
    enemies: [],
    battlefield: {},
    gameManager: {
      spendAp: vi.fn(() => true),
      executePushing: vi.fn(() => ({ success: true, apGained: 1 })),
      refreshForCharacter: vi.fn(() => true),
      executeRally: vi.fn(() => ({ success: true })),
      executeRevive: vi.fn(() => ({ success: true })),
    },
    sideName: 'Alpha',
    apBefore: 2,
    allowHideAction: true,
    sideInitiativePoints: 0,
    hasOpposingInBaseContact: vi.fn(() => false),
    getMarkerKeyIdsInHand: vi.fn(() => []),
    trackAttempt: vi.fn(),
    incrementAction: vi.fn(),
    trackSuccess: vi.fn(),
    trackSituationalModifiers: vi.fn(),
    trackSituationalModifierType: vi.fn(),
    sanitizeForAudit: (value: unknown) => value,
    ...overrides,
  } as any;
}

describe('DecisionNonCoreExecutionSupport', () => {
  it('returns null for unsupported decision types', async () => {
    const result = await executeNonCoreDecisionForRunner(
      buildParams({ decision: { type: 'move' } })
    );
    expect(result).toBeNull();
  });

  it('returns pushing=false:requires-zero-ap when AP is above zero', async () => {
    const result = await executeNonCoreDecisionForRunner(
      buildParams({ decision: { type: 'pushing' }, apBefore: 1 })
    );
    expect(result?.resultCode).toBe('pushing=false:requires-zero-ap');
    expect(result?.actionExecuted).toBe(false);
  });

  it('returns rally=false:no-target when no rally target is provided', async () => {
    const result = await executeNonCoreDecisionForRunner(
      buildParams({ decision: { type: 'rally', target: undefined } })
    );
    expect(result?.resultCode).toBe('rally=false:no-target');
    expect(result?.actionExecuted).toBe(false);
  });
});

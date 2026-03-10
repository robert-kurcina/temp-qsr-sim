import { describe, expect, it, vi } from 'vitest';
import { handleStalledDecisionOutcomeForRunner } from './StalledDecisionOutcomeSupport';

describe('StalledDecisionOutcomeSupport', () => {
  it('returns break status when fallback did not execute', () => {
    const result = handleStalledDecisionOutcomeForRunner({
      fallbackOutcome: {
        attempted: true,
        executed: false,
        apAfter: 0,
        movedDistance: 0,
      },
      character: {} as any,
      turn: 1,
      sideName: 'Alpha',
      trackPassiveUsageOpportunityAttack: vi.fn(),
      trackCombatExtras: vi.fn(),
      syncMissionRuntimeForAttack: vi.fn(),
      extractDamageResolutionFromUnknown: vi.fn(),
      incrementMoveAction: vi.fn(),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      appendFallbackMoveLog: vi.fn(),
      trackReactOutcome: vi.fn(),
      trackMovesWhileWaiting: vi.fn(),
      appendActivationStep: vi.fn(),
      nextStepSequence: 1,
    });

    expect(result.continueLoop).toBe(false);
    expect(result.lastKnownAp).toBe(0);
  });

  it('returns continue status and appends step when fallback executed', () => {
    const appendActivationStep = vi.fn();
    const result = handleStalledDecisionOutcomeForRunner({
      fallbackOutcome: {
        attempted: true,
        executed: true,
        apAfter: 1,
        movedDistance: 2,
        step: {
          sequence: 0,
          actionType: 'move',
          success: true,
          apBefore: 1,
          apAfter: 0,
          apSpent: 1,
          vectors: [],
          targets: [],
          affectedModels: [],
          interactions: [],
        } as any,
        stateBefore: { isWaiting: false } as any,
      },
      character: {} as any,
      turn: 1,
      sideName: 'Alpha',
      trackPassiveUsageOpportunityAttack: vi.fn(),
      trackCombatExtras: vi.fn(),
      syncMissionRuntimeForAttack: vi.fn(),
      extractDamageResolutionFromUnknown: vi.fn(),
      incrementMoveAction: vi.fn(),
      incrementTotalActions: vi.fn(),
      trackPathMovement: vi.fn(),
      processMoveConcludedPassives: vi.fn(),
      appendFallbackMoveLog: vi.fn(),
      trackReactOutcome: vi.fn(),
      trackMovesWhileWaiting: vi.fn(),
      appendActivationStep,
      nextStepSequence: 3,
    });

    expect(result.continueLoop).toBe(true);
    expect(result.lastKnownAp).toBe(1);
    expect(appendActivationStep).toHaveBeenCalledTimes(1);
    expect((appendActivationStep.mock.calls[0]?.[0] as any).sequence).toBe(3);
  });
});

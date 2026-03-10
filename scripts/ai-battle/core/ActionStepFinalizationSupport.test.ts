import { describe, expect, it, vi } from 'vitest';
import { finalizeActionStepForRunner } from './ActionStepFinalizationSupport';

describe('ActionStepFinalizationSupport', () => {
  it('appends opposed-test interaction and planning details', () => {
    const stepInteractions: any[] = [];
    const onMoveWhileWaiting = vi.fn();
    const result = finalizeActionStepForRunner({
      decision: { type: 'move', reason: 'advance', planning: { source: 'goap' } } as any,
      character: { id: 'c1' } as any,
      actionExecuted: true,
      resultCode: 'move=true',
      apBefore: 2,
      startPos: { x: 1, y: 1 } as any,
      endPos: { x: 2, y: 2 } as any,
      actorStateBefore: { isWaiting: true } as any,
      stepSequence: 1,
      stepVectors: [],
      stepTargets: [],
      stepAffectedModels: [],
      stepInteractions,
      stepOpposedTest: { pass: true, score: 7 } as any,
      stepRangeCheck: undefined,
      stepDetails: { foo: 'bar' },
      snapshotModelState: vi.fn(() => ({ isWaiting: false } as any)),
      createModelEffect: vi.fn(() => null),
      isAttackDecisionType: vi.fn(() => false),
      extractDamageResolutionFromStepDetails: vi.fn(),
      syncMissionRuntimeForAttack: vi.fn(),
      onAttackDecision: vi.fn(),
      getApRemaining: vi.fn(() => 1),
      sanitizeForAudit: value => value,
      onMoveWhileWaiting,
    });

    expect(stepInteractions).toHaveLength(1);
    expect(onMoveWhileWaiting).toHaveBeenCalledTimes(1);
    expect(result.stepDetails).toEqual({
      foo: 'bar',
      planning: { source: 'goap' },
    });
    expect(result.activationStep.apAfter).toBe(1);
  });

  it('syncs mission runtime for executed attack with target', () => {
    const syncMissionRuntimeForAttack = vi.fn();
    const onAttackDecision = vi.fn();
    const target = { id: 't1' } as any;
    finalizeActionStepForRunner({
      decision: { type: 'close_combat', target } as any,
      character: { id: 'a1' } as any,
      actionExecuted: true,
      resultCode: 'close_combat=true',
      apBefore: 1,
      actorStateBefore: {} as any,
      targetStateBefore: {} as any,
      stepSequence: 1,
      stepVectors: [],
      stepTargets: [],
      stepAffectedModels: [],
      stepInteractions: [],
      stepOpposedTest: undefined,
      stepRangeCheck: undefined,
      stepDetails: {},
      snapshotModelState: vi.fn(() => ({} as any)),
      createModelEffect: vi.fn(() => null),
      isAttackDecisionType: vi.fn(() => true),
      extractDamageResolutionFromStepDetails: vi.fn(() => ({ wound: 1 })),
      syncMissionRuntimeForAttack,
      onAttackDecision,
      getApRemaining: vi.fn(() => 0),
      sanitizeForAudit: value => value,
      onMoveWhileWaiting: vi.fn(),
    });

    expect(syncMissionRuntimeForAttack).toHaveBeenCalledTimes(1);
    expect(onAttackDecision).toHaveBeenCalledTimes(1);
  });
});

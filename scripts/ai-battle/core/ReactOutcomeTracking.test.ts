import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { ModelStateAudit } from '../../shared/BattleReportTypes';
import {
  applyReactOutcomeTrackingForRunner,
  mergeReactOutcomeIntoStepForRunner,
} from './ReactOutcomeTracking';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
}

function createState(overrides: Partial<ModelStateAudit> = {}): ModelStateAudit {
  return {
    wounds: 0,
    delayTokens: 0,
    fearTokens: 0,
    isKOd: false,
    isEliminated: false,
    isHidden: false,
    isWaiting: false,
    isAttentive: true,
    isOrdered: false,
    ...overrides,
  };
}

describe('ReactOutcomeTracking', () => {
  it('no-ops when react did not execute', () => {
    const onReactExecuted = vi.fn();
    const trackPassiveUsageReact = vi.fn();
    applyReactOutcomeTrackingForRunner({
      reactResult: { executed: false },
      active: createCharacter('active'),
      actorStateBeforeReact: createState(),
      actorStateAfterReact: createState(),
      onReactChoiceTaken: vi.fn(),
      onReactExecuted,
      trackPassiveUsageReact,
      trackReactorAttemptSuccess: vi.fn(),
      trackReactWoundsInflicted: vi.fn(),
      trackWaitTriggeredReact: vi.fn(),
      trackWaitReactWoundsInflicted: vi.fn(),
      extractDamageResolutionFromUnknown: () => undefined,
      extractWoundsAddedFromDamageResolution: () => 0,
      syncMissionRuntimeForAttack: vi.fn(),
    });
    expect(onReactExecuted).not.toHaveBeenCalled();
    expect(trackPassiveUsageReact).not.toHaveBeenCalled();
  });

  it('tracks full react outcome including wait-triggered wounds', () => {
    const reactor = createCharacter('reactor');
    const onReactChoiceTaken = vi.fn();
    const onReactExecuted = vi.fn();
    const trackPassiveUsageReact = vi.fn();
    const trackReactorAttemptSuccess = vi.fn();
    const trackReactWoundsInflicted = vi.fn();
    const trackWaitTriggeredReact = vi.fn();
    const trackWaitReactWoundsInflicted = vi.fn();
    const syncMissionRuntimeForAttack = vi.fn();

    applyReactOutcomeTrackingForRunner({
      reactResult: {
        executed: true,
        reactor,
        reactorWasWaiting: true,
        rawResult: { damageResolution: { woundsAdded: 1 } },
      },
      active: createCharacter('active'),
      actorStateBeforeReact: createState({ wounds: 0 }),
      actorStateAfterReact: createState({ wounds: 1 }),
      onReactChoiceTaken,
      onReactExecuted,
      trackPassiveUsageReact,
      trackReactorAttemptSuccess,
      trackReactWoundsInflicted,
      trackWaitTriggeredReact,
      trackWaitReactWoundsInflicted,
      extractDamageResolutionFromUnknown: (result) => result,
      extractWoundsAddedFromDamageResolution: () => 1,
      syncMissionRuntimeForAttack,
    });

    expect(onReactChoiceTaken).toHaveBeenCalledTimes(1);
    expect(onReactExecuted).toHaveBeenCalledTimes(1);
    expect(trackPassiveUsageReact).toHaveBeenCalledTimes(1);
    expect(trackReactorAttemptSuccess).toHaveBeenCalledWith(reactor);
    expect(trackReactWoundsInflicted).toHaveBeenCalledWith(1);
    expect(trackWaitTriggeredReact).toHaveBeenCalledTimes(1);
    expect(trackWaitReactWoundsInflicted).toHaveBeenCalledWith(1);
    expect(syncMissionRuntimeForAttack).toHaveBeenCalledTimes(1);
  });

  it('merges executed react details into action step payload', () => {
    const stepInteractions: any[] = [];
    const stepVectors: any[] = [];
    const merged = mergeReactOutcomeIntoStepForRunner({
      reactResult: {
        executed: true,
        reactor: createCharacter('reactor'),
        resultCode: 'react=true:standard',
        vector: { kind: 'los', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, distanceMu: 1.4 },
        opposedTest: { pass: true },
        details: { reason: 'test' },
      },
      activeModelId: 'active',
      stepInteractions,
      stepVectors,
      stepOpposedTest: undefined,
      stepDetails: { prior: true },
    });

    expect(stepInteractions).toHaveLength(1);
    expect(stepVectors).toHaveLength(1);
    expect((merged.opposedTest as any)?.pass).toBe(true);
    expect((merged.details as any)?.react).toEqual({ reason: 'test' });
  });

  it('merges non-executed react gate details into action step payload', () => {
    const merged = mergeReactOutcomeIntoStepForRunner({
      reactResult: {
        executed: false,
        choiceWindowOffered: true,
        choicesGiven: 0,
        details: {
          reason: 'react-gate-failed',
          requiredRef: 5,
          effectiveRef: 4,
          gateReason: 'Insufficient REF to React.',
        },
      },
      activeModelId: 'active',
      stepInteractions: [],
      stepVectors: [],
      stepOpposedTest: undefined,
      stepDetails: { prior: true },
    });

    expect((merged.details as any)?.react).toBeUndefined();
    expect((merged.details as any)?.reactGate?.executed).toBe(false);
    expect((merged.details as any)?.reactGate?.choiceWindowOffered).toBe(true);
    expect((merged.details as any)?.reactGate?.requiredRef).toBe(5);
    expect((merged.details as any)?.reactGate?.effectiveRef).toBe(4);
    expect((merged.details as any)?.reactGate?.gateReason).toBe('Insufficient REF to React.');
  });
});

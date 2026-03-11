import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { PassiveOption } from '../../../src/lib/mest-tactics/status/passive-options';
import {
  applyAutoBonusActionIfPossibleForRunner,
  applyPassiveFollowupBonusActionsForRunner,
  countDiceInPoolForRunner,
  processMoveConcludedPassivesForRunner,
} from './PassiveCombatFollowups';

function createCharacter(id: string): Character {
  return {
    id,
    profile: {
      name: id,
      finalTraits: [],
      allTraits: [],
    },
    attributes: { mov: 4, siz: 3, str: 3 },
    finalAttributes: { mov: 4, siz: 3, str: 3 },
    state: {
      isAttentive: true,
      delayTokens: 0,
      fearTokens: 0,
      wounds: 0,
    },
  } as unknown as Character;
}

function createBonusCharacter(params: {
  id: string;
  finalTraits?: string[];
  attentive?: boolean;
}): Character {
  const character = createCharacter(params.id);
  character.profile = {
    ...character.profile,
    finalTraits: params.finalTraits ?? [],
    allTraits: params.finalTraits ?? [],
  };
  character.state.isAttentive = params.attentive ?? true;
  return character;
}

function buildRefreshOnlySelections(options: { type: string; available: boolean }[]) {
  return options.some(option => option.type === 'Refresh' && option.available)
    ? [{ type: 'Refresh' as const }]
    : [];
}

describe('PassiveCombatFollowups', () => {
  it('counts all dice pool channels', () => {
    expect(countDiceInPoolForRunner(undefined)).toBe(0);
    expect(countDiceInPoolForRunner({ base: 2, modifier: 1, wild: 3 })).toBe(6);
  });

  it('skips move-concluded passive processing when model did not move', () => {
    const inspectMovePassiveOptions = vi.fn();
    const executeCounterChargeFromMove = vi.fn();

    processMoveConcludedPassivesForRunner({
      gameManager: {} as GameManager,
      battlefield: {} as Battlefield,
      character: createCharacter('actor'),
      enemies: [createCharacter('enemy')],
      visibilityOrMu: 24,
      movedDistance: 0,
      inspectMovePassiveOptions,
      executeCounterChargeFromMove,
    });

    expect(inspectMovePassiveOptions).not.toHaveBeenCalled();
    expect(executeCounterChargeFromMove).not.toHaveBeenCalled();
  });

  it('passes move-concluded options into counter-charge resolution when moved', () => {
    const moveConcluded = [{ type: 'CounterCharge', available: true }] as PassiveOption[];
    const inspectMovePassiveOptions = vi.fn(() => ({ moveConcluded, engagementBroken: [] as PassiveOption[] }));
    const executeCounterChargeFromMove = vi.fn();

    processMoveConcludedPassivesForRunner({
      gameManager: {} as GameManager,
      battlefield: {} as Battlefield,
      character: createCharacter('actor'),
      enemies: [createCharacter('enemy')],
      visibilityOrMu: 24,
      movedDistance: 1.5,
      inspectMovePassiveOptions,
      executeCounterChargeFromMove,
    });

    expect(inspectMovePassiveOptions).toHaveBeenCalledTimes(1);
    expect(executeCounterChargeFromMove).toHaveBeenCalledTimes(1);
    expect(executeCounterChargeFromMove.mock.calls[0][2]).toBe(moveConcluded);
  });

  it('chains passive follow-up bonus actions up to the max action budget', () => {
    const defender = createBonusCharacter({
      id: 'defender',
      finalTraits: ['Fight 3'],
    });
    const attacker = createBonusCharacter({
      id: 'attacker',
      finalTraits: ['Fight 1'],
    });
    const trackBonusActionOptions = vi.fn();
    const trackBonusActionOutcome = vi.fn();
    const applyRefreshLocally = vi.fn();

    const result = applyPassiveFollowupBonusActionsForRunner({
      defender,
      attacker,
      battlefield: {} as Battlefield,
      doctrine: 'Operative' as any,
      attackType: 'ranged',
      cascades: 5,
      areEngaged: () => false,
      buildAutoBonusActionSelections: (
        _attacker,
        _target,
        _battlefield,
        _allies,
        _opponents,
        options
      ) => buildRefreshOnlySelections(options),
      applyRefreshLocally,
      trackBonusActionOptions,
      trackBonusActionOutcome,
    });

    expect(result.bonusActionOutcomes?.length).toBe(3);
    expect(result.bonusActionOutcome?.type).toBe('Refresh');
    expect(trackBonusActionOptions).toHaveBeenCalledTimes(3);
    expect(trackBonusActionOutcome).toHaveBeenCalledTimes(3);
    expect(applyRefreshLocally).toHaveBeenCalledTimes(3);
  });

  it('applies auto bonus-action chains and records all outcomes', () => {
    const attacker = createBonusCharacter({
      id: 'attacker',
      finalTraits: ['Fight 4'],
    });
    const target = createBonusCharacter({
      id: 'target',
      finalTraits: ['Fight 1'],
    });
    const result = {
      hitTestResult: {
        cascades: 2,
      },
    } as Record<string, unknown>;
    const applyRefreshLocally = vi.fn();

    applyAutoBonusActionIfPossibleForRunner({
      result,
      attacker,
      target,
      battlefield: {} as Battlefield,
      allies: [],
      opponents: [],
      isCloseCombat: false,
      doctrine: 'Operative' as any,
      areEngaged: () => false,
      buildAutoBonusActionSelections: (
        _attacker,
        _target,
        _battlefield,
        _allies,
        _opponents,
        options
      ) => buildRefreshOnlySelections(options),
      applyRefreshLocally,
    });

    const outcomes = (result.bonusActionOutcomes ?? []) as Array<{ type?: string; executed?: boolean }>;
    expect(outcomes.length).toBe(2);
    expect(outcomes.every(outcome => outcome.executed && outcome.type === 'Refresh')).toBe(true);
    expect(Array.isArray(result.bonusActionOptionSets)).toBe(true);
    expect((result.bonusActionOptionSets as unknown[]).length).toBe(2);
    expect(applyRefreshLocally).toHaveBeenCalledTimes(2);
  });

  it('does not re-grant brawl cascades across chained steps', () => {
    const attacker = createBonusCharacter({
      id: 'attacker',
      finalTraits: ['Fight 3', 'Brawl 2'],
    });
    const target = createBonusCharacter({
      id: 'target',
      finalTraits: ['Fight 1'],
    });
    const result = {
      hitTestResult: {
        cascades: 0,
      },
    } as Record<string, unknown>;
    const applyRefreshLocally = vi.fn();

    applyAutoBonusActionIfPossibleForRunner({
      result,
      attacker,
      target,
      battlefield: {} as Battlefield,
      allies: [],
      opponents: [],
      isCloseCombat: true,
      doctrine: 'Operative' as any,
      areEngaged: () => false,
      buildAutoBonusActionSelections: (
        _attacker,
        _target,
        _battlefield,
        _allies,
        _opponents,
        options
      ) => buildRefreshOnlySelections(options),
      applyRefreshLocally,
    });

    const outcomes = (result.bonusActionOutcomes ?? []) as unknown[];
    expect(outcomes.length).toBe(2);
    expect(applyRefreshLocally).toHaveBeenCalledTimes(2);
  });
});

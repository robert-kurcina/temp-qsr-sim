import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { PassiveOption } from '../../../src/lib/mest-tactics/status/passive-options';
import {
  countDiceInPoolForRunner,
  processMoveConcludedPassivesForRunner,
} from './PassiveCombatFollowups';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
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
});

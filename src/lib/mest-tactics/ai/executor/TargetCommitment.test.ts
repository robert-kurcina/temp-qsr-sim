import { describe, expect, it, vi } from 'vitest';
import {
  getTargetCommitmentWeight,
  isAttackDecisionType,
  updateSideTargetCommitment,
  type SideCoordinatorLike,
} from './TargetCommitment';
import type { Character } from '../../core/Character';

function stubCharacter(id: string, stateOverrides: Partial<Character['state']> = {}): Character {
  return {
    id,
    state: {
      isKOd: false,
      isEliminated: false,
      ...stateOverrides,
    },
  } as Character;
}

describe('TargetCommitment helpers', () => {
  it('classifies attack decision types', () => {
    expect(isAttackDecisionType('close_combat')).toBe(true);
    expect(isAttackDecisionType('charge')).toBe(true);
    expect(isAttackDecisionType('ranged_combat')).toBe(true);
    expect(isAttackDecisionType('move')).toBe(false);
  });

  it('computes commitment weight with success penalty on failure', () => {
    expect(getTargetCommitmentWeight('charge', true)).toBeCloseTo(1.2, 5);
    expect(getTargetCommitmentWeight('charge', false)).toBeCloseTo(0.24, 5);
    expect(getTargetCommitmentWeight('close_combat', true)).toBeCloseTo(1.0, 5);
    expect(getTargetCommitmentWeight('ranged_combat', true)).toBeCloseTo(0.9, 5);
    expect(getTargetCommitmentWeight('move', true)).toBe(0);
  });

  it('records side target commitment through coordinator manager', () => {
    const coordinator: SideCoordinatorLike = {
      clearTargetCommitment: vi.fn(),
      recordTargetCommitment: vi.fn(),
    };
    const host = {
      getSideCoordinatorManager: () => ({
        getCoordinator: () => coordinator,
      }),
    };

    updateSideTargetCommitment({
      coordinatorHost: host,
      sideId: 'Alpha',
      attacker: stubCharacter('attacker-1'),
      target: stubCharacter('target-1'),
      actionType: 'close_combat',
      actionExecuted: true,
      turn: 2,
      topologySignature: 'scrum:test',
    });

    expect(coordinator.clearTargetCommitment).not.toHaveBeenCalled();
    expect(coordinator.recordTargetCommitment).toHaveBeenCalledWith(
      'target-1',
      'attacker-1',
      2,
      1,
      'close_combat',
      'scrum:test'
    );
  });

  it('clears commitment when target is out-of-play', () => {
    const coordinator: SideCoordinatorLike = {
      clearTargetCommitment: vi.fn(),
      recordTargetCommitment: vi.fn(),
    };
    const host = {
      getSideCoordinatorManager: () => ({
        getCoordinator: () => coordinator,
      }),
    };

    updateSideTargetCommitment({
      coordinatorHost: host,
      sideId: 'Bravo',
      attacker: stubCharacter('attacker-2'),
      target: stubCharacter('target-2'),
      actionType: 'ranged_combat',
      actionExecuted: true,
      turn: 3,
      targetStateAfter: { isKOd: true },
    });

    expect(coordinator.clearTargetCommitment).toHaveBeenCalledWith('target-2');
    expect(coordinator.recordTargetCommitment).not.toHaveBeenCalled();
  });
});

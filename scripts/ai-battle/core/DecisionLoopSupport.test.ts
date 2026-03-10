import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import {
  buildDecisionTargetsForAuditForRunner,
  validateDecisionForExecutionForRunner,
} from './DecisionLoopSupport';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
}

describe('DecisionLoopSupport', () => {
  it('builds audit targets for direct target decisions', () => {
    const actor = createCharacter('actor');
    const target = createCharacter('target');
    const decision: ActionDecision = {
      type: 'close_combat',
      target,
      reason: 'attack',
      priority: 1,
      requiresAP: true,
    };

    const targets = buildDecisionTargetsForAuditForRunner({
      decision,
      allSides: [{ characters: [actor] }, { characters: [target] }],
      sideName: 'Alpha',
      actorId: actor.id,
      resolveSideName: id => (id === actor.id ? 'Alpha' : 'Bravo'),
    });

    expect(targets).toHaveLength(1);
    expect(targets[0].modelId).toBe('target');
    expect(targets[0].relation).toBe('enemy');
  });

  it('validates move with computed fallback position when position is missing', () => {
    const actor = createCharacter('actor');
    const decision: ActionDecision = {
      type: 'move',
      reason: 'advance',
      priority: 1,
      requiresAP: true,
    };
    const validateActionDecision = vi.fn(() => ({ isValid: true, errors: [] }));
    const outcome = validateDecisionForExecutionForRunner({
      actionValidator: { validateActionDecision },
      decision,
      character: actor,
      turn: 1,
      apBefore: 1,
      allies: [],
      enemies: [],
      battlefield: {} as Battlefield,
      shouldValidateWithExecutor: () => false,
      computeFallbackMovePosition: () => ({ x: 1, y: 1 }),
      buildValidationContext: () => ({}),
      sanitizeForAudit: value => value,
    });

    expect(outcome.resultCode).toBeUndefined();
    expect(validateActionDecision).toHaveBeenCalledTimes(1);
  });

  it('returns validation error payload when executor rejects action', () => {
    const actor = createCharacter('actor');
    const decision: ActionDecision = {
      type: 'close_combat',
      reason: 'invalid',
      priority: 1,
      requiresAP: true,
    };
    const outcome = validateDecisionForExecutionForRunner({
      actionValidator: {
        validateActionDecision: () => ({
          isValid: false,
          errors: ['not engaged'],
        }),
      },
      decision,
      character: actor,
      turn: 1,
      apBefore: 1,
      allies: [],
      enemies: [],
      battlefield: {} as Battlefield,
      shouldValidateWithExecutor: () => true,
      computeFallbackMovePosition: () => null,
      buildValidationContext: () => ({}),
      sanitizeForAudit: value => value,
    });

    expect(outcome.resultCode).toBe('close_combat=false:validation:not engaged');
    expect((outcome.details as any).validation).toEqual({
      isValid: false,
      errors: ['not engaged'],
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { executeSupportActionForRunner } from './SupportActionResolution';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
}

describe('SupportActionResolution', () => {
  it('returns no-target when support action has no target', () => {
    const actor = createCharacter('actor');
    const gameManager = {} as GameManager;
    const result = executeSupportActionForRunner({
      actionType: 'rally',
      actor,
      target: undefined,
      gameManager,
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('rally=false:no-target');
  });

  it('returns not-enough-ap when AP spend fails', () => {
    const actor = createCharacter('actor');
    const target = createCharacter('target');
    const gameManager = {
      spendAp: vi.fn(() => false),
    } as unknown as GameManager;
    const result = executeSupportActionForRunner({
      actionType: 'revive',
      actor,
      target,
      gameManager,
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('revive=false:not-enough-ap');
  });

  it('executes rally and returns success details', () => {
    const actor = createCharacter('actor');
    const target = createCharacter('target');
    const gameManager = {
      spendAp: vi.fn(() => true),
      executeRally: vi.fn(() => ({ success: true })),
      executeRevive: vi.fn(() => ({ success: false })),
    } as unknown as GameManager;
    const result = executeSupportActionForRunner({
      actionType: 'rally',
      actor,
      target,
      gameManager,
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('rally=true');
    expect((result.details as any).rallyResult).toEqual({ success: true });
  });
});

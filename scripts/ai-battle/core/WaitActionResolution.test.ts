import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { executeWaitActionForRunner } from './WaitActionResolution';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: {},
  } as unknown as Character;
}

describe('WaitActionResolution', () => {
  it('returns disabled when wait toggle is off', () => {
    const actor = createCharacter('actor');
    const manager = {} as GameManager;
    const result = executeWaitActionForRunner({
      allowWaitAction: false,
      character: actor,
      opponents: [],
      gameManager: manager,
      visibilityOrMu: 12,
      trackAttempt: vi.fn(),
      incrementWaitAction: vi.fn(),
      trackWaitChoiceTaken: vi.fn(),
      trackSuccess: vi.fn(),
      sanitizeForAudit: value => value,
    });
    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('wait=false:disabled');
  });

  it('tracks successful wait execution', () => {
    const actor = createCharacter('actor');
    const manager = {
      executeWait: () => ({ success: true }),
    } as unknown as GameManager;
    const trackAttempt = vi.fn();
    const incrementWaitAction = vi.fn();
    const trackWaitChoiceTaken = vi.fn();
    const trackSuccess = vi.fn();

    const result = executeWaitActionForRunner({
      allowWaitAction: true,
      character: actor,
      opponents: [],
      gameManager: manager,
      visibilityOrMu: 12,
      selectionSource: 'utility',
      trackAttempt,
      incrementWaitAction,
      trackWaitChoiceTaken,
      trackSuccess,
      sanitizeForAudit: value => value,
    });

    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('wait=true');
    expect(trackAttempt).toHaveBeenCalledTimes(1);
    expect(incrementWaitAction).toHaveBeenCalledTimes(1);
    expect(trackWaitChoiceTaken).toHaveBeenCalledWith('utility');
    expect(trackSuccess).toHaveBeenCalledTimes(1);
  });

  it('returns failure code when wait fails', () => {
    const actor = createCharacter('actor');
    const manager = {
      executeWait: () => ({ success: false, reason: 'not-attentive' }),
    } as unknown as GameManager;
    const trackSuccess = vi.fn();

    const result = executeWaitActionForRunner({
      allowWaitAction: true,
      character: actor,
      opponents: [],
      gameManager: manager,
      visibilityOrMu: 12,
      trackAttempt: vi.fn(),
      incrementWaitAction: vi.fn(),
      trackWaitChoiceTaken: vi.fn(),
      trackSuccess,
      sanitizeForAudit: value => value,
    });

    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('wait=false:not-attentive');
    expect(trackSuccess).not.toHaveBeenCalled();
  });
});

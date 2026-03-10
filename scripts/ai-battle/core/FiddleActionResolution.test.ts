import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ActionDecision } from '../../../src/lib/mest-tactics/ai/core/AIController';
import { executeFiddleActionForRunner } from './FiddleActionResolution';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id },
    state: { isAttentive: true, isOrdered: false },
  } as unknown as Character;
}

describe('FiddleActionResolution', () => {
  it('resolves acquire marker objective action', () => {
    const character = createCharacter('actor');
    const decision: ActionDecision = {
      type: 'fiddle',
      reason: 'acquire',
      priority: 1,
      requiresAP: true,
      objectiveAction: 'acquire_marker',
      markerId: 'm1',
    };
    const gameManager = {
      executeAcquireObjectiveMarker: vi.fn(() => ({ success: true })),
    } as unknown as GameManager;
    const battlefield = {} as Battlefield;

    const result = executeFiddleActionForRunner({
      decision,
      character,
      enemies: [],
      battlefield,
      gameManager,
      sideName: 'Alpha',
      hasOpposingInBaseContact: () => false,
      getMarkerKeyIdsInHand: () => ['k1'],
      sanitizeForAudit: value => value,
    });

    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('fiddle=true:acquire_marker');
    expect((result.details as any).markerId).toBe('m1');
    expect((gameManager.executeAcquireObjectiveMarker as any)).toHaveBeenCalledTimes(1);
  });

  it('rejects share marker when missing target model', () => {
    const character = createCharacter('actor');
    const decision: ActionDecision = {
      type: 'fiddle',
      reason: 'share',
      priority: 1,
      requiresAP: true,
      objectiveAction: 'share_marker',
      markerId: 'm1',
    };
    const gameManager = {} as GameManager;
    const battlefield = {} as Battlefield;

    const result = executeFiddleActionForRunner({
      decision,
      character,
      enemies: [],
      battlefield,
      gameManager,
      sideName: 'Alpha',
      hasOpposingInBaseContact: () => false,
      getMarkerKeyIdsInHand: () => [],
      sanitizeForAudit: value => value,
    });

    expect(result.executed).toBe(false);
    expect(result.resultCode).toBe('fiddle=false:no-share-target');
  });

  it('falls back to generic fiddle action when no marker objective action is selected', () => {
    const character = createCharacter('actor');
    const decision: ActionDecision = {
      type: 'fiddle',
      reason: 'generic',
      priority: 1,
      requiresAP: true,
    };
    const gameManager = {
      executeFiddle: vi.fn(() => ({ success: true })),
    } as unknown as GameManager;
    const battlefield = {} as Battlefield;

    const result = executeFiddleActionForRunner({
      decision,
      character,
      enemies: [],
      battlefield,
      gameManager,
      sideName: 'Alpha',
      hasOpposingInBaseContact: () => false,
      getMarkerKeyIdsInHand: () => [],
      sanitizeForAudit: value => value,
    });

    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('fiddle=true');
    expect((gameManager.executeFiddle as any)).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { ModelStateAudit } from '../../shared/BattleReportTypes';
import { runStalledDecisionFallbackAdvance } from './ActivationFallbackRecovery';

function createCharacter(id: string): Character {
  return {
    id,
    profile: { name: id, equipment: [{ name: 'Sword', classification: 'Melee' }] },
    state: { isWaiting: false },
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

describe('ActivationFallbackRecovery', () => {
  it('skips fallback planning when AP is exhausted', () => {
    const actor = createCharacter('actor');
    const enemy = createCharacter('enemy');
    const computeFallbackMovePosition = vi.fn(() => ({ x: 1, y: 0 }));
    const battlefield = {
      getCharacterPosition: () => ({ x: 0, y: 0 }),
    } as unknown as Battlefield;
    const spendAp = vi.fn(() => false);
    const gameManager = {
      getApRemaining: () => 0,
      spendAp,
      executeMove: vi.fn(() => ({ moved: false })),
    } as unknown as GameManager;

    const result = runStalledDecisionFallbackAdvance({
      character: actor,
      enemies: [enemy],
      battlefield,
      gameManager,
      visibilityOrMu: 12,
      apBefore: 0,
      computeFallbackMovePosition,
      snapshotModelState: () => createState(),
      processReacts: () => ({ executed: false }),
      createMovementVector: () => ({
        kind: 'movement',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        distanceMu: 1,
      }),
      createModelEffect: () => null,
      sanitizeForAudit: value => value,
    });

    expect(result.attempted).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.apAfter).toBe(0);
    expect(computeFallbackMovePosition).not.toHaveBeenCalled();
    expect(spendAp).not.toHaveBeenCalled();
  });

  it('returns not attempted when no fallback position is available', () => {
    const actor = createCharacter('actor');
    const enemy = createCharacter('enemy');
    const battlefield = {
      getCharacterPosition: () => ({ x: 0, y: 0 }),
    } as unknown as Battlefield;
    const gameManager = {
      getApRemaining: () => 1,
      spendAp: () => true,
      executeMove: () => ({ moved: true }),
    } as unknown as GameManager;

    const result = runStalledDecisionFallbackAdvance({
      character: actor,
      enemies: [enemy],
      battlefield,
      gameManager,
      visibilityOrMu: 12,
      apBefore: 1,
      computeFallbackMovePosition: () => null,
      snapshotModelState: () => createState(),
      processReacts: () => ({ executed: false }),
      createMovementVector: () => ({
        kind: 'movement',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        distanceMu: 1,
      }),
      createModelEffect: () => null,
      sanitizeForAudit: value => value,
    });

    expect(result.attempted).toBe(false);
    expect(result.executed).toBe(false);
  });

  it('spends AP and builds fallback step when move executes', () => {
    const actor = createCharacter('actor');
    const enemy = createCharacter('enemy');
    let ap = 1;
    let actorPos = { x: 0, y: 0 };
    const battlefield = {
      getCharacterPosition: () => ({ ...actorPos }),
    } as unknown as Battlefield;
    const gameManager = {
      getApRemaining: () => ap,
      spendAp: () => {
        ap -= 1;
        return true;
      },
      executeMove: () => {
        actorPos = { x: 2, y: 0 };
        return { moved: true };
      },
    } as unknown as GameManager;

    const result = runStalledDecisionFallbackAdvance({
      character: actor,
      enemies: [enemy],
      battlefield,
      gameManager,
      visibilityOrMu: 12,
      apBefore: 1,
      computeFallbackMovePosition: () => ({ x: 2, y: 0 }),
      snapshotModelState: () => createState(),
      processReacts: () => ({
        executed: true,
        reactor: enemy,
        resultCode: 'react=true:standard',
        vector: { kind: 'los', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } },
      }),
      createMovementVector: () => ({
        kind: 'movement',
        from: { x: 0, y: 0 },
        to: { x: 2, y: 0 },
        distanceMu: 2,
      }),
      createModelEffect: () => null,
      sanitizeForAudit: value => value,
    });

    expect(result.attempted).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.apAfter).toBe(0);
    expect(result.movedDistance).toBe(2);
    expect(result.step?.actionType).toBe('move');
    expect(result.step?.interactions[0]?.kind).toBe('react');
  });

  it('returns attempted but not executed when movement does not resolve', () => {
    const actor = createCharacter('actor');
    const enemy = createCharacter('enemy');
    let ap = 1;
    const battlefield = {
      getCharacterPosition: () => ({ x: 0, y: 0 }),
    } as unknown as Battlefield;
    const gameManager = {
      getApRemaining: () => ap,
      spendAp: () => {
        ap -= 1;
        return true;
      },
      executeMove: () => ({ moved: false }),
    } as unknown as GameManager;

    const result = runStalledDecisionFallbackAdvance({
      character: actor,
      enemies: [enemy],
      battlefield,
      gameManager,
      visibilityOrMu: 12,
      apBefore: 1,
      computeFallbackMovePosition: () => ({ x: 1, y: 0 }),
      snapshotModelState: vi.fn(() => createState()),
      processReacts: vi.fn(() => ({ executed: false })),
      createMovementVector: vi.fn(() => ({
        kind: 'movement' as const,
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        distanceMu: 1,
      })),
      createModelEffect: vi.fn(() => null),
      sanitizeForAudit: value => value,
    });

    expect(result.attempted).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.apAfter).toBe(0);
    expect(result.step).toBeUndefined();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { TurnPhase } from '../../core/types';
import { runTurnForGameLoop } from './TurnRunner';

function makeCharacter(id: string, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    name: id,
    initiative: 2,
    state: {
      isEliminated: false,
      isKOd: false,
      isWaiting: false,
      delayTokens: 0,
      ...overrides,
    },
  };
}

describe('runTurnForGameLoop', () => {
  it('advances phases, runs character turns, and aggregates squad activations', () => {
    const active = makeCharacter('active');
    const side = { id: 'A', name: 'Alpha', members: [{ character: active }], state: { initiativePoints: 1 } };

    const manager = {
      phase: TurnPhase.Activation,
      roundsPerTurn: 3,
      advancePhase: vi.fn(),
      isTurnOver: vi
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
      getNextToActivate: vi.fn(() => active),
      beginActivation: vi.fn(() => 2),
      endActivation: vi.fn(),
      getApRemaining: vi.fn(() => 1),
    };

    const logger = { logInitiativePoints: vi.fn() };
    const auditService = {
      startActivation: vi.fn(),
      endActivation: vi.fn(),
    };
    const runCharacterTurn = vi.fn(() => ({
      totalActions: 3,
      successfulActions: 2,
      failedActions: 1,
      replannedActions: 1,
    }));
    const considerSquadIPActivation = vi.fn(() => ({
      success: true,
      totalActions: 2,
      successfulActions: 2,
      failedActions: 0,
    }));

    const result = runTurnForGameLoop(1, {
      manager: manager as any,
      sides: [side as any],
      logger: logger as any,
      auditService: auditService as any,
      runCharacterTurn,
      considerSquadIPActivation,
    });

    expect(result).toEqual({
      totalActions: 5,
      successfulActions: 4,
      failedActions: 1,
      replannedActions: 1,
    });
    expect(manager.advancePhase).toHaveBeenCalledTimes(2);
    expect(runCharacterTurn).toHaveBeenCalledWith(active, 1);
    expect(considerSquadIPActivation).toHaveBeenCalledWith(active, 1);
    expect(logger.logInitiativePoints).toHaveBeenCalledWith(1, { A: 1 });
    expect(auditService.startActivation).toHaveBeenCalledTimes(1);
    expect(auditService.endActivation).toHaveBeenCalledTimes(1);
  });

  it('skips eliminated characters and does not execute a turn for them', () => {
    const eliminated = makeCharacter('eliminated', { isEliminated: true });
    const side = { id: 'A', name: 'Alpha', members: [{ character: eliminated }], state: { initiativePoints: 0 } };

    const manager = {
      phase: TurnPhase.Activation,
      roundsPerTurn: 3,
      advancePhase: vi.fn(),
      isTurnOver: vi
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
      getNextToActivate: vi.fn(() => eliminated),
      beginActivation: vi.fn(() => 2),
      endActivation: vi.fn(),
      getApRemaining: vi.fn(() => 0),
    };

    const runCharacterTurn = vi.fn();
    const result = runTurnForGameLoop(2, {
      manager: manager as any,
      sides: [side as any],
      logger: null,
      auditService: null,
      runCharacterTurn,
      considerSquadIPActivation: vi.fn(() => ({
        success: false,
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
      })),
    });

    expect(result.totalActions).toBe(0);
    expect(runCharacterTurn).not.toHaveBeenCalled();
    expect(manager.endActivation).toHaveBeenCalledWith(eliminated);
  });
});

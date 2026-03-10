import { describe, expect, it, vi } from 'vitest';
import { runGameLifecycleForGameLoop } from './GameLifecycleRunner';

describe('runGameLifecycleForGameLoop', () => {
  it('aggregates turn summaries and stops when end condition is met', () => {
    const resetReplanAttempts = vi.fn();
    const runTurn = vi.fn((turn: number) => ({
      totalActions: turn,
      successfulActions: 1,
      failedActions: 0,
      replannedActions: 0,
    }));
    const onTurnEnd = vi.fn();
    const shouldEndGame = vi.fn((turn: number) => turn >= 2);
    const getEndReason = vi.fn(() => 'Ended early');

    const result = runGameLifecycleForGameLoop({
      maxTurns: 5,
      resetReplanAttempts,
      runTurn,
      onTurnEnd,
      shouldEndGame,
      getEndReason,
    });

    expect(result).toEqual({
      totalActions: 3,
      successfulActions: 2,
      failedActions: 0,
      replannedActions: 0,
      finalTurn: 2,
      endReason: 'Ended early',
    });
    expect(resetReplanAttempts).toHaveBeenCalledTimes(2);
    expect(runTurn).toHaveBeenCalledTimes(2);
    expect(onTurnEnd).toHaveBeenCalledTimes(2);
    expect(getEndReason).toHaveBeenCalledTimes(1);
  });

  it('runs all turns when end condition is never met', () => {
    const result = runGameLifecycleForGameLoop({
      maxTurns: 3,
      resetReplanAttempts: vi.fn(),
      runTurn: () => ({
        totalActions: 1,
        successfulActions: 1,
        failedActions: 0,
        replannedActions: 0,
      }),
      shouldEndGame: () => false,
      getEndReason: () => 'unused',
    });

    expect(result.finalTurn).toBe(3);
    expect(result.totalActions).toBe(3);
    expect(result.endReason).toBeUndefined();
  });
});

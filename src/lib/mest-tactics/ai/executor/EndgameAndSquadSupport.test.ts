import { describe, expect, it, vi } from 'vitest';
import {
  considerSquadIPActivationForGameLoop,
  getGameEndReasonForGameLoop,
  getSideNameForCharacterForGameLoop,
  shouldEndGameForGameLoop,
} from './EndgameAndSquadSupport';

function makeCharacter(id: string, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    name: id,
    state: {
      isEliminated: false,
      isKOd: false,
      isReady: true,
      isWaiting: false,
      ...overrides,
    },
  };
}

describe('EndgameAndSquadSupport', () => {
  it('evaluates endgame conditions and reasons', () => {
    const a1 = makeCharacter('a1');
    const b1 = makeCharacter('b1');
    const bySide = new Map<string, string>([
      [a1.id, 'A'],
      [b1.id, 'B'],
    ]);

    expect(
      shouldEndGameForGameLoop(
        1,
        ['A', 'B'],
        [a1, b1],
        character => bySide.get(character.id) || null
      )
    ).toBe(false);

    b1.state.isKOd = true;
    expect(
      shouldEndGameForGameLoop(
        1,
        ['A', 'B'],
        [a1, b1],
        character => bySide.get(character.id) || null
      )
    ).toBe(true);
    expect(
      getGameEndReasonForGameLoop([a1, b1], character => bySide.get(character.id) || null)
    ).toBe('One side remaining');

    a1.state.isEliminated = true;
    expect(
      getGameEndReasonForGameLoop([a1, b1], character => bySide.get(character.id) || null)
    ).toBe('All models eliminated');

    expect(
      shouldEndGameForGameLoop(
        10,
        ['A', 'B'],
        [makeCharacter('a2'), makeCharacter('b2')],
        character => (character.id.startsWith('a') ? 'A' : 'B')
      )
    ).toBe(true);
  });

  it('resolves side names from mission sides', () => {
    const alpha = makeCharacter('alpha');
    const sideName = getSideNameForCharacterForGameLoop(alpha, [
      { id: 'A', name: 'Alpha', members: [{ character: alpha }] } as any,
    ]);
    expect(sideName).toBe('Alpha');
    expect(getSideNameForCharacterForGameLoop(makeCharacter('unknown'), [])).toBe('Unknown');
  });

  it('runs squad-IP activation when a ready squadmate is in range', () => {
    const leader = makeCharacter('leader');
    const wing = makeCharacter('wing');
    const side = {
      id: 'A',
      name: 'Alpha',
      members: [{ character: leader }, { character: wing }],
      state: { initiativePoints: 1 },
    };
    const battlefield = {
      getCharacterPosition: (c: any) => (c.id === 'leader' ? { x: 4, y: 4 } : { x: 8, y: 4 }),
    };
    const manager = {
      beginActivation: vi.fn(() => 2),
      maintainInitiative: vi.fn(() => true),
      endActivation: vi.fn(),
    };
    const logger = { logIpSpending: vi.fn() };
    const runCharacterTurn = vi.fn(() => ({
      totalActions: 2,
      successfulActions: 2,
      failedActions: 0,
      replannedActions: 0,
    }));

    const result = considerSquadIPActivationForGameLoop(leader, 3, {
      sides: [side as any],
      battlefield: battlefield as any,
      manager: manager as any,
      logger: logger as any,
      runCharacterTurn,
    });

    expect(result).toEqual({
      success: true,
      totalActions: 2,
      successfulActions: 2,
      failedActions: 0,
    });
    expect(manager.beginActivation).toHaveBeenCalledWith(wing);
    expect(manager.maintainInitiative).toHaveBeenCalledWith(side);
    expect(runCharacterTurn).toHaveBeenCalledWith(wing, 3);
    expect(logger.logIpSpending).toHaveBeenCalledWith('A', 'leader', 'push', 3);
  });

  it('does not activate squadmate when no IP is available', () => {
    const leader = makeCharacter('leader');
    const wing = makeCharacter('wing');
    const side = {
      id: 'A',
      name: 'Alpha',
      members: [{ character: leader }, { character: wing }],
      state: { initiativePoints: 0 },
    };
    const manager = {
      beginActivation: vi.fn(() => 2),
      maintainInitiative: vi.fn(() => true),
      endActivation: vi.fn(),
    };
    const result = considerSquadIPActivationForGameLoop(leader, 1, {
      sides: [side as any],
      battlefield: { getCharacterPosition: () => ({ x: 0, y: 0 }) } as any,
      manager: manager as any,
      logger: null,
      runCharacterTurn: vi.fn() as any,
    });

    expect(result.success).toBe(false);
    expect(manager.beginActivation).not.toHaveBeenCalled();
  });
});

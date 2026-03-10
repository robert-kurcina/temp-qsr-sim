import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Character } from '../../core/Character';
import {
  createConsiderSquadIPActivationForAIGameLoop,
  createRunCharacterTurnDepsForAIGameLoop,
  createRunGameLifecycleDepsForAIGameLoop,
  createRunTurnDepsForAIGameLoop,
} from './AIGameLoopRunDeps';

const mockShouldEndGameForGameLoop = vi.fn();
const mockGetGameEndReasonForGameLoop = vi.fn();
const mockConsiderSquadIPActivationForGameLoop = vi.fn();

vi.mock('./EndgameAndSquadSupport', () => ({
  shouldEndGameForGameLoop: (...args: unknown[]) => mockShouldEndGameForGameLoop(...args),
  getGameEndReasonForGameLoop: (...args: unknown[]) => mockGetGameEndReasonForGameLoop(...args),
  considerSquadIPActivationForGameLoop: (...args: unknown[]) =>
    mockConsiderSquadIPActivationForGameLoop(...args),
}));

describe('AIGameLoopRunDeps', () => {
  beforeEach(() => {
    mockShouldEndGameForGameLoop.mockReset();
    mockGetGameEndReasonForGameLoop.mockReset();
    mockConsiderSquadIPActivationForGameLoop.mockReset();
  });

  it('creates run-turn deps by passing through supplied references', () => {
    const runCharacterTurn = vi.fn();
    const considerSquad = vi.fn();
    const deps = createRunTurnDepsForAIGameLoop({
      manager: { any: 'manager' } as any,
      sides: [{ id: 'A' }] as any,
      logger: null,
      auditService: null,
      runCharacterTurn: runCharacterTurn as any,
      considerSquadIPActivation: considerSquad as any,
    });

    expect(deps.runCharacterTurn).toBe(runCharacterTurn);
    expect(deps.considerSquadIPActivation).toBe(considerSquad);
    expect(deps.sides).toHaveLength(1);
  });

  it('creates character-turn deps that delegate to decision runtime', () => {
    const runtime = {
      getAIDecision: vi.fn(() => ({ type: 'hold' })),
      getAggressiveFallbackDecision: vi.fn(() => ({ type: 'move' })),
      getAlternativeDecision: vi.fn(() => ({ type: 'hold' })),
      sanitizeDecisionForExecution: vi.fn((_actor, decision) => decision),
      createExecutionContext: vi.fn(() => ({ currentTurn: 1 })),
      captureModelState: vi.fn(() => ({ wounds: 0 })),
      getSideNameForCharacter: vi.fn(() => 'Alpha'),
      findCharacterSide: vi.fn(() => 'A'),
      buildPressureTopologySignature: vi.fn(() => 'sig'),
    };
    const actor = { id: 'actor-1' } as unknown as Character;

    const deps = createRunCharacterTurnDepsForAIGameLoop({
      manager: { getApRemaining: () => 2, getCharacterPosition: () => undefined, currentTurn: 1 } as any,
      battlefield: {} as any,
      executor: {} as any,
      auditService: null,
      maxActionsPerTurn: 3,
      decisionRuntime: runtime as any,
    });

    deps.getAIDecision(actor);
    deps.getAlternativeDecision(actor, { type: 'hold' } as any);
    deps.getAggressiveFallbackDecision(actor, 2, undefined);
    deps.buildPressureTopologySignature('close_combat', 'A', actor, actor);

    expect(runtime.getAIDecision).toHaveBeenCalledWith(actor);
    expect(runtime.getAlternativeDecision).toHaveBeenCalledWith(actor, { type: 'hold' });
    expect(runtime.getAggressiveFallbackDecision).toHaveBeenCalledWith(actor, 2, undefined);
    expect(runtime.buildPressureTopologySignature).toHaveBeenCalledWith(
      'close_combat',
      'A',
      actor,
      actor
    );
  });

  it('creates run-game lifecycle deps that delegate to endgame helpers', () => {
    mockShouldEndGameForGameLoop.mockReturnValue(true);
    mockGetGameEndReasonForGameLoop.mockReturnValue('All enemies KOd');

    const manager = { characters: [{ id: 'c1' }] } as any;
    const findCharacterSide = vi.fn(() => 'A');
    const deps = createRunGameLifecycleDepsForAIGameLoop({
      maxTurns: 4,
      manager,
      sideIds: ['A', 'B'],
      resetReplanAttempts: vi.fn(),
      runTurn: vi.fn(() => ({
        totalActions: 1,
        successfulActions: 1,
        failedActions: 0,
        replannedActions: 0,
      })),
      onTurnEnd: vi.fn(),
      findCharacterSide,
    });

    expect(deps.shouldEndGame(2)).toBe(true);
    expect(deps.getEndReason()).toBe('All enemies KOd');
    expect(mockShouldEndGameForGameLoop).toHaveBeenCalledWith(
      2,
      ['A', 'B'],
      manager.characters,
      expect.any(Function)
    );
    expect(mockGetGameEndReasonForGameLoop).toHaveBeenCalledWith(
      manager.characters,
      expect.any(Function)
    );
  });

  it('creates squad-IP activation callback that delegates to support helper', () => {
    const expected = {
      success: true,
      totalActions: 2,
      successfulActions: 2,
      failedActions: 0,
    };
    mockConsiderSquadIPActivationForGameLoop.mockReturnValue(expected);

    const runCharacterTurn = vi.fn(() => ({
      totalActions: 1,
      successfulActions: 1,
      failedActions: 0,
      replannedActions: 0,
    }));
    const callback = createConsiderSquadIPActivationForAIGameLoop({
      sides: [{ id: 'A' }] as any,
      battlefield: { width: 24, height: 24 } as any,
      manager: { characters: [] } as any,
      logger: null,
      runCharacterTurn,
    });

    const actor = { id: 'actor-1' } as unknown as Character;
    const result = callback(actor, 3);
    expect(result).toEqual(expected);
    expect(mockConsiderSquadIPActivationForGameLoop).toHaveBeenCalledWith(
      actor,
      3,
      expect.objectContaining({
        sides: [{ id: 'A' }],
        runCharacterTurn: expect.any(Function),
      })
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { runAIDecisionCycle } from './AIDecisionCycle';
import type { AIContext, AIResult, CharacterKnowledge } from '../core/AIController';

function createContext(): AIContext {
  return {
    character: { id: 'actor-1' } as any,
    allies: [],
    enemies: [],
    battlefield: {} as any,
    currentTurn: 1,
    currentRound: 1,
    apRemaining: 2,
    config: {
      aggression: 0.5,
      caution: 0.5,
      accuracyModifier: 0,
      godMode: true,
    },
  };
}

function createKnowledge(turn: number): CharacterKnowledge {
  return {
    knownEnemies: new Map(),
    knownTerrain: new Map(),
    lastKnownPositions: new Map(),
    threatZones: [],
    safeZones: [],
    lastUpdated: turn,
  };
}

describe('runAIDecisionCycle', () => {
  it('runs updateKnowledge before decideAction and assigns context knowledge', () => {
    const context = createContext();
    const events: string[] = [];
    const knowledge = createKnowledge(1);
    const result: AIResult = { decision: { type: 'hold', priority: 0, requiresAP: false, reason: 'test' } };

    const output = runAIDecisionCycle(context, {
      updateKnowledge: () => {
        events.push('update');
        return knowledge;
      },
      decideAction: () => {
        events.push('decide');
        return result;
      },
    });

    expect(events).toEqual(['update', 'decide']);
    expect(output).toBe(result);
    expect(context.knowledge).toBe(knowledge);
  });

  it('skips knowledge assignment when assignKnowledgeToContext is false', () => {
    const context = createContext();
    const knowledge = createKnowledge(3);
    const output = runAIDecisionCycle(context, {
      updateKnowledge: () => knowledge,
      decideAction: () => ({ decision: { type: 'hold', priority: 0, requiresAP: false, reason: 'test' } }),
      assignKnowledgeToContext: false,
    });

    expect(output.decision.type).toBe('hold');
    expect(context.knowledge).toBeUndefined();
  });

  it('works without updateKnowledge callback', () => {
    const context = createContext();
    const decideAction = vi.fn(() => ({ decision: { type: 'hold', priority: 0, requiresAP: false } as any }));
    const output = runAIDecisionCycle(context, { decideAction });
    expect(decideAction).toHaveBeenCalledTimes(1);
    expect(output.decision.type).toBe('hold');
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildCoordinatorDecisionFromTrace,
  normalizeDecisionTrace,
  normalizeDecisionTraceEntry,
  normalizePressureContinuityDiagnostics,
  normalizeSideStrategy,
  selectCurrentTurnTrace,
} from './CoordinatorTraceSerialization';

describe('CoordinatorTraceSerialization', () => {
  it('normalizes pressure continuity diagnostics buckets', () => {
    const diagnostics = normalizePressureContinuityDiagnostics({
      scrum: { updates: 2, breakRate: 0.25 },
      lane: { updates: 1, matchRate: 0.5 },
      combined: { updates: 3, signatureSamples: 4 },
    })!;

    expect(diagnostics.scrum.updates).toBe(2);
    expect(diagnostics.scrum.breakRate).toBe(0.25);
    expect(diagnostics.lane.matchRate).toBe(0.5);
    expect(diagnostics.combined.signatureSamples).toBe(4);
  });

  it('normalizes decision trace entries and current turn selection', () => {
    const trace = normalizeDecisionTrace([
      { turn: 1, observations: { amILeading: true } },
      { turn: 2, observations: { amILeading: false }, response: { priority: 'contest' } },
      { turn: 2, observations: { amILeading: true }, response: { priority: 'stabilize' } },
    ], {
      sideId: 'alpha',
      doctrine: 'operative',
    })!;

    expect(trace.length).toBe(3);
    expect(trace[0].sideId).toBe('alpha');
    const currentTurn = selectCurrentTurnTrace(trace, 2)!;
    expect(currentTurn.response.priority).toBe('stabilize');
  });

  it('normalizes full side strategy and builds coordinator decision', () => {
    const strategy = normalizeSideStrategy('alpha', {
      doctrine: 'aggressive',
      advice: ['push'],
      context: { amILeading: true, vpMargin: 1.2, winningKeys: ['elimination'], losingKeys: [] },
      decisionTrace: [
        normalizeDecisionTraceEntry({
          turn: 3,
          observations: {
            topOpponentKeyPressure: [{ key: 'elimination', predicted: 0.4, confidence: 0.8 }],
          },
        }, { sideId: 'alpha', doctrine: 'aggressive', turn: 3 }),
      ],
    });

    expect(strategy.doctrine).toBe('aggressive');
    expect(strategy.context?.winningKeys).toEqual(['elimination']);
    expect(strategy.decisionTrace?.[0].observations.topOpponentKeyPressure[0].key).toBe('elimination');

    const decision = buildCoordinatorDecisionFromTrace(
      'alpha',
      strategy.doctrine,
      strategy.decisionTrace![0]
    );
    expect(decision.sideId).toBe('alpha');
    expect(decision.trace.turn).toBe(3);
  });
});

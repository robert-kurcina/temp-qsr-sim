import { describe, expect, it, vi } from 'vitest';
import {
  buildAIScoringContext,
  buildCoordinatorContextSlice,
  type CoordinatorLike,
  type CoordinatorScoringContextLike,
} from './CoordinatorContext';

function createScoringContext(): CoordinatorScoringContextLike {
  return {
    myScores: { keyA: { current: 0.2, predicted: 0.6, confidence: 0.8, leadMargin: 0.1 } },
    opponentScores: { keyA: { current: 0.1, predicted: 0.4, confidence: 0.7, leadMargin: -0.1 } },
    amILeading: true,
    vpMargin: 1,
    winningKeys: ['keyA'],
    losingKeys: [],
    vpDeficitPercent: 0,
    remainingVP: 2,
    currentTurn: 3,
    maxTurns: 6,
    endGameTurn: 3,
    fractionalPotentialLedger: {
      myTotalPotential: 1.2,
      opponentTotalPotential: 0.7,
      myDeniedPotential: 0.2,
      opponentDeniedPotential: 0.1,
      potentialDelta: 0.6,
      keyProgress: {},
      lastUpdatedTurn: 3,
    },
  };
}

describe('CoordinatorContext helpers', () => {
  it('builds scoring context with optional key normalization', () => {
    const normalize = vi.fn((scores: unknown) => scores as any);
    const scoring = buildAIScoringContext(createScoringContext(), { normalizeKeyScores: normalize });
    expect(scoring).toBeDefined();
    expect(normalize).toHaveBeenCalledTimes(2);
    expect(scoring?.amILeading).toBe(true);
    expect(scoring?.myKeyScores).toHaveProperty('keyA');
  });

  it('includes fractional potential ledger only when enabled', () => {
    const base = createScoringContext();
    const withoutLedger = buildAIScoringContext(base, { includeFractionalPotentialLedger: false });
    const withLedger = buildAIScoringContext(base, { includeFractionalPotentialLedger: true });
    expect(withoutLedger?.fractionalPotentialLedger).toBeUndefined();
    expect(withLedger?.fractionalPotentialLedger?.myTotalPotential).toBeCloseTo(1.2, 5);
  });

  it('builds coordinator context slice with non-empty maps', () => {
    const coordinator: CoordinatorLike = {
      getScoringContext: () => createScoringContext(),
      getTargetCommitments: () => ({ enemyA: 1.5 }),
      getScrumContinuity: () => ({}),
      getLanePressure: () => ({ enemyA: 0.75 }),
    };

    const slice = buildCoordinatorContextSlice({
      coordinator,
      currentTurn: 2,
      includeFractionalPotentialLedger: true,
    });

    expect(slice.scoringContext?.predictorCurrentTurn).toBe(3);
    expect(slice.scoringContext?.predictorEndGameTurn).toBe(3);
    expect(slice.targetCommitments).toEqual({ enemyA: 1.5 });
    expect(slice.scrumContinuity).toBeUndefined();
    expect(slice.lanePressure).toEqual({ enemyA: 0.75 });
    expect(slice.scoringContext?.fractionalPotentialLedger?.lastUpdatedTurn).toBe(3);
  });

  it('maps initiative signal directives into scoring context snapshot', () => {
    const coordinator: CoordinatorLike = {
      getScoringContext: () => createScoringContext(),
      getTargetCommitments: () => ({}),
      getScrumContinuity: () => ({}),
      getLanePressure: () => ({}),
      getInitiativeSignalForTurn: () => ({
        priority: 'recover_deficit',
        potentialDirective: 'expand_potential',
        pressureDirective: 'mixed_pressure',
        urgency: 1.25,
      }),
    };

    const slice = buildCoordinatorContextSlice({
      coordinator,
      currentTurn: 4,
      includeFractionalPotentialLedger: false,
    });

    expect(slice.scoringContext?.coordinatorPriority).toBe('recover_deficit');
    expect(slice.scoringContext?.coordinatorPotentialDirective).toBe('expand_potential');
    expect(slice.scoringContext?.coordinatorPressureDirective).toBe('mixed_pressure');
    expect(slice.scoringContext?.coordinatorUrgency).toBeCloseTo(1.25, 5);
  });

  it('returns empty slice when coordinator is missing', () => {
    expect(buildCoordinatorContextSlice({ coordinator: null })).toEqual({});
  });
});

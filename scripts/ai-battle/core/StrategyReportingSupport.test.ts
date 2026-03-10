import { describe, expect, it } from 'vitest';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import {
  buildPredictedScoringForRunner,
  buildSideStrategiesForRunner,
  buildTurnCoordinatorDecisionsForRunner,
  normalizeKeyScoresForRunner,
} from './StrategyReportingSupport';

describe('StrategyReportingSupport', () => {
  it('normalizes key score maps and drops undefined entries', () => {
    const normalized = normalizeKeyScoresForRunner({
      elim: { current: 1, predicted: 2, confidence: 0.8, leadMargin: 0.5 },
      bottled: undefined,
    });
    expect(Object.keys(normalized)).toEqual(['elim']);
    expect(normalized.elim.predicted).toBe(2);
  });

  it('returns undefined predicted scoring when no side has scoring data', () => {
    const sides: MissionSide[] = [
      {
        id: 'Alpha',
        state: { predictedVp: 0, predictedRp: 0, keyScores: {} },
      } as unknown as MissionSide,
    ];
    expect(buildPredictedScoringForRunner(sides)).toBeUndefined();
  });

  it('builds fallback side strategies and skips missing turn traces', () => {
    const sideStrategies = buildSideStrategiesForRunner({
      managerStrategies: {},
      missionSides: [
        {
          id: 'Alpha',
          members: [{ character: { id: 'a1' } }],
        } as unknown as MissionSide,
      ],
      doctrineByCharacterId: new Map([['a1', TacticalDoctrine.Aggressive]]),
    });
    expect(sideStrategies?.Alpha?.doctrine).toBe(String(TacticalDoctrine.Aggressive));

    const turnDecisions = buildTurnCoordinatorDecisionsForRunner({
      managerStrategies: {
        Alpha: {
          doctrine: 'aggressive',
          advice: [],
          decisionTrace: [],
        },
      },
      currentTurn: 2,
    });
    expect(turnDecisions).toBeUndefined();
  });
});

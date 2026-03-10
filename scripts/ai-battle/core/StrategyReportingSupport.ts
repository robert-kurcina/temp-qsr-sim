import type { MissionSide } from '../../../src/lib/mest-tactics/mission/MissionSide';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { BattleReport, TurnAudit } from '../../shared/BattleReportTypes';
import {
  buildCoordinatorDecisionFromTrace,
  normalizeSideStrategy,
  selectCurrentTurnTrace,
} from './CoordinatorTraceSerialization';

type KeyScoreValue = {
  current: number;
  predicted: number;
  confidence: number;
  leadMargin: number;
};

export function normalizeKeyScoresForRunner(
  scores: Record<string, KeyScoreValue | undefined> | undefined
): Record<string, KeyScoreValue> {
  const normalized: Record<string, KeyScoreValue> = {};
  for (const [key, value] of Object.entries(scores ?? {})) {
    if (!value) continue;
    normalized[key] = {
      current: value.current,
      predicted: value.predicted,
      confidence: value.confidence,
      leadMargin: value.leadMargin,
    };
  }
  return normalized;
}

export function buildPredictedScoringForRunner(
  sides: MissionSide[]
): NonNullable<NonNullable<BattleReport['missionRuntime']>['predictedScoring']> | undefined {
  const bySide: NonNullable<NonNullable<BattleReport['missionRuntime']>['predictedScoring']>['bySide'] = {};

  for (const side of sides) {
    bySide[side.id] = {
      predictedVp: side.state.predictedVp,
      predictedRp: side.state.predictedRp,
      keyScores: {},
    };

    for (const [key, score] of Object.entries(side.state.keyScores)) {
      if (!score) continue;
      bySide[side.id].keyScores[key] = {
        current: score.current,
        predicted: score.predicted,
        confidence: score.confidence,
        leadMargin: score.leadMargin,
      };
    }
  }

  const hasData = Object.values(bySide).some(
    side =>
      side.predictedVp > 0 ||
      side.predictedRp > 0 ||
      Object.keys(side.keyScores).length > 0
  );
  return hasData ? { bySide } : undefined;
}

export function buildSideStrategiesForRunner(params: {
  managerStrategies?: Record<string, unknown>;
  missionSides: MissionSide[];
  doctrineByCharacterId: Map<string, TacticalDoctrine>;
}): BattleReport['sideStrategies'] {
  const strategies: NonNullable<BattleReport['sideStrategies']> = {};
  const managerStrategies = params.managerStrategies;

  if (managerStrategies && Object.keys(managerStrategies).length > 0) {
    for (const [sideId, strategy] of Object.entries(managerStrategies)) {
      if (!strategy) continue;
      strategies[sideId] = normalizeSideStrategy(sideId, strategy as any);
    }
  }
  if (Object.keys(strategies).length > 0) {
    return strategies;
  }

  for (const side of params.missionSides) {
    const doctrine =
      params.doctrineByCharacterId.get(side.members[0]?.character.id ?? '') ??
      TacticalDoctrine.Operative;
    strategies[side.id] = {
      doctrine: String(doctrine),
      advice: [],
    };
  }

  return Object.keys(strategies).length > 0 ? strategies : undefined;
}

export function buildTurnCoordinatorDecisionsForRunner(params: {
  managerStrategies?: Record<string, unknown>;
  currentTurn: number;
}): TurnAudit['coordinatorDecisions'] {
  const managerStrategies = params.managerStrategies;
  if (!managerStrategies || Object.keys(managerStrategies).length === 0) {
    return undefined;
  }

  const decisions: NonNullable<TurnAudit['coordinatorDecisions']> = [];
  for (const [sideId, strategy] of Object.entries(managerStrategies)) {
    if (!strategy) continue;
    const normalized = normalizeSideStrategy(sideId, strategy as any);
    const currentTurnTrace = selectCurrentTurnTrace(
      normalized.decisionTrace,
      params.currentTurn
    );
    if (!currentTurnTrace) continue;
    decisions.push(
      buildCoordinatorDecisionFromTrace(
        sideId,
        normalized.doctrine,
        currentTurnTrace
      )
    );
  }

  return decisions.length > 0 ? decisions : undefined;
}

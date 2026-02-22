import { MissionSide } from './MissionSide';
import {
  AggressionState,
  GameSize,
  MissionScoreResult,
  buildMissionSideStatus,
  computeMissionScores,
  determineGameSize,
  markBottledOut,
  resolveEndGameState,
} from './mission-scoring';
import { BottleTestResult } from './bottle-tests';
import { MissionScoreDelta } from './mission-keys';

export interface MissionFlowState {
  gameSize: GameSize;
  turn: number;
  endDice: number;
  aggression?: AggressionState;
  bottledOutSideIds: string[];
  eliminationBpBySide?: Record<string, number>;
  extraRpBySide?: Record<string, number>;
  extraVpBySide?: Record<string, number>;
  keyVpBySide?: Record<string, number>;
  firstBloodSideId?: string;
}

export interface MissionFlowOptions {
  gameSize?: GameSize;
  turn?: number;
  endDice?: number;
  aggression?: AggressionState;
  eliminationBpBySide?: Record<string, number>;
  extraRpBySide?: Record<string, number>;
  extraVpBySide?: Record<string, number>;
  keyVpBySide?: Record<string, number>;
  firstBloodSideId?: string;
}

export interface EndGameAdvanceResult {
  state: MissionFlowState;
  ended: boolean;
  addedEndDie: boolean;
  reason?: 'end-die';
}

export function initMissionFlow(
  sides: MissionSide[],
  options: MissionFlowOptions = {}
): MissionFlowState {
  const maxBp = Math.max(...sides.map(side => side.totalBP || 0), 0);
  const maxModels = Math.max(...sides.map(side => side.members.length || 0), 0);
  const gameSize = options.gameSize ?? determineGameSize(maxBp, maxModels);
  return {
    gameSize,
    turn: options.turn ?? 1,
    endDice: options.endDice ?? 0,
    aggression: options.aggression,
    bottledOutSideIds: [],
    eliminationBpBySide: options.eliminationBpBySide,
    extraRpBySide: options.extraRpBySide,
    extraVpBySide: options.extraVpBySide,
    keyVpBySide: options.keyVpBySide ?? {},
    firstBloodSideId: options.firstBloodSideId,
  };
}

export function recordBottleResults(
  state: MissionFlowState,
  results: Record<string, BottleTestResult>
): MissionFlowState {
  const bottledOutSideIds = new Set(state.bottledOutSideIds);
  for (const [sideId, result] of Object.entries(results)) {
    if (result.bottledOut) {
      bottledOutSideIds.add(sideId);
    }
  }
  return { ...state, bottledOutSideIds: Array.from(bottledOutSideIds) };
}

export function advanceEndGameState(
  state: MissionFlowState,
  rollResults?: number[]
): EndGameAdvanceResult {
  const result = resolveEndGameState({
    gameSize: state.gameSize,
    turn: state.turn,
    endDice: state.endDice,
    rollResults,
  });
  const nextState = {
    ...state,
    endDice: result.endDice,
  };
  return {
    state: nextState,
    ended: result.ended,
    addedEndDie: result.addedEndDie,
    reason: result.reason,
  };
}

export function computeMissionOutcome(
  sides: MissionSide[],
  state: MissionFlowState
): MissionScoreResult {
  const statuses = sides.map(side => {
    const base = buildMissionSideStatus(side);
    if (state.bottledOutSideIds.includes(side.id)) {
      return markBottledOut(base);
    }
    return base;
  });

  const keyVpBySide: Record<string, number> = { ...(state.keyVpBySide ?? {}) };
  if (state.firstBloodSideId) {
    keyVpBySide[state.firstBloodSideId] = (keyVpBySide[state.firstBloodSideId] || 0) + 1;
  }
  const combinedExtraVpBySide: Record<string, number> = {
    ...(state.extraVpBySide ?? {}),
  };
  for (const [sideId, value] of Object.entries(keyVpBySide)) {
    combinedExtraVpBySide[sideId] = (combinedExtraVpBySide[sideId] || 0) + value;
  }

  return computeMissionScores({
    sides: statuses,
    aggression: state.aggression,
    bottledOutSideIds: state.bottledOutSideIds,
    eliminationBpBySide: state.eliminationBpBySide,
    extraRpBySide: state.extraRpBySide,
    extraVpBySide: combinedExtraVpBySide,
  });
}

export function addKeyVp(
  state: MissionFlowState,
  sideId: string,
  amount = 1
): MissionFlowState {
  const keyVpBySide = { ...(state.keyVpBySide ?? {}) };
  keyVpBySide[sideId] = (keyVpBySide[sideId] || 0) + amount;
  return { ...state, keyVpBySide };
}

export function recordFirstBlood(
  state: MissionFlowState,
  sideId: string
): MissionFlowState {
  if (state.firstBloodSideId) return state;
  return { ...state, firstBloodSideId: sideId };
}

export function mergeMissionDelta(
  state: MissionFlowState,
  delta: MissionScoreDelta
): MissionFlowState {
  const extraVpBySide = { ...(state.extraVpBySide ?? {}) };
  const extraRpBySide = { ...(state.extraRpBySide ?? {}) };
  for (const [sideId, vp] of Object.entries(delta.vpBySide ?? {})) {
    extraVpBySide[sideId] = (extraVpBySide[sideId] || 0) + vp;
  }
  for (const [sideId, rp] of Object.entries(delta.rpBySide ?? {})) {
    extraRpBySide[sideId] = (extraRpBySide[sideId] || 0) + rp;
  }
  return { ...state, extraVpBySide, extraRpBySide };
}

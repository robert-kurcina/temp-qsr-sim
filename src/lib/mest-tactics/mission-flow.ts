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

export interface MissionFlowState {
  gameSize: GameSize;
  turn: number;
  endDice: number;
  aggression?: AggressionState;
  bottledOutSideIds: string[];
  eliminationBpBySide?: Record<string, number>;
  extraRpBySide?: Record<string, number>;
  extraVpBySide?: Record<string, number>;
}

export interface MissionFlowOptions {
  gameSize?: GameSize;
  turn?: number;
  endDice?: number;
  aggression?: AggressionState;
  eliminationBpBySide?: Record<string, number>;
  extraRpBySide?: Record<string, number>;
  extraVpBySide?: Record<string, number>;
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

  return computeMissionScores({
    sides: statuses,
    aggression: state.aggression,
    bottledOutSideIds: state.bottledOutSideIds,
    eliminationBpBySide: state.eliminationBpBySide,
    extraRpBySide: state.extraRpBySide,
    extraVpBySide: state.extraVpBySide,
  });
}

import { Character } from '../core/Character';
import { MissionSide } from '../mission/MissionSide';
import { getEndGameTriggerTurn } from '../engine/end-game-trigger';
import {
  determineCanonicalGameSize,
  type CanonicalGameSize
} from '../mission/game-size-canonical';

export type GameSize = CanonicalGameSize;

export interface MissionSideStatus {
  sideId: string;
  startingCount: number;
  inPlayCount: number;
  orderedCount: number;
  koCount: number;
  eliminatedCount: number;
  koBp: number;
  eliminatedBp: number;
  totalBp: number;
  bottledOut: boolean;
}

export interface AggressionState {
  crossedBySide: Record<string, number>;
  firstCrossedSideId?: string;
}

export interface EncroachmentState {
  firstCrossedSideId?: string;
  // Backward compatibility properties
  crossedBySide?: string;
}

export interface MissionScoreInput {
  sides: MissionSideStatus[];
  aggression?: AggressionState;
  bottledOutSideIds?: string[];
  eliminationBpBySide?: Record<string, number>;
  extraRpBySide?: Record<string, number>;
  extraVpBySide?: Record<string, number>;
}

export interface MissionScoreBreakdown {
  aggressionVp: number;
  bottledVp: number;
  eliminationVp: number;
  outnumberedVp: number;
  resourceVp: number;
  extraVp: number;
  rp: number;
  // Backward compatibility: mission-specific VP types
  assaultVP?: number;
  markerVP?: number;
  firstControlVP?: number;
  dominanceVP?: number;
  sanctuaryVP?: number;
  courierVP?: number;
  collectionVP?: number;
  poiVP?: number;
  [key: string]: number | undefined;
}

export interface MissionScoreResult {
  vpBySide: Record<string, number>;
  rpBySide: Record<string, number>;
  breakdownBySide: Record<string, MissionScoreBreakdown>;
  winnerSideId?: string;
  tie: boolean;
  tieSideIds: string[];
  winnerReason: 'vp' | 'rp' | 'initiative-card' | 'mission-immediate' | 'tie';
  tieBreakMethod: 'none' | 'rp' | 'initiative-card';
  suddenDeathApplied?: boolean;
  // Backward compatibility properties
  keysToVictory?: Record<string, number>;
}

export interface EndGameStateInput {
  gameSize: GameSize;
  turn: number;
  endDice: number;
  rollResults?: number[];
}

export interface EndGameStateResult {
  ended: boolean;
  endDice: number;
  addedEndDie: boolean;
  reason?: 'end-die';
}

export function buildMissionSideStatus(side: MissionSide): MissionSideStatus {
  const startingCount = side.members.length;
  let inPlayCount = 0;
  let orderedCount = 0;
  let koCount = 0;
  let eliminatedCount = 0;
  let koBp = 0;
  let eliminatedBp = 0;

  for (const member of side.members) {
    const character = member.character;
    const bp = member.profile?.totalBp ?? 0;
    if (character.state.isEliminated) {
      eliminatedCount += 1;
      eliminatedBp += bp;
      continue;
    }
    if (character.state.isKOd) {
      koCount += 1;
      koBp += bp;
      continue;
    }
    inPlayCount += 1;
    if (character.state.isOrdered) {
      orderedCount += 1;
    }
  }

  const bottledOut = orderedCount === 0;

  return {
    sideId: side.id,
    startingCount,
    inPlayCount,
    orderedCount,
    koCount,
    eliminatedCount,
    koBp,
    eliminatedBp,
    totalBp: side.totalBP,
    bottledOut,
  };
}

export function determineGameSize(bpPerSide: number, modelsPerSide: number): GameSize {
  return determineCanonicalGameSize(bpPerSide, modelsPerSide);
}

export function resolveEndGameState(input: EndGameStateInput): EndGameStateResult {
  const endDice = input.endDice ?? 0;
  const rollResults = input.rollResults ?? [];
  // QSR-correct: Use game-size-aware trigger turn
  const thresholdTurn = getEndGameTriggerTurn(input.gameSize as any);

  let ended = false;
  if (endDice > 0 && rollResults.length > 0) {
    ended = rollResults.some(value => value >= 1 && value <= 3);
  }

  if (ended) {
    return { ended: true, endDice, addedEndDie: false, reason: 'end-die' };
  }

  const shouldAdd = input.turn >= thresholdTurn;
  return {
    ended: false,
    endDice: endDice + (shouldAdd ? 1 : 0),
    addedEndDie: shouldAdd,
  };
}

export function computeAggressionScores(
  sides: MissionSideStatus[],
  aggression?: AggressionState
): { vpBySide: Record<string, number>; rpBySide: Record<string, number> } {
  const vpBySide: Record<string, number> = {};
  const rpBySide: Record<string, number> = {};
  if (!aggression) return { vpBySide, rpBySide };

  for (const side of sides) {
    const crossed = aggression.crossedBySide[side.sideId] ?? 0;
    const threshold = Math.ceil(side.startingCount / 2);
    if (crossed >= threshold) {
      vpBySide[side.sideId] = (vpBySide[side.sideId] || 0) + 1;
    }
  }

  if (aggression.firstCrossedSideId) {
    rpBySide[aggression.firstCrossedSideId] = (rpBySide[aggression.firstCrossedSideId] || 0) + 1;
  }

  return { vpBySide, rpBySide };
}

export function computeEncroachmentScore(
  encroachment?: EncroachmentState
): { vpBySide: Record<string, number>; rpBySide: Record<string, number> } {
  const vpBySide: Record<string, number> = {};
  const rpBySide: Record<string, number> = {};
  if (!encroachment?.firstCrossedSideId) return { vpBySide, rpBySide };

  // Encroachment: +1 VP to first side to cross midline
  vpBySide[encroachment.firstCrossedSideId] = 1;

  return { vpBySide, rpBySide };
}

export function computeBottledScores(
  sides: MissionSideStatus[],
  bottledOutSideIds?: string[]
): { vpBySide: Record<string, number>; rpBySide: Record<string, number> } {
  const vpBySide: Record<string, number> = {};
  const rpBySide: Record<string, number> = {};
  const bottledSet = new Set(bottledOutSideIds ?? []);

  for (const side of sides) {
    if (side.bottledOut) bottledSet.add(side.sideId);
  }

  for (const bottledId of bottledSet) {
    const opposingSides = sides.filter(side => side.sideId !== bottledId && side.inPlayCount > 0);
    if (opposingSides.length >= 2) {
      for (const side of opposingSides) {
        rpBySide[side.sideId] = (rpBySide[side.sideId] || 0) + 3;
      }
    } else {
      for (const side of opposingSides) {
        vpBySide[side.sideId] = (vpBySide[side.sideId] || 0) + 1;
      }
    }
  }

  return { vpBySide, rpBySide };
}

export function computeEliminationScores(
  sides: MissionSideStatus[],
  eliminationBpBySide?: Record<string, number>
): Record<string, number> {
  const eliminationTotals: Record<string, number> = {};
  if (eliminationBpBySide) {
    Object.assign(eliminationTotals, eliminationBpBySide);
  } else {
    for (const side of sides) {
      let total = 0;
      for (const opponent of sides) {
        if (opponent.sideId === side.sideId) continue;
        if (opponent.bottledOut) continue;
        total += opponent.koBp + opponent.eliminatedBp;
      }
      eliminationTotals[side.sideId] = total;
    }
  }

  let best: { sideId: string; total: number } | null = null;
  let tie = false;
  for (const [sideId, total] of Object.entries(eliminationTotals)) {
    if (!best || total > best.total) {
      best = { sideId, total };
      tie = false;
    } else if (best && total === best.total) {
      tie = true;
    }
  }

  if (!best || best.total <= 0 || tie) return {};
  return { [best.sideId]: 1 };
}

export function computeOutnumberedScores(sides: MissionSideStatus[]): Record<string, number> {
  const activeSides = sides.filter(side => side.inPlayCount > 0);
  if (activeSides.length !== 2) return {};

  const [a, b] = activeSides;
  if (a.startingCount === 0 || b.startingCount === 0) return {};
  const larger = a.startingCount >= b.startingCount ? a : b;
  const smaller = larger.sideId === a.sideId ? b : a;

  const ratio = larger.startingCount / Math.max(1, smaller.startingCount);
  if (ratio >= 2) {
    return { [smaller.sideId]: 2 };
  }
  if (ratio >= 1.5) {
    return { [smaller.sideId]: 1 };
  }
  return {};
}

export function computeResourcePointsVictory(rpBySide: Record<string, number>): Record<string, number> {
  const entries = Object.entries(rpBySide).sort((a, b) => b[1] - a[1]);
  if (entries.length < 2) {
    if (entries.length === 1 && entries[0][1] > 0) {
      return { [entries[0][0]]: 1 };
    }
    return {};
  }
  const [topSide, topValue] = entries[0];
  const secondValue = entries[1][1];
  if (topValue === secondValue) return {};
  if (topValue >= secondValue * 2 && topValue - secondValue >= 10) {
    return { [topSide]: 2 };
  }
  return { [topSide]: 1 };
}

export function resolveMissionWinner(
  vpBySide: Record<string, number>,
  rpBySide: Record<string, number>
): Pick<MissionScoreResult, 'winnerSideId' | 'tie' | 'tieSideIds' | 'winnerReason' | 'tieBreakMethod'> {
  const entries = Object.entries(vpBySide);
  if (entries.length === 0) {
    return {
      winnerSideId: undefined,
      tie: true,
      tieSideIds: [],
      winnerReason: 'tie',
      tieBreakMethod: 'none',
    };
  }

  const topVp = Math.max(...entries.map(([, vp]) => vp));
  const topVpSides = entries
    .filter(([, vp]) => vp === topVp)
    .map(([sideId]) => sideId);

  if (topVpSides.length === 1) {
    return {
      winnerSideId: topVpSides[0],
      tie: false,
      tieSideIds: [],
      winnerReason: 'vp',
      tieBreakMethod: 'none',
    };
  }

  const topRp = Math.max(...topVpSides.map(sideId => rpBySide[sideId] ?? 0));
  const topRpSides = topVpSides.filter(sideId => (rpBySide[sideId] ?? 0) === topRp);
  if (topRpSides.length === 1) {
    return {
      winnerSideId: topRpSides[0],
      tie: false,
      tieSideIds: [],
      winnerReason: 'rp',
      tieBreakMethod: 'rp',
    };
  }

  return {
    winnerSideId: undefined,
    tie: true,
    tieSideIds: topRpSides,
    winnerReason: 'tie',
    tieBreakMethod: 'none',
  };
}

export function computeMissionScores(input: MissionScoreInput): MissionScoreResult {
  const sides = input.sides;
  const vpBySide: Record<string, number> = {};
  const rpBySide: Record<string, number> = {};
  const breakdownBySide: Record<string, MissionScoreBreakdown> = {};

  const aggression = computeAggressionScores(sides, input.aggression);
  const bottled = computeBottledScores(sides, input.bottledOutSideIds);
  const elimination = computeEliminationScores(sides, input.eliminationBpBySide);
  const outnumbered = computeOutnumberedScores(sides);

  for (const side of sides) {
    breakdownBySide[side.sideId] = {
      aggressionVp: aggression.vpBySide[side.sideId] || 0,
      bottledVp: bottled.vpBySide[side.sideId] || 0,
      eliminationVp: elimination[side.sideId] || 0,
      outnumberedVp: outnumbered[side.sideId] || 0,
      resourceVp: 0,
      extraVp: input.extraVpBySide?.[side.sideId] || 0,
      rp: 0,
    };
    rpBySide[side.sideId] = (rpBySide[side.sideId] || 0)
      + (aggression.rpBySide[side.sideId] || 0)
      + (bottled.rpBySide[side.sideId] || 0)
      + (input.extraRpBySide?.[side.sideId] || 0);
    breakdownBySide[side.sideId].rp = rpBySide[side.sideId];
  }

  const resourceVp = computeResourcePointsVictory(rpBySide);

  for (const side of sides) {
    const breakdown = breakdownBySide[side.sideId];
    breakdown.resourceVp = resourceVp[side.sideId] || 0;
    vpBySide[side.sideId] =
      breakdown.aggressionVp +
      breakdown.bottledVp +
      breakdown.eliminationVp +
      breakdown.outnumberedVp +
      breakdown.resourceVp +
      breakdown.extraVp;
  }

  const winner = resolveMissionWinner(vpBySide, rpBySide);
  return {
    vpBySide,
    rpBySide,
    breakdownBySide,
    winnerSideId: winner.winnerSideId,
    tie: winner.tie,
    tieSideIds: winner.tieSideIds,
    winnerReason: winner.winnerReason,
    tieBreakMethod: winner.tieBreakMethod,
    suddenDeathApplied: false,
  };
}

export function markBottledOut(side: MissionSideStatus): MissionSideStatus {
  return { ...side, bottledOut: true };
}

export function markBottledOutForNoOrdered(side: MissionSideStatus): MissionSideStatus {
  if (side.orderedCount > 0) return side;
  return { ...side, bottledOut: true };
}

export function collectCharacters(side: MissionSide): Character[] {
  return side.members.map(member => member.character);
}

import { Character } from '../core/Character';
import { resolveTest, TestParticipant, ResolveTestResult } from '../subroutines/dice-roller';
import { getLeaderMoraleBonus, identifyDesignatedLeader } from '../core/leader-identification';
import { MissionSide } from '../mission/MissionSide';
import { Battlefield } from '../battlefield/Battlefield';

export interface BreakpointState {
  startingCount: number;
  remainingCount: number;
  koOrEliminatedCount: number;
  isAtBreakpoint: boolean;
  isAtDoubleBreakpoint: boolean;
}

export interface BottleTestOptions {
  outnumbered?: boolean;
  additionalDr?: number;
  rolls?: number[];
  leaderMoraleBonus?: number; // Bonus from designated leader's Leadership trait
}

export interface BottleTestResult {
  pass: boolean;
  bottledOut: boolean;
  drApplied: number;
  leaderBonusApplied: number;
  testResult?: ResolveTestResult;
}

export function computeBreakpointState(characters: Character[]): BreakpointState {
  const startingCount = characters.length;
  const koOrEliminatedCount = characters.filter(char => char.state.isKOd || char.state.isEliminated).length;
  const remainingCount = Math.max(0, startingCount - koOrEliminatedCount);
  const isAtBreakpoint = startingCount > 0 && koOrEliminatedCount >= startingCount / 2;
  const isAtDoubleBreakpoint = startingCount > 0 && remainingCount <= startingCount / 4;

  return {
    startingCount,
    remainingCount,
    koOrEliminatedCount,
    isAtBreakpoint,
    isAtDoubleBreakpoint,
  };
}

export function resolveBottleTest(
  orderedCharacter: Character | null,
  options: BottleTestOptions = {}
): BottleTestResult {
  if (!orderedCharacter) {
    return { pass: false, bottledOut: true, drApplied: 0, leaderBonusApplied: 0 };
  }

  const dr = Math.max(0, options.additionalDr ?? 0) + (options.outnumbered ? 1 : 0);
  const leaderBonus = options.leaderMoraleBonus ?? 0;
  
  // Leader bonus effectively increases POW for the test
  const adjustedPow = Math.max(0, orderedCharacter.finalAttributes.pow - dr + leaderBonus);

  const participant: TestParticipant = {
    attributeValue: adjustedPow,
  };
  const systemPlayer: TestParticipant = {
    attributeValue: 0,
    isSystemPlayer: true,
  };

  const result = resolveTest(participant, systemPlayer, options.rolls ?? null);
  const pass = result.pass;
  return {
    pass,
    bottledOut: !pass,
    drApplied: dr,
    leaderBonusApplied: leaderBonus,
    testResult: result,
  };
}

export function resolveBottleForSide(
  characters: Character[],
  orderedCandidate: Character | null,
  opposingCount: number,
  rolls?: number[],
  side?: MissionSide,
  battlefield?: Battlefield | null
): BottleTestResult {
  const state = computeBreakpointState(characters);
  if (!state.isAtBreakpoint) {
    return { pass: true, bottledOut: false, drApplied: 0, leaderBonusApplied: 0 };
  }

  const outnumbered = state.remainingCount > 0 && opposingCount >= state.remainingCount * 2;
  const additionalDr = state.isAtDoubleBreakpoint ? 1 : 0;
  
  // Get leader morale bonus if side and battlefield provided
  let leaderBonus = 0;
  if (side && battlefield) {
    const leader = identifyDesignatedLeader(side, 'morale', battlefield);
    leaderBonus = getLeaderMoraleBonus(leader);
  }
  
  return resolveBottleTest(orderedCandidate, {
    outnumbered,
    additionalDr,
    rolls,
    leaderMoraleBonus: leaderBonus,
  });
}

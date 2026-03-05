import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import { MissionSide } from './MissionSide';
import { Profile } from '../core/Profile';
import { initMissionFlow, advanceEndGameState, computeMissionOutcome, recordBottleResults } from '../missions/mission-flow';

function makeProfile(name: string, bp = 0): Profile {
  return {
    name,
    archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
    items: [],
    totalBp: bp,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 0,
    adjPhysicality: 0,
    durability: 0,
    adjDurability: 0,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 0,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeSide(id: string, count: number, bp = 0): MissionSide {
  const members = Array.from({ length: count }, (_, index) => {
    const profile = makeProfile(`${id}-${index}`, bp);
    const character = new Character(profile);
    character.finalAttributes = character.attributes;
    return {
      id: `${id}-${index}`,
      character,
      profile,
      assembly: { name: id, totalBP: 0, totalCharacters: 0 } as any,
      portrait: { sheet: 's', column: 0, row: 0, name: '' } as any,
    };
  });
  return {
    id,
    name: id,
    assemblies: [],
    members: members as any,
    totalBP: members.reduce((sum, member) => sum + (member.profile.totalBp ?? 0), 0),
  } as any;
}

describe('mission-flow', () => {
  it('should initialize mission flow state from sides', () => {
    // Canonical MEDIUM benchmark in mission-flow uses per-side max values.
    const state = initMissionFlow([makeSide('A', 6, 100), makeSide('B', 6, 100)]);
    expect(state.gameSize).toBe('MEDIUM');
    expect(state.turn).toBe(1);
  });

  it('should advance end-game state and add end dice', () => {
    const state = initMissionFlow([makeSide('A', 4, 300)]);
    const advanced = advanceEndGameState({ ...state, turn: 10, endDice: 0 });
    expect(advanced.addedEndDie).toBe(true);
    expect(advanced.state.endDice).toBe(1);
  });

  it('should record bottle results and include bottled scoring', () => {
    const sideA = makeSide('A', 4, 100);
    const sideB = makeSide('B', 4, 100);
    let state = initMissionFlow([sideA, sideB]);
    state = recordBottleResults(state, { B: { pass: false, bottledOut: true, remainingCount: 0 } as any });
    const outcome = computeMissionOutcome([sideA, sideB], state);
    expect(outcome.vpBySide.A).toBeGreaterThanOrEqual(1);
  });

  it('should score elimination for the default two-side mission', () => {
    const sideA = makeSide('A', 4, 100);
    const sideB = makeSide('B', 4, 100);
    const state = initMissionFlow([sideA, sideB], {
      eliminationBpBySide: { A: 10, B: 5 },
    });
    const outcome = computeMissionOutcome([sideA, sideB], state);
    expect(outcome.vpBySide.A).toBeGreaterThan(outcome.vpBySide.B ?? 0);
  });

  it('should award bottled RP in multi-side missions', () => {
    const sideA = makeSide('A', 4, 100);
    const sideB = makeSide('B', 4, 100);
    const sideC = makeSide('C', 4, 100);
    let state = initMissionFlow([sideA, sideB, sideC]);
    state = recordBottleResults(state, { C: { pass: false, bottledOut: true, remainingCount: 0 } as any });
    const outcome = computeMissionOutcome([sideA, sideB, sideC], state);
    expect(outcome.rpBySide.A).toBe(3);
    expect(outcome.rpBySide.B).toBe(3);
    expect(outcome.vpBySide.A).toBeGreaterThanOrEqual(0);
  });

  it('should handle four-side bottle scoring', () => {
    const sideA = makeSide('A', 4, 100);
    const sideB = makeSide('B', 4, 100);
    const sideC = makeSide('C', 4, 100);
    const sideD = makeSide('D', 4, 100);
    let state = initMissionFlow([sideA, sideB, sideC, sideD]);
    state = recordBottleResults(state, { D: { pass: false, bottledOut: true, remainingCount: 0 } as any });
    const outcome = computeMissionOutcome([sideA, sideB, sideC, sideD], state);
    expect(outcome.rpBySide.A).toBe(3);
    expect(outcome.rpBySide.B).toBe(3);
    expect(outcome.rpBySide.C).toBe(3);
  });
});

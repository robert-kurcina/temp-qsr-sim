import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { MissionSide } from './MissionSide';
import {
  buildMissionSideStatus,
  computeAggressionScores,
  computeBottledScores,
  computeEliminationScores,
  computeMissionScores,
  computeOutnumberedScores,
  computeResourcePointsVictory,
  determineGameSize,
  resolveEndGameState,
} from '../missions/mission-scoring';

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
    burden: { totalLaden: 0, totalBurden: 0 },
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
    return { id: `${id}-${index}`, character, profile, assembly: { name: id, totalBP: 0, totalCharacters: 0 } as any, portrait: { sheet: 's', column: 0, row: 0, name: '' } as any };
  });
  return {
    id,
    name: id,
    assemblies: [],
    members,
    totalBP: members.reduce((sum, member) => sum + (member.profile.totalBp ?? 0), 0),
  };
}

describe('mission-scoring', () => {
  it('should determine game size with model bias', () => {
    expect(determineGameSize(700, 5)).toBe('Small');
    expect(determineGameSize(700, 9)).toBe('Large');
  });

  it('should resolve end-game die additions and endings', () => {
    const state = resolveEndGameState({ gameSize: 'Small', turn: 4, endDice: 0 });
    expect(state.addedEndDie).toBe(true);
    expect(state.endDice).toBe(1);

    const ended = resolveEndGameState({ gameSize: 'Small', turn: 4, endDice: 1, rollResults: [2] });
    expect(ended.ended).toBe(true);
    expect(ended.reason).toBe('end-die');
  });

  it('should score aggression and first cross RP', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 6));
    const sideB = buildMissionSideStatus(makeSide('B', 6));
    const scores = computeAggressionScores([sideA, sideB], {
      crossedBySide: { A: 3, B: 2 },
      firstCrossedSideId: 'A',
    });
    expect(scores.vpBySide.A).toBe(1);
    expect(scores.vpBySide.B).toBeUndefined();
    expect(scores.rpBySide.A).toBe(1);
  });

  it('should award bottled VP in two-side games', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 4));
    const sideB = buildMissionSideStatus(makeSide('B', 4));
    sideB.orderedCount = 0;
    sideB.bottledOut = true;
    const scores = computeBottledScores([sideA, sideB], []);
    expect(scores.vpBySide.A).toBe(1);
  });

  it('should award bottled RP in multi-side games', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 4));
    const sideB = buildMissionSideStatus(makeSide('B', 4));
    const sideC = buildMissionSideStatus(makeSide('C', 4));
    sideC.bottledOut = true;
    const scores = computeBottledScores([sideA, sideB, sideC], []);
    expect(scores.rpBySide.A).toBe(3);
    expect(scores.rpBySide.B).toBe(3);
  });

  it('should award elimination VP to the highest total', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 4));
    const sideB = buildMissionSideStatus(makeSide('B', 4));
    const scores = computeEliminationScores([sideA, sideB], { A: 20, B: 10 });
    expect(scores.A).toBe(1);
  });

  it('should award outnumbered VP when ratio is >= 2:1', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 10));
    const sideB = buildMissionSideStatus(makeSide('B', 5));
    const scores = computeOutnumberedScores([sideA, sideB]);
    expect(scores.B).toBe(2);
  });

  it('should award resource VP based on RP advantage', () => {
    const scores = computeResourcePointsVictory({ A: 20, B: 9 });
    expect(scores.A).toBe(2);
  });

  it('should compute aggregate mission scores', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 6));
    const sideB = buildMissionSideStatus(makeSide('B', 6));
    const result = computeMissionScores({
      sides: [sideA, sideB],
      aggression: { crossedBySide: { A: 3, B: 0 }, firstCrossedSideId: 'A' },
      eliminationBpBySide: { A: 10, B: 5 },
      extraRpBySide: { A: 9 },
    });
    expect(result.vpBySide.A).toBeGreaterThan(result.vpBySide.B);
    expect(result.rpBySide.A).toBe(10);
  });
});

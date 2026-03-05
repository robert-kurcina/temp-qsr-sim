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
    return { id: `${id}-${index}`, character, profile, assembly: { name: id, totalBP: 0, totalCharacters: 0 } as any, portrait: { sheet: 's', column: 0, row: 0, name: '' } as any };
  });
  return {
    id,
    name: id,
    assemblies: [],
    members: members as any,
    totalBP: members.reduce((sum, member) => sum + (member.profile.totalBp ?? 0), 0),
  } as any;
}

describe('mission-scoring', () => {
  it('should determine game size with model bias', () => {
    expect(determineGameSize(700, 5)).toBe('SMALL');
    expect(determineGameSize(700, 9)).toBe('LARGE');
    expect(determineGameSize(1200, 15)).toBe('VERY_LARGE');
    expect(determineGameSize(1050, 9)).toBe('LARGE');
  });

  it('should resolve end-game die additions and endings', () => {
    // VERY_SMALL: trigger turn is 3
    const beforeTrigger = resolveEndGameState({ gameSize: 'VERY_SMALL', turn: 2, endDice: 0 });
    expect(beforeTrigger.addedEndDie).toBe(false);
    expect(beforeTrigger.endDice).toBe(0);

    const atTrigger = resolveEndGameState({ gameSize: 'VERY_SMALL', turn: 3, endDice: 0 });
    expect(atTrigger.addedEndDie).toBe(true);
    expect(atTrigger.endDice).toBe(1);

    const afterTrigger = resolveEndGameState({ gameSize: 'VERY_SMALL', turn: 4, endDice: 1 });
    expect(afterTrigger.addedEndDie).toBe(true);
    expect(afterTrigger.endDice).toBe(2);

    // Test end-game die ending on roll 1-3
    const ended = resolveEndGameState({ gameSize: 'VERY_SMALL', turn: 10, endDice: 1, rollResults: [2] });
    expect(ended.ended).toBe(true);
    expect(ended.reason).toBe('end-die');

    // Test end-game die continuing on roll 4-6
    const continued = resolveEndGameState({ gameSize: 'VERY_SMALL', turn: 10, endDice: 1, rollResults: [5] });
    expect(continued.ended).toBe(false);
    expect(continued.endDice).toBe(2); // Still adds die for next turn

    // Test different game sizes have different trigger turns
    const smallTrigger = resolveEndGameState({ gameSize: 'SMALL', turn: 4, endDice: 0 });
    expect(smallTrigger.addedEndDie).toBe(true);
    expect(smallTrigger.endDice).toBe(1);

    const mediumTrigger = resolveEndGameState({ gameSize: 'MEDIUM', turn: 6, endDice: 0 });
    expect(mediumTrigger.addedEndDie).toBe(true);
    expect(mediumTrigger.endDice).toBe(1);

    const largeTrigger = resolveEndGameState({ gameSize: 'LARGE', turn: 8, endDice: 0 });
    expect(largeTrigger.addedEndDie).toBe(true);
    expect(largeTrigger.endDice).toBe(1);

    const veryLargeTrigger = resolveEndGameState({ gameSize: 'VERY_LARGE', turn: 10, endDice: 0 });
    expect(veryLargeTrigger.addedEndDie).toBe(true);
    expect(veryLargeTrigger.endDice).toBe(1);
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
    expect(result.winnerSideId).toBe('A');
    expect(result.tie).toBe(false);
    expect(result.winnerReason).toBe('vp');
    expect(result.tieBreakMethod).toBe('none');
    expect(result.tieSideIds).toEqual([]);
  });

  it('should resolve tied VP with RP tie-break after RP->VP adjustment', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 4));
    const sideB = buildMissionSideStatus(makeSide('B', 4));
    const result = computeMissionScores({
      sides: [sideA, sideB],
      extraVpBySide: { B: 1 },
      extraRpBySide: { A: 5, B: 3 }, // A gets +1 resource VP, causing VP tie at 1-1
    });
    expect(result.vpBySide.A).toBe(1);
    expect(result.vpBySide.B).toBe(1);
    expect(result.rpBySide.A).toBe(5);
    expect(result.rpBySide.B).toBe(3);
    expect(result.winnerSideId).toBe('A');
    expect(result.tie).toBe(false);
    expect(result.winnerReason).toBe('rp');
    expect(result.tieBreakMethod).toBe('rp');
  });

  it('should remain tied when VP and RP are both tied', () => {
    const sideA = buildMissionSideStatus(makeSide('A', 4));
    const sideB = buildMissionSideStatus(makeSide('B', 4));
    const result = computeMissionScores({
      sides: [sideA, sideB],
      extraVpBySide: { A: 1, B: 1 },
      extraRpBySide: { A: 2, B: 2 },
    });
    expect(result.tie).toBe(true);
    expect(result.winnerSideId).toBeUndefined();
    expect(result.winnerReason).toBe('tie');
    expect(result.tieBreakMethod).toBe('none');
    expect(result.tieSideIds).toEqual(['A', 'B']);
  });
});

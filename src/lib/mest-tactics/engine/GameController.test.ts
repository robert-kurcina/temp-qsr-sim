import { describe, it, expect } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { GameManager } from './GameManager';
import { GameController } from './GameController';

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

function makeMissionSide(id: string, bp = 0): any {
  const profile = makeProfile(`${id}-member`, bp);
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return {
    id,
    name: id,
    assemblies: [],
    members: [
      {
        id: `${id}-member`,
        character,
        profile,
        assembly: { name: id, totalBP: bp, totalCharacters: 1 },
        portrait: { sheet: 'default', column: 0, row: 0, name: `${id}-portrait` },
        status: 'Ready',
        isVIP: false,
        objectiveMarkers: [],
      },
    ],
    totalBP: bp,
    deploymentZones: [],
    state: {
      currentTurn: 0,
      activatedModels: new Set<string>(),
      readyModels: new Set<string>(),
      woundsThisTurn: 0,
      eliminatedModels: [],
      victoryPoints: 0,
      initiativePoints: 0,
      missionState: {},
    },
    objectiveMarkerManager: { getMarkersByHolder: () => [], getAllMarkers: () => [] },
  };
}

describe('GameController mission outcome tie-breakers', () => {
  it('keeps a tie when optional initiative-card tie-breaker is disabled', () => {
    const sideA = makeMissionSide('A', 100);
    const sideB = makeMissionSide('B', 100);
    const characters = [sideA.members[0].character, sideB.members[0].character];
    const manager = new GameManager(characters, new Battlefield(12, 12));
    const controller = new GameController(manager, new Battlefield(12, 12));

    const result = controller.runMission([sideA, sideB], {
      maxTurns: 0,
      extraVpBySide: { A: 1, B: 1 },
      extraRpBySide: { A: 2, B: 2 },
      initiativeCardTieBreakerOnTie: false,
      initiativeCardHolderSideId: 'B',
    });

    expect(result.outcome.tie).toBe(true);
    expect(result.outcome.winnerSideId).toBeUndefined();
    expect(result.outcome.winnerReason).toBe('tie');
    expect(result.outcome.tieBreakMethod).toBe('none');
    expect(result.outcome.tieSideIds).toEqual(['A', 'B']);
  });

  it('resolves final tie to initiative-card holder when optional tie-breaker is enabled', () => {
    const sideA = makeMissionSide('A', 100);
    const sideB = makeMissionSide('B', 100);
    const characters = [sideA.members[0].character, sideB.members[0].character];
    const manager = new GameManager(characters, new Battlefield(12, 12));
    const controller = new GameController(manager, new Battlefield(12, 12));

    const result = controller.runMission([sideA, sideB], {
      maxTurns: 0,
      extraVpBySide: { A: 1, B: 1 },
      extraRpBySide: { A: 2, B: 2 },
      initiativeCardTieBreakerOnTie: true,
      initiativeCardHolderSideId: 'B',
    });

    expect(result.outcome.tie).toBe(false);
    expect(result.outcome.winnerSideId).toBe('B');
    expect(result.outcome.winnerReason).toBe('initiative-card');
    expect(result.outcome.tieBreakMethod).toBe('initiative-card');
    expect(result.outcome.suddenDeathApplied).toBe(true);
    expect(result.outcome.tieSideIds).toEqual([]);
  });

  it('applies mission-specific runtime behavior when missionId is provided', () => {
    const sideA = makeMissionSide('A', 100);
    const sideB = makeMissionSide('B', 100);
    sideA.members[0].character.finalAttributes.mov = 1;
    sideB.members[0].character.finalAttributes.mov = 1;

    const characters = [sideA.members[0].character, sideB.members[0].character];
    const battlefield = new Battlefield(24, 24);
    const manager = new GameManager(characters, battlefield);
    const controller = new GameController(manager, battlefield);

    manager.placeCharacter(sideA.members[0].character, { x: 6, y: 6 });
    manager.placeCharacter(sideB.members[0].character, { x: 18, y: 18 });

    const result = controller.runMission([sideA, sideB], {
      missionId: 'QAI_12',
      maxTurns: 1,
      endDieRolls: [1],
    });

    expect(result.state.extraVpBySide?.A ?? 0).toBeGreaterThan(0);
    expect((result.outcome.vpBySide.A ?? 0)).toBeGreaterThan(result.outcome.vpBySide.B ?? 0);
  });
});

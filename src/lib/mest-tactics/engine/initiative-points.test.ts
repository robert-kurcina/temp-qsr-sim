import { describe, expect, it } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { CharacterStatus } from '../core/types';
import { GameManager } from './GameManager';
import type { MissionSide } from '../mission/MissionSide';
import { ObjectiveMarkerManager } from '../mission/objective-markers';

function makeCharacter(name: string, int: number): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca: 0,
        rca: 0,
        ref: 0,
        int,
        pow: 0,
        str: 0,
        for: 0,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp: 0,
    },
    items: [],
    totalBp: 0,
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
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return character;
}

function makeSide(id: string, character: Character): MissionSide {
  return {
    id,
    name: id,
    assemblies: [],
    members: [
      {
        id: character.id,
        character,
        profile: character.profile,
        assembly: { name: `${id}-assembly`, characters: [character.id], totalBP: 0, totalCharacters: 1 },
        portrait: { sheet: 'default', column: 0, row: 0, name: `${id}-portrait` } as any,
        status: CharacterStatus.Ready as any,
        isVIP: false,
        objectiveMarkers: [],
      },
    ],
    totalBP: 0,
    deploymentZones: [],
    state: {
      currentTurn: 1,
      activatedModels: new Set<string>(),
      readyModels: new Set<string>([character.id]),
      woundsThisTurn: 0,
      eliminatedModels: [],
      victoryPoints: 0,
      resourcePoints: 0,
      predictedVp: 0,
      predictedRp: 0,
      keyScores: {},
      initiativePoints: 0,
      missionState: {},
    },
    objectiveMarkerManager: new ObjectiveMarkerManager(),
  };
}

function sequenceRoller(values: number[]): () => number {
  let index = 0;
  return () => {
    const next = values[index];
    index += 1;
    return next ?? 0;
  };
}

describe('Initiative points awarding', () => {
  it('awards winner IP equal to initiative margin', () => {
    const sideACharacter = makeCharacter('A', 4);
    const sideBCharacter = makeCharacter('B', 2);
    const sideA = makeSide('side-a', sideACharacter);
    const sideB = makeSide('side-b', sideBCharacter);

    const manager = new GameManager([sideACharacter, sideBCharacter]);
    const result = manager.rollInitiative(() => 0, [sideA, sideB]);

    expect(manager.lastInitiativeWinnerSideId).toBe('side-a');
    expect(result.ipAwarded).toContainEqual({
      sideId: 'side-a',
      amount: 2,
      reason: 'highest_initiative',
    });
    expect(sideA.state.initiativePoints).toBe(2);
  });

  it('awards carry-over IP to non-winning side from base dice that roll 6', () => {
    const sideACharacter = makeCharacter('A', 8);
    const sideBCharacter = makeCharacter('B', 1);
    const sideA = makeSide('side-a', sideACharacter);
    const sideB = makeSide('side-b', sideBCharacter);

    // Character A (winner): [4,4]
    // Character B (loser): [6,1] -> one Base die carry-over
    const roller = sequenceRoller([0.55, 0.55, 0.99, 0.0]);
    const manager = new GameManager([sideACharacter, sideBCharacter]);
    const result = manager.rollInitiative(roller, [sideA, sideB]);

    expect(manager.lastInitiativeWinnerSideId).toBe('side-a');
    expect(result.ipAwarded).toContainEqual({
      sideId: 'side-b',
      amount: 1,
      reason: 'carry_over',
    });
    expect(sideB.state.initiativePoints).toBe(1);
  });

  it('lets Mission Attacker win tied initiative with zero winner IP (IN.3)', () => {
    const sideACharacter = makeCharacter('A', 2);
    const sideBCharacter = makeCharacter('B', 2);
    const sideA = makeSide('side-a', sideACharacter);
    const sideB = makeSide('side-b', sideBCharacter);

    const manager = new GameManager([sideACharacter, sideBCharacter]);
    const result = manager.rollInitiativeWithOptions(
      () => 0,
      [sideA, sideB],
      {
        missionAttackerSideId: 'side-b',
        missionAttackerWinsTie: true,
      }
    );

    expect(result.winner).toBe('side-b');
    expect(result.ipAwarded).toContainEqual({
      sideId: 'side-b',
      amount: 0,
      reason: 'tie_break',
    });
    expect(sideB.state.initiativePoints).toBe(0);
  });

  it('re-rolls unresolved side ties when mission-attacker tie option is not used (IN.3)', () => {
    const sideACharacter = makeCharacter('A', 2);
    const sideBCharacter = makeCharacter('B', 2);
    const sideA = makeSide('side-a', sideACharacter);
    const sideB = makeSide('side-b', sideBCharacter);

    // Dice rolls:
    // - 4 initiative dice for 2 characters (all 1s -> tied score)
    // - 2 character tie-break dice in activation sorting (both 1)
    // - 2 side tie-break reroll dice (both 1 -> still tied)
    // - 2 side tie-break reroll dice (1,6 -> side-b wins)
    const roller = sequenceRoller([0, 0, 0, 0, 0, 0, 0, 0, 0, 0.99]);
    const manager = new GameManager([sideACharacter, sideBCharacter]);
    const result = manager.rollInitiativeWithOptions(roller, [sideA, sideB], {
      missionAttackerWinsTie: false,
    });

    expect(result.winner).toBe('side-b');
  });
});

describe('Initiative point special abilities', () => {
  it('spends 1 IP to maintain initiative', () => {
    const character = makeCharacter('A', 4);
    const side = makeSide('side-a', character);
    side.state.initiativePoints = 2;

    const manager = new GameManager([character]);
    expect(manager.maintainInitiative(side)).toBe(true);
    expect(side.state.initiativePoints).toBe(1);
  });

  it('spends 1 IP to force initiative order change and refunds when already first', () => {
    const first = makeCharacter('A', 4);
    const second = makeCharacter('B', 4);
    const side = makeSide('side-a', first);
    side.state.initiativePoints = 1;

    const manager = new GameManager([first, second]);
    manager.activationOrder = [second, first];

    expect(manager.forceInitiative(first, side)).toBe(true);
    expect(manager.activationOrder.map((character: any) => character.id)).toEqual([first.id, second.id]);
    expect(side.state.initiativePoints).toBe(0);

    side.state.initiativePoints = 1;
    expect(manager.forceInitiative(first, side)).toBe(false);
    expect(side.state.initiativePoints).toBe(1);
  });

  it('spends 1 IP to refresh and remove a Delay token', () => {
    const character = makeCharacter('A', 4);
    const side = makeSide('side-a', character);
    side.state.initiativePoints = 1;
    character.state.delayTokens = 1;

    const manager = new GameManager([character]);
    expect(manager.refresh(character, side)).toBe(true);
    expect(character.state.delayTokens).toBe(0);
    expect(side.state.initiativePoints).toBe(0);
  });

  it('refunds IP when refresh is attempted without Delay tokens', () => {
    const character = makeCharacter('A', 4);
    const side = makeSide('side-a', character);
    side.state.initiativePoints = 1;
    character.state.delayTokens = 0;

    const manager = new GameManager([character]);
    expect(manager.refresh(character, side)).toBe(false);
    expect(side.state.initiativePoints).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../battlefield';
import { Character, Profile } from '../../core';
import { GameManager } from '../../engine';
import { createAIGameLoopDecisionRuntime } from './AIGameLoopDecisionRuntime';

function makeProfile(name: string): Profile {
  return {
    name,
    archetype: {
      name: 'Average',
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp: 30,
    },
    items: [],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeCharacter(name: string): Character {
  const character = new Character(makeProfile(name));
  character.finalAttributes = character.attributes;
  return character;
}

describe('createAIGameLoopDecisionRuntime', () => {
  it('captures model state and side-name/side-id lookups', () => {
    const battlefield = new Battlefield(24, 24);
    const alpha = makeCharacter('alpha-1');
    const bravo = makeCharacter('bravo-1');
    alpha.state.wounds = 2;
    alpha.state.delayTokens = 1;
    alpha.state.isWaiting = true;

    battlefield.placeCharacter(alpha, { x: 4, y: 12 });
    battlefield.placeCharacter(bravo, { x: 18, y: 12 });

    const manager = new GameManager([alpha, bravo], battlefield);
    const sideA = {
      id: 'side-a',
      name: 'Alpha',
      members: [{ character: alpha }],
      state: { initiativePoints: 0 },
    } as any;
    const sideB = {
      id: 'side-b',
      name: 'Bravo',
      members: [{ character: bravo }],
      state: { initiativePoints: 0 },
    } as any;

    const sideById = new Map<string, string>([
      [alpha.id, sideA.id],
      [bravo.id, sideB.id],
    ]);
    const assemblyById = new Map<string, string>([
      [alpha.id, 'Alpha Assembly'],
      [bravo.id, 'Bravo Assembly'],
    ]);

    const runtime = createAIGameLoopDecisionRuntime({
      manager,
      battlefield,
      sides: [sideA, sideB],
      getConfig: () => ({
        enableStrategic: false,
        enableTactical: false,
        enableCharacterAI: false,
      }),
      getCharacterAIs: () => new Map(),
      getSideAIs: () => new Map(),
      getAssemblyAIs: () => new Map(),
      getCharacterSideById: () => sideById,
      getCharacterAssemblyById: () => assemblyById,
    });

    expect(runtime.findCharacterSide(alpha)).toBe(sideA.id);
    expect(runtime.getSideNameForCharacter(bravo)).toBe('Bravo');
    expect(runtime.captureModelState(alpha)).toMatchObject({
      wounds: 2,
      delayTokens: 1,
      isWaiting: true,
    });
  });

  it('returns hold decision when all AI layers are disabled', () => {
    const battlefield = new Battlefield(24, 24);
    const actor = makeCharacter('actor');
    battlefield.placeCharacter(actor, { x: 4, y: 12 });

    const manager = new GameManager([actor], battlefield);
    const side = {
      id: 'solo-side',
      name: 'Solo',
      members: [{ character: actor }],
      state: { initiativePoints: 0 },
    } as any;
    const sideById = new Map<string, string>([[actor.id, side.id]]);

    const runtime = createAIGameLoopDecisionRuntime({
      manager,
      battlefield,
      sides: [side],
      getConfig: () => ({
        enableStrategic: false,
        enableTactical: false,
        enableCharacterAI: false,
      }),
      getCharacterAIs: () => new Map(),
      getSideAIs: () => new Map(),
      getAssemblyAIs: () => new Map(),
      getCharacterSideById: () => sideById,
      getCharacterAssemblyById: () => new Map([[actor.id, 'Solo Assembly']]),
    });

    const decision = runtime.getAIDecision(actor);
    expect(decision?.type).toBe('hold');
  });
});

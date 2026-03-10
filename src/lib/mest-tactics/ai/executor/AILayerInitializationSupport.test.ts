import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../battlefield';
import { Character, Profile } from '../../core';
import { buildAssembly, createMissionSide } from '../../mission';
import { initializeAILayersForGameLoop } from './AILayerInitializationSupport';

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

function makeSides() {
  const a1 = makeCharacter('A-1');
  const a2 = makeCharacter('A-2');
  const b1 = makeCharacter('B-1');
  const b2 = makeCharacter('B-2');
  const assemblyA = buildAssembly('Alpha Assembly', [a1.profile, a2.profile]);
  const assemblyB = buildAssembly('Bravo Assembly', [b1.profile, b2.profile]);
  const sideA = createMissionSide('Alpha', [assemblyA], { startingIndex: 0 });
  const sideB = createMissionSide('Bravo', [assemblyB], { startingIndex: 2 });
  return { sideA, sideB };
}

describe('initializeAILayersForGameLoop', () => {
  it('initializes side/assembly/character mappings and AI layers', () => {
    const battlefield = new Battlefield(24, 24);
    const { sideA, sideB } = makeSides();
    const initialized = initializeAILayersForGameLoop([sideA, sideB], battlefield, {
      enableStrategic: true,
      enableTactical: true,
      enableCharacterAI: true,
      allowWaitAction: false,
      allowHideAction: false,
    });

    expect(initialized.sideIds).toEqual([sideA.id, sideB.id]);
    expect(initialized.sideAIs.size).toBe(2);
    expect(initialized.assemblyAIs.size).toBeGreaterThan(0);
    expect(initialized.characterAIs.size).toBe(4);
    expect(initialized.characterSideById.size).toBe(4);
    expect(initialized.characterAssemblyById.size).toBe(4);

    const firstChar = sideA.members[0]?.character;
    expect(firstChar).toBeDefined();
    const ai = initialized.characterAIs.get(firstChar.id);
    expect(ai).toBeDefined();
    expect(ai?.getConfig().allowWaitAction).toBe(false);
    expect(ai?.getConfig().allowHideAction).toBe(false);
  });

  it('skips character AI map when character AI is disabled', () => {
    const battlefield = new Battlefield(24, 24);
    const { sideA, sideB } = makeSides();
    const initialized = initializeAILayersForGameLoop([sideA, sideB], battlefield, {
      enableStrategic: true,
      enableTactical: true,
      enableCharacterAI: false,
    });

    expect(initialized.characterAIs.size).toBe(0);
    expect(initialized.sideAIs.size).toBe(2);
    expect(initialized.assemblyAIs.size).toBeGreaterThan(0);
  });
});

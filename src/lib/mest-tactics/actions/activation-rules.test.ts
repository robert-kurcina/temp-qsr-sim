import { describe, expect, it, vi } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { CharacterStatus } from '../core/types';
import { beginActivation, endActivation, type ActivationDeps } from './activation';

function makeCharacter(name: string, traits: string[] = []): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca: 0,
        rca: 0,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
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
    burden: { totalLaden: 0, totalBurden: 0 },
    totalHands: 0,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: traits,
    allTraits: traits,
  };
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return character;
}

function makeDeps(
  character: Character,
  status: CharacterStatus,
  options: {
    isFreeFromEngagement?: boolean;
    isBehindCover?: boolean;
    opposingCharacters?: Character[];
    isInLos?: boolean;
  } = {}
): { deps: ActivationDeps; statusById: Map<string, CharacterStatus>; apById: Map<string, number>; activeId: { value: string | null } } {
  const statusById = new Map<string, CharacterStatus>([[character.id, status]]);
  const apById = new Map<string, number>([[character.id, 0]]);
  const activeId = { value: null as string | null };

  const deps: ActivationDeps = {
    apPerActivation: 2,
    getCharacterStatus: (characterId: string) => statusById.get(characterId),
    setCharacterStatus: (characterId: string, next: CharacterStatus) => {
      statusById.set(characterId, next);
    },
    setActiveCharacterId: (characterId: string | null) => {
      activeId.value = characterId;
    },
    applyOngoingStatusEffects: vi.fn(),
    clearTransfixUsed: vi.fn(),
    clearFiddleUsed: vi.fn(),
    getApRemaining: (characterId: string) => apById.get(characterId) ?? 0,
    setApRemaining: (characterId: string, value: number) => {
      apById.set(characterId, value);
    },
    getCharacterPosition: () => ({ x: 1, y: 1 }),
    isBehindCover: () => options.isBehindCover ?? false,
    isInLos: () => options.isInLos ?? false,
    getOpposingCharacters: () => options.opposingCharacters ?? [],
    isFreeFromEngagement: () => options.isFreeFromEngagement ?? true,
  };

  return { deps, statusById, apById, activeId };
}

describe('activation rules', () => {
  it('does not begin activation unless character is Ready', () => {
    const character = makeCharacter('non-ready');
    const { deps, activeId } = makeDeps(character, CharacterStatus.Done);

    const ap = beginActivation(deps, character);

    expect(ap).toBe(0);
    expect(activeId.value).toBeNull();
  });

  it('removes delay tokens before setting activation AP', () => {
    const character = makeCharacter('delay');
    character.state.delayTokens = 1;
    const { deps, apById } = makeDeps(character, CharacterStatus.Ready);

    const ap = beginActivation(deps, character);

    expect(ap).toBe(1);
    expect(apById.get(character.id)).toBe(1);
    expect(character.state.delayTokens).toBe(0);
  });

  it('forces Pushing when a Disordered character lacks compulsory AP and can push', () => {
    const character = makeCharacter('disordered-push');
    character.state.fearTokens = 2;
    character.state.delayTokens = 2;
    const { deps, apById } = makeDeps(character, CharacterStatus.Ready);

    const ap = beginActivation(deps, character);

    expect(ap).toBe(1);
    expect(apById.get(character.id)).toBe(1);
    expect(character.state.delayTokens).toBe(1);
    expect(character.state.hasPushedThisInitiative).toBe(true);
  });

  it('forces Pushing when a Panicked character needs extra compulsory AP', () => {
    const character = makeCharacter('panicked-push');
    character.state.fearTokens = 3;
    character.state.delayTokens = 1;
    const { deps, apById } = makeDeps(character, CharacterStatus.Ready);

    const ap = beginActivation(deps, character);

    expect(ap).toBe(2);
    expect(apById.get(character.id)).toBe(2);
    expect(character.state.delayTokens).toBe(1);
    expect(character.state.hasPushedThisInitiative).toBe(true);
  });

  it('does not auto-push compulsory actions when remaining Delay tokens block pushing', () => {
    const character = makeCharacter('blocked-push');
    character.state.fearTokens = 2;
    character.state.delayTokens = 3;
    const { deps, apById } = makeDeps(character, CharacterStatus.Ready);

    const ap = beginActivation(deps, character);

    expect(ap).toBe(0);
    expect(apById.get(character.id)).toBe(0);
    expect(character.state.delayTokens).toBe(1);
    expect(character.state.hasPushedThisInitiative).toBe(false);
  });

  it('maintains Wait for non-Free models by spending 1 AP when possible', () => {
    const character = makeCharacter('wait-upkeep');
    character.state.isWaiting = true;
    const { deps, apById } = makeDeps(character, CharacterStatus.Ready, {
      isFreeFromEngagement: false,
    });

    const ap = beginActivation(deps, character);

    expect(ap).toBe(1);
    expect(apById.get(character.id)).toBe(1);
    expect(character.state.isWaiting).toBe(true);
  });

  it('removes Wait for non-Free models if no AP remains for upkeep', () => {
    const character = makeCharacter('wait-removed');
    character.state.isWaiting = true;
    character.state.delayTokens = 2;
    const { deps } = makeDeps(character, CharacterStatus.Ready, {
      isFreeFromEngagement: false,
    });

    const ap = beginActivation(deps, character);

    expect(ap).toBe(0);
    expect(character.state.isWaiting).toBe(false);
  });

  it('maintains Wait for Free models with zero AP upkeep cost', () => {
    const character = makeCharacter('wait-free');
    character.state.isWaiting = true;
    const { deps, apById } = makeDeps(character, CharacterStatus.Ready, {
      isFreeFromEngagement: true,
    });

    const ap = beginActivation(deps, character);

    expect(ap).toBe(2);
    expect(apById.get(character.id)).toBe(2);
    expect(character.state.isWaiting).toBe(true);
  });

  it('marks Done and clears Overreach at end of activation', () => {
    const character = makeCharacter('done-state');
    character.state.isOverreach = true;
    const { deps, statusById, activeId } = makeDeps(character, CharacterStatus.Ready);

    endActivation(deps, character);

    expect(statusById.get(character.id)).toBe(CharacterStatus.Done);
    expect(activeId.value).toBeNull();
    expect(character.state.isOverreach).toBe(false);
  });

  it('auto-hides Sneaky characters when end-of-activation cover condition is met', () => {
    const character = makeCharacter('sneaky', ['Sneaky']);
    character.state.isHidden = false;
    character.state.isAttentive = true;
    const { deps } = makeDeps(character, CharacterStatus.Ready, {
      isBehindCover: true,
    });

    endActivation(deps, character);

    expect(character.state.isHidden).toBe(true);
  });
});

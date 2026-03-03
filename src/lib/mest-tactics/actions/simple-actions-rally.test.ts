import { describe, expect, it } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { executeRallyAction, type SimpleActionDeps } from './simple-actions';
import type { Position } from '../battlefield/Position';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainElement } from '../battlefield/terrain/TerrainElement';

function makeCharacter(name: string, pow: number): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca: 0,
        rca: 0,
        ref: 2,
        int: 2,
        pow,
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
    finalTraits: [],
    allTraits: [],
  };
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return character;
}

function makeDeps(
  apById: Map<string, number>,
  rallied: Set<string>,
  options: { positions?: Map<string, Position>; twoApMovementRange?: number } = {}
): SimpleActionDeps {
  return {
    spendAp: (character: Character, cost: number) => {
      const current = apById.get(character.id) ?? 0;
      if (current < cost) return false;
      apById.set(character.id, current - cost);
      return true;
    },
    setWaiting: () => {},
    getCharacterPosition: options.positions
      ? (character: Character) => options.positions?.get(character.id)
      : undefined,
    getTwoApMovementRange: options.twoApMovementRange !== undefined
      ? () => options.twoApMovementRange as number
      : undefined,
    setCharacterStatus: () => {},
    markRallyUsed: (characterId: string) => {
      rallied.add(characterId);
    },
    markReviveUsed: () => {},
    markFiddleUsed: () => {},
    hasRallyUsed: (characterId: string) => rallied.has(characterId),
    hasReviveUsed: () => false,
    hasFiddleUsed: () => false,
  };
}

describe('executeRallyAction', () => {
  it('costs 1 AP and removes fear on success', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 4);
    actor.state.isAttentive = false;
    target.state.fearTokens = 3;
    const positions = new Map<string, Position>([
      [actor.id, { x: 1, y: 1 }],
      [target.id, { x: 2, y: 1 }],
    ]);

    const apById = new Map<string, number>([[actor.id, 2]]);
    const rallied = new Set<string>();
    const deps = makeDeps(apById, rallied, { positions });

    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, target],
      visibilityOrMu: 16,
      rolls: [6, 6],
    });

    expect(result.success).toBe(true);
    expect(apById.get(actor.id)).toBe(1);
    expect(target.state.fearTokens).toBe(0);
    expect(rallied.has(target.id)).toBe(true);
  });

  it('fails when actor is not Free', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    actor.state.isEngaged = true;

    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set());
    const result = executeRallyAction(deps, actor, target, { rolls: [6, 6] });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Free');
  });

  it('fails when target is not Free', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    target.state.isEngaged = true;

    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set());
    const result = executeRallyAction(deps, actor, target, { rolls: [6, 6] });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('target');
  });

  it('fails when target already benefited from Rally this turn', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);

    const apById = new Map<string, number>([[actor.id, 2]]);
    const rallied = new Set<string>([target.id]);
    const deps = makeDeps(apById, rallied);
    const result = executeRallyAction(deps, actor, target, { rolls: [6, 6] });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('already rallied');
    expect(apById.get(actor.id)).toBe(2);
  });

  it('fails when actor cannot pay 1 AP rally cost', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    const positions = new Map<string, Position>([
      [actor.id, { x: 1, y: 1 }],
      [target.id, { x: 2, y: 1 }],
    ]);

    const apById = new Map<string, number>([[actor.id, 0]]);
    const deps = makeDeps(apById, new Set(), { positions });
    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, target],
      visibilityOrMu: 16,
      rolls: [6, 6],
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('AP');
  });

  it('fails when target is not a Friendly model (RL.4)', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('enemy-target', 3);
    const friendly = makeCharacter('friendly', 3);
    const positions = new Map<string, Position>([
      [actor.id, { x: 1, y: 1 }],
      [target.id, { x: 2, y: 1 }],
      [friendly.id, { x: 1.5, y: 1 }],
    ]);
    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set(), { positions });

    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, friendly],
      visibilityOrMu: 16,
      rolls: [6, 6],
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Friendly');
  });

  it('fails when friendly target is outside Cohesion (RL.4)', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    const positions = new Map<string, Position>([
      [actor.id, { x: 1, y: 1 }],
      [target.id, { x: 12, y: 1 }],
    ]);
    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set(), { positions });

    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, target],
      visibilityOrMu: 8,
      rolls: [6, 6],
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Cohesion');
  });

  it('applies RL.7 friendly +1m when an Attentive Ordered friendly is in Cohesion', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    const supporter = makeCharacter('supporter', 3);
    target.state.fearTokens = 1;

    const positions = new Map<string, Position>([
      [actor.id, { x: 1, y: 1 }],
      [target.id, { x: 4, y: 1 }],
      [supporter.id, { x: 5, y: 1 }],
    ]);
    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set(), { positions });

    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, supporter, target],
      visibilityOrMu: 16,
      rolls: [6, 6, 6, 6, 6, 6],
    });

    expect(result.friendlyBonusApplied).toBe(true);
  });

  it('applies RL.8 safety +1w when behind cover/out of LOS and outside 2 AP threat', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    const opponent = makeCharacter('opponent', 3);
    target.state.fearTokens = 1;

    const battlefield = new Battlefield(20, 20);
    battlefield.addTerrain(new TerrainElement('Tree', { x: 10, y: 10 }).toFeature());
    battlefield.placeCharacter(actor, { x: 15, y: 10 });
    battlefield.placeCharacter(target, { x: 12, y: 10 });
    battlefield.placeCharacter(opponent, { x: 4, y: 10 });

    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set(), { positions: new Map([
      [actor.id, { x: 15, y: 10 }],
      [target.id, { x: 12, y: 10 }],
      [opponent.id, { x: 4, y: 10 }],
    ]), twoApMovementRange: 2 });

    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, target],
      battlefield,
      opponents: [opponent],
      rolls: [6, 6, 6, 6, 6, 6],
    });

    expect(result.safetyBonusApplied).toBe(true);
  });

  it('does not apply RL.8 safety bonus when opposition can reach within 2 AP', () => {
    const actor = makeCharacter('actor', 3);
    const target = makeCharacter('target', 3);
    const opponent = makeCharacter('opponent', 3);

    const battlefield = new Battlefield(20, 20);
    battlefield.placeCharacter(actor, { x: 10, y: 10 });
    battlefield.placeCharacter(target, { x: 11, y: 10 });
    battlefield.placeCharacter(opponent, { x: 12, y: 10 });

    const apById = new Map<string, number>([[actor.id, 2]]);
    const deps = makeDeps(apById, new Set(), { positions: new Map([
      [actor.id, { x: 10, y: 10 }],
      [target.id, { x: 11, y: 10 }],
      [opponent.id, { x: 12, y: 10 }],
    ]), twoApMovementRange: 100 });

    const result = executeRallyAction(deps, actor, target, {
      allies: [actor, target],
      battlefield,
      opponents: [opponent],
      rolls: [6, 6, 6, 6, 6, 6],
    });

    expect(result.safetyBonusApplied).toBe(false);
  });
});

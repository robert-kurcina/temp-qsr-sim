import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { GameManager } from '../engine/GameManager';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { setRoller, resetRoller } from '../subroutines/dice-roller';
import { TerrainType } from '../battlefield/terrain/Terrain';
import type { Profile } from '../core/Profile';

const makeProfile = (name: string, attrs: Partial<Profile['archetype']['attributes']> = {}, items: any[] = []): Profile => ({
  name,
  archetype: { attributes: { cca: 2, rca: 2, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 4, siz: 3, ...attrs } },
  items,
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
});

describe('Indirect attack scrambling', () => {
  let battlefield: Battlefield;

  beforeEach(() => {
    battlefield = new Battlefield(12, 12);
    setRoller(() => Array(20).fill(1));
  });

  afterEach(() => {
    resetRoller();
  });

  it('identifies eligible scramble targets and applies moves when enabled', () => {
    const weapon = { name: 'Test Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));

    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const targetPos = { x: 6, y: 6 };
    const scrambleMove = { x: 7, y: 6 };

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: targetPos,
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      allowScramble: true,
      scrambleMoves: { [target.id]: scrambleMove },
    });

    expect(result.scramble.eligibleIds).toContain(target.id);
    expect(result.scramble.movedIds).toContain(target.id);
    expect(manager.getCharacterPosition(target)).toEqual(scrambleMove);
  });

  it('does not scramble when disabled', () => {
    const weapon = { name: 'Test Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));

    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      allowScramble: false,
      scrambleMoves: { [target.id]: { x: 7, y: 6 } },
    });

    expect(result.scramble.eligibleIds).toEqual([]);
    expect(result.scramble.movedIds).toEqual([]);
    expect(manager.getCharacterPosition(target)).toEqual({ x: 6, y: 6 });
  });

  it('blocks blind indirect attacks without Spotter or Known target', () => {
    const weapon = { name: 'Blind Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE', 'Scatter'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 6 });
    manager.placeCharacter(target, { x: 8, y: 6 });
    battlefield.addTerrain({
      id: 'blocking-wall',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 12 },
        { x: 4, y: 12 },
      ],
      meta: { los: 'Blocking' } as any,
    } as any);

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 8, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: false,
      spotters: [],
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Spotter or Known');
    expect(result.blind?.isBlind).toBe(true);
    expect(result.blind?.allowed).toBe(false);
  });

  it('uses unbiased scatter and extra wild-distance for blind attacks with [Scatter]', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.2);
    try {
      const weapon = { name: 'Blind Frag', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE', 'Scatter'] };
      const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
      const target = new Character(makeProfile('Target'));
      const manager = new GameManager([attacker, target], battlefield);
      manager.placeCharacter(attacker, { x: 2, y: 6 });
      manager.placeCharacter(target, { x: 8, y: 6 });
      battlefield.addTerrain({
        id: 'blocking-wall',
        type: TerrainType.Obstacle,
        vertices: [
          { x: 4, y: 0 },
          { x: 5, y: 0 },
          { x: 5, y: 12 },
          { x: 4, y: 12 },
        ],
        meta: { los: 'Blocking' } as any,
      } as any);

      const result = manager.executeIndirectAttack(attacker, weapon as any, 10, {
        target: {
          id: 'target',
          position: { x: 8, y: 6 },
          baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
          siz: target.finalAttributes.siz ?? 3,
        },
        knownAtInitiativeStart: true,
        scatterBias: 'biased',
        blindScatterDistanceRoll: 6, // +2 misses via wild die
      });

      const baseMisses = Math.max(1, Math.ceil(Math.abs(result.hitTestResult.score)));
      expect(result.blind?.isBlind).toBe(true);
      expect(result.blind?.allowed).toBe(true);
      expect(result.blind?.usedKnown).toBe(true);
      expect(result.blindScatterDistanceBonus).toBe(2);
      expect(result.scatterResult?.misses).toBe(baseMisses + 2);
      expect(result.scatterResult?.scatterDirection).toBe(1); // unbiased roll @0.2 -> d6=2
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('allows blind indirect attacks when a valid Spotter has LOS within Cohesion', () => {
    const weapon = { name: 'Spotter Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const spotter = new Character(makeProfile('Spotter'));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, spotter, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(spotter, { x: 2, y: 5 });
    manager.placeCharacter(target, { x: 8, y: 2 });
    battlefield.addTerrain({
      id: 'low-wall',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 4, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 4 },
        { x: 4, y: 4 },
      ],
      meta: { los: 'Blocking' } as any,
    } as any);

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 8, y: 2 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: false,
      spotters: [spotter],
      spotterCohesionRangeMu: 4,
    });

    expect(result.blind?.isBlind).toBe(true);
    expect(result.blind?.allowed).toBe(true);
    expect(result.blind?.usedSpotter).toBe(true);
  });
});

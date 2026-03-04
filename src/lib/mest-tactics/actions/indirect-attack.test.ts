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
    expect(target.state.delayTokens).toBeGreaterThan(0);
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

  it('enables scramble eligibility by default for indirect attacks', () => {
    const weapon = { name: 'Default Scramble Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
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
    });

    expect(result.scramble.eligibleIds).toContain(target.id);
  });

  it('requires attentive and ordered targets to be scramble-eligible', () => {
    const weapon = { name: 'State-Gated Scramble Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    target.state.delayTokens = 1;
    target.refreshStatusFlags();

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
      allowScramble: true,
      scrambleMoves: { [target.id]: { x: 7, y: 6 } },
    });

    expect(result.scramble.eligibleIds).not.toContain(target.id);
    expect(result.scramble.movedIds).toEqual([]);
    expect(manager.getCharacterPosition(target)).toEqual({ x: 6, y: 6 });
  });

  it('excludes targets that already reacted this turn from scramble eligibility', () => {
    const weapon = { name: 'React-Gated Scramble Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    target.state.isWaiting = true;
    target.refreshStatusFlags();

    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const reacted = manager.executeReactAction(target, () => true);
    expect(reacted.executed).toBe(true);

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      allowScramble: true,
      scrambleMoves: { [target.id]: { x: 7, y: 6 } },
    });

    expect(result.scramble.eligibleIds).not.toContain(target.id);
    expect(result.scramble.movedIds).toEqual([]);
    expect(manager.getCharacterPosition(target)).toEqual({ x: 6, y: 6 });
  });

  it('marks successful scramble moves as reacted this turn', () => {
    const weapon = { name: 'Scramble React Marker', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));

    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const scrambleMove = { x: 7, y: 6 };
    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      allowScramble: true,
      scrambleMoves: { [target.id]: scrambleMove },
    });
    expect(result.scramble.movedIds).toContain(target.id);

    target.state.isWaiting = true;
    target.refreshStatusFlags();
    const react = manager.executeReactAction(target, () => true);
    expect(react.executed).toBe(false);
    expect(react.reason).toContain('Already reacted');
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
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 12 },
        { x: 3, y: 12 },
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
          { x: 3, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 12 },
          { x: 3, y: 12 },
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
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
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
      isFriendlySpotter: () => true,
      spotterCohesionRangeMu: 4,
    });

    expect(result.blind?.isBlind).toBe(true);
    expect(result.blind?.allowed).toBe(true);
    expect(result.blind?.usedSpotter).toBe(true);
  });

  it('rejects blind indirect attacks when Spotter friendliness is unknown', () => {
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
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
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

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Spotter or Known');
    expect(result.blind?.allowed).toBe(false);
  });

  it('rejects blind indirect attacks when Spotter is not Friendly', () => {
    const weapon = { name: 'Spotter Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const spotter = new Character(makeProfile('Enemy Spotter'));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, spotter, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(spotter, { x: 2, y: 5 });
    manager.placeCharacter(target, { x: 8, y: 2 });
    battlefield.addTerrain({
      id: 'low-wall',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
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
      isFriendlySpotter: () => false,
      spotterCohesionRangeMu: 4,
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Spotter or Known');
    expect(result.blind?.allowed).toBe(false);
  });

  it('rejects blind indirect attacks when Spotter is not Free', () => {
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
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
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
      isSpotterFree: () => false,
      spotterCohesionRangeMu: 4,
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Spotter or Known');
    expect(result.blind?.allowed).toBe(false);
  });

  it('adds a Delay token on second non-Natural indirect attack in the same initiative', () => {
    const weapon = { name: 'Repeat Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const targetSpec = {
      id: 'target',
      position: { x: 6, y: 6 },
      baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
      siz: target.finalAttributes.siz ?? 3,
    };

    const first = manager.executeIndirectAttack(attacker, weapon as any, 1, { target: targetSpec });
    expect(first.handRequirementFailed).toBeFalsy();
    expect(attacker.state.delayTokens).toBe(0);

    const second = manager.executeIndirectAttack(attacker, weapon as any, 1, { target: targetSpec });
    expect(second.handRequirementFailed).toBeFalsy();
    expect(attacker.state.delayTokens).toBe(1);
  });

  it('does not add repeat-attack Delay token for Natural indirect weapons', () => {
    const weapon = { name: 'Natural Arc Blast', classification: 'Natural', class: 'Natural', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE', '[Arc]'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const targetSpec = {
      id: 'target',
      position: { x: 6, y: 6 },
      baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
      siz: target.finalAttributes.siz ?? 3,
    };

    manager.executeIndirectAttack(attacker, weapon as any, 1, { target: targetSpec });
    manager.executeIndirectAttack(attacker, weapon as any, 1, { target: targetSpec });
    expect(attacker.state.delayTokens).toBe(0);
  });

  it('applies [Reveal] to remove attacker Hidden when target location is in LOS', () => {
    const weapon = { name: 'Reveal Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE', '[Reveal]'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    attacker.state.isHidden = true;
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 2 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 6, y: 2 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
    });

    expect(result.handRequirementFailed).toBeFalsy();
    expect(attacker.state.isHidden).toBe(false);
  });

  it('keeps attacker Hidden on [Reveal] indirect attack when target location is not in LOS', () => {
    const weapon = { name: 'Blind Reveal Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE', '[Reveal]'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    attacker.state.isHidden = true;
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 6 });
    manager.placeCharacter(target, { x: 8, y: 6 });
    battlefield.addTerrain({
      id: 'blocking-wall',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 12 },
        { x: 3, y: 12 },
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
      knownAtInitiativeStart: true,
    });

    expect(result.handRequirementFailed).toBeFalsy();
    expect(attacker.state.isHidden).toBe(true);
  });

  it('rejects indirect attacks with negative OR values', () => {
    const weapon = { name: 'Bad Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: -1, traits: ['AoE'] };
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
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('cannot be negative');
  });

  it('rejects thrown indirect attacks when STR-based OR expression resolves negative', () => {
    const weapon = { name: 'Bad Strength Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 'STR-5', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', { str: 2 }, [weapon]));
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
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('cannot be negative');
  });

  it('accepts thrown indirect attacks when STR-based OR expression resolves positive', () => {
    const weapon = { name: 'Strength Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 'STR+2', traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', { str: 4 }, [weapon]));
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
    });

    expect(result.handRequirementFailed).toBeFalsy();
  });

  it('rejects indirect attacks for non-Thrown/non-Throwable/non-[Arc] weapons', () => {
    const weapon = { name: 'Rifle', classification: 'Firearm', class: 'Firearm', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 8, traits: ['AoE'] };
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
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Thrown, Throwable, or [Arc]');
  });

  it('rejects indirect attacks targeting a location outside battlefield bounds', () => {
    const weapon = { name: 'Test Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 20, y: 20 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('within battlefield bounds');
  });

  it('rejects indirect attacks when attacker location is outside battlefield bounds', () => {
    const weapon = { name: 'Test Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      attacker: {
        id: attacker.id,
        position: { x: -1, y: 2 },
        baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? 3),
        siz: attacker.finalAttributes.siz ?? 3,
      },
      target: {
        id: 'target',
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Attacker location must be within battlefield bounds');
  });

  it('rejects indirect attacks by default when midpoint arc validation fails', () => {
    const weapon = { name: 'Arc Check Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 6 });
    manager.placeCharacter(target, { x: 8, y: 6 });
    battlefield.addTerrain({
      id: 'midpoint-blocker',
      type: 'Blocking' as any,
      vertices: [
        { x: 4.8, y: 5.2 },
        { x: 5.2, y: 5.2 },
        { x: 5.2, y: 6.8 },
        { x: 4.8, y: 6.8 },
      ],
      bounds: { x: 4.8, y: 5.2, width: 0.4, height: 1.6 },
      meta: { los: 'Blocking' } as any,
    } as any);

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 8, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: true,
    });

    expect(result.handRequirementFailed).toBe(true);
    expect(result.handRequirementReason).toContain('Midpoint has blocking terrain');
  });

  it('allows opting out of arc validation when explicitly disabled', () => {
    const weapon = { name: 'Arc Override Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 6 });
    manager.placeCharacter(target, { x: 8, y: 6 });
    battlefield.addTerrain({
      id: 'midpoint-blocker',
      type: 'Blocking' as any,
      vertices: [
        { x: 4.8, y: 5.2 },
        { x: 5.2, y: 5.2 },
        { x: 5.2, y: 6.8 },
        { x: 4.8, y: 6.8 },
      ],
      bounds: { x: 4.8, y: 5.2, width: 0.4, height: 1.6 },
      meta: { los: 'Blocking' } as any,
    } as any);

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target',
        position: { x: 8, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: true,
      enforceArcValidation: false,
    });

    expect(result.handRequirementFailed).toBeFalsy();
  });

  it('tracks target marker placement/removal through indirect resolution', () => {
    setRoller(() => Array(20).fill(6));
    const weapon = { name: 'Marker Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: 'target-location',
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
    });

    expect(result.targetMarker).toEqual({
      placed: true,
      removed: true,
      placedPosition: { x: 6, y: 6 },
      removedPosition: result.finalPosition,
    });
  });

  it('uses desired direction as biased scatter axis for indirect misses', () => {
    const weapon = { name: 'Biased Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '2', or: 6, traits: ['AoE', 'Scatter'] };
    const attacker = new Character(makeProfile('Attacker', {}, [weapon]));
    const target = new Character(makeProfile('Target'));
    const manager = new GameManager([attacker, target], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 6 });
    manager.placeCharacter(target, { x: 6, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 10, {
      target: {
        id: target.id,
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? 3),
        siz: target.finalAttributes.siz ?? 3,
      },
      scatterBias: 'biased',
      directionRoll: 1,
      scatterDesiredDirection: { x: 6, y: 10 },
      knownAtInitiativeStart: true,
    });

    expect(result.hitTestResult.pass).toBe(false);
    expect(result.scatterResult).toBeDefined();
    expect(result.scatterResult?.finalPosition.x).toBeCloseTo(6, 5);
    expect(result.scatterResult?.finalPosition.y).toBeGreaterThan(6);
  });

  it('applies non-Frag AoE damage flow to all base-contact targets', () => {
    setRoller(() => Array(20).fill(6));
    const weapon = { name: 'Blast Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 1, dmg: '3', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', { rca: 4 }, [weapon]));
    const targetA = new Character(makeProfile('Target A'));
    const targetB = new Character(makeProfile('Target B', { siz: 6, for: 1 }));
    targetB.finalAttributes.siz = 6;
    targetB.attributes.siz = 6;
    const manager = new GameManager([attacker, targetA, targetB], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(targetA, { x: 6, y: 6 });
    manager.placeCharacter(targetB, { x: 7, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: targetA.id,
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(targetA.finalAttributes.siz ?? 3),
        siz: targetA.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: true,
    });

    expect(result.hitTestResult.pass).toBe(true);
    const damagedIds = result.damageResults.map(entry => entry.targetId).sort();
    expect(damagedIds).toEqual([targetA.id, targetB.id].sort());
  });

  it('resolves AoE traits before single-target fallback when targetCharacter is provided', () => {
    setRoller(() => Array(20).fill(6));
    const weapon = { name: 'Status Blast', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '6', or: 6, traits: ['AoE', 'Confuse 1'] };
    const attacker = new Character(makeProfile('Attacker', { rca: 5 }, [weapon]));
    const targetA = new Character(makeProfile('Target A'));
    const targetB = new Character(makeProfile('Target B', { siz: 6 }));
    targetB.finalAttributes.siz = 6;
    targetB.attributes.siz = 6;
    const manager = new GameManager([attacker, targetA, targetB], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(targetA, { x: 6, y: 6 });
    manager.placeCharacter(targetB, { x: 7, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: targetA.id,
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(targetA.finalAttributes.siz ?? 3),
        siz: targetA.finalAttributes.siz ?? 3,
      },
      targetCharacter: targetA,
      knownAtInitiativeStart: true,
    });

    const damagedIds = result.damageResults.map(entry => entry.targetId).sort();
    expect(damagedIds).toEqual([targetA.id, targetB.id].sort());
    expect(targetA.state.statusTokens.Confused || 0).toBeGreaterThan(0);
    expect(targetB.state.statusTokens.Confused || 0).toBeGreaterThan(0);
  });

  it('uses unopposed damage flow for non-Frag AoE targets', () => {
    setRoller(() => Array(40).fill(6));
    const weapon = { name: 'Heavy Blast', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 0, dmg: '6', or: 6, traits: ['AoE'] };
    const attacker = new Character(makeProfile('Attacker', { rca: 6 }, [weapon]));
    const targetNormal = new Character(makeProfile('Target A'));
    const targetHighFor = new Character(makeProfile('Target B', { for: 12, siz: 6 }));
    targetHighFor.finalAttributes.siz = 6;
    targetHighFor.attributes.siz = 6;
    const manager = new GameManager([attacker, targetNormal, targetHighFor], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(targetNormal, { x: 6, y: 6 });
    manager.placeCharacter(targetHighFor, { x: 7, y: 6 });

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: targetNormal.id,
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(targetNormal.finalAttributes.siz ?? 3),
        siz: targetNormal.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: true,
    });

    const damagedIds = result.damageResults.map(entry => entry.targetId);
    expect(damagedIds).toContain(targetNormal.id);
    expect(damagedIds).toContain(targetHighFor.id);
    expect(targetHighFor.state.wounds).toBeGreaterThan(0);
  });

  it('applies Frag only to targets that fail Frag hit tests', () => {
    setRoller(() => Array(20).fill(6));
    const weapon = { name: 'Frag Grenade', classification: 'Thrown', class: 'Thrown', type: 'Ranged', bp: 0, impact: 1, dmg: '3', or: 6, traits: ['Frag'] };
    const attacker = new Character(makeProfile('Attacker', { rca: 4 }, [weapon]));
    const clearTarget = new Character(makeProfile('Clear Target'));
    const blockedTarget = new Character(makeProfile('Blocked Target', { siz: 6, for: 1 }));
    blockedTarget.finalAttributes.siz = 6;
    blockedTarget.attributes.siz = 6;
    const manager = new GameManager([attacker, clearTarget, blockedTarget], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(clearTarget, { x: 6, y: 6 });
    manager.placeCharacter(blockedTarget, { x: 7, y: 6 });
    battlefield.addTerrain({
      id: 'frag-los-blocker',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 5.2, y: 4.5 },
        { x: 5.9, y: 4.5 },
        { x: 5.9, y: 5.1 },
        { x: 5.2, y: 5.1 },
      ],
      meta: { los: 'Blocking' } as any,
    } as any);

    const result = manager.executeIndirectAttack(attacker, weapon as any, 1, {
      target: {
        id: clearTarget.id,
        position: { x: 6, y: 6 },
        baseDiameter: getBaseDiameterFromSiz(clearTarget.finalAttributes.siz ?? 3),
        siz: clearTarget.finalAttributes.siz ?? 3,
      },
      knownAtInitiativeStart: true,
    });

    expect(result.hitTestResult.pass).toBe(true);
    const damagedIds = result.damageResults.map(entry => entry.targetId);
    expect(damagedIds.length).toBe(1);
    expect([clearTarget.id, blockedTarget.id]).toContain(damagedIds[0]);
  });
});

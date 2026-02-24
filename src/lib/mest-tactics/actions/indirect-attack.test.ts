import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { GameManager } from '../engine/GameManager';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { setRoller, resetRoller } from '../subroutines/dice-roller';
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
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import { GameManager } from '../engine/GameManager';
import { setRoller, resetRoller } from '../subroutines/dice-roller';
import type { Profile } from '../core/Profile';

const makeProfile = (name: string, attrs: any = {}, traits: any[] = [], items: any[] = []): Profile => ({
  name,
  archetype: { attributes: { cca: 2, rca: 2, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 3, siz: 3, ...attrs } },
  items,
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
  finalTraits: traits,
  allTraits: traits,
});

describe('KOd attacks in combat actions', () => {
  let battlefield: Battlefield;

  beforeEach(() => {
    battlefield = new Battlefield(12, 12);
    setRoller(() => Array(20).fill(6));
  });

  afterEach(() => {
    resetRoller();
  });

  it('blocks ranged attacks against KOd targets when disabled', () => {
    const weapon = { name: 'Test Rifle', classification: 'Ranged', class: 'Ranged', type: 'Ranged', bp: 0, impact: 0, dmg: '5', accuracy: '0', traits: [] };
    const attacker = new Character(makeProfile('Attacker', {}, [], [weapon]));
    const defender = new Character(makeProfile('Defender', {}, [], []));
    defender.state.isKOd = true;
    attacker.state.isPanicked = true;

    const manager = new GameManager([attacker, defender], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(defender, { x: 6, y: 2 });

    const result = manager.executeRangedAttack(attacker, defender, weapon as any);
    expect(result.result.hit).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('eliminates KOd targets when enabled (ranged)', () => {
    const weapon = { name: 'Test Rifle', classification: 'Ranged', class: 'Ranged', type: 'Ranged', bp: 0, impact: 0, dmg: '5', accuracy: '0', traits: [] };
    const attacker = new Character(makeProfile('Attacker', {}, [], [weapon]));
    const defender = new Character(makeProfile('Defender', {}, [], []));
    defender.state.isKOd = true;
    attacker.state.isPanicked = true;

    const manager = new GameManager([attacker, defender], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(defender, { x: 6, y: 2 });
    manager.allowKOdAttacks = true;

    const result = manager.executeRangedAttack(attacker, defender, weapon as any);
    expect(result.result?.hit).toBe(true);
    expect(defender.state.isEliminated).toBe(true);
    expect(defender.state.isKOd).toBe(false);
  });

  it('auto-hits KOd targets in close combat when enabled', () => {
    const weapon = { name: 'Test Blade', classification: 'Melee', class: 'Melee', type: 'Melee', bp: 0, impact: 0, dmg: '5', traits: [] };
    const attacker = new Character(makeProfile('Attacker', {}, [], [weapon]));
    const defender = new Character(makeProfile('Defender', {}, [], []));
    defender.state.isKOd = true;
    attacker.state.isPanicked = true;

    const manager = new GameManager([attacker, defender], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(defender, { x: 3, y: 2 });
    manager.allowKOdAttacks = true;

    const result = manager.executeCloseCombatAttack(attacker, defender, weapon as any);
    expect(result?.result?.hit).toBe(true);
    expect(defender.state.isEliminated).toBe(true);
  });
});

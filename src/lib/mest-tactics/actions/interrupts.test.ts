import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameManager } from '../engine/GameManager';
import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { setRoller, resetRoller } from '../subroutines/dice-roller';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';
import type { Profile } from '../core/Profile';

const makeProfile = (name: string, attrs: { cca: number; rca: number; ref: number; int: number; pow: number; str: number; for: number; mov: number; siz: number }, traits: string[] = []): Profile => ({
  name,
  archetype: { attributes: attrs },
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
});

describe('interrupt execution', () => {
  let battlefield: Battlefield;
  let manager: GameManager;

  beforeEach(() => {
    battlefield = new Battlefield(12, 12);
  });

  afterEach(() => {
    resetRoller();
  });

  it('should execute Counter-strike and apply damage', () => {
    setRoller(() => Array(10).fill(6));
    const attacker = new Character(makeProfile('Attacker', { cca: 1, rca: 1, ref: 2, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));
    const defender = new Character(makeProfile('Defender', { cca: 1, rca: 1, ref: 3, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }, ['Counter-strike!']));
    defender.profile.finalTraits = ['Counter-strike!'];
    defender.profile.allTraits = ['Counter-strike!'];

    manager = new GameManager([attacker, defender], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(defender, { x: 3, y: 2 });

    const weapon = {
      name: 'Test Blade',
      classification: 'Melee',
      class: 'Melee',
      type: 'Melee',
      bp: 0,
      impact: 0,
      dmg: '10',
      traits: [],
    };

    const hitTestResult = {
      score: -1,
      pass: false,
      cascades: 0,
      p1FinalScore: 1,
      p2FinalScore: 2,
      p1Result: { score: 1, carryOverDice: { base: 0, modifier: 0, wild: 0 } },
      p2Result: { score: 2, carryOverDice: { base: 1, modifier: 0, wild: 0 } },
    };

    const result = manager.executeCounterStrike(defender, attacker, weapon as any, hitTestResult as any);
    expect(result.executed).toBe(true);
    expect(attacker.state.wounds).toBeGreaterThan(0);
    expect(defender.state.delayTokens).toBe(1);
  });

  it('should execute Counter-fire when requirements are met', () => {
    setRoller(() => Array(10).fill(6));
    const attacker = new Character(makeProfile('Attacker', { cca: 1, rca: 1, ref: 1, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));
    const defender = new Character(makeProfile('Defender', { cca: 1, rca: 1, ref: 3, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));

    manager = new GameManager([attacker, defender], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(defender, { x: 7, y: 2 });

    const weapon = {
      name: 'Test Rifle',
      classification: 'Range',
      class: 'Range',
      type: 'Ranged',
      bp: 0,
      impact: 0,
      dmg: '10',
      traits: [],
    };

    const hitTestResult = {
      score: -2,
      pass: false,
      cascades: 0,
      p1FinalScore: 1,
      p2FinalScore: 3,
      p1Result: { score: 1, carryOverDice: { base: 0, modifier: 0, wild: 0 } },
      p2Result: { score: 3, carryOverDice: { base: 1, modifier: 0, wild: 0 } },
    };

    const result = manager.executeCounterFire(defender, attacker, weapon as any, hitTestResult as any, { visibilityOrMu: 16 });
    expect(result.executed).toBe(true);
    expect(attacker.state.wounds).toBeGreaterThan(0);
    expect(defender.state.delayTokens).toBe(1);
  });

  it('should enforce declared weapon for Counter-fire attacks', () => {
    setRoller(() => Array(10).fill(6));
    const attacker = new Character(makeProfile('Attacker', { cca: 1, rca: 1, ref: 1, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));
    const defender = new Character(makeProfile('Defender', { cca: 1, rca: 1, ref: 3, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));

    const declaredWeapon = {
      name: 'Declared Blank',
      classification: 'Range',
      class: 'Range',
      type: 'Ranged',
      bp: 0,
      impact: 0,
      dmg: '-', // no damage test when declared weapon is enforced
      traits: [],
    };
    defender.profile.items = [declaredWeapon as any];
    defender.state.activeWeaponIndex = 0;

    manager = new GameManager([attacker, defender], battlefield);
    manager.placeCharacter(attacker, { x: 2, y: 2 });
    manager.placeCharacter(defender, { x: 7, y: 2 });

    const fallbackWeapon = {
      name: 'Fallback Damage Weapon',
      classification: 'Range',
      class: 'Range',
      type: 'Ranged',
      bp: 0,
      impact: 0,
      dmg: '10',
      traits: [],
    };

    const hitTestResult = {
      score: -2,
      pass: false,
      cascades: 0,
      p1FinalScore: 1,
      p2FinalScore: 3,
      p1Result: { score: 1, carryOverDice: { base: 0, modifier: 0, wild: 0 } },
      p2Result: { score: 3, carryOverDice: { base: 1, modifier: 0, wild: 0 } },
    };

    const result = manager.executeCounterFire(defender, attacker, fallbackWeapon as any, hitTestResult as any, { visibilityOrMu: 16 });
    expect(result.executed).toBe(true);
    expect(attacker.state.wounds).toBe(0);
  });

  it('should resolve Counter-action cascades from carry-overs', () => {
    const attacker = new Character(makeProfile('Attacker', { cca: 1, rca: 1, ref: 1, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));
    const defender = new Character(makeProfile('Defender', { cca: 1, rca: 1, ref: 2, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));

    manager = new GameManager([attacker, defender], battlefield);

    const hitTestResult = {
      score: -1,
      pass: false,
      cascades: 0,
      p1FinalScore: 1,
      p2FinalScore: 2,
      p1Result: { score: 1, carryOverDice: { base: 0, modifier: 0, wild: 0 } },
      p2Result: { score: 2, carryOverDice: { base: 1, modifier: 0, wild: 0 } },
    };

    const result = manager.executeCounterAction(defender, attacker, hitTestResult as any, { carryOverRolls: [6] });
    expect(result.executed).toBe(true);
    expect(result.bonusActionCascades).toBe(2);
    expect(defender.state.delayTokens).toBe(1);
  });

  it('should execute Counter-charge to engage the mover', () => {
    const mover = new Character(makeProfile('Mover', { cca: 1, rca: 1, ref: 1, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));
    const observer = new Character(makeProfile('Observer', { cca: 1, rca: 1, ref: 3, int: 0, pow: 0, str: 1, for: 1, mov: 3, siz: 3 }));

    manager = new GameManager([mover, observer], battlefield);
    manager.placeCharacter(mover, { x: 6, y: 2 });
    manager.placeCharacter(observer, { x: 3, y: 2 });

    const result = manager.executeCounterCharge(observer, mover, { visibilityOrMu: 16, moveApSpent: 2 });
    expect(result.executed).toBe(true);
    const observerPos = manager.getCharacterPosition(observer);
    const moverPos = manager.getCharacterPosition(mover);
    expect(observerPos).toBeDefined();
    expect(moverPos).toBeDefined();
    if (observerPos && moverPos) {
      const engaged = SpatialRules.isEngaged(
        { id: observer.id, position: observerPos, baseDiameter: 1 },
        { id: mover.id, position: moverPos, baseDiameter: 1 }
      );
      expect(engaged).toBe(true);
    }
  });
});


import { describe, it, expect, beforeEach } from 'vitest';
import { makeCloseCombatAttack } from './close-combat';
import { DiceType } from './dice-roller';
import type { Profile } from './Profile';
import type { Item } from './Item';
import { Character } from './Character';
import { gameData } from '../data';

const { archetypes, melee_weapons, armors } = gameData;

describe('makeCloseCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(() => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };
    attackerWeapon = { name: "Sword, Broad", ...melee_weapons["Sword, Broad"] };
    const defenderArmor = { name: "Armor, Medium Mail", ...armors["Armor, Medium Mail"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [defenderArmor] };

    attacker = new Character(attackerProfile);
    attacker.finalAttributes = attacker.attributes;
    defender = new Character(defenderProfile);
    defender.finalAttributes = defender.attributes;
  });

  it('should force a successful hit and create a damage resolution', () => {
    const context = { forceHit: true };
    const attackerHitRolls: number[] = [1,1];
    const defenderHitRolls: number[] = [1,1];
    const attackerDamageRolls = [5, 5];
    const defenderDamageRolls = [1, 1];

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context, attackerHitRolls, defenderHitRolls, attackerDamageRolls, defenderDamageRolls);
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
    expect(result.damageResolution.woundsAdded).toBe(2);
  });

  it('should pass the hit test and create a damage resolution', () => {
    const context = {};
    const attackerHitRolls = [6, 6];
    const defenderHitRolls = [1, 1];
    const attackerDamageRolls = [5, 5];
    const defenderDamageRolls = [1, 1];

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context, attackerHitRolls, defenderHitRolls, attackerDamageRolls, defenderDamageRolls);
    expect(result.hit).toBe(true);
    expect(result.hitTestResult.score).toBe(6);
    expect(result.damageResolution).toBeDefined();
  });

  it('should fail the hit test and not create a damage resolution', () => {
    const context = {};
    const attackerHitRolls = [1, 1];
    const defenderHitRolls = [6, 6];
    const attackerDamageRolls: number[] = [];
    const defenderDamageRolls: number[] = [];

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context, attackerHitRolls, defenderHitRolls, attackerDamageRolls, defenderDamageRolls);
    expect(result.hit).toBe(false);
    expect(result.hitTestResult.score).toBe(-2);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a bonus die to the attacker for a Charge', () => {
    const context = { isCharge: true };
    const attackerHitRolls = [1, 1, 1];
    const defenderHitRolls = [1, 1];
    const attackerDamageRolls: number[] = [];
    const defenderDamageRolls: number[] = [];

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context, attackerHitRolls, defenderHitRolls, attackerDamageRolls, defenderDamageRolls);
    expect(result.hitTestResult.p1Result.carryOverDice[DiceType.Modifier] || 0).toBe(0);
  });

  it('should add a bonus die to the defender for Defending', () => {
    const context = { isDefending: true };
    const attackerHitRolls = [1, 1];
    const defenderHitRolls = [1, 1, 1];
    const attackerDamageRolls: number[] = [];
    const defenderDamageRolls: number[] = [];

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context, attackerHitRolls, defenderHitRolls, attackerDamageRolls, defenderDamageRolls);
    expect(result.hitTestResult.p2Result.carryOverDice[DiceType.Base] || 0).toBe(0);
  });

  it('should correctly apply impact modifier from assisting models', () => {
    const context = { forceHit: true, assistingModels: 2 };
    const attackerHitRolls: number[] = [1,1];
    const defenderHitRolls: number[] = [1,1];
    const attackerDamageRolls = [1, 1, 1, 1];
    const defenderDamageRolls = [1, 1];

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context, attackerHitRolls, defenderHitRolls, attackerDamageRolls, defenderDamageRolls);
    expect(result.damageResolution.impact).toBe(3);
  });
});

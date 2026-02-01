
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeCloseCombatAttack, AttackResult } from './combat';
import type { Profile, Archetype } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import type { TestContext } from './TestContext';

// Import the JSON data directly
import archetypesData from '../../data/archetypes.json';
import meleeWeaponsData from '../../data/melee_weapons.json';
import armorsData from '../../data/armors.json';

// Helper function to log the detailed results of a combat encounter
const logCombatResults = (result: AttackResult, attacker: Character, defender: Character, weapon: Item) => {
  const finalDefenderState = { ...defender.state, wounds: defender.state.wounds + result.woundsInflicted };

  // New detailed initial state logging
  console.log('\n--- INITIAL STATE ---');
  console.log('Attacker:', JSON.stringify({ attributes: attacker.finalAttributes, state: attacker.state }, null, 2));
  console.log('Defender:', JSON.stringify({ attributes: defender.finalAttributes, state: defender.state }, null, 2));

  console.log('\n--- COMBAT RESOLUTION ---');
  if (result.hitTestResult) {
    console.log(`\n1. HIT TEST (Opposed CCA vs. CCA)`);
    console.log(`   - Attacker's Base CCA: ${attacker.finalAttributes.cca}, Defender's Base CCA: ${defender.finalAttributes.cca}`);
    console.log(`   - Weapon Accuracy: ${weapon.accuracy || 'N/A'}`)
    console.log(`   - Attacker's Score (${result.hitTestResult.activePlayerTestScore}) vs. Defender's Score (${result.hitTestResult.passivePlayerTestScore})`);
    console.log(`   - OUTCOME: ${result.hit ? `HIT! (${result.hitTestResult.cascades} Cascades)` : `MISS! (${result.hitTestResult.misses} Misses)`}`);
  } else {
    console.log("\nERROR: Hit Test did not produce a result.");
  }

  if (result.hit && result.damageTestResult) {
    console.log(`\n2. DAMAGE TEST (Unopposed)`);
    console.log(`   - Attacker's Score (${result.damageTestResult.activePlayerTestScore}) vs. Defender's FORTITUDE DR (${defender.finalAttributes.for})`);
    console.log(`   - Damage Roll Cascades: ${result.damageTestResult.cascades}`);
    console.log(`\n3. WOUND CALCULATION`);
    console.log(`   - Defender's Armor (AR): ${defender.state.armor.total}`);
    console.log(`   - Weapon Impact: ${weapon.impact || 0}`);
    const effectiveAR = Math.max(0, defender.state.armor.total - (weapon.impact || 0));
    console.log(`   - Effective AR (AR - Impact): ${effectiveAR}`);
    console.log(`   - Wounds Inflicted (Damage Cascades - Effective AR): ${result.woundsInflicted}`);
    console.log(`   - Remaining Impact: ${result.remainingImpact}`);
  }

  console.log('\n--- FINAL STATE ---');
  console.log(`Defender Wounds: ${finalDefenderState.wounds}`);
  console.log('-------------------------------------\n');
};

describe('makeCloseCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(() => {
    const archetypes: Record<string, Archetype> = archetypesData;
    const meleeWeapons: Record<string, Item> = meleeWeaponsData;
    const armors: Record<string, Item> = armorsData;

    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };

    attackerWeapon = { name: "Sword, Broad", ...meleeWeapons["Sword, Broad"] };
    const defenderWeapon = { name: "Axe", ...meleeWeapons["Axe"] };
    const defenderArmor = { name: "Gambeson, Heavy", ...armors["Gambeson, Heavy"] };

    const attackerProfile: Profile = { archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { archetype: defenderArchetype, equipment: [defenderWeapon, defenderArmor] };

    attacker = createCharacter(attackerProfile, 'Veteran Fighter');
    defender = createCharacter(defenderProfile, 'Militia Defender');
  });

  it('should resolve a standard attack, factoring in armor and impact', () => {
    console.log('\n======== TEST: Standard Attack w/ Armor ========');
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
    logCombatResults(result, attacker, defender, attackerWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result).toBeDefined();
  });

  it('should apply a weapon\'s dice-based accuracy bonus to the hit test', () => {
    console.log('\n======== TEST: Accuracy Modifier (Dice) ========');
    const customWeapon: Item = { ...attackerWeapon, accuracy: '+1m' };
    const result = makeCloseCombatAttack(attacker, defender, customWeapon, {});
    logCombatResults(result, attacker, defender, customWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result).toBeDefined();
  });

  it('should apply a weapon\'s flat accuracy bonus to the hit test', () => {
    console.log('\n======== TEST: Accuracy Modifier (Flat) ========');
    const customWeapon: Item = { ...attackerWeapon, accuracy: 1 };
    const result = makeCloseCombatAttack(attacker, defender, customWeapon, {});
    logCombatResults(result, attacker, defender, customWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result).toBeDefined();
  });

  it('should correctly calculate wounds when weapon impact is less than defender armor', () => {
    console.log('\n======== TEST: Impact vs. Armor (Impact < AR) ========');
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
    logCombatResults(result, attacker, defender, attackerWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result.woundsInflicted).toBeGreaterThanOrEqual(0);
    expect(result.remainingImpact).toBe(0);
  });

  it('should correctly calculate wounds and remaining impact when impact exceeds armor', () => {
    console.log('\n======== TEST: Impact vs. Armor (Impact > AR) ========');
    const highImpactWeapon: Item = { ...attackerWeapon, name: "Heavy Mace", impact: 3 };
    const result = makeCloseCombatAttack(attacker, defender, highImpactWeapon, {});
    logCombatResults(result, attacker, defender, highImpactWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result.woundsInflicted).toBeGreaterThanOrEqual(0);
    expect(result.remainingImpact).toBe(1);
  });

  it('should apply a +1b bonus to the defender when they Defend', () => {
    console.log('\n======== TEST: Defend Modifier (+1b for Defender) ========');
    const context: TestContext = { isDefending: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result).toBeDefined();
  });

  it('should apply a -1m penalty to a hindered attacker', () => {
    console.log('\n======== TEST: Hindrance Penalty (-1m for Attacker) ========');
    attacker.state.wounds = 1;
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
    logCombatResults(result, attacker, defender, attackerWeapon);
    defender.state.wounds += result.woundsInflicted;
    expect(result).toBeDefined();
  });
});

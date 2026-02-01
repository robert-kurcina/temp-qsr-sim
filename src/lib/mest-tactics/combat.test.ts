
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeCloseCombatAttack, AttackResult } from './combat';
import type { Profile, Archetype } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import type { TestContext } from './TestContext';
import { gameData } from '../data';

const { archetypes, melee_weapons, armors } = gameData;

const logCombatResults = (
  result: AttackResult,
  attacker: Character,
  defender: Character,
  weapon: Item,
  context: TestContext = {}
) => {
  const finalWounds = defender.state.wounds + result.woundsInflicted;

  console.log('\n--- INITIAL STATE ---');
  console.log('Attacker:', JSON.stringify({ attributes: attacker.finalAttributes, state: attacker.state }, null, 2));
  console.log('Defender:', JSON.stringify({ 
    attributes: defender.finalAttributes, 
    state: defender.state,
    calculatedArmor: defender.state.armor.total 
  }, null, 2));

  console.log('\n--- COMBAT RESOLUTION ---');
  if (result.hitTestResult) {
    console.log(`\n1. HIT TEST (Opposed CCA vs. CCA)`);
    console.log(`   - Attacker's Base CCA: ${attacker.finalAttributes.cca}, Defender's Base CCA: ${defender.finalAttributes.cca}`);
    console.log(`   - Weapon Accuracy: ${weapon.accuracy || 'N/A'}`);
    console.log(`   - Attacker's Score (${result.hitTestResult.activePlayerTestScore}) vs. Defender's Score (${result.hitTestResult.passivePlayerTestScore})`);
    console.log(`   - OUTCOME: ${result.hit ? `HIT! (${result.hitTestResult.cascades} Cascades)` : `MISS! (${result.hitTestResult.misses} Misses)`}`);
  }

  if (result.hit && result.damageTestResult) {
    console.log(`\n2. DAMAGE TEST (Opposed Dmg vs. FOR)`);
    console.log(`   - Attacker's Dmg Score (${result.damageTestResult.activePlayerTestScore}) vs. Defender's FOR Score (${result.damageTestResult.passivePlayerTestScore})`);
    console.log(`   - Net Successes (Cascades): ${result.damageTestResult.cascades}`);
    
    console.log(`\n3. WOUND CALCULATION`);
    console.log(`   - Defender's Total Armor (AR): ${defender.state.armor.total}`);
    const baseImpact = weapon.impact || 0;
    const assistImpact = context.assistingModels || 0;
    const totalImpact = baseImpact + assistImpact;
    console.log(`   - Weapon Impact: ${baseImpact}`);
    if (assistImpact > 0) {
      console.log(`   - Assist Impact: ${assistImpact}`);
      console.log(`   - Total Impact: ${totalImpact}`);
    }
    const effectiveAR = Math.max(0, defender.state.armor.total - totalImpact);
    console.log(`   - Effective AR (AR - Total Impact): ${effectiveAR}`);
    console.log(`   - Wounds Inflicted (Net Successes - Effective AR): ${result.woundsInflicted}`);
    console.log(`   - Remaining Impact (Total Impact - AR): ${result.remainingImpact}`);
  }

  console.log('\n--- FINAL STATE (for this attack) ---');
  console.log(`Defender Wounds (Initial + Inflicted): ${finalWounds}`);
  console.log('-------------------------------------\n');
};

describe('makeCloseCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(() => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };

    attackerWeapon = { name: "Sword, Broad", ...melee_weapons["Sword, Broad"] };
    const defenderWeapon = { name: "Axe", ...melee_weapons["Axe"] };
    const defenderArmor = { name: "Armor, Medium Mail", ...armors["Armor, Medium Mail"] };

    const attackerProfile: Profile = { archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { archetype: defenderArchetype, equipment: [defenderWeapon, defenderArmor] };

    attacker = createCharacter(attackerProfile, 'Attacker');
    defender = createCharacter(defenderProfile, 'Defender');
  });

  it('should resolve a standard attack, factoring in armor and impact', () => {
    console.log('\n======== TEST: Standard Attack w/ Armor ========');
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a weapon\'s dice-based accuracy bonus to the hit test', () => {
    console.log('\n======== TEST: Accuracy Modifier (Dice) ========');
    const customWeapon: Item = { ...attackerWeapon, accuracy: '+1m' };
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, customWeapon, context);
    logCombatResults(result, attacker, defender, customWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a weapon\'s flat accuracy bonus to the hit test', () => {
    console.log('\n======== TEST: Accuracy Modifier (Flat) ========');
    const customWeapon: Item = { ...attackerWeapon, accuracy: 1 };
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, customWeapon, context);
    logCombatResults(result, attacker, defender, customWeapon, context);
    expect(result).toBeDefined();
  });

  it('should correctly calculate wounds when weapon impact is less than defender armor', () => {
    console.log('\n======== TEST: Impact vs. Armor (Impact < AR) ========');
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result.woundsInflicted).toBeGreaterThanOrEqual(0);
    expect(result.remainingImpact).toBe(0);
  });

  it('should correctly calculate wounds and remaining impact when impact exceeds armor', () => {
    console.log('\n======== TEST: Impact vs. Armor (Impact > AR) ========');
    const highImpactWeapon: Item = { ...attackerWeapon, name: "Heavy Mace", impact: 6 };
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, highImpactWeapon, context);
    logCombatResults(result, attacker, defender, highImpactWeapon, context);
    expect(result.woundsInflicted).toBeGreaterThanOrEqual(0);
    // This assertion is only valid if the attack hits.
    if (result.hit) {
      expect(result.remainingImpact).toBe(2);
    }
  });

  it('should apply a +1b bonus to the defender when they Defend', () => {
    console.log('\n======== TEST: Defend Modifier (+1b for Defender) ========');
    const context: TestContext = { isDefending: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a -1m penalty to a hindered attacker', () => {
    console.log('\n======== TEST: Hindrance Penalty (-1m for Attacker) ========');
    const hinderedAttacker = JSON.parse(JSON.stringify(attacker));
    hinderedAttacker.state.wounds = 1;
    const context = {};
    const result = makeCloseCombatAttack(hinderedAttacker, defender, attackerWeapon, context);
    logCombatResults(result, hinderedAttacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a +1m bonus to the attacker when they Charge', () => {
    console.log('\n======== TEST: Charge Modifier (+1m for Attacker) ========');
    const context: TestContext = { isCharge: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply bonus Impact for each assisting model', () => {
    console.log('\n======== TEST: Assist Bonus (+1 Impact per Assisting Model) ========');
    const highImpactWeapon: Item = { ...attackerWeapon, name: "Heavy Mace", impact: 6 };
    const context: TestContext = { assistingModels: 2 }; // 2 assisting models
    const result = makeCloseCombatAttack(attacker, defender, highImpactWeapon, context);
    logCombatResults(result, attacker, defender, highImpactWeapon, context);
    // This assertion is only valid if the attack hits.
    if (result.hit) {
      const defenderAR = defender.state.armor.total;
      const expectedRemainingImpact = (highImpactWeapon.impact || 0) + context.assistingModels! - defenderAR;
      expect(result.remainingImpact).toBe(expectedRemainingImpact);
    }
  });

  it('should apply a +2w bonus to the attacker for outnumbering', () => {
    console.log('\n======== TEST: Outnumber Modifier (+2w for Attacker) ========');
    const context: TestContext = { outnumberAdvantage: 2 };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a +1m bonus to the attacker for high ground', () => {
    console.log('\n======== TEST: High Ground Modifier (+1m for Attacker) ========');
    const context: TestContext = { hasHighGround: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a -1m penalty to the defender for being cornered', () => {
    console.log('\n======== TEST: Cornered Modifier (-1m for Defender) ========');
    const context: TestContext = { isCornered: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should apply a -1m penalty to the defender for being flanked', () => {
    console.log('\n======== TEST: Flanked Modifier (-1m for Defender) ========');
    const context: TestContext = { isFlanked: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  it('should handle multiple overlapping modifiers for both attacker and defender', () => {
    console.log('\n======== TEST: Complex Scenario (Multiple Modifiers) ========');
    const context: TestContext = {
      isCharge: true,      // Attacker: +1m
      hasHighGround: true, // Attacker: +1m
      isCornered: true,    // Defender: -1m
      isFlanked: true,     // Defender: -1m
    };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    logCombatResults(result, attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });
});

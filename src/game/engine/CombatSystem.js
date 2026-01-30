// /src/engine/CombatSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * MEST QSR Combat Resolution System
 */
export class CombatSystem {
  constructor(models, tokenManager, battlefieldSizeMU) {
    this.models = models;
    this.tokenManager = tokenManager;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.coverSystem = new CoverSystem([], models); // Will be updated with terrain
    this.elevationSystem = new ElevationSystem([]);
  }
  
  /**
   * Resolve combat between attacker and defender
   */
  resolveCombat(attacker, defender, weapon, options = {}) {
    const result = {
      success: false,
      hit: false,
      damage: false,
      effects: [],
      rolls: {},
      modifiers: {}
    };
    
    // Get attacker and defender profiles
    const attackerProfile = attacker.profile || {};
    const defenderProfile = defender.profile || {};
    
    // Calculate range and determine combat type
    const distance = this.calculateDistance(attacker.position, defender.position);
    const isMelee = distance <= 1; // 1 MU melee range
    
    // Validate combat attempt
    if (isMelee && !this.isEngaged(attacker, defender)) {
      result.effects.push('Not engaged in melee');
      return result;
    }
    
    if (!isMelee && this.isEngaged(attacker)) {
      result.effects.push('Cannot make ranged attacks while engaged');
      return result;
    }
    
    // Determine test type
    const testType = isMelee ? 'CCA' : 'RCA';
    const attackerStat = attackerProfile[testType] || 0;
    const defenderStat = defenderProfile.REF || 0;
    
    // Calculate modifiers
    const modifiers = this.calculateCombatModifiers(attacker, defender, isMelee);
    result.modifiers = modifiers;
    
    // Roll Hit Test
    const hitTest = this.rollHitTest(attackerStat, modifiers.hit);
    result.rolls.hit = hitTest;
    result.hit = hitTest.success;
    
    if (!hitTest.success) {
      result.effects.push('Attack missed');
      return result;
    }
    
    // Roll Damage Test
    const damageTest = this.rollDamageTest(defenderStat, modifiers.damage);
    result.rolls.damage = damageTest;
    result.damage = damageTest.success;
    
    if (damageTest.success) {
      // Apply Wound token
      this.tokenManager.addToken(defender.id, 'wound');
      result.effects.push('Wound applied');
      
      // Trigger Fear Test (QSR Page 26)
      const fearResult = this.resolveFearTest(defender);
      if (fearResult.fearTokens > 0) {
        result.effects.push(`Fear: ${fearResult.fearTokens} tokens`);
      }
    } else {
      result.effects.push('Target avoided damage');
    }
    
    result.success = true;
    return result;
  }
  
  /**
   * Calculate distance between two positions
   */
  calculateDistance(posA, posB) {
    return Math.sqrt(
      Math.pow(posA.x - posB.x, 2) +
      Math.pow(posA.y - posB.y, 2)
    );
  }
  
  /**
   * Check if models are engaged in melee
   */
  isEngaged(model, target = null) {
    const meleeRange = 1; // 1 MU
    
    for (const other of this.models) {
      if (other.side !== model.side && other.id !== model.id) {
        if (target && other.id !== target.id) continue;
        
        const distance = this.calculateDistance(model.position, other.position);
        if (distance <= meleeRange) {
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Calculate combat modifiers
   */
  calculateCombatModifiers(attacker, defender, isMelee) {
    const modifiers = {
      hit: { total: 0, details: [] },
      damage: { total: 0, details: [] }
    };
    
    // Cover modifiers
    const cover = this.coverSystem.analyzeCover(defender.position, [attacker]);
    if (cover.type === 'hard') {
      modifiers.hit.total -= 3;
      modifiers.hit.details.push('Hard cover (-3)');
    } else if (cover.type === 'soft') {
      modifiers.hit.total -= 2;
      modifiers.hit.details.push('Soft cover (-2)');
    } else if (cover.type === 'partial') {
      modifiers.hit.total -= 1;
      modifiers.hit.details.push('Partial cover (-1)');
    }
    
    // Elevation advantage
    if (this.elevationSystem.hasElevationAdvantage(attacker.position, defender.position)) {
      modifiers.hit.total += 1;
      modifiers.hit.details.push('Elevation advantage (+1)');
    }
    
    // Hindrance modifiers
    const attackerHindrances = this.getHindranceCount(attacker.id);
    const defenderHindrances = this.getHindranceCount(defender.id);
    
    // Attacker penalties
    if (attackerHindrances.delay >= 1) {
      modifiers.hit.total -= 1;
      modifiers.hit.details.push('Distracted (-1)');
    }
    if (attackerHindrances.delay >= 2) {
      modifiers.hit.total -= 1;
      modifiers.hit.details.push('Stunned (-1)');
    }
    if (attackerHindrances.fear >= 1) {
      modifiers.hit.total -= 1;
      modifiers.hit.details.push('Nervous (-1)');
    }
    if (attackerHindrances.fear >= 2) {
      modifiers.hit.total -= 1;
      modifiers.hit.details.push('Disordered (-1)');
    }
    if (attackerHindrances.fear >= 3) {
      modifiers.hit.total -= 1;
      modifiers.hit.details.push('Panicked (-1)');
    }
    
    // Defender bonuses
    if (defenderHindrances.delay >= 2) {
      modifiers.damage.total += 1; // Stunned defenders are easier to damage?
      // Actually, hindrances typically don't help defense
    }
    
    return modifiers;
  }
  
  /**
   * Get hindrance count for model
   */
  getHindranceCount(modelId) {
    const tokens = this.tokenManager.getTokens(modelId);
    const counts = { wound: 0, delay: 0, fear: 0 };
    
    tokens.forEach(token => {
      if (counts.hasOwnProperty(token.type)) {
        counts[token.type]++;
      }
    });
    
    return counts;
  }
  
  /**
   * Roll Hit Test
   */
  rollHitTest(baseStat, modifiers) {
    const targetNumber = baseStat + modifiers.total;
    const roll = this.rollD6();
    const success = roll <= targetNumber;
    
    return {
      roll: roll,
      target: targetNumber,
      modifiers: modifiers,
      success: success
    };
  }
  
  /**
   * Roll Damage Test
   */
  rollDamageTest(defenderREF, modifiers) {
    const targetNumber = defenderREF + modifiers.total;
    const roll = this.rollD6();
    const success = roll > targetNumber; // Damage succeeds on higher roll
    
    return {
      roll: roll,
      target: targetNumber,
      modifiers: modifiers,
      success: success
    };
  }
  
  /**
   * Resolve Fear Test after taking damage
   */
  resolveFearTest(model) {
    const result = { fearTokens: 0, rolls: [] };
    
    // Count existing Fear tokens
    const existingFear = this.getHindranceCount(model.id).fear;
    
    // Fear Test difficulty based on existing Fear tokens
    let difficulty = 0;
    if (existingFear >= 1) difficulty = 2; // Nervous → Disordered
    if (existingFear >= 2) difficulty = 3; // Disordered → Panicked
    if (existingFear >= 3) difficulty = 4; // Panicked → More panicked
    
    if (difficulty === 0) {
      // First Fear token requires no test (automatic)
      this.tokenManager.addToken(model.id, 'fear');
      result.fearTokens = 1;
      return result;
    }
    
    // Roll Fear Test
    const roll = this.rollD6();
    result.rolls.push({ roll: roll, difficulty: difficulty });
    
    if (roll <= difficulty) {
      // Fear test failed - gain another Fear token
      this.tokenManager.addToken(model.id, 'fear');
      result.fearTokens = 1;
    }
    
    return result;
  }
  
  /**
   * Roll D6
   */
  rollD6() {
    return Math.floor(Math.random() * 6) + 1;
  }
  
  /**
   * Get combat summary for logging
   */
  getCombatSummary(result) {
    let summary = '';
    
    if (result.hit) {
      summary += `Hit! (Roll: ${result.rolls.hit.roll}, Target: ${result.rolls.hit.target})\n`;
      if (result.damage) {
        summary += `Damage! (Roll: ${result.rolls.damage.roll}, Target: ${result.rolls.damage.target})\n`;
        summary += result.effects.join('\n');
      } else {
        summary += 'Damage avoided!';
      }
    } else {
      summary += `Missed! (Roll: ${result.rolls.hit.roll}, Target: ${result.rolls.hit.target})`;
    }
    
    return summary;
  }
}
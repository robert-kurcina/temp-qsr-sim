import { DiceRoller } from './DiceRoller.js';
import { CoverSystem } from './CoverSystem.js';
import { ElevationSystem } from './ElevationSystem.js';
import { MELEE_RANGE } from './Constants.js';

export class CombatSystem {
  constructor(models, tokenManager) {
    this.models = models;
    this.tokenManager = tokenManager;
    this.coverSystem = new CoverSystem([], models);
    this.elevationSystem = new ElevationSystem([]);
  }

  resolveCombat(attacker, defender, weapon, options = {}) {
    const result = {
      success: false,
      hit: false,
      damage: false,
      effects: [],
      rolls: {},
      modifiers: {},
    };

    const distance = this.calculateDistance(attacker.position, defender.position);
    const isMelee = distance <= MELEE_RANGE;

    if (isMelee && !this.isEngaged(attacker, defender)) {
      result.effects.push('Not engaged in melee');
      return result;
    }

    if (!isMelee && this.isEngaged(attacker)) {
      result.effects.push('Cannot make ranged attacks while engaged');
      return result;
    }

    const testType = isMelee ? 'CCA' : 'RCA';
    const attackerStat = attacker.character.archetype[testType.toLowerCase()] || 0;
    const defenderStat = defender.character.archetype.ref || 0;

    const attackerDicePool = { base: attackerStat, modifier: 0, wild: 0 };
    const defenderDicePool = { base: defenderStat, modifier: 0, wild: 0 };

    const opposedTestResult = DiceRoller.performOpposedTest(attackerDicePool, defenderDicePool);

    result.rolls.hit = opposedTestResult;
    result.hit = opposedTestResult.success;

    if (!result.hit) {
      result.effects.push('Attack missed');
      return result;
    }
    
    // Simplified damage roll for now
    const damageRoll = Math.floor(Math.random() * 6) + 1;
    const damageSuccess = damageRoll > 3; // Placeholder

    result.rolls.damage = { roll: damageRoll, success: damageSuccess };
    result.damage = damageSuccess;

    if (result.damage) {
      this.tokenManager.addToken(defender.id, 'wound');
      result.effects.push('Wound applied');
    } else {
      result.effects.push('Target avoided damage');
    }

    result.success = true;
    return result;
  }

  calculateDistance(posA, posB) {
    return Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2));
  }

  isEngaged(model, target = null) {
    for (const other of this.models) {
      if (other.side !== model.side && other.id !== model.id) {
        if (target && other.id !== target.id) continue;
        const distance = this.calculateDistance(model.position, other.position);
        if (distance <= MELEE_RANGE) {
          return true;
        }
      }
    }
    return false;
  }
}

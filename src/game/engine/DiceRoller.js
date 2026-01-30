// /src/engine/DiceRoller.js

/**
 * Represents a single die roll result
 */
export class DieResult {
  constructor(value) {
    this.value = value;
    this.isSuccess = value >= 4;
    this.isFailure = value === 1;
  }
}

/**
 * Represents a complete dice pool roll (Base + Modifier)
 */
export class DicePoolResult {
  constructor(baseDice, modifierDice) {
    this.baseDice = baseDice.map(v => new DieResult(v));
    this.modifierDice = modifierDice.map(v => new DieResult(v));
    
    // Count successes/failures
    this.baseSuccesses = this.baseDice.filter(d => d.isSuccess).length;
    this.baseFailures = this.baseDice.filter(d => d.isFailure).length;
    this.modifierSuccesses = this.modifierDice.filter(d => d.isSuccess).length;
    this.modifierFailures = this.modifierDice.filter(d => d.isFailure).length;
    
    // Net result
    this.netSuccesses = Math.max(0, this.baseSuccesses + this.modifierSuccesses - this.baseFailures);
    this.hasAnySuccess = this.netSuccesses > 0;
  }

  /**
   * Get cascade count (extra actions from excess successes)
   * @returns {number}
   */
  getCascades() {
    return Math.max(0, this.netSuccesses - 1);
  }

  /**
   * String representation for debugging
   */
  toString() {
    const baseStr = this.baseDice.map(d => d.value).join('');
    const modStr = this.modifierDice.map(d => d.value).join('');
    return `BD[${baseStr}] MD[${modStr}] → ${this.netSuccesses} successes`;
  }
}

/**
 * Main dice rolling engine for MEST Tactics
 */
export class DiceRoller {
  /**
   * Roll a dice pool with optional Advantage/Disadvantage
   * @param {number} baseDice - Number of Base Dice (BD)
   * @param {number} modifierDice - Number of Modifier Dice (MD)
   * @param {Object} options - { advantage: boolean, disadvantage: boolean }
   * @returns {DicePoolResult}
   */
  static roll(baseDice, modifierDice, options = {}) {
    const { advantage = false, disadvantage = false } = options;
    
    // Handle Advantage/Disadvantage (QSR: "Advantage — roll twice, take best")
    if (advantage || disadvantage) {
      const roll1 = this._rollPool(baseDice, modifierDice);
      const roll2 = this._rollPool(baseDice, modifierDice);
      
      if (advantage) {
        return this._takeBestResult(roll1, roll2);
      } else {
        return this._takeWorstResult(roll1, roll2);
      }
    }
    
    return this._rollPool(baseDice, modifierDice);
  }

  /**
   * Internal: Roll a single dice pool
   * @private
   */
  static _rollPool(baseDice, modifierDice) {
    const baseResults = this._rollDice(baseDice);
    const modifierResults = this._rollDice(modifierDice);
    return new DicePoolResult(baseResults, modifierResults);
  }

  /**
   * Internal: Roll N six-sided dice
   * @private
   */
  static _rollDice(count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }
    return results;
  }

  /**
   * Internal: Take the better of two results (more net successes)
   * @private
   */
  static _takeBestResult(roll1, roll2) {
    if (roll1.netSuccesses > roll2.netSuccesses) return roll1;
    if (roll2.netSuccesses > roll1.netSuccesses) return roll2;
    // Tiebreaker: more base successes
    if (roll1.baseSuccesses > roll2.baseSuccesses) return roll1;
    if (roll2.baseSuccesses > roll1.baseSuccesses) return roll2;
    // Still tied: return first
    return roll1;
  }

  /**
   * Internal: Take the worse of two results (fewer net successes)
   * @private
   */
  static _takeWorstResult(roll1, roll2) {
    if (roll1.netSuccesses < roll2.netSuccesses) return roll1;
    if (roll2.netSuccesses < roll1.netSuccesses) return roll2;
    // Tiebreaker: fewer base successes
    if (roll1.baseSuccesses < roll2.baseSuccesses) return roll1;
    if (roll2.baseSuccesses < roll1.baseSuccesses) return roll2;
    // Still tied: return first
    return roll1;
  }

  /**
   * Roll a Hit Test for combat
   * @param {number} attackerSkill - CCA or RCA
   * @param {number} defenderREF - Target's REF
   * @param {Object} modifiers - { bonusDice: number, penaltyDice: number }
   * @param {Object} options - { advantage, disadvantage }
   * @returns {DicePoolResult}
   */
  static rollHitTest(attackerSkill, defenderREF, modifiers = {}, options = {}) {
    const baseDice = attackerSkill;
    const modifierDice = defenderREF + (modifiers.bonusDice || 0) - (modifiers.penaltyDice || 0);
    return this.roll(baseDice, modifierDice, options);
  }

  /**
   * Roll a Morale Test (Bottle Test)
   * @param {number} modelsRemaining - Number of models in unit
   * @param {number} modelsKo - Number of KO'd models
   * @param {Object} options - { advantage, disadvantage }
   * @returns {DicePoolResult}
   */
  static rollMoraleTest(modelsRemaining, modelsKo, options = {}) {
    const baseDice = modelsRemaining;
    const modifierDice = modelsKo;
    return this.roll(baseDice, modifierDice, options);
  }
}
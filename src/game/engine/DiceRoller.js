
// /src/game/engine/DiceRoller.js

/**
 * Represents a single die roll, calculating its score and carry-over status based on its type.
 */
export class Die {
  constructor(type) {
    this.type = type; // 'base', 'modifier', or 'wild'
    this.value = 0;
    this.score = 0;
    this.carryOver = false;
  }

  /**
   * Rolls a single 6-sided die and calculates the score and carry-over.
   */
  roll() {
    this.value = Math.floor(Math.random() * 6) + 1;
    this._calculateScoreAndCarryOver();
    return this;
  }

  /**
   * Mocks a roll for testing purposes.
   * @param {number} value - The value to set the die to.
   */
  mockRoll(value) {
    this.value = value;
    this._calculateScoreAndCarryOver();
    return this;
  }

  /**
   * Determines the score and carry-over status based on the die's type and value.
   * @private
   */
  _calculateScoreAndCarryOver() {
    switch (this.type) {
      case 'base':
        if (this.value >= 4) this.score = 1;
        if (this.value === 6) {
          this.score = 2;
          this.carryOver = true;
        }
        break;
      case 'modifier':
        if (this.value >= 4) this.score = 1;
        if (this.value === 6) this.carryOver = true;
        break;
      case 'wild':
        if (this.value >= 4) {
          this.score = 1;
          this.carryOver = true;
        }
        break;
      default:
        this.score = 0;
        this.carryOver = false;
    }
  }
}

/**
 * Represents the result of one player's dice pool in a test.
 */
export class PlayerTestResult {
  constructor(dice) {
    this.dice = dice; // Array of Die objects
    this.totalScore = dice.reduce((sum, die) => sum + die.score, 0);
    this.carryOverDice = dice.filter(die => die.carryOver);
  }
}

/**
 * Represents the final result of an Opposed Test between an Active and Passive player.
 */
export class OpposedTestResult {
  constructor(activeResult, passiveResult) {
    this.activeResult = activeResult;
    this.passiveResult = passiveResult;
    this.success = activeResult.totalScore >= passiveResult.totalScore;
    this.cascades = 0;
    this.transferredDice = { base: 0, modifier: 0, wild: 0 };

    if (this.success) {
      // Calculate cascades: difference in scores, but at least 1 for a tie.
      this.cascades = (activeResult.totalScore - passiveResult.totalScore) || 1;

      // If the active player passed, count the dice that generated a carry-over.
      for (const die of activeResult.carryOverDice) {
        if (this.transferredDice[die.type] !== undefined) {
          this.transferredDice[die.type]++;
        }
      }
    }
  }
}

/**
 * Main dice rolling engine for performing tests.
 */
export class DiceRoller {
  /**
   * Performs an Opposed Test between an Active and a Passive player.
   * @param {{base: number, modifier: number, wild: number}} activeDicePool - The dice pool for the Active player.
   * @param {{base: number, modifier: number, wild: number}} passiveDicePool - The dice pool for the Passive player.
   * @returns {OpposedTestResult} - The comprehensive result of the test.
   */
  static performOpposedTest(activeDicePool, passiveDicePool) {
    const activeResult = this._rollPlayerPool(activeDicePool);
    // Passive players do not generate carry-overs, so we clear that status after the roll.
    const passiveResult = this._rollPlayerPool(passiveDicePool, { isPassive: true });

    return new OpposedTestResult(activeResult, passiveResult);
  }

  /**
   * Rolls the dice for a single player's pool.
   * @private
   */
  static _rollPlayerPool(dicePool, options = {}) {
    const { isPassive = false } = options;
    const rolledDice = [];

    for (const type in dicePool) {
      for (let i = 0; i < dicePool[type]; i++) {
        const die = new Die(type).roll();
        // Per rules, Passive player does not get carry-over benefits.
        if (isPassive) {
          die.carryOver = false;
        }
        rolledDice.push(die);
      }
    }
    return new PlayerTestResult(rolledDice);
  }
}

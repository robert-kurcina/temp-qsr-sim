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

  roll() {
    this.value = Math.floor(Math.random() * 6) + 1;
    this._calculateScoreAndCarryOver();
    return this;
  }

  mockRoll(value) {
    this.value = value;
    this._calculateScoreAndCarryOver();
    return this;
  }

  _calculateScoreAndCarryOver() {
    this.score = 0;
    this.carryOver = false;

    switch (this.type) {
      case 'base':
        if (this.value >= 4 && this.value <= 5) this.score = 1;
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
        if (this.value >= 4 && this.value <= 5) {
            this.score = 1;
            this.carryOver = true;
        }
        if (this.value === 6) {
          this.score = 3;
          this.carryOver = true;
        }
        break;
    }
  }
}

/**
 * Holds the results of a player's dice rolls.
 */
export class PlayerRollResult {
  constructor(dice) {
    this.dice = dice; // Array of Die objects
    this.diceScore = dice.reduce((sum, die) => sum + die.score, 0);
    this.carryOverDice = dice.filter(die => die.carryOver);
  }
}


/**
 * Represents the final result of a test.
 */
export class TestResult {
  constructor(activeRoll, passiveRoll, activeAttribute, passiveAttribute, dr = 0) {
    this.activeRoll = activeRoll;
    this.passiveRoll = passiveRoll;
    this.activeAttribute = activeAttribute;
    this.passiveAttribute = passiveAttribute;
    this.dr = dr;

    this.activeScore = activeRoll.diceScore + activeAttribute;
    this.passiveScore = passiveRoll.diceScore + passiveAttribute + dr;

    this.success = this.activeScore >= this.passiveScore;
    this.cascades = 0;
    this.misses = 0;
    this.carryOver = { base: 0, modifier: 0, wild: 0 };

    if (this.success) {
      this.cascades = this.activeScore - this.passiveScore;
      for (const die of activeRoll.carryOverDice) {
        if (this.carryOver[die.type] !== undefined) {
          this.carryOver[die.type]++;
        }
      }
    } else {
      this.misses = this.passiveScore - this.activeScore + 1;
    }
  }
}


/**
 * Main dice rolling engine for performing tests.
 */
export class DiceRoller {

  /**
   * Flattens two dice pools by canceling out dice of the same type.
   * Each player must retain at least two Base dice.
   * @param {{base: number, modifier: number, wild: number}} activePool
   * @param {{base: number, modifier: number, wild: number}} passivePool
   * @returns {{flatActivePool: object, flatPassivePool: object}}
   */
  static flattenDice(activePool, passivePool) {
    const flatActivePool = { ...activePool };
    const flatPassivePool = { ...passivePool };

    // Flatten modifier dice
    const minModifiers = Math.min(flatActivePool.modifier, flatPassivePool.modifier);
    flatActivePool.modifier -= minModifiers;
    flatPassivePool.modifier -= minModifiers;

    // Flatten wild dice
    const minWilds = Math.min(flatActivePool.wild, flatPassivePool.wild);
    flatActivePool.wild -= minWilds;
    flatPassivePool.wild -= minWilds;

    // Flatten base dice, ensuring each player keeps at least 2
    const availableToFlattenActive = Math.max(0, flatActivePool.base - 2);
    const availableToFlattenPassive = Math.max(0, flatPassivePool.base - 2);
    const minBase = Math.min(availableToFlattenActive, availableToFlattenPassive);
    flatActivePool.base -= minBase;
    flatPassivePool.base -= minBase;

    return { flatActivePool, flatPassivePool };
  }

  /**
   * Performs an Opposed Test between an Active and a Passive player.
   * @param {{base: number, modifier: number, wild: number}} activeDicePool
   * @param {number} activeAttribute
   * @param {{base: number, modifier: number, wild: number}} passiveDicePool
   * @param {number} passiveAttribute
   * @param {number} [dr=0] - Difficulty Rating added to the passive player's score.
   * @returns {TestResult}
   */
  static performOpposedTest(activeDicePool, activeAttribute, passiveDicePool, passiveAttribute, dr = 0) {
    // Add 2 base dice for each player per the rules.
    const fullActivePool = { base: (activeDicePool.base || 0) + 2, modifier: activeDicePool.modifier || 0, wild: activeDicePool.wild || 0 };
    const fullPassivePool = { base: (passiveDicePool.base || 0) + 2, modifier: passiveDicePool.modifier || 0, wild: passiveDicePool.wild || 0 };

    const { flatActivePool, flatPassivePool } = this.flattenDice(fullActivePool, fullPassivePool);

    const activeResult = this._rollPlayerPool(flatActivePool);
    // Passive players do not generate carry-overs per rules.
    const passiveResult = this._rollPlayerPool(flatPassivePool, { isPassive: true });

    return new TestResult(activeResult, passiveResult, activeAttribute, passiveAttribute, dr);
  }

  /**
   * Performs an Unopposed Test against the System.
   * @param {{base: number, modifier: number, wild: number}} activeDicePool
   * @param {number} activeAttribute
   * @param {number} [dr=0] - Difficulty Rating added to the System's score.
   * @returns {TestResult}
   */
  static performUnopposedTest(activeDicePool, activeAttribute, dr = 0) {
    const passiveDicePool = { base: 0, modifier: 0, wild: 0 }; // Gets 2 base dice in performOpposedTest
    const passiveAttribute = 2; // System attribute is always 2

    return this.performOpposedTest(
      activeDicePool,
      activeAttribute,
      passiveDicePool,
      passiveAttribute,
      dr
    );
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
    return new PlayerRollResult(rolledDice);
  }
}

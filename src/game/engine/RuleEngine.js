// /src/engine/RuleEngine.js

/**
 * Executes MEST QSR rules based on character state and context
 * All logic is data-driven and deterministic
 */
export class RuleEngine {
  /**
   * Check if a character can perform Overreach
   * @param {Character} attacker
   * @param {Object} context - { target, weapon }
   * @returns {boolean}
   */
  static canOverreach(attacker, context) {
    const { weapon } = context;
    
    // QSR: "Overreach — If Free and Attentive, may add +1 MU to Melee Range"
    // Conditions:
    // 1. Character is Free (not Engaged)
    // 2. Character is Attentive (not Disordered)
    // 3. Weapon is not Natural (Unarmed, Claws, etc.)
    
    if (!attacker.isFree()) return false;
    if (!attacker.isAttentive()) return false;
    if (weapon && weapon.class === 'Natural') return false;
    
    return true;
  }

  /**
   * Get melee range modifier for a character
   * @param {Character} attacker
   * @param {Weapon} weapon
   * @returns {number} - Additional MU (e.g., +1 for Overreach)
   */
  static getMeleeRangeModifier(attacker, weapon) {
    if (this.canOverreach(attacker, { weapon })) {
      return 1; // +1 MU from Overreach
    }
    return 0;
  }

  /**
   * Check if a character ignores Fear tests (Grit trait)
   * @param {Character} character
   * @returns {boolean}
   */
  static hasGrit(character) {
    return character.hasTrait('Grit');
  }

  /**
   * Get modifiers for any combat or attribute test.
   * @param {Character} character - The character performing the test.
   * @param {Object} context - { target, weapon, testType, combatType }
   * @returns {Object} - { bonusDice: number, penaltyDice: number }
   */
  static getTestModifiers(character, context = {}) {
    let bonusDice = 0;
    let penaltyDice = 0;
    const { target, weapon, combatType } = context;

    // --- Universal Modifiers ---

    // Concentrate action: +1 bonus die to the next Test.
    if (character.isConcentrating()) {
      bonusDice += 1;
      character.removeStatus('Concentrating'); // Consume the status
    }
    
    // --- Combat-Specific Modifiers ---
    if (combatType) {
        // Leaning penalty for the attacker
        if (character.isLeaning() && combatType === 'ranged') {
            penaltyDice += 1;
        }

        // Leaning penalty for the defender (smaller target)
        if (target && target.isLeaning()) {
            penaltyDice += 1;
        }

        // Fighter trait: reduces penalty dice
        if (character.hasTrait('Fight')) {
          penaltyDice = Math.max(0, penaltyDice - 1);
        }

        // Terrain cover penalties
        if (target && target.inCover()) { // Assuming inCover() method exists
          penaltyDice += 1;
        }

        // Flanked penalty
        if (target && this.isFlanked(target)) {
          penaltyDice += 1;
        }
    }
    
    // --- Weapon & Hand-Related Penalties ---
    if (weapon) {
        const handsRequired = character.handManager.getHandsRequired(weapon);
        const isWeaponInHand = character.handManager.inHand.some(i => i.name === weapon.name);

        // Penalty for using a 2H weapon with 1 hand
        if (isWeaponInHand && handsRequired === 2 && character.getFreeHands() > 0) {
            // If you have a 2H weapon in hand but still have a free hand,
            // it means you're not dedicating both hands to it.
            penaltyDice += 1;
        }
    }

    return { bonusDice, penaltyDice };
  }

  /**
   * Check if a model is flanked
   * @param {Character} defender
   * @returns {boolean}
   */
  static isFlanked(defender) {
    // Simplified: check if multiple enemies in melee range
    // In full implementation, this would use spatial engine
    return defender.getEngagedEnemies().length >= 2;
  }

  /**
   * Validate a movement action
   * @param {Character} character
   * @param {Object} move - { from, to, path }
   * @returns {ValidationResult}
   */
  static validateMovement(character, move) {
    const errors = [];

    // A move action costs 1 AP.
    if (character.getAvailableAP() < 1) {
        errors.push(`Insufficient AP: need 1, have ${character.getAvailableAP()}`);
    }
    
    // Check if the path cost is within the character's movement allowance for a single action.
    const movementAllowance = this.getMovementAllowance(character);
    const movementCost = this.calculateMovementCost(character, move.path);

    if (movementCost > movementAllowance) {
      errors.push(`Path cost of ${movementCost.toFixed(1)} MU exceeds single action allowance of ${movementAllowance} MU.`);
    }

    // Check terrain legality
    for (const segment of move.path) {
      if (!this.canEnterTerrain(character, segment.terrain)) {
        errors.push(`Cannot enter ${segment.terrain} terrain`);
      }
    }

    return new ValidationResult(errors.length === 0, errors);
  }

  /**
   * Calculates the movement allowance for a single Move action.
   * Rule: MOV + 2"
   * @param {Character} character
   * @returns {number} The total movement allowance in MU.
   */
  static getMovementAllowance(character) {
    const mov = character?.archetype?.attributes?.mov ?? 0;
    return mov + 2;
  }

  /**
   * Calculate movement cost for a path in Movement Units (MU).
   * @param {Character} character
   * @param {Array} path - [{ terrain, distance }, ...]
   * @returns {number} The total cost in MU.
   */
  static calculateMovementCost(character, path) {
    let totalCost = 0;
    const ladenPenalty = character.getLadenPenalty();
    
    for (const segment of path) {
      let costPerMU = 1; // Clear terrain
      
      if (segment.terrain === 'Rough') {
        costPerMU = 2;
      } else if (segment.terrain === 'Difficult') {
        costPerMU = 3;
      }
      
      // Apply Laden penalty (this might need clarification if it affects the new system)
      // For now, we assume it increases the MU cost.
      if (ladenPenalty > 0) {
        costPerMU += ladenPenalty;
      }
      
      totalCost += costPerMU * segment.distance;
    }
    
    return totalCost;
  }

  /**
   * Check if character can enter terrain type
   * @param {Character} character
   * @param {string} terrainType
   * @returns {boolean}
   */
  static canEnterTerrain(character, terrainType) {
    // Most characters can enter all terrain
    // Special cases (e.g., cavalry in woods) would go here
    return true;
  }

  /**
   * Resolve a Close Combat attack
   * @param {Character} attacker
   * @param {Character} defender
   * @param {Weapon} weapon
   * @returns {CombatResult}
   */
  static resolveCloseCombat(attacker, defender, weapon) {
    const modifiers = this.getTestModifiers(attacker, { target: defender, weapon, combatType: 'close' });
    const advantage = this.hasGrit(attacker) && !attacker.isDisordered() && !defender.hasTrait('Intimidating');
    
    const hitTest = DiceRoller.rollHitTest(
        attacker.getCCA(), 
        defender.getREF(),
        modifiers,
        { advantage }
    );
    
    return new CombatResult(hitTest, attacker, defender);
  }

  /**
   * Resolve a Ranged Combat attack
   * @param {Character} attacker
   * @param {Character} defender
   * @param {Weapon} weapon
   * @returns {CombatResult}
   */
  static resolveRangedCombat(attacker, defender, weapon) {
    const modifiers = this.getTestModifiers(attacker, { target: defender, weapon, combatType: 'ranged' });
    
    const hitTest = DiceRoller.rollHitTest(
        attacker.getRCA(),
        defender.getREF(),
        modifiers
    );

    return new CombatResult(hitTest, attacker, defender);
  }
}

/**
 * Encapsulates validation results
 */
export class ValidationResult {
  constructor(isValid, messages) {
    this.isValid = isValid;
    this.messages = messages;
  }
}

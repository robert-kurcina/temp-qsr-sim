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
   * Get CCA/RCA modifiers for Close Combat
   * @param {Character} attacker
   * @param {Character} defender
   * @param {Weapon} weapon
   * @returns {Object} - { bonusDice: number, penaltyDice: number }
   */
  static getCombatModifiers(attacker, defender, weapon) {
    let bonusDice = 0;
    let penaltyDice = 0;

    // Fighter trait: reduces penalty dice
    if (attacker.hasTrait('Fight')) {
      // QSR: "Fight X — Reduces up to X penalty Modifier dice"
      // For now, assume level 1 → reduce 1 penalty die
      penaltyDice = Math.max(0, penaltyDice - 1);
    }

    // Terrain cover penalties (to be integrated with LOSEngine)
    if (defender.inCover()) {
      penaltyDice += 1; // -1m = -1 penalty die
    }

    // Flanked penalty
    if (this.isFlanked(defender)) {
      penaltyDice += 1;
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
    
    // Check AP cost
    const apCost = this.calculateAPCost(character, move.path);
    if (apCost > character.getAvailableAP()) {
      errors.push(`Insufficient AP: need ${apCost}, have ${character.getAvailableAP()}`);
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
   * Calculate AP cost for a path
   * @param {Character} character
   * @param {Array} path - [{ terrain, distance }, ...]
   * @returns {number}
   */
  static calculateAPCost(character, path) {
    let total = 0;
    const ladenPenalty = character.getLadenPenalty();
    
    for (const segment of path) {
      let costPerMU = 1; // Clear terrain
      
      if (segment.terrain === 'Rough') {
        costPerMU = 2;
      } else if (segment.terrain === 'Difficult') {
        costPerMU = 3;
      }
      
      // Apply Laden penalty
      if (ladenPenalty > 0) {
        costPerMU += ladenPenalty;
      }
      
      total += costPerMU * segment.distance;
    }
    
    return total;
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

  // Add this method to RuleEngine class

    /**
     * Resolve a Close Combat attack
     * @param {Character} attacker
     * @param {Character} defender
     * @param {Weapon} weapon
     * @returns {CombatResult}
     */
    static resolveCloseCombat(attacker, defender, weapon) {
    // Get combat modifiers
    const modifiers = this.getCombatModifiers(attacker, defender, weapon);
    
    // Apply Grit advantage if applicable
    const advantage = this.hasGrit(attacker) && 
                    !attacker.isDisordered() && 
                    !defender.hasTrait('Intimidating');
    
    // Roll Hit Test
    const hitTest = DiceRoller.rollHitTest(
        attacker.getCCA(), // Assume Character has getCCA()
        defender.getREF(), // Assume Character has getREF()
        modifiers,
        { advantage }
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


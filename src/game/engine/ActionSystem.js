import { ValidationResult } from './RuleEngine.js';

/**
 * A system for handling character actions and their consequences.
 */
export class ActionSystem {

  /**
   * Perform the Lean (Fiddle) action.
   * @param {Character} character
   * @param {Object} options - { leanDistance, leanDirection, coverObject }
   * @returns {ValidationResult}
   */
  static lean(character, options) {
    // 1. Validation
    if (!character.isFree()) {
      return new ValidationResult(false, ['Character must be Free to lean.']);
    }
    if (character.getFreeHands() < 1) {
      return new ValidationResult(false, ['Leaning requires at least one free hand.']);
    }
    // Placeholder: How do we know the character is in base-contact with cover?
    if (!options.coverObject) {
        return new ValidationResult(false, ['Must be in base-contact with an object providing cover.']);
    }

    // 2. AP Cost
    const apCost = character.hasUsedFiddleAction() ? 1 : 0;
    if (character.getAvailableAP() < apCost) {
      return new ValidationResult(false, [`Insufficient AP. Needs ${apCost}, has ${character.getAvailableAP()}.`]);
    }

    // 3. Agility & Positioning
    const maxLean = Math.min(character.agility, character.archetype.baseDiameter || 1);
    const leanDistance = Math.min(options.leanDistance, maxLean);

    // Simplified: For now, we assume the leanDirection is a normalized vector
    const leanPosition = {
        x: character.position.x + options.leanDirection.x * leanDistance,
        y: character.position.y + options.leanDirection.y * leanDistance,
        z: character.position.z, // Assuming lean is horizontal
    };

    // 4. State Update
    character.spendAP(apCost);
    character.incrementFiddleActions();
    character.setLeanPosition(leanPosition);

    return new ValidationResult(true, ['Leaning.']);
  }

  /**
   * Perform the Concentrate (Fiddle) action.
   * @param {Character} character
   * @returns {ValidationResult}
   */
  static concentrate(character) {
    // 1. Validation
    if (!character.isFree()) {
      return new ValidationResult(false, ['Character must be Free to concentrate.']);
    }
    if (character.getFreeHands() < 1) {
      return new ValidationResult(false, ['Concentrating requires at least one free hand.']);
    }

    // 2. AP Cost
    const apCost = character.hasUsedFiddleAction() ? 1 : 0;
    if (character.getAvailableAP() < apCost) {
      return new ValidationResult(false, [`Insufficient AP. Needs ${apCost}, has ${character.getAvailableAP()}.`]);
    }

    // 3. State Update
    character.spendAP(apCost);
    character.incrementFiddleActions();
    character.addStatus('Concentrating');

    return new ValidationResult(true, ['Concentrating.']);
  }
  
  /**
   * Switch an item between in-hand and stowed.
   * This is a "Fiddle" action.
   * @param {Character} character The character performing the action.
   * @param {string} itemName The name of the item to switch.
   * @returns {ValidationResult} The result of the action.
   */
  static switchItem(character, itemName) {
    // 1. AP Cost
    const apCost = character.hasUsedFiddleAction() ? 1 : 0;
    if (character.getAvailableAP() < apCost) {
      return new ValidationResult(false, [`Insufficient AP. Needs ${apCost}, has ${character.getAvailableAP()}.`]);
    }

    // 2. Perform the switch using HandManager
    const result = character.handManager.switchItem(itemName);

    // 3. Handle the result
    if (result.includes('stowed') || result.includes('in hand')) {
      character.spendAP(apCost);
      character.incrementFiddleActions();
      return new ValidationResult(true, [result]);
    } else {
      // This covers "Not enough free hands" and "Item not found"
      return new ValidationResult(false, [result]);
    }
  }
}

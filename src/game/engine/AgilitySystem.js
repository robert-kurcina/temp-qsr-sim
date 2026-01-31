/**
 * A system to manage Agility calculations and actions for characters.
 */
export class AgilitySystem {

  /**
   * Calculates a character's total Agility pool in MU.
   * Agility = MOV * 0.5
   * @param {Character} character - The character to calculate Agility for.
   * @returns {number} The character's total Agility pool in MU.
   */
  static calculateAgility(character) {
    const mov = character?.archetype?.attributes?.MOV ?? 0;
    return mov * 0.5;
  }

  // ... Other methods for spending Agility on specific actions will be added here.

}

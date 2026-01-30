// /src/core/Character.js (updated)
import { Archetype } from './Archetype.js';
import { Weapon } from './Weapon.js';
import { Armor } from './Armor.js';
import { Equipment } from './Equipment.js';

/**
 * Represents a fully built character with archetype, weapons, armor, equipment
 */
export class Character {
  /**
   * @param {Object} config
   * @param {string} config.archetype - Base archetype name
   * @param {string[]} [config.weapons] - Weapon names
   * @param {Object} [config.armor] - { helm, suit, shield }
   * @param {string} [config.equipment] - Equipment name
   * @param {string} [config.variant] - Variant archetype
   */
  constructor(config) {
    this.archetype = new Archetype(config.archetype);
    this.variant = config.variant ? new Archetype(config.variant) : null;
    this.weapons = (config.weapons || []).map(name => new Weapon(name));
    
    // Armor
    this.armor = {
      helm: config.armor?.helm ? new Armor(config.armor.helm) : null,
      suit: config.armor?.suit ? new Armor(config.armor.suit) : null,
      shield: config.armor?.shield ? new Armor(config.armor.shield) : null
    };

    // Equipment
    this.equipment = config.equipment ? new Equipment(config.equipment) : null;
  }

  /**
   * Calculate total BP cost
   * @returns {number}
   */
  getBP() {
    let total = this.archetype.bp;

    // Add variant cost
    if (this.variant) {
      total = this.variant.getVariantBP(this.archetype);
    }

    // Add weapons
    this.weapons.forEach(weapon => {
      total += weapon.bp;
    });

    // Add armor
    Object.values(this.armor).forEach(piece => {
      if (piece) total += piece.bp;
    });

    // Add equipment
    if (this.equipment) {
      total += this.equipment.bp;
    }

    // Apply Unarmed reduction if no weapons
    if (this.weapons.length === 0) {
      total -= 3; // Unarmed = -3 BP
    }

    return total;
  }

  /**
   * Get total Armor Rating (AR)
   * @returns {number}
   */
  getAR() {
    let ar = 0;
    Object.values(this.armor).forEach(piece => {
      if (piece) ar += piece.ar;
    });
    return ar;
  }

  /**
   * Get [Laden X] penalty from armor
   * @returns {number}
   */
  getLadenPenalty() {
    let penalty = 0;
    Object.values(this.armor).forEach(piece => {
      if (piece) penalty += piece.getLadenPenalty();
    });
    return penalty;
  }

  /**
   * Get all active traits (from variant + equipment)
   * @returns {string[]}
   */
  getTraits() {
    const traits = [];
    
    // Variant traits
    if (this.variant) {
      const trait = this.variant.getTrait();
      if (trait) traits.push(trait);
    }

    // Equipment effects (treat as temporary traits)
    if (this.equipment && this.equipment.hasEffect('Grit')) {
      traits.push('Advantage Grit');
    }

    return traits;
  }

  /**
   * Check if character has a specific trait or effect
   * @param {string} traitName - e.g., "Grit", "Fight"
   * @returns {boolean}
   */
  hasTrait(traitName) {
    return this.getTraits().some(t => t.startsWith(traitName));
  }

  /**
   * Get primary weapon
   * @returns {Weapon|null}
   */
  getPrimaryWeapon() {
    return this.weapons[0] || null;
  }

  // Add these methods to Character class

/**
 * Check if character is Free (not Engaged)
 * @returns {boolean}
 */
isFree() {
  // In full implementation, this would check spatial engine
  // For now, assume always free
  return true;
}

/**
 * Check if character is Attentive (not Disordered)
 * @returns {boolean}
 */
isAttentive() {
  // In full implementation, track Disordered status
  return true;
}

/**
 * Get available Action Points
 * @returns {number}
 */
getAvailableAP() {
  // Base AP = MOV attribute
  // For now, assume 4 AP
  return 4;
}

  /**
   * Get engaged enemies (for Flanked check)
   * @returns {Array}
   */
  getEngagedEnemies() {
    // In full implementation, use spatial engine
    return [];
  }

  /**
   * Check if in cover
   * @returns {boolean}
   */
  inCover() {
    // In full implementation, use LOSEngine
    return false;
  }

  // Add these methods to Character class

  getCCA() {
    // For now, assume all Veterans have CCA 3
    // In full implementation, this would come from archetype data
    return 3;
  }

  getREF() {
    return 3; // Default REF
  }

  isDisordered() {
    // Track disordered status
    return false;
  }
}
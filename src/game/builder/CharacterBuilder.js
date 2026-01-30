// /src/builder/CharacterBuilder.js
import { Archetype } from '../core/Archetype.js';
import { Weapon } from '../core/Weapon.js';
import { Armor } from '../core/Armor.js';
import { Equipment } from '../core/Equipment.js';

/**
 * Builds canonical MEST character profiles from user selections
 * Strictly adheres to QSR literal text
 */
export class CharacterBuilder {
  /**
   * Build a character profile from configuration
   * @param {Object} config
   * @param {string} config.archetype - Base archetype (e.g., "Veteran")
   * @param {string} [config.variant] - Variant trait (e.g., "Fighter")
   * @param {string[]} [config.weapons] - Weapon names
   * @param {Object} [config.armor] - { helm, suit, shield }
   * @param {string} [config.equipment] - Equipment name
   * @returns {CharacterProfile}
   */
  static build(config) {
    // Validate archetype
    const baseArchetype = new Archetype(config.archetype);
    
    // Resolve variant
    let variantArchetype = null;
    if (config.variant) {
      variantArchetype = new Archetype(config.variant);
      if (variantArchetype.type !== 'variant') {
        throw new Error(`"${config.variant}" is not a valid variant`);
      }
    }

    // Build weapons
    const weapons = (config.weapons || []).map(name => new Weapon(name));
    
    // Build armor
    const armor = {
      helm: config.armor?.helm ? new Armor('Helm', config.armor.helm) : null,
      suit: config.armor?.suit ? new Armor('Armor', config.armor.suit) : null,
      shield: config.armor?.shield ? new Armor('Shield', config.armor.shield) : null
    };

    // Build equipment
    const equipment = config.equipment ? new Equipment(config.equipment) : null;

    // Calculate total BP
    let totalBP = baseArchetype.bp;
    
    // Add variant cost
    if (variantArchetype) {
      totalBP = variantArchetype.getVariantBP(baseArchetype);
    }

    // Add weapons
    weapons.forEach(weapon => {
      totalBP += weapon.bp;
    });

    // Add armor
    Object.values(armor).forEach(piece => {
      if (piece) totalBP += piece.bp;
    });

    // Add equipment
    if (equipment) {
      totalBP += equipment.bp;
    }

    // Apply Unarmed reduction
    const isUnarmed = weapons.length === 0;
    if (isUnarmed) {
      totalBP -= 3; // QSR: "Unarmed — All characters begin with... (–3 BP)"
    }

    // Get traits
    const traits = [];
    if (variantArchetype) {
      const trait = variantArchetype.getTrait();
      if (trait) traits.push(trait);
    }
    if (equipment && equipment.hasEffect('Grit')) {
      traits.push('Advantage Grit');
    }

    return new CharacterProfile({
      archetype: config.archetype,
      variant: config.variant,
      weapons: config.weapons || [],
      armor: config.armor,
      equipment: config.equipment,
      bp: totalBP,
      traits,
      isUnarmed
    });
  }
}

/**
 * Serializable character profile
 */
export class CharacterProfile {
  constructor(data) {
    this.archetype = data.archetype;
    this.variant = data.variant;
    this.weapons = data.weapons;
    this.armor = data.armor;
    this.equipment = data.equipment;
    this.bp = data.bp;
    this.traits = data.traits;
    this.isUnarmed = data.isUnarmed;
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      archetype: this.archetype,
      variant: this.variant,
      weapons: this.weapons,
      armor: this.armor,
      equipment: this.equipment,
      bp: this.bp,
      traits: this.traits
    };
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json) {
    return new CharacterProfile({
      archetype: json.archetype,
      variant: json.variant,
      weapons: json.weapons,
      armor: json.armor,
      equipment: json.equipment,
      bp: json.bp,
      traits: json.traits,
      isUnarmed: json.weapons?.length === 0
    });
  }
}
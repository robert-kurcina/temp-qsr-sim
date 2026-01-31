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
   * @param {string} config.archetype - Archetype (e.g., "Veteran", or "Veteran, Fighter")
   * @param {string[]} [config.weapons] - Weapon names
   * @param {string[]} [config.armor] - Armor names (e.g., ["Light Helmet", "Medium Armor"])
   * @param {string} [config.equipment] - Equipment name
   * @returns {CharacterProfile}
   */
  static build(config) {
    // Validate archetype
    const archetype = new Archetype(config.archetype);

    // Build weapons
    const weapons = (config.weapons || []).map(name => new Weapon(name));
    
    // Build armor
    const armors = (config.armor || []).map(name => new Armor(name));

    // Build equipment
    const equipment = config.equipment ? new Equipment(config.equipment) : null;

    // Calculate total BP
    let totalBP = archetype.bp;

    // Add weapons
    weapons.forEach(weapon => {
      totalBP += weapon.bp;
    });

    // Add armor
    armors.forEach(piece => {
      totalBP += piece.bp;
    });

    // Add equipment
    if (equipment) {
      totalBP += equipment.bp;
    }

    // Apply Unarmed reduction
    // TODO what needs to be done is that all characters which are not assigned a Weapon, or which do not have a Natural weapon assigned, or have a Trait with the Natural keyword, must be assigned "Unarmed" and that will count as a Natural Weapon and itself has the implicit "Natural" keyword.
    const isUnarmed = weapons.length === 0;
    if (isUnarmed) {
      totalBP -= 3; // QSR: "Unarmed — All characters begin with... (–3 BP)"
    }

    // Get traits
    const traits = [];
    if (equipment && equipment.hasTrait('Grit')) {
      traits.push('Grit');
    }

    return new CharacterProfile({
      archetype: config.archetype,
      weapons: config.weapons || [],
      armor: config.armor || [],
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
      weapons: json.weapons,
      armor: json.armor,
      equipment: json.equipment,
      bp: json.bp,
      traits: json.traits,
      isUnarmed: json.weapons?.length === 0
    });
  }
}

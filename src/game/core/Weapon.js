// /src/core/Weapon.js
import { weapons as weaponsData } from '../../../data/bundledData.js';

/**
 * Represents a weapon with stats and traits
 */
export class Weapon {
  /**
   * @param {string} name - e.g., "Axe", "Unarmed"
   */
  constructor(name) {
    this.name = name;
    this._loadFromData();
  }

  _loadFromData() {
    const data = weaponsData.find(w => w.name === this.name);
    if (!data) {
      throw new Error(`Unknown weapon: ${this.name}`);
    }

    this.class = data.class;
    this.or = data.or;
    this.accuracy = data.accuracy;
    this.impact = data.impact;
    this.damage = data.damage;
    this.traits = data.traits || [];
    this.bp = data.bp;
  }

  /**
   * Check if weapon has a specific trait
   * @param {string} traitName - e.g., "Cleave", "[Stub]"
   * @returns {boolean}
   */
  hasTrait(traitName) {
    return this.traits.some(t => t.includes(traitName));
  }

  /**
   * Get OR distance in MU (resolve STR" → actual value)
   * @param {number} str - Model's STR attribute
   * @returns {number|string} - MU or special value (e.g., "STR\"")
   */
  getOR(str) {
    if (this.or === 'STR"') return str;
    if (this.or === 'STR +3"') return str + 3;
    if (this.or === 'STR - 1"') return Math.max(0, str - 1);
    return this.or; // e.g., "-"
  }
}
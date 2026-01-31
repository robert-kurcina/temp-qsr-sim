import equipmentData from '../../data/equipment.json';

/**
 * Represents a single equipment item (Alcohol, Stimulant, etc.)
 */
export class Equipment {
  /**
   * @param {string} name - e.g., "Alcohol", "Stimulant"
   */
  constructor(name) {
    this.name = name;
    this._loadFromData();
  }

  _loadFromData() {
    const item = equipmentData.find(e => e.name === this.name);
    if (!item) {
      throw new Error(`Unknown equipment: ${this.name}`);
    }

    this.traits = item.traits;
    this.bp = item.bp;
  }

  /**
   * Check if equipment grants a specific effect
   * @param {string} keyword - e.g., "Grit", "MOV"
   * @returns {boolean}
   */
  hasEffect(keyword) {
    return this.traits.some(t => t.includes(keyword));
  }
}

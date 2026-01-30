// /src/core/Archetype.js
import { archetypes as archetypesData } from '../../../data/bundledData.js';

/**
 * Represents a base or variant archetype (e.g., "Veteran", "Tactician")
 */
export class Archetype {
  /**
   * @param {string} name - e.g., "Veteran", "Wise"
   * @param {Object} [overrides] - Optional attribute overrides
   */
  constructor(name, overrides = {}) {
    this.name = name;
    this._loadFromData(overrides);
  }

  _loadFromData(overrides) {
    // Check common archetypes first
    let base = archetypesData.common.find(a => a.name === this.name);
    if (base) {
      this.bp = base.bp;
      this.type = 'common';
      return;
    }

    // Check variants
    const variant = archetypesData.variants.find(v => v.variant === this.name);
    if (variant) {
      this.base = variant.base;
      this.trait = variant.trait;
      this.bpAdd = variant.bp_add;
      this.type = 'variant';
      return;
    }

    throw new Error(`Unknown archetype: ${this.name}`);
  }

  /**
   * Get total BP cost when applied to a base archetype
   * @param {Archetype} base - Base archetype (e.g., Veteran)
   * @returns {number}
   */
  getVariantBP(base) {
    if (this.type !== 'variant') return this.bp;
    return base.bp + this.bpAdd;
  }

  /**
   * Get full trait name (e.g., "Leadership 1")
   * @returns {string|null}
   */
  getTrait() {
    if (this.type !== 'variant') return null;
    // Assume level 1 for now; extend later for multi-level traits
    return `${this.trait} 1`;
  }
}
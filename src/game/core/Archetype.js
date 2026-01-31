
import archetypesData from '../../data/archetypes.json';

/**
 * Represents a character archetype (e.g., Veteran, Zealot)
 */
export class Archetype {
  /**
   * @param {string} name - The name of the archetype, e.g., "Veteran"
   */
  constructor(name) {
    this.name = name;
    this.variants = {};
    this._loadFromData();
  }

  _loadFromData() {
    const data = (archetypesData.default || archetypesData).common[this.name];
    if (!data) {
      throw new Error(`Unknown archetype: ${this.name}`);
    }

    this.class = data.class;
    this.bp = data.bp;
    this.attributes = data.attributes;
    this.mov = data.attributes.mov;
    this.str = data.attributes.str;
    this.ref = data.attributes.ref;
    this.wil = data.attributes.wil;
    this.traits = data.traits || [];

    const allVariants = (archetypesData.default || archetypesData).variants;
    this.variants = {};
    allVariants
      .filter(v => v.base === this.name)
      .forEach(v => {
        this.variants[v.variant] = {
          bp: v.bp_add,
          adds: [v.trait]
        };
      });
  }

  /**
   * Get data for a specific variant
   * @param {string} variantName
   * @returns {{bp: number, adds: string[]}|null}
   */
  getVariant(variantName) {
    return this.variants[variantName] || null;
  }

  getTrait() {
    return this.traits[0] || null;
  }
}

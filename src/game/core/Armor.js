import armorsData from '../../../data/bundledData.js';
import { parseTrait } from '../../utils/trait-parser.js';

/**
 * Represents a piece of armor.
 */
export class Armor {
    /**
     * The name of the armor.
     * @type {string}
     */
    name;

    /**
     * The class of the armor.
     * @type {string}
     */
    armorClass;

    /**
     * The base price of the armor.
     * @type {number}
     */
    bp;

    /**
     * The armor rating.
     * @type {number}
     */
    ar;

    /**
     * The traits of the armor.
     * @type {Array<object>}
     */
    traits = [];

    /**
     * Creates a new Armor object.
     * @param {string} name - The name of the armor to load from the data.
     */
    constructor(name) {
        if (!name) {
            throw new Error('Armor name must be provided.');
        }

        this._loadFromData(name);
    }

    /**
     * Loads the armor data from the bundled JSON data.
     * @param {string} name - The name of the armor to find.
     * @private
     */
    _loadFromData(name) {
        const armorDataItem = armorsData.find(item => item.name === name);

        if (!armorDataItem) {
            throw new Error(`Armor with name "${name}" not found.`);
        }

        this.name = armorDataItem.name;
        this.armorClass = armorDataItem.class;
        this.bp = armorDataItem.bp;
        this.ar = armorDataItem.ar;

        if (armorDataItem.traits && Array.isArray(armorDataItem.traits)) {
            this.traits = armorDataItem.traits.map(traitString => parseTrait(traitString));
        }
    }

    /**
     * Get [Laden X] penalty from armor traits.
     * @returns {number}
     */
    getLadenPenalty() {
        const ladenTrait = this.traits.find(t => t.name === 'Laden');
        return ladenTrait ? ladenTrait.value : 0;
    }
}

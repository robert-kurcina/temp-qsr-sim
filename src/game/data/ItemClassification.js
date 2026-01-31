
import itemClassifications from '../../data/item_classifications.json';

/**
 * A utility class for looking up item classifications from the `item_classifications.json` data.
 */
export class ItemClassification {
  /**
   * Get the classification data for a given item class string.
   * @param {string} classString The class string, e.g., "Armor - Helm".
   * @returns {{wae_class: string, item_type: string, item_class: string}|null} The classification data or null if not found.
   */
  static getClass(classString) {
    return itemClassifications[classString] || null;
  }
}

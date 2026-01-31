/**
 * Represents a temporary marker on the battlefield, such as for Leaning.
 */
export class Marker {
  constructor(config) {
    this.id = config.id || `marker_${Date.now()}`;
    this.type = config.type; // e.g., 'Leaning'
    this.characterId = config.characterId; // The character that created the marker
    this.position = config.position; // { x, y, z }
    this.size = config.size || 0.5; // Visual size of the marker

    // Add any other relevant properties, e.g., for targeting
    this.isTargetable = config.isTargetable || false;
  }
}

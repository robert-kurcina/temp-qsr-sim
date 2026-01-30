// /src/analysis/BattlefieldLayoutConfig.js
/**
 * Battlefield layout configuration for balance testing
 */
export class BattlefieldLayoutConfig {
  constructor() {
    this.layouts = {
      // Open field - favors ranged
      'open-field': this.createOpenField(),
      
      // Urban combat - favors melee with cover
      'urban-outpost': this.createUrbanOutpost(),
      
      // Forest terrain - mixed advantages  
      'forest-clearing': this.createForestClearing(),
      
      // Defensive positions - favors defenders
      'defensive-positions': this.createDefensivePositions(),
      
      // Symmetric cover - balanced engagement
      'symmetric-cover': this.createSymmetricCover()
    };
  }
  
  /**
   * Open field layout (24x24 MU)
   */
  createOpenField() {
    return {
      name: 'Open Field',
      description: 'Flat, open battlefield with minimal terrain',
      sizeMU: 24,
      terrain: [],
      deployment: {
        sideA: { x: -10, y: 0, radius: 3 },
        sideB: { x: 10, y: 0, radius: 3 }
      },
      tacticalNotes: 'Heavily favors ranged weapons'
    };
  }
  
  /**
   * Urban outpost layout
   */
  createUrbanOutpost() {
    return {
      name: 'Urban Outpost',
      description: 'Buildings and walls provide cover and blocking terrain',
      sizeMU: 24,
      terrain: [
        // Central building complex
        { type: 'building', x: 0, y: 0, width: 4, depth: 4, rotation: 0 },
        { type: 'building', x: -3, y: 3, width: 3, depth: 3, rotation: 0 },
        { type: 'building', x: 3, y: -3, width: 3, depth: 3, rotation: 0 },
        
        // Defensive walls
        { type: 'wall', x: -6, y: 0, length: 8, rotation: 0 },
        { type: 'wall', x: 6, y: 0, length: 8, rotation: 0 },
        
        // Cover elements
        { type: 'tree_cluster', x: -8, y: 4, radius: 1.5 },
        { type: 'tree_cluster', x: 8, y: -4, radius: 1.5 }
      ],
      deployment: {
        sideA: { x: -10, y: -2, radius: 2 },
        sideB: { x: 10, y: 2, radius: 2 }
      },
      tacticalNotes: 'Buildings provide hard cover, walls block LOS, favors tactical movement'
    };
  }
  
  /**
   * Forest clearing layout
   */
  createForestClearing() {
    return {
      name: 'Forest Clearing',
      description: 'Central clearing surrounded by dense forest',
      sizeMU: 24,
      terrain: [
        // Dense forest perimeter
        { type: 'tree_stand', x: -8, y: 0, radius: 3 },
        { type: 'tree_stand', x: 8, y: 0, radius: 3 },
        { type: 'tree_stand', x: 0, y: -8, radius: 3 },
        { type: 'tree_stand', x: 0, y: 8, radius: 3 },
        
        // Scattered trees in clearing
        { type: 'tree_single', x: -3, y: 2, radius: 0.5 },
        { type: 'tree_single', x: 3, y: -2, radius: 0.5 },
        { type: 'tree_single', x: -2, y: -3, radius: 0.5 },
        { type: 'tree_single', x: 2, y: 3, radius: 0.5 }
      ],
      deployment: {
        sideA: { x: -10, y: 0, radius: 2 },
        sideB: { x: 10, y: 0, radius: 2 }
      },
      tacticalNotes: 'Forest provides soft cover and LOS blocking, clearing allows ranged engagement'
    };
  }
  
  /**
   * Defensive positions layout
   */
  createDefensivePositions() {
    return {
      name: 'Defensive Positions',
      description: 'Elevated positions with defensive works',
      sizeMU: 24,
      terrain: [
        // Elevated plateau
        { type: 'hill', x: 0, y: 0, plateauRadius: 4, totalRadius: 8 },
        
        // Defensive walls on plateau
        { type: 'wall', x: -2, y: 0, length: 6, rotation: 0 },
        { type: 'wall', x: 2, y: 0, length: 6, rotation: Math.PI },
        
        // Cover positions
        { type: 'debris', x: -5, y: 3, radius: 1 },
        { type: 'debris', x: 5, y: -3, radius: 1 }
      ],
      deployment: {
        sideA: { x: 0, y: 0, radius: 2 }, // Defender on hill
        sideB: { x: 10, y: 0, radius: 2 }  // Attacker approaches
      },
      tacticalNotes: 'Elevation advantage for defenders, favors defensive tactics'
    };
  }
  
  /**
   * Symmetric cover layout
   */
  createSymmetricCover() {
    return {
      name: 'Symmetric Cover',
      description: 'Balanced terrain providing equal advantages',
      sizeMU: 24,
      terrain: [
        // Symmetric cover elements
        { type: 'building', x: -4, y: -3, width: 3, depth: 3, rotation: 0 },
        { type: 'building', x: 4, y: 3, width: 3, depth: 3, rotation: 0 },
        
        { type: 'wall', x: -6, y: 2, length: 4, rotation: Math.PI / 2 },
        { type: 'wall', x: 6, y: -2, length: 4, rotation: Math.PI / 2 },
        
        { type: 'tree_cluster', x: -3, y: 4, radius: 1.5 },
        { type: 'tree_cluster', x: 3, y: -4, radius: 1.5 }
      ],
      deployment: {
        sideA: { x: -10, y: 0, radius: 2 },
        sideB: { x: 10, y: 0, radius: 2 }
      },
      tacticalNotes: 'Equal terrain advantages, tests pure tactical skill'
    };
  }
  
  /**
   * Get layout by name
   */
  getLayout(layoutName) {
    return this.layouts[layoutName] || this.layouts['open-field'];
  }
}
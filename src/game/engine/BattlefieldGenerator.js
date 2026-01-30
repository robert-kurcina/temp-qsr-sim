// /src/engine/BattlefieldGenerator.js
/**
 * Generates valid random battlefield layouts
 */
export class BattlefieldGenerator {
  constructor(battlefieldSizeMU, collisionSystem) {
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.collisionSystem = collisionSystem;
    this.terrainTypes = [
      { type: 'hill', weight: 0.25, params: () => ({ size: this.getRandomHillSize() }) },
      { type: 'tree_single', weight: 0.20, params: () => ({}) },
      { type: 'tree_cluster', weight: 0.15, params: () => ({}) },
      { type: 'tree_stand', weight: 0.10, params: () => ({}) },
      { type: 'building', weight: 0.20, params: () => ({ width: 4, depth: 4 }) },
      { type: 'wall', weight: 0.10, params: () => ({ length: 6 }) }
    ];
  }
  
  /**
   * Generate a complete battlefield layout
   */
  generateLayout(targetCoverage = 0.35) {
    const terrainObjects = [];
    const maxAttempts = 200;
    let attempts = 0;
    let currentCoverage = 0;
    
    // Clear existing terrain
    this.collisionSystem.objects = [];
    
    while (currentCoverage < targetCoverage && attempts < maxAttempts) {
      const terrainType = this.selectRandomTerrainType();
      const position = this.getRandomPosition();
      const rotation = Math.random() * 180; // 0-180 degrees
      
      const tempObject = TerrainFactory.createTerrain(
        terrainType.type,
        position.x,
        position.y,
        terrainType.params(),
        0.5, // MU_TO_M
        rotation
      );
      
      const validation = this.collisionSystem.isValidPlacement(tempObject);
      if (validation.valid) {
        // Add to layout
        terrainObjects.push(tempObject);
        this.collisionSystem.addObject(tempObject);
        currentCoverage = this.calculateCoverage(terrainObjects);
      }
      
      attempts++;
    }
    
    return terrainObjects;
  }
  
  /**
   * Select terrain type based on weights
   */
  selectRandomTerrainType() {
    const totalWeight = this.terrainTypes.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const type of this.terrainTypes) {
      random -= type.weight;
      if (random <= 0) return type;
    }
    
    return this.terrainTypes[0];
  }
  
  /**
   * Get random hill size
   */
  getRandomHillSize() {
    const sizes = ['small', 'medium', 'large'];
    return sizes[Math.floor(Math.random() * sizes.length)];
  }
  
  /**
   * Get random position within battlefield
   */
  getRandomPosition() {
    const halfSize = this.battlefieldSizeMU / 2;
    return {
      x: (Math.random() - 0.5) * this.battlefieldSizeMU,
      y: (Math.random() - 0.5) * this.battlefieldSizeMU
    };
  }
  
  /**
   * Calculate terrain coverage percentage
   */
  calculateCoverage(terrainObjects) {
    let totalArea = 0;
    
    for (const obj of terrainObjects) {
      switch(obj.type) {
        case 'hill':
          totalArea += Math.PI * Math.pow(obj.totalRadiusMU, 2);
          break;
        case 'building':
          totalArea += obj.size.width * obj.size.depth;
          break;
        case 'wall':
          totalArea += obj.size.width * 1; // Assume 1 MU depth
          break;
        case 'tree_single':
          totalArea += Math.PI * Math.pow(0.5, 2);
          break;
        case 'tree_cluster':
          totalArea += Math.PI * Math.pow(3, 2);
          break;
        case 'tree_stand':
          totalArea += Math.PI * Math.pow(6, 2);
          break;
      }
    }
    
    const battlefieldArea = Math.pow(this.battlefieldSizeMU, 2);
    return totalArea / battlefieldArea;
  }
}
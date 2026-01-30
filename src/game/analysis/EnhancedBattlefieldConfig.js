// /src/analysis/EnhancedBattlefieldConfig.js
/**
 * Enhanced battlefield configuration with visibility and terrain density
 */
export class EnhancedBattlefieldConfig {
  constructor() {
    this.visibilityRanges = [16, 8, 4]; // MU
    this.terrainDensities = [0.25, 0.50, 0.75]; // 25%, 50%, 75%
  }
  
  /**
   * Generate all visibility × terrain combinations
   */
  generateRangedTestMatrix() {
    const testConfigs = [];
    
    for (const visibility of this.visibilityRanges) {
      for (const density of this.terrainDensities) {
        testConfigs.push({
          name: `Longbow vs Axe Long - Vis${visibility}MU Terr${Math.round(density * 100)}%`,
          visibility: visibility,
          terrainDensity: density,
          battlefieldSizeMU: 24
        });
      }
    }
    
    return testConfigs;
  }
  
  /**
   * Create terrain layout with guaranteed connectivity
   */
  createConnectedTerrainLayout(visibility, terrainDensity, battlefieldSizeMU = 24) {
    const terrain = [];
    const centerX = 0;
    const centerY = 0;
    
    // Calculate number of terrain elements based on density
    const baseElements = Math.floor(terrainDensity * 12); // 12 is base for 24x24
    
    // Ensure at least 2 traversable paths by creating clear corridors
    const pathAngle1 = Math.PI / 4; // 45 degrees
    const pathAngle2 = Math.PI * 3 / 4; // 135 degrees
    const pathWidth = 4; // MU width for paths
    
    // Add terrain elements while avoiding path corridors
    for (let i = 0; i < baseElements; i++) {
      let x, y, element;
      
      // Generate random position
      do {
        x = (Math.random() - 0.5) * battlefieldSizeMU * 0.8;
        y = (Math.random() - 0.5) * battlefieldSizeMU * 0.8;
        
        // Check if position is in path corridors
        const angle1 = Math.atan2(y, x);
        const angle2 = Math.atan2(y, -x);
        const distanceFromCenter = Math.sqrt(x * x + y * y);
        
        const inPath1 = Math.abs(angle1 - pathAngle1) < 0.3 && distanceFromCenter > 3;
        const inPath2 = Math.abs(angle2 - pathAngle2) < 0.3 && distanceFromCenter > 3;
        
        // Avoid placing terrain in path corridors beyond 3 MU from center
        if (!inPath1 && !inPath2) {
          break;
        }
      } while (true);
      
      // Choose terrain type based on density
      const terrainType = this.selectTerrainType(terrainDensity);
      element = this.createTerrainElement(terrainType, x, y);
      terrain.push(element);
    }
    
    // Add guaranteed path markers (for AI navigation)
    const paths = [
      { start: { x: -10, y: -2 }, end: { x: 10, y: 2 }, angle: pathAngle1 },
      { start: { x: -10, y: 2 }, end: { x: 10, y: -2 }, angle: pathAngle2 }
    ];
    
    return {
      terrain: terrain,
      paths: paths,
      visibility: visibility,
      terrainDensity: terrainDensity,
      sizeMU: battlefieldSizeMU,
      deployment: {
        sideA: { x: -10, y: 0, radius: 2 },
        sideB: { x: 10, y: 0, radius: 2 }
      }
    };
  }
  
  /**
   * Select terrain type based on density
   */
  selectTerrainType(density) {
    if (density <= 0.25) {
      return ['tree_single', 'debris'];
    } else if (density <= 0.50) {
      return ['tree_cluster', 'building', 'wall'];
    } else {
      return ['tree_stand', 'building_complex', 'wall_complex'];
    }
  }
  
  /**
   * Create terrain element
   */
  createTerrainElement(type, x, y) {
    switch(type) {
      case 'tree_single':
        return { type: 'tree', x: x, y: y, radius: 0.5, losBlocking: true };
      case 'tree_cluster':
        return { type: 'tree_cluster', x: x, y: y, radius: 1.5, losBlocking: true };
      case 'tree_stand':
        return { type: 'tree_stand', x: x, y: y, radius: 3, losBlocking: true };
      case 'building':
        return { type: 'building', x: x, y: y, width: 3, depth: 3, losBlocking: true };
      case 'building_complex':
        return { type: 'building_complex', x: x, y: y, width: 5, depth: 5, losBlocking: true };
      case 'wall':
        return { type: 'wall', x: x, y: y, length: 4, rotation: Math.random() * Math.PI, losBlocking: true };
      case 'debris':
        return { type: 'debris', x: x, y: y, radius: 1, losBlocking: false };
      default:
        return { type: 'tree', x: x, y: y, radius: 1, losBlocking: true };
    }
  }
  
  /**
   * Check LOS blocking beyond 8 MU
   */
  checkLOSBlocking(terrain, source, target, visibilityLimit) {
    const distance = Math.sqrt(Math.pow(target.x - source.x, 2) + Math.pow(target.y - source.y, 2));
    
    if (distance <= 8) {
      // Within 8 MU, LOS is generally clear
      return false;
    }
    
    if (distance > visibilityLimit) {
      // Beyond visibility limit, automatically blocked
      return true;
    }
    
    // Check terrain blocking between 8 MU and visibility limit
    return this.checkTerrainBlocking(terrain, source, target);
  }
  
  /**
   * Check if terrain blocks LOS
   */
  checkTerrainBlocking(terrain, source, target) {
    // Simplified line intersection check
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    for (const element of terrain) {
      if (!element.losBlocking) continue;
      
      if (element.type === 'wall') {
        // Wall blocking logic
        if (this.doesWallBlock(source, target, element)) {
          return true;
        }
      } else {
        // Circular/rectangular blocking logic
        const closestPoint = this.getClosestPointOnLine(source, target, element);
        const elementDistance = this.getDistanceToElement(closestPoint, element);
        
        if (elementDistance < (element.radius || 1)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Utility methods for geometry calculations
  doesWallBlock(source, target, wall) {
    // Simplified wall blocking
    const wallCenterX = wall.x;
    const wallCenterY = wall.y;
    const wallEndX = wall.x + Math.cos(wall.rotation) * wall.length / 2;
    const wallEndY = wall.y + Math.sin(wall.rotation) * wall.length / 2;
    
    // Check if line intersects wall
    return this.linesIntersect(
      source.x, source.y, target.x, target.y,
      wallCenterX, wallCenterY, wallEndX, wallEndY
    );
  }
  
  getClosestPointOnLine(start, end, element) {
    // Simplified closest point calculation
    return {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };
  }
  
  getDistanceToElement(point, element) {
    return Math.sqrt(Math.pow(point.x - element.x, 2) + Math.pow(point.y - element.y, 2));
  }
  
  linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    // Line intersection algorithm
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return false;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
}
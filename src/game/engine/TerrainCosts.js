// /src/engine/TerrainCosts.js
/**
 * MEST QSR terrain movement costs
 */
export const TERRAIN_COSTS = {
  // Clear terrain (default)
  clear: { apCost: 1, name: 'Clear' },
  
  // Rough terrain (2x cost)
  rough: { apCost: 2, name: 'Rough' },
  
  // Difficult terrain (3x cost)
  difficult: { apCost: 3, name: 'Difficult' },
  
  // Impassable terrain (infinite cost)
  impassable: { apCost: Infinity, name: 'Impassable' }
};

/**
 * Determine terrain type at position
 */
export function getTerrainTypeAtPosition(x, y, terrain) {
  // Check for impassable first (walls, buildings, trees)
  for (const obj of terrain) {
    if (isPointInTerrain(x, y, obj)) {
      // Impassable terrain
      if (obj.type === 'wall' || 
          obj.type === 'building' || 
          obj.type.startsWith('tree')) {
        return 'impassable';
      }
      
      // Hills are difficult terrain
      if (obj.type === 'hill') {
        return 'difficult';
      }
      
      // Debris/rough ground
      if (obj.type === 'debris') {
        return 'rough';
      }
    }
  }
  
  // Default to clear terrain
  return 'clear';
}

/**
 * Check if point is inside terrain object
 */
function isPointInTerrain(x, y, obj) {
  switch(obj.type) {
    case 'hill':
      const hillDistance = Math.sqrt(
        Math.pow(x - obj.position.x, 2) +
        Math.pow(y - obj.position.y, 2)
      );
      return hillDistance <= obj.totalRadiusMU;
      
    case 'building':
    case 'wall':
      const halfWidth = obj.size.width / 2;
      const halfDepth = obj.size.depth / 2;
      return (
        x >= obj.position.x - halfWidth &&
        x <= obj.position.x + halfWidth &&
        y >= obj.position.y - halfDepth &&
        y <= obj.position.y + halfDepth
      );
      
    case 'tree_single':
      return Math.sqrt(
        Math.pow(x - obj.position.x, 2) +
        Math.pow(y - obj.position.y, 2)
      ) <= 0.5;
      
    case 'tree_cluster':
      return Math.sqrt(
        Math.pow(x - obj.position.x, 2) +
        Math.pow(y - obj.position.y, 2)
      ) <= 3;
      
    case 'tree_stand':
      return Math.sqrt(
        Math.pow(x - obj.position.x, 2) +
        Math.pow(y - obj.position.y, 2)
      ) <= 6;
      
    case 'debris':
      return Math.sqrt(
        Math.pow(x - obj.position.x, 2) +
        Math.pow(y - obj.position.y, 2)
      ) <= 1;
      
    default:
      return false;
  }
}
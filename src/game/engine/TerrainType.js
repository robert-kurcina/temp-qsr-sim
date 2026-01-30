// /src/engine/TerrainType.js
import { TERRAIN_COSTS } from './Constants.js';

/**
 * Determine terrain type at position based on QSR rules
 */
export function getTerrainTypeAtPosition(x, y, terrain) {
  for (const obj of terrain) {
    if (isPointInTerrain(x, y, obj)) {
      // Impassable terrain
      if (obj.type === 'building' || obj.type === 'wall') {
        return 'impassable';
      }
      
      // Tree terrain costs
      if (obj.type === 'tree_stand') return 'difficult';
      if (obj.type === 'tree_cluster') return 'rough';
      if (obj.type === 'tree_single') return 'clear';
      
      // Hills: plateau=clear, slope=rough
      if (obj.type === 'hill') {
        const distance = Math.sqrt(
          Math.pow(x - obj.position.x, 2) +
          Math.pow(y - obj.position.y, 2)
        );
        if (distance <= obj.plateauRadiusMU) return 'clear';
        if (distance <= obj.totalRadiusMU) return 'rough';
      }
      
      // Debris = rough
      if (obj.type === 'debris') return 'rough';
    }
  }
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
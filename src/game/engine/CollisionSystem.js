// /src/engine/CollisionSystem.js
/**
 * Comprehensive collision detection for MEST terrain
 */
export class CollisionSystem {
  constructor(battlefieldSizeMU) {
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.objects = [];
  }
  
  /**
   * Add object to collision system
   */
  addObject(object) {
    this.objects.push(object);
  }
  
  /**
   * Remove object from collision system
   */
  removeObject(objectId) {
    this.objects = this.objects.filter(obj => obj.id !== objectId);
  }
  
  /**
   * Check if placement is valid with all constraints
   */
  isValidPlacement(newObject) {
    // Check battlefield bounds (allow partial placement)
    if (!this.isWithinBattlefieldBounds(newObject)) {
      return { valid: false, reason: 'outside_bounds' };
    }
    
    // Check against all existing objects
    for (const existing of this.objects) {
      if (this.objectsIntersect(newObject, existing)) {
        const constraint = this.checkPlacementConstraints(newObject, existing);
        if (!constraint.valid) {
          return constraint;
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Allow partial placement (clipped within viewport)
   */
  isWithinBattlefieldBounds(object) {
    const halfBattlefield = this.battlefieldSizeMU / 2;
    const objectRadius = this.getObjectRadius(object);
    
    // Allow object to be partially outside battlefield
    // Only require that some part is within bounds
    const minX = object.position.x - objectRadius;
    const maxX = object.position.x + objectRadius;
    const minY = object.position.y - objectRadius;
    const maxY = object.position.y + objectRadius;
    
    // Check if any part overlaps battlefield
    return !(maxX < -halfBattlefield || 
             minX > halfBattlefield || 
             maxY < -halfBattlefield || 
             minY > halfBattlefield);
  }
  
  /**
   * Get object radius for collision detection
   */
  getObjectRadius(object) {
    switch(object.type) {
      case 'hill':
        return object.totalRadiusMU;
      case 'tree_single':
        return 0.5; // Tree trunk radius
      case 'tree_cluster':
        return 3; // Approximate cluster radius
      case 'tree_stand':
        return 6; // Approximate stand radius
      case 'building':
        return Math.max(object.size.width, object.size.depth) / 2;
      case 'wall':
        return Math.max(object.size.width, object.size.depth) / 2;
      default:
        return 1;
    }
  }
  
  /**
   * Check if two objects intersect
   */
  objectsIntersect(obj1, obj2) {
    const distance = Math.sqrt(
      Math.pow(obj1.position.x - obj2.position.x, 2) +
      Math.pow(obj1.position.y - obj2.position.y, 2)
    );
    
    const radius1 = this.getObjectRadius(obj1);
    const radius2 = this.getObjectRadius(obj2);
    
    return distance < (radius1 + radius2);
  }
  
  /**
   * Check specific placement constraints
   */
  checkPlacementConstraints(newObj, existingObj) {
    // Hill-on-Hill stacking rules
    if (newObj.type === 'hill' && existingObj.type === 'hill') {
      if (this.canPlaceHillOnHill(newObj, existingObj)) {
        return { valid: true };
      }
      return { valid: false, reason: 'hill_stacking_violation' };
    }
    
    // Tree-on-Hill placement
    if ((newObj.type.startsWith('tree') || newObj.type === 'hill') && 
        existingObj.type === 'hill') {
      if (this.canPlaceOnHill(newObj, existingObj)) {
        return { valid: true };
      }
      return { valid: false, reason: 'not_on_hill_plateau' };
    }
    
    // Building/Wall intersection rules
    const buildingWallTypes = ['building', 'wall'];
    if (buildingWallTypes.includes(newObj.type) && 
        buildingWallTypes.includes(existingObj.type)) {
      return { valid: false, reason: 'building_wall_intersection' };
    }
    
    // Trees/Hills cannot intersect Buildings/Walls
    const terrainTypes = ['tree_single', 'tree_cluster', 'tree_stand', 'hill'];
    if (terrainTypes.includes(newObj.type) && 
        buildingWallTypes.includes(existingObj.type)) {
      return { valid: false, reason: 'terrain_building_intersection' };
    }
    
    // Default: allow intersection (for non-constrained cases)
    return { valid: true };
  }
  
  /**
   * Check if hill can be placed on another hill
   */
  canPlaceHillOnHill(newHill, existingHill) {
    const sizeOrder = { 'small': 1, 'medium': 2, 'large': 3 };
    
    // Must be smaller hill on larger hill
    if (sizeOrder[newHill.sizeCategory] >= sizeOrder[existingHill.sizeCategory]) {
      return false;
    }
    
    // Must fit entirely within plateau
    const distance = Math.sqrt(
      Math.pow(newHill.position.x - existingHill.position.x, 2) +
      Math.pow(newHill.position.y - existingHill.position.y, 2)
    );
    
    const requiredClearance = existingHill.plateauRadiusMU - newHill.totalRadiusMU;
    return distance <= requiredClearance;
  }
  
  /**
   * Check if object can be placed on hill plateau
   */
  canPlaceOnHill(object, hill) {
    const distance = Math.sqrt(
      Math.pow(object.position.x - hill.position.x, 2) +
      Math.pow(object.position.y - hill.position.y, 2)
    );
    
    // Object must be within hill's plateau
    return distance <= hill.plateauRadiusMU;
  }
}
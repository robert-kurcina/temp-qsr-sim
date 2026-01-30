// /src/engine/ElevationSystem.js
/**
 * Handles elevation advantages from hills
 */
export class ElevationSystem {
  constructor(terrain) {
    this.terrain = terrain;
  }
  
  /**
   * Get elevation at position (in MU)
   */
  getElevationAt(x, y) {
    for (const obj of this.terrain) {
      if (obj.type === 'hill') {
        const distance = Math.sqrt(
          Math.pow(x - obj.position.x, 2) +
          Math.pow(y - obj.position.y, 2)
        );
        
        // Check if on plateau (flat top)
        if (distance <= obj.plateauRadiusMU) {
          return obj.elevation; // Full elevation
        }
        
        // On slope - calculate partial elevation
        if (distance <= obj.totalRadiusMU) {
          const slopeProgress = (distance - obj.plateauRadiusMU) / 
                               (obj.totalRadiusMU - obj.plateauRadiusMU);
          return obj.elevation * (1 - slopeProgress);
        }
      }
    }
    return 0; // Ground level
  }
  
  /**
   * Check if model has elevation advantage over target
   */
  hasElevationAdvantage(observerPos, targetPos) {
    const observerElevation = this.getElevationAt(observerPos.x, observerPos.y);
    const targetElevation = this.getElevationAt(targetPos.x, targetPos.y);
    
    // Elevation advantage if significantly higher
    return (observerElevation - targetElevation) >= 0.5;
  }
  
  /**
   * Modify LOS calculation with elevation
   */
  canSeeWithElevation(fromPos, toPos, terrain) {
    const fromElevation = this.getElevationAt(fromPos.x, fromPos.y);
    const toElevation = this.getElevationAt(toPos.x, toPos.y);
    
    // Eye level includes model height + elevation
    const fromEyeLevel = 0.5 + fromElevation; // Model eye level + elevation
    const toEyeLevel = 0.5 + toElevation;
    
    // Raycast from elevated position
    const origin = new THREE.Vector3(fromPos.x, fromPos.y, fromEyeLevel);
    const target = new THREE.Vector3(toPos.x, toPos.y, toEyeLevel);
    const direction = new THREE.Vector3().subVectors(target, origin).normalize();
    const distance = origin.distanceTo(target);
    
    const raycaster = new THREE.Raycaster();
    raycaster.set(origin, direction);
    
    // Check terrain intersections
    for (const obj of terrain) {
      if (obj.blocking) {
        const intersects = raycaster.intersectObject(obj.mesh, true);
        for (const hit of intersects) {
          if (hit.distance < distance) {
            return false; // Blocked
          }
        }
      }
    }
    
    return true; // Clear LOS with elevation
  }
}
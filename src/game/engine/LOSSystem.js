// /src/engine/LOSSystem.js
/**
 * Line of Sight system with MEST QSR rules
 */
export class LOSSystem {
  constructor(terrain) {
    this.terrain = terrain;
    this.raycaster = new THREE.Raycaster();
  }
  
  /**
   * Check if there's clear LOS between two positions
   * Only validates paths > 8 MU (QSR rule)
   */
  hasClearLOS(fromPos, toPos) {
    const distance = Math.sqrt(
      Math.pow(fromPos.x - toPos.x, 2) +
      Math.pow(fromPos.y - toPos.y, 2)
    );
    
    // QSR: Only check LOS for distances > 8 MU
    if (distance <= 8) {
      return true;
    }
    
    // Raycast at eye level
    const origin = new THREE.Vector3(fromPos.x, fromPos.y, 0.5);
    const target = new THREE.Vector3(toPos.x, toPos.y, 0.5);
    const direction = new THREE.Vector3().subVectors(target, origin).normalize();
    const rayDistance = origin.distanceTo(target);
    
    this.raycaster.set(origin, direction);
    
    // Check against blocking terrain
    for (const obj of this.terrain) {
      if (obj.blocking) {
        const intersects = this.raycaster.intersectObject(obj.mesh, true);
        for (const hit of intersects) {
          if (hit.distance < rayDistance) {
            return false; // Blocked
          }
        }
      }
    }
    
    return true; // Clear LOS
  }
}
// /src/engine/TacticalAI.js
/**
 * AI that moves to avoid LOS and seek cover
 */
export class TacticalAI {
  constructor(pathfinder, coverSystem) {
    this.pathfinder = pathfinder;
    this.coverSystem = coverSystem;
  }
  
  /**
   * Move model to target while avoiding LOS and seeking cover
   */
  moveTactically(model, targetPos, enemyModels) {
    // First, check if current position has good cover
    const currentCover = this.coverSystem.analyzeCover(model.position, enemyModels);
    
    // Find best cover position near target
    const bestCover = this.coverSystem.findBestCoverPosition(targetPos, enemyModels);
    
    if (bestCover && bestCover.cover.type !== 'none') {
      // Path to best cover position
      const path = this.pathfinder.findPath(model.position, bestCover);
      if (path) {
        return {
          path: path,
          reason: `Moving to ${bestCover.cover.description}`,
          coverQuality: bestCover.cover.type
        };
      }
    }
    
    // Fallback: direct path to target
    const directPath = this.pathfinder.findPath(model.position, targetPos);
    if (directPath) {
      return {
        path: directPath,
        reason: 'Direct path to target',
        coverQuality: currentCover.type
      };
    }
    
    return null; // No path found
  }
  
  /**
   * Find position that avoids LOS from all enemies
   */
  findLOSFreePosition(model, enemyModels, searchRadius = 6) {
    const candidates = [];
    
    // Search around model's current position
    for (let radius = 1; radius <= searchRadius; radius += 1) {
      const samples = Math.ceil(radius * 6);
      
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const testX = model.position.x + Math.cos(angle) * radius;
        const testY = model.position.y + Math.sin(angle) * radius;
        
        // Skip blocked positions
        if (this.coverSystem.isPositionBlocked(testX, testY)) continue;
        
        // Check if position is LOS-free from all enemies
        let losFree = true;
        for (const enemy of enemyModels) {
          const distance = Math.sqrt(
            Math.pow(testX - enemy.position.x, 2) +
            Math.pow(testY - enemy.position.y, 2)
          );
          
          // Only care about distances > 8 MU (QSR rule)
          if (distance > 8) {
            const coverType = this.coverSystem.getCoverType(
              { x: testX, y: testY },
              enemy.position
            );
            if (coverType === 'none') {
              losFree = false;
              break;
            }
          }
        }
        
        if (losFree) {
          candidates.push({ x: testX, y: testY });
        }
      }
    }
    
    // Return closest candidate
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.x - model.position.x, 2) + Math.pow(a.y - model.position.y, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.x - model.position.x, 2) + Math.pow(b.y - model.position.y, 2)
        );
        return distA - distB;
      });
      
      return candidates[0];
    }
    
    return null;
  }
}
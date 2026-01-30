// /src/engine/CoverSystem.js
/**
 * Determines cover quality and tactical positioning
 */
export class CoverSystem {
  constructor(terrain, models) {
    this.terrain = terrain;
    this.models = models;
    this.raycaster = new THREE.Raycaster();
  }
  
  /**
   * Analyze cover for a position against all enemy models
   */
  analyzeCover(position, enemyModels) {
    let bestCover = 'none';
    let coverCount = 0;
    
    for (const enemy of enemyModels) {
      const coverType = this.getCoverType(position, enemy.position);
      if (coverType !== 'none') {
        coverCount++;
        // Upgrade cover quality if better
        if (this.getCoverPriority(coverType) > this.getCoverPriority(bestCover)) {
          bestCover = coverType;
        }
      }
    }
    
    return {
      type: bestCover,
      effectiveness: coverCount / enemyModels.length, // Percentage of enemies covered from
      description: this.getCoverDescription(bestCover)
    };
  }
  
  /**
   * Get cover type between two positions
   */
  getCoverType(fromPos, toPos) {
    const origin = new THREE.Vector3(fromPos.x, fromPos.y, 0.5); // Eye level
    const target = new THREE.Vector3(toPos.x, toPos.y, 0.5);
    const direction = new THREE.Vector3().subVectors(target, origin).normalize();
    const distance = origin.distanceTo(target);
    
    this.raycaster.set(origin, direction);
    
    // Check all terrain objects
    for (const obj of this.terrain) {
      if (obj.blocking) {
        const intersects = this.raycaster.intersectObject(obj.mesh, true);
        for (const hit of intersects) {
          if (hit.distance < distance) {
            return this.classifyCover(obj);
          }
        }
      }
    }
    
    return 'none';
  }
  
  /**
   * Classify terrain object as cover type
   */
  classifyCover(obj) {
    switch(obj.type) {
      case 'building':
      case 'wall':
        return 'hard'; // Hard cover
        
      case 'tree_stand':
      case 'tree_cluster':
        return 'soft'; // Soft cover
        
      case 'tree_single':
      case 'debris':
        return 'partial'; // Partial cover
        
      case 'hill':
        // Hills provide elevation advantage, not cover
        return 'elevation';
        
      default:
        return 'none';
    }
  }
  
  /**
   * Get cover priority (higher = better)
   */
  getCoverPriority(coverType) {
    const priorities = {
      'none': 0,
      'partial': 1,
      'soft': 2,
      'hard': 3,
      'elevation': 2 // Elevation is tactically valuable
    };
    return priorities[coverType] || 0;
  }
  
  /**
   * Get cover description
   */
  getCoverDescription(coverType) {
    const descriptions = {
      'none': 'No cover',
      'partial': 'Partial cover (+1 REF)',
      'soft': 'Soft cover (+2 REF)',
      'hard': 'Hard cover (+3 REF)',
      'elevation': 'Elevation advantage'
    };
    return descriptions[coverType] || 'Unknown cover';
  }
  
  /**
   * Find best cover position near target
   */
  findBestCoverPosition(targetPos, enemyModels, searchRadius = 4) {
    let bestPosition = null;
    let bestScore = -1;
    
    // Search in expanding circles
    for (let radius = 1; radius <= searchRadius; radius += 0.5) {
      const samples = Math.ceil(radius * 8);
      
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const testX = targetPos.x + Math.cos(angle) * radius;
        const testY = targetPos.y + Math.sin(angle) * radius;
        
        // Skip if position is blocked
        if (this.isPositionBlocked(testX, testY)) continue;
        
        // Analyze cover
        const cover = this.analyzeCover({ x: testX, y: testY }, enemyModels);
        const score = this.calculateCoverScore(cover, testX, testY, targetPos);
        
        if (score > bestScore) {
          bestScore = score;
          bestPosition = { x: testX, y: testY, cover: cover };
        }
      }
    }
    
    return bestPosition;
  }
  
  /**
   * Calculate tactical score for position
   */
  calculateCoverScore(cover, x, y, targetPos) {
    // Base score from cover quality
    let score = this.getCoverPriority(cover.type) * 10;
    
    // Bonus for being close to target
    const distanceToTarget = Math.sqrt(
      Math.pow(x - targetPos.x, 2) + Math.pow(y - targetPos.y, 2)
    );
    score += Math.max(0, 10 - distanceToTarget);
    
    // Penalty for being exposed to many enemies
    score -= (1 - cover.effectiveness) * 5;
    
    return score;
  }
  
  /**
   * Check if position is blocked
   */
  isPositionBlocked(x, y) {
    for (const obj of this.terrain) {
      if (obj.blocking && this.isPointInTerrain(x, y, obj)) {
        return true;
      }
    }
    return false;
  }
  
  isPointInTerrain(x, y, obj) {
    // Same implementation as Pathfinder
    switch(obj.type) {
      case 'hill':
        const distance = Math.sqrt(
          Math.pow(x - obj.position.x, 2) +
          Math.pow(y - obj.position.y, 2)
        );
        return distance <= obj.totalRadiusMU;
        
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
        
      default:
        return false;
    }
  }
}
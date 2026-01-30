// /src/engine/CoverBonusSystem.js
/**
 * Calculates cover bonuses during movement
 */
export class CoverBonusSystem {
  constructor(coverSystem, elevationSystem) {
    this.coverSystem = coverSystem;
    this.elevationSystem = elevationSystem;
  }
  
  /**
   * Calculate total defensive bonus at position
   */
  calculateDefensiveBonus(position, enemyModels) {
    let totalBonus = 0;
    let coverType = 'none';
    
    // Get cover from enemies
    const coverAnalysis = this.coverSystem.analyzeCover(position, enemyModels);
    coverType = coverAnalysis.type;
    
    // Add cover bonus
    switch(coverType) {
      case 'hard':
        totalBonus += 3; // +3 REF
        break;
      case 'soft':
        totalBonus += 2; // +2 REF  
        break;
      case 'partial':
        totalBonus += 1; // +1 REF
        break;
    }
    
    // Add elevation bonus
    if (this.hasElevationAdvantageFromEnemies(position, enemyModels)) {
      totalBonus += 1; // Elevation advantage bonus
    }
    
    return {
      total: totalBonus,
      cover: coverType,
      elevation: this.hasElevationAdvantageFromEnemies(position, enemyModels),
      description: this.getBonusDescription(totalBonus, coverType)
    };
  }
  
  /**
   * Check if position has elevation advantage over all enemies
   */
  hasElevationAdvantageFromEnemies(position, enemyModels) {
    for (const enemy of enemyModels) {
      if (!this.elevationSystem.hasElevationAdvantage(position, enemy.position)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get bonus description
   */
  getBonusDescription(total, coverType) {
    const descriptions = [];
    
    if (coverType === 'hard') descriptions.push('+3 Hard Cover');
    else if (coverType === 'soft') descriptions.push('+2 Soft Cover');
    else if (coverType === 'partial') descriptions.push('+1 Partial Cover');
    
    if (total > (coverType === 'hard' ? 3 : coverType === 'soft' ? 2 : coverType === 'partial' ? 1 : 0)) {
      descriptions.push('+1 Elevation');
    }
    
    return descriptions.join(', ') || 'No bonus';
  }
  
  /**
   * Find best defensive position within movement range
   */
  findBestDefensivePosition(startPos, enemyModels, maxAP, terrain) {
    let bestPosition = null;
    let bestScore = -1;
    
    // Search within movement range
    const maxDistance = maxAP * 2; // Maximum possible with difficult terrain
    
    for (let radius = 0; radius <= maxDistance; radius += 0.5) {
      const samples = Math.ceil(radius * 8);
      
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const testX = startPos.x + Math.cos(angle) * radius;
        const testY = startPos.y + Math.sin(angle) * radius;
        
        // Skip impassable positions
        if (this.isPositionImpassable(testX, testY, terrain)) continue;
        
        // Calculate AP cost to reach position
        const pathfinder = new Pathfinder(terrain, 48); // Assuming large battlefield
        const pathResult = pathfinder.findPathWithCost(startPos, {x: testX, y: testY});
        if (!pathResult || pathResult.cost > maxAP) continue;
        
        // Calculate defensive bonus
        const bonus = this.calculateDefensiveBonus({x: testX, y: testY}, enemyModels);
        const score = bonus.total - pathResult.cost; // Bonus minus movement cost
        
        if (score > bestScore) {
          bestScore = score;
          bestPosition = {
            x: testX,
            y: testY,
            bonus: bonus,
            apCost: pathResult.cost
          };
        }
      }
    }
    
    return bestPosition;
  }
  
  /**
   * Check if position is impassable
   */
  isPositionImpassable(x, y, terrain) {
    const terrainType = getTerrainTypeAtPosition(x, y, terrain);
    return terrainType === 'impassable';
  }
}
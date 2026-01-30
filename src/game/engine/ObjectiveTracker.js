// /src/engine/ObjectiveTracker.js
/**
 * Objective Tracker - monitors and validates mission objectives
 */
export class ObjectiveTracker {
  constructor() {
    this.objectives = [];
  }
  
  /**
   * Set objectives to track
   */
  setObjectives(objectives) {
    this.objectives = objectives.map((obj, index) => ({
      ...obj,
      id: `objective-${index}`,
      side: obj.side || 'side-a'
    }));
  }
  
  /**
   * Check all objectives and return completion status
   */
  checkObjectives(models, tokenManager) {
    const completed = [];
    const active = [];
    
    this.objectives.forEach(objective => {
      const isCompleted = this.checkObjective(objective, models, tokenManager);
      
      if (isCompleted) {
        completed.push(objective);
      } else {
        active.push(objective);
      }
    });
    
    return { completed, active };
  }
  
  /**
   * Check individual objective
   */
  checkObjective(objective, models, tokenManager) {
    switch(objective.type) {
      case 'eliminate':
        return this.checkEliminateObjective(objective, models, tokenManager);
        
      case 'control':
        return this.checkControlObjective(objective, models);
        
      case 'survive':
        return this.checkSurviveObjective(objective, models, tokenManager);
        
      default:
        return false;
    }
  }
  
  /**
   * Check eliminate objective
   */
  checkEliminateObjective(objective, models, tokenManager) {
    const targetModel = models.find(m => m.identifier === objective.target);
    if (!targetModel) return true; // Already eliminated
    
    const tokens = tokenManager.getTokenCounts(targetModel.id);
    return tokens.ko > 0 || tokens.eliminated > 0;
  }
  
  /**
   * Check control objective
   */
  checkControlObjective(objective, models) {
    if (!objective.location || !objective.duration) return false;
    
    const { x, y, radius } = objective.location;
    const controllingSide = this.getControllingSide(x, y, radius, models);
    
    // For now, assume immediate control if friendly models are present
    return controllingSide === objective.side;
  }
  
  /**
   * Get controlling side of area
   */
  getControllingSide(x, y, radius, models) {
    const friendlyModels = models.filter(m => 
      m.side === 'side-a' && 
      this.isInArea(m.position, x, y, radius)
    );
    
    const enemyModels = models.filter(m => 
      m.side === 'side-b' && 
      this.isInArea(m.position, x, y, radius)
    );
    
    if (friendlyModels.length > enemyModels.length) return 'side-a';
    if (enemyModels.length > friendlyModels.length) return 'side-b';
    return null; // Contested
  }
  
  /**
   * Check if position is in area
   */
  isInArea(position, centerX, centerY, radius) {
    const distance = Math.sqrt(
      Math.pow(position.x - centerX, 2) +
      Math.pow(position.y - centerY, 2)
    );
    return distance <= radius;
  }
  
  /**
   * Check survive objective
   */
  checkSurviveObjective(objective, models, tokenManager) {
    if (!objective.turns) return false;
    
    // Count surviving models for side
    const sideModels = models.filter(m => m.side === objective.side);
    const survivors = sideModels.filter(model => {
      const tokens = tokenManager.getTokenCounts(model.id);
      return tokens.ko === 0 && tokens.eliminated === 0;
    });
    
    // Check if enough models survived required turns
    return survivors.length > 0 && this.currentTurn >= objective.turns;
  }
}
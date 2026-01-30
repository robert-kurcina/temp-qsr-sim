// /src/engine/AIDecisionEngine.js
/**
 * AI Decision Engine for automated combat
 */
export class AIDecisionEngine {
  constructor(combatSystem, actionSystem, tokenManager) {
    this.combatSystem = combatSystem;
    this.actionSystem = actionSystem;
    this.tokenManager = tokenManager;
  }
  
  /**
   * Decide best action for model
   */
  decideAction(model, gameState) {
    const availableActions = this.getActionOptions(model, gameState);
    
    // Score each action
    const scoredActions = availableActions.map(action => ({
      ...action,
      score: this.scoreAction(action, model, gameState)
    }));
    
    // Return highest scoring action
    return scoredActions.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }
  
  /**
   * Get available actions for model
   */
  getActionOptions(model, gameState) {
    const actions = [];
    const enemyModels = gameState.models.filter(m => m.side !== model.side);
    
    // Move action
    if (this.canMove(model)) {
      const bestPosition = this.findBestCombatPosition(model, enemyModels);
      if (bestPosition) {
        actions.push({
          type: 'move',
          target: bestPosition,
          cost: 1
        });
      }
    }
    
    // Combat actions
    const visibleEnemies = this.getVisibleEnemies(model, enemyModels);
    visibleEnemies.forEach(enemy => {
      // Close combat
      if (this.isInRange(model, enemy, 1)) {
        actions.push({
          type: 'closeCombat',
          target: enemy,
          cost: 1
        });
      }
      
      // Ranged combat
      if (!this.isEngaged(model) && this.isInRange(model, enemy, 24)) {
        actions.push({
          type: 'rangedCombat',
          target: enemy,
          cost: 1
        });
      }
    });
    
    // Hide action
    if (this.canHide(model, enemyModels)) {
      actions.push({
        type: 'hide',
        cost: 1
      });
    }
    
    // Wait action
    actions.push({
      type: 'wait',
      cost: 0
    });
    
    return actions;
  }
  
  /**
   * Score an action based on tactical value
   */
  scoreAction(action, model, gameState) {
    let score = 0;
    
    switch(action.type) {
      case 'closeCombat':
        score = this.scoreCloseCombat(action.target, model);
        break;
        
      case 'rangedCombat':
        score = this.scoreRangedCombat(action.target, model);
        break;
        
      case 'move':
        score = this.scoreMovement(action.target, model, gameState);
        break;
        
      case 'hide':
        score = this.scoreHide(model, gameState);
        break;
        
      case 'wait':
        score = this.scoreWait(model, gameState);
        break;
    }
    
    // Apply AP cost penalty
    score -= (action.cost || 0) * 2;
    
    return score;
  }
  
  /**
   * Score close combat action
   */
  scoreCloseCombat(target, attacker) {
    // Estimate hit probability
    const combatResult = this.combatSystem.resolveCombat(attacker, target, 'melee', { simulate: true });
    if (combatResult.hit && combatResult.damage) {
      return 10; // High value if likely to wound
    } else if (combatResult.hit) {
      return 5; // Medium value if likely to hit
    }
    return 1; // Low value
  }
  
  /**
   * Score ranged combat action
   */
  scoreRangedCombat(target, attacker) {
    const combatResult = this.combatSystem.resolveCombat(attacker, target, 'ranged', { simulate: true });
    if (combatResult.hit && combatResult.damage) {
      return 8; // High value
    } else if (combatResult.hit) {
      return 4; // Medium value
    }
    return 2; // Low value (still worth trying)
  }
  
  /**
   * Find best combat position
   */
  findBestCombatPosition(model, enemies) {
    // This would use the TacticalAI system you already have
    // Return optimal position for engaging enemies
    return null; // Placeholder
  }
  
  // Helper methods
  canMove(model) {
    return this.getAvailableAP(model) >= 1;
  }
  
  getAvailableAP(model) {
    return 2 - (model.apSpent || 0) - this.getDelayTokenCount(model.id);
  }
  
  getDelayTokenCount(modelId) {
    return this.tokenManager.getTokenCounts(modelId).delay || 0;
  }
  
  isInRange(modelA, modelB, range) {
    const distance = Math.sqrt(
      Math.pow(modelA.position.x - modelB.position.x, 2) +
      Math.pow(modelA.position.y - modelB.position.y, 2)
    );
    return distance <= range;
  }
  
  isEngaged(model) {
    return this.combatSystem.isEngaged(model);
  }
  
  getVisibleEnemies(model, enemies) {
    return enemies.filter(enemy => {
      const distance = this.isInRange(model, enemy, 8);
      if (distance) return true;
      // Check LOS for longer distances
      return true; // Simplified
    });
  }
  
  canHide(model, enemies) {
    const cover = this.combatSystem.coverSystem.analyzeCover(model.position, enemies);
    return cover.type !== 'none' && !this.isEngaged(model);
  }
  
  scoreMovement(position, model, gameState) {
    // Score based on tactical advantage
    return 3;
  }
  
  scoreHide(model, gameState) {
    return 4;
  }
  
  scoreWait(model, gameState) {
    return 1;
  }
}
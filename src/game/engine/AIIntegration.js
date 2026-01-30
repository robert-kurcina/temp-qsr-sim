// /src/engine/AIIntegration.js
import { UnifiedAICoordinator } from '../ai/UnifiedAICoordinator.js';

/**
 * AI integration for Three.js application
 */
export class AIIntegration {
  constructor(battlefieldEngine) {
    this.battlefieldEngine = battlefieldEngine;
    this.aiCoordinator = new UnifiedAICoordinator('threejs');
  }
  
  /**
   * Get AI suggestions for current player
   */
  getAISuggestions(currentSide) {
    const models = this.battlefieldEngine.models.filter(m => m.side === currentSide);
    const gameState = this.createGameState(currentSide);
    
    const suggestions = new Map();
    models.forEach(model => {
      const profile = this.aiCoordinator.getCharacterProfile(
        this.aiCoordinator.normalizeThreeJSModel(model)
      );
      const gameStateNormalized = this.aiCoordinator.normalizeGameState(gameState);
      const suggestedAction = profile.evaluateAction(
        this.aiCoordinator.normalizeThreeJSModel(model),
        gameStateNormalized
      );
      suggestions.set(model.id, suggestedAction);
    });
    
    return suggestions;
  }
  
  /**
   * Execute full AI turn for opponent
   */
  async executeAITurn(opponentSide) {
    const models = this.battlefieldEngine.models.filter(m => m.side === opponentSide);
    const gameState = this.createGameState(opponentSide);
    
    // Get coordinated actions
    const actions = this.aiCoordinator.coordinateTurn(opponentSide, models, gameState);
    
    // Execute actions with visual feedback
    for (const [modelId, action] of actions) {
      const model = this.battlefieldEngine.models.find(m => m.id === modelId);
      if (model) {
        await this.executeAIAction(model, action);
        
        // Small delay for visual pacing
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // End turn
    this.battlefieldEngine.endTurn();
  }
  
  /**
   * Execute single AI action with Three.js integration
   */
  async executeAIAction(model, action) {
    switch(action.type) {
      case 'move':
        await this.executeAIMovement(model, action.target);
        break;
      case 'closeCombat':
        await this.executeAICloseCombat(model, action.target);
        break;
      case 'rangedCombat':
        await this.executeAIRangedCombat(model, action.target);
        break;
      case 'wait':
        this.battlefieldEngine.tokenManager.addToken(model.id, 'wait');
        break;
      case 'support':
        // Healing/support logic
        break;
    }
  }
  
  /**
   * Execute AI movement with pathfinding
   */
  async executeAIMovement(model, targetPosition) {
    // Use existing pathfinding system
    const path = this.battlefieldEngine.pathfinder.findPath(
      model.position,
      targetPosition,
      model
    );
    
    if (path && path.length > 0) {
      // Animate movement along path
      for (let i = 1; i < path.length; i++) {
        await this.battlefieldEngine.moveModelTo(model, path[i]);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }
  
  /**
   * Execute AI close combat
   */
  async executeAICloseCombat(attacker, defender) {
    // Highlight combat participants
    this.highlightModel(attacker, '#ff0000');
    this.highlightModel(defender, '#ff0000');
    
    // Resolve combat
    const result = this.battlefieldEngine.combatSystem.resolveCombat(
      attacker, 
      defender, 
      'melee'
    );
    
    // Show combat result
    this.showCombatResult(result);
    
    // Restore normal highlighting
    setTimeout(() => {
      this.restoreModelHighlight(attacker);
      this.restoreModelHighlight(defender);
    }, 2000);
  }
  
  /**
   * Create game state for AI
   */
  createGameState(currentSide) {
    return {
      turn: this.battlefieldEngine.turn,
      models: this.battlefieldEngine.models,
      tokenManager: this.battlefieldEngine.tokenManager,
      terrain: this.battlefieldEngine.terrain,
      battlefieldSizeMU: this.battlefieldEngine.battlefieldSizeMU,
      currentSide: currentSide
    };
  }
  
  // Visual feedback methods
  highlightModel(model, color) {
    // Store original material
    if (!model.originalMaterial) {
      model.originalMaterial = model.mesh.material.clone();
    }
    
    // Apply highlight
    model.mesh.material = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color(color),
      wireframe: true
    });
  }
  
  restoreModelHighlight(model) {
    if (model.originalMaterial) {
      model.mesh.material = model.originalMaterial;
      model.originalMaterial = null;
    }
  }
  
  showCombatResult(result) {
    // Display combat result in UI
    const message = this.battlefieldEngine.combatSystem.getCombatSummary(result);
    this.battlefieldEngine.showMessage(message);
  }
}
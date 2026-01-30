// /src/engine/ActionSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { TERRAIN_COSTS } from './Constants.js';
import { getTerrainTypeAtPosition } from './TerrainType.js';

/**
 * MEST QSR canonical Action System with correct AP flow
 */
export class ActionSystem {
  constructor(models, terrain, battlefieldSizeMU, tokenSystem, hindranceTracker) {
    this.models = models;
    this.terrain = terrain;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.tokenSystem = tokenSystem;
    this.hindranceTracker = hindranceTracker;
    this.selectedModel = null;
    this.enemyModels = [];
    
    // Initialize subsystems
    this.losSystem = new LOSSystem(terrain);
    this.coverSystem = new CoverSystem(terrain, models);
    this.elevationSystem = new ElevationSystem(terrain);
    this.pathfinder = new Pathfinder(terrain, battlefieldSizeMU);
  }
  
  /**
   * Set selected model and update available actions
   */
  selectModel(model) {
    this.selectedModel = model;
    this.enemyModels = this.models.filter(m => m.side !== model.side);
    this.updateActionButtons();
  }
  
  /**
   * Get available AP for model (QSR compliant)
   */
  getAvailableAP(model) {
    let ap = 2; // Base 2 AP per activation
    
    // Remove Delay tokens first (mandatory cost)
    const delayTokens = this.getDelayTokenCount(model.id);
    ap -= delayTokens;
    
    return Math.max(0, ap);
  }
  
  /**
   * Get Delay token count
   */
  getDelayTokenCount(modelId) {
    const hindrances = this.hindranceTracker?.getHindrances(modelId) || { fear: 0, delay: 0, wounds: 0 };
    return hindrances.delay;
  }
  
  /**
   * Check if model can use Pushing
   */
  canUsePushing(model) {
    // Pushing requires no Delay tokens
    return this.getDelayTokenCount(model.id) === 0;
  }
  
  /**
   * Update action button states based on current context
   */
  updateActionButtons() {
    const model = this.selectedModel;
    if (!model) return;
    
    const apAvailable = this.getAvailableAP(model);
    const canPush = this.canUsePushing(model);
    const engaged = this.isEngaged(model);
    const inCover = this.getCoverQuality(model) !== 'none';
    const canSeeEnemies = this.canSeeAnyEnemy(model);
    
    const actions = {
      move: {
        enabled: apAvailable >= 1,
        reason: apAvailable >= 1 ? '' : 'No AP remaining'
      },
      hide: {
        enabled: apAvailable >= 1 && !engaged && inCover,
        reason: !inCover ? 'Must be in cover' : 
               engaged ? 'Cannot hide while engaged' :
               apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      wait: {
        enabled: true,
        reason: ''
      },
      closeCombat: {
        enabled: engaged && apAvailable >= 1,
        reason: !engaged ? 'Must be engaged in melee' : 
               apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      rangedCombat: {
        enabled: canSeeEnemies && apAvailable >= 1 && !engaged,
        reason: engaged ? 'Cannot make ranged attacks while engaged' :
               !canSeeEnemies ? 'No visible targets' :
               apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      refresh: {
        enabled: apAvailable >= 1,
        reason: apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      pushing: {
        enabled: canPush && apAvailable <= 0,
        reason: !canPush ? 'Has Delay tokens' : 
               apAvailable > 0 ? 'Already has AP available' : ''
      }
    };
    
    // Update UI buttons
    Object.entries(actions).forEach(([actionName, action]) => {
      const button = document.getElementById(`action-${actionName}`);
      if (button) {
        button.disabled = !action.enabled;
        button.title = action.reason || '';
        if (!action.enabled) {
          button.classList.add('opacity-50');
        } else {
          button.classList.remove('opacity-50');
        }
      }
    });
  }
  
  /**
   * Execute action
   */
  executeAction(actionName) {
    const model = this.selectedModel;
    if (!model) return;
    
    const actions = this.getAvailableActions();
    if (!actions[actionName]?.enabled) {
      console.warn(`Action ${actionName} not available`);
      return;
    }
    
    switch(actionName) {
      case 'move':
        // Movement handled by MovementSystem
        break;
      case 'hide':
        this.executeHide(model);
        break;
      case 'wait':
        this.executeWait(model);
        break;
      case 'closeCombat':
        this.executeCloseCombat(model);
        break;
      case 'rangedCombat':
        this.executeRangedCombat(model);
        break;
      case 'refresh':
        this.executeRefresh(model);
        break;
      case 'pushing':
        this.executePushing(model);
        break;
    }
    
    // Record action in history
    window.HISTORY_MANAGER?.saveState(
      window.BATTLEFIELD_ENGINE.terrain,
      window.BATTLEFIELD_ENGINE.models,
      `${actionName.charAt(0).toUpperCase() + actionName.slice(1)} ${model.identifier}`
    );
    
    // Update action buttons
    this.updateActionButtons();
  }
  
  /**
   * Execute Hide action
   */
  executeHide(model) {
    this.tokenSystem.addToken(model.id, 'hidden');
    console.log(`${model.identifier} is now hidden`);
  }
  
  /**
   * Execute Wait action
   */
  executeWait(model) {
    this.tokenSystem.addToken(model.id, 'wait');
    console.log(`${model.identifier} is waiting`);
  }
  
  /**
   * Execute Pushing action (QSR compliant)
   */
  executePushing(model) {
    // Pushing grants 1 AP and adds 1 Delay token (no AP cost)
    this.hindranceTracker.addHindrance(model.id, 'delay');
    console.log(`${model.identifier} used Pushing: gained 1 AP, acquired Delay token`);
    
    // Update action buttons to reflect new AP availability
    this.updateActionButtons();
  }
  
  // Other action implementations remain the same
  executeCloseCombat(model) {
    const target = this.getClosestEnemy(model, 1); // 1 MU range
    if (target) {
      console.log(`${model.identifier} attacks ${target.identifier} in close combat`);
    }
  }
  
  executeRangedCombat(model) {
    const visibleTargets = this.getVisibleEnemies(model);
    if (visibleTargets.length > 0) {
      const target = visibleTargets[0];
      console.log(`${model.identifier} makes ranged attack on ${target.identifier}`);
    }
  }
  
  executeRefresh(model) {
    model.refreshed = true;
    console.log(`${model.identifier} refreshed`);
  }
  
  /**
   * Get all available actions with validation
   */
  getAvailableActions() {
    const model = this.selectedModel;
    if (!model) return {};
    
    const apAvailable = this.getAvailableAP(model);
    const canPush = this.canUsePushing(model);
    const engaged = this.isEngaged(model);
    const inCover = this.getCoverQuality(model) !== 'none';
    const canSeeEnemies = this.canSeeAnyEnemy(model);
    
    return {
      move: {
        enabled: apAvailable >= 1,
        reason: apAvailable >= 1 ? '' : 'No AP remaining'
      },
      hide: {
        enabled: apAvailable >= 1 && !engaged && inCover,
        reason: !inCover ? 'Must be in cover' : 
               engaged ? 'Cannot hide while engaged' :
               apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      wait: {
        enabled: true,
        reason: ''
      },
      closeCombat: {
        enabled: engaged && apAvailable >= 1,
        reason: !engaged ? 'Must be engaged in melee' : 
               apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      rangedCombat: {
        enabled: canSeeEnemies && apAvailable >= 1 && !engaged,
        reason: engaged ? 'Cannot make ranged attacks while engaged' :
               !canSeeEnemies ? 'No visible targets' :
               apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      refresh: {
        enabled: apAvailable >= 1,
        reason: apAvailable < 1 ? 'Requires 1 AP' : ''
      },
      pushing: {
        enabled: canPush && apAvailable <= 0,
        reason: !canPush ? 'Has Delay tokens' : 
               apAvailable > 0 ? 'Already has AP available' : ''
      }
    };
  }
  
  // Helper methods
  isEngaged(model) {
    const meleeRange = 1; // 1 MU melee range
    for (const enemy of this.enemyModels) {
      const distance = Math.sqrt(
        Math.pow(model.position.x - enemy.position.x, 2) +
        Math.pow(model.position.y - enemy.position.y, 2)
      );
      if (distance <= meleeRange) {
        return true;
      }
    }
    return false;
  }
  
  getCoverQuality(model) {
    const cover = this.coverSystem.analyzeCover(model.position, this.enemyModels);
    return cover.type;
  }
  
  canSeeAnyEnemy(model) {
    for (const enemy of this.enemyModels) {
      const distance = Math.sqrt(
        Math.pow(model.position.x - enemy.position.x, 2) +
        Math.pow(model.position.y - enemy.position.y, 2)
      );
      if (distance <= 8) return true;
      if (this.losSystem.hasClearLOS(model.position, enemy.position)) {
        return true;
      }
    }
    return false;
  }
  
  getClosestEnemy(model, range) {
    let closest = null;
    let minDistance = Infinity;
    for (const enemy of this.enemyModels) {
      const distance = Math.sqrt(
        Math.pow(model.position.x - enemy.position.x, 2) +
        Math.pow(model.position.y - enemy.position.y, 2)
      );
      if (distance <= range && distance < minDistance) {
        minDistance = distance;
        closest = enemy;
      }
    }
    return closest;
  }
  
  getVisibleEnemies(model) {
    return this.enemyModels.filter(enemy => {
      const distance = Math.sqrt(
        Math.pow(model.position.x - enemy.position.x, 2) +
        Math.pow(model.position.y - enemy.position.y, 2)
      );
      if (distance <= 8) return true;
      return this.losSystem.hasClearLOS(model.position, enemy.position);
    });
  }
}
// /src/ai/UnifiedAICoordinator.js
import { CharacterBehaviorProfiles } from './CharacterBehaviorProfiles.js';
import { PlayerStrategems } from './PlayerStrategems.js';

/**
 * Unified AI coordinator that works in both headless and Three.js environments
 */
export class UnifiedAICoordinator {
  constructor(environment = 'headless') {
    this.environment = environment; // 'headless' or 'threejs'
    this.characterProfiles = new CharacterBehaviorProfiles();
    this.playerStrategems = new PlayerStrategems();
  }
  
  /**
   * Normalize game state between environments
   */
  normalizeGameState(rawGameState) {
    if (this.environment === 'threejs') {
      return this.normalizeThreeJSGameState(rawGameState);
    }
    return rawGameState; // Already normalized for headless
  }
  
  /**
   * Convert Three.js game state to normalized format
   */
  normalizeThreeJSGameState(threeJSState) {
    return {
      turn: threeJSState.turn,
      allModels: threeJSState.models.map(this.normalizeThreeJSModel.bind(this)),
      allies: threeJSState.models
        .filter(m => m.side === threeJSState.currentSide)
        .map(this.normalizeThreeJSModel.bind(this)),
      enemies: threeJSState.models
        .filter(m => m.side !== threeJSState.currentSide)
        .map(this.normalizeThreeJSModel.bind(this)),
      tokens: threeJSState.tokenManager.tokens,
      terrain: threeJSState.terrain, // Will be used for advanced positioning
      battlefieldSize: threeJSState.battlefieldSizeMU
    };
  }
  
  /**
   * Normalize Three.js model to AI format
   */
  normalizeThreeJSModel(threeJSModel) {
    return {
      id: threeJSModel.id,
      side: threeJSModel.side,
      archetype: threeJSModel.profile?.archetype || 'Average',
      cca: threeJSModel.profile?.cca || 2,
      rca: threeJSModel.profile?.rca || 2,
      ref: threeJSModel.profile?.ref || 2,
      int: threeJSModel.profile?.int || 2,
      pow: threeJSModel.profile?.pow || 2,
      str: threeJSModel.profile?.str || 2,
      for: threeJSModel.profile?.for || 2,
      mov: threeJSModel.profile?.mov || 2,
      siz: threeJSModel.profile?.siz || 3,
      traits: threeJSModel.profile?.traits || [],
      weapons: threeJSModel.weapons || [],
      armor: threeJSModel.armor || [],
      equipment: threeJSModel.equipment || [],
      position: {
        x: threeJSModel.position.x,
        y: threeJSModel.position.y
      },
      apSpent: threeJSModel.apSpent || 0,
      status: threeJSModel.status || 'attentive'
    };
  }
  
  /**
   * Get character behavior profile
   */
  getCharacterProfile(model) {
    // Same logic as before - works in both environments
    if (model.traits.includes('Leadership')) {
      return this.characterProfiles.profiles.balanced;
    }
    
    if (model.traits.includes('Shoot') || this.hasRangedWeapon(model)) {
      return this.characterProfiles.profiles.ranged;
    }
    
    if (model.traits.includes('Fight') || this.hasMeleeWeapon(model)) {
      return this.characterProfiles.profiles.melee;
    }
    
    if (this.hasSupportEquipment(model)) {
      return this.characterProfiles.profiles.healer;
    }
    
    if (model.archetype === 'Elite' || model.archetype === 'Veteran') {
      return this.characterProfiles.profiles.aggressive;
    }
    
    return this.characterProfiles.profiles.balanced;
  }
  
  /**
   * Get player strategem
   */
  getPlayerStrategem(side, models) {
    const meleeCount = models.filter(m => this.hasMeleeWeapon(m)).length;
    const rangedCount = models.filter(m => this.hasRangedWeapon(m)).length;
    const totalModels = models.length;
    
    if (meleeCount / totalModels > 0.7) {
      return this.playerStrategems.strategems.rush;
    }
    
    if (rangedCount / totalModels > 0.6) {
      return this.playerStrategems.strategems.opportune;
    }
    
    if (totalModels >= 6) {
      return this.playerStrategems.strategems.outnumber;
    }
    
    if (models.some(m => m.archetype === 'Elite')) {
      return this.playerStrategems.strategems.flanking;
    }
    
    return this.playerStrategems.strategems.defensive;
  }
  
  /**
   * Coordinate turn - returns normalized actions
   */
  coordinateTurn(side, models, rawGameState) {
    const gameState = this.normalizeGameState(rawGameState);
    const strategem = this.getPlayerStrategem(side, models);
    const coordinatedActions = strategem.coordinateTurn(models, gameState);
    
    // Apply individual character behaviors as fallback
    models.forEach(model => {
      if (!coordinatedActions.has(model.id)) {
        const profile = this.getCharacterProfile(model);
        const actionType = profile.evaluateAction(model, gameState);
        coordinatedActions.set(model.id, { type: actionType });
      }
    });
    
    return coordinatedActions;
  }
  
  // Utility methods (same as before)
  hasMeleeWeapon(model) {
    return (model.weapons || []).some(w => w.class === 'Melee');
  }
  
  hasRangedWeapon(model) {
    return (model.weapons || []).some(w => ['Bow', 'Range', 'Thrown'].includes(w.class));
  }
  
  hasSupportEquipment(model) {
    return (model.equipment || []).some(e => e.type === 'Advantage');
  }
}
// /src/ai/AICoordinator.js
import { CharacterBehaviorProfiles } from './CharacterBehaviorProfiles.js';
import { PlayerStrategems } from './PlayerStrategems.js';

/**
 * Coordinates character behaviors with player strategems
 */
export class AICoordinator {
  constructor() {
    this.characterProfiles = new CharacterBehaviorProfiles();
    this.playerStrategems = new PlayerStrategems();
  }
  
  /**
   * Get character behavior profile based on traits and equipment
   */
  getCharacterProfile(model) {
    // Determine profile from traits and equipment
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
    
    // Default based on archetype
    if (model.archetype === 'Elite' || model.archetype === 'Veteran') {
      return this.characterProfiles.profiles.aggressive;
    }
    
    return this.characterProfiles.profiles.balanced;
  }
  
  /**
   * Get player strategem based on assembly composition
   */
  getPlayerStrategem(side, models) {
    const meleeCount = models.filter(m => this.hasMeleeWeapon(m)).length;
    const rangedCount = models.filter(m => this.hasRangedWeapon(m)).length;
    const totalModels = models.length;
    
    // Determine strategem based on composition
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
    
    return this.playerStrategems.strategems.balanced || this.playerStrategems.strategems.defensive;
  }
  
  /**
   * Coordinate turn for entire side
   */
  coordinateTurn(side, models, gameState) {
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
  
  // Utility methods
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
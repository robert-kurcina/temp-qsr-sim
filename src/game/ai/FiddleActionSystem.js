// /src/ai/FiddleActionSystem.js
/**
 * Fiddle Action System - handles weapon switching and equipment management
 */
export class FiddleActionSystem {
  constructor() {
    this.currentlyEquipped = new Map(); // modelId -> { primary: weapon, secondary: weapon }
  }
  
  /**
   * Determine Fiddle action cost for weapon switch
   */
  getFiddleCost(model, targetConfiguration, gameState) {
    const currentConfig = this.getCurrentConfiguration(model);
    const apSpent = model.apSpent || 0;
    const isFree = apSpent === 0;
    
    // Count how many weapons need to be switched
    const switchesNeeded = this.calculateSwitchesNeeded(currentConfig, targetConfiguration);
    
    if (switchesNeeded === 0) {
      return { cost: 0, actions: [] };
    }
    
    let totalCost = 0;
    const fiddleActions = [];
    
    for (let i = 0; i < switchesNeeded; i++) {
      if (i === 0 && isFree) {
        // First Fiddle action is free if model is Free
        fiddleActions.push({ type: 'fiddle', cost: 0, description: 'Free weapon switch' });
      } else {
        // Subsequent Fiddle actions cost 1 AP each
        totalCost += 1;
        fiddleActions.push({ type: 'fiddle', cost: 1, description: 'Weapon switch' });
      }
    }
    
    return { cost: totalCost, actions: fiddleActions, switches: switchesNeeded };
  }
  
  /**
   * Calculate number of weapon switches needed
   */
  calculateSwitchesNeeded(currentConfig, targetConfig) {
    let switches = 0;
    
    // Primary weapon
    if (currentConfig.primary !== targetConfig.primary) {
      switches++;
    }
    
    // Secondary weapon  
    if (currentConfig.secondary !== targetConfig.secondary) {
      switches++;
    }
    
    return switches;
  }
  
  /**
   * Get current weapon configuration
   */
  getCurrentConfiguration(model) {
    const equipped = this.currentlyEquipped.get(model.id) || { primary: null, secondary: null };
    return equipped;
  }
  
  /**
   * Update equipped weapons after Fiddle action
   */
  updateEquippedWeapons(model, newConfiguration) {
    this.currentlyEquipped.set(model.id, newConfiguration);
  }
  
  /**
   * Get optimal weapon configuration for situation
   */
  getOptimalConfiguration(model, enemies, distance) {
    const weapons = model.weapons || [];
    const rangedWeapons = weapons.filter(w => ['Bow', 'Range', 'Thrown'].includes(w.class));
    const meleeWeapons = weapons.filter(w => w.class === 'Melee');
    
    if (distance > 3 && rangedWeapons.length > 0) {
      // Use ranged weapon at distance
      return { 
        primary: rangedWeapons[0], 
        secondary: meleeWeapons[0] || null 
      };
    } else if (meleeWeapons.length > 0) {
      // Use melee weapon in close combat
      return { 
        primary: meleeWeapons[0], 
        secondary: rangedWeapons[0] || null 
      };
    } else {
      // Use whatever is available
      return { 
        primary: weapons[0] || null, 
        secondary: weapons[1] || null 
      };
    }
  }
}
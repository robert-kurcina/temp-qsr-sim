// /src/engine/StatusEffectSystem.js
/**
 * Tracks and manages status effects for MEST models
 */
export class StatusEffectSystem {
  constructor() {
    this.statusEffects = new Map(); // modelId -> Set of effects
  }
  
  /**
   * Add status effect to model
   */
  addStatusEffect(modelId, effectType, duration = 'until_end_of_turn') {
    if (!this.statusEffects.has(modelId)) {
      this.statusEffects.set(modelId, new Set());
    }
    
    const effects = this.statusEffects.get(modelId);
    effects.add({
      type: effectType,
      duration: duration,
      timestamp: Date.now()
    });
    
    this.updateModelVisuals(modelId, effectType, 'add');
  }
  
  /**
   * Remove status effect from model
   */
  removeStatusEffect(modelId, effectType) {
    if (!this.statusEffects.has(modelId)) return;
    
    const effects = this.statusEffects.get(modelId);
    const effectToRemove = Array.from(effects).find(e => e.type === effectType);
    
    if (effectToRemove) {
      effects.delete(effectToRemove);
      this.updateModelVisuals(modelId, effectType, 'remove');
    }
    
    // Clean up empty sets
    if (effects.size === 0) {
      this.statusEffects.delete(modelId);
    }
  }
  
  /**
   * Get all status effects for model
   */
  getStatusEffects(modelId) {
    return this.statusEffects.get(modelId) || new Set();
  }
  
  /**
   * Get status effects by type count
   */
  getStatusEffectCounts(modelId) {
    const effects = this.getStatusEffects(modelId);
    const counts = {};
    
    effects.forEach(effect => {
      counts[effect.type] = (counts[effect.type] || 0) + 1;
    });
    
    return counts;
  }
  
  /**
   * Clear all status effects (end of turn)
   */
  clearTurnBasedEffects() {
    for (const [modelId, effects] of this.statusEffects.entries()) {
      const remainingEffects = new Set();
      
      for (const effect of effects) {
        // Keep permanent effects, remove turn-based ones
        if (effect.duration !== 'until_end_of_turn') {
          remainingEffects.add(effect);
        }
      }
      
      if (remainingEffects.size === 0) {
        this.statusEffects.delete(modelId);
      } else {
        this.statusEffects.set(modelId, remainingEffects);
      }
    }
  }
  
  /**
   * Update model visuals based on status effects
   */
  updateModelVisuals(modelId, effectType, action) {
    const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
    if (!model) return;
    
    // Apply visual effects
    switch(effectType) {
      case 'hidden':
        if (action === 'add') {
          model.mesh.material.opacity = 0.5;
          model.mesh.material.transparent = true;
        } else {
          model.mesh.material.opacity = 1.0;
          model.mesh.material.transparent = false;
        }
        break;
        
      case 'overwatch':
        if (action === 'add') {
          // Add overwatch indicator
          this.addOverwatchIndicator(model);
        } else {
          this.removeOverwatchIndicator(model);
        }
        break;
        
      case 'wounded':
        if (action === 'add') {
          model.mesh.material.color.set(0xff6b6b); // Red tint
        } else {
          // Restore original color
          const sideColor = model.side === 'side-a' ? 0xff0000 : 0x0000ff;
          model.mesh.material.color.set(sideColor);
        }
        break;
        
      case 'pinned':
        if (action === 'add') {
          model.mesh.material.color.set(0xffd93d); // Yellow tint
        }
        break;
    }
  }
  
  /**
   * Add overwatch indicator
   */
  addOverwatchIndicator(model) {
    if (model.overwatchIndicator) return;
    
    const geometry = new THREE.CircleGeometry(0.4, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x4ecdc4, // Teal
      transparent: true,
      opacity: 0.8
    });
    const indicator = new THREE.Mesh(geometry, material);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.set(model.position.x, model.position.y, 1.2);
    
    model.mesh.add(indicator);
    model.overwatchIndicator = indicator;
  }
  
  /**
   * Remove overwatch indicator
   */
  removeOverwatchIndicator(model) {
    if (model.overwatchIndicator) {
      model.mesh.remove(model.overwatchIndicator);
      model.overwatchIndicator = null;
    }
  }
}
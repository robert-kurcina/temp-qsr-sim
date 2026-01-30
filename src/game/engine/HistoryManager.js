// /src/engine/HistoryManager.js
/**
 * Manages undo/redo history for battlefield edits
 */
export class HistoryManager {
  constructor() {
    this.history = [];
    this.future = [];
    this.maxHistory = 50;
  }

  /**
   * Save current state to history
   */
  saveState(terrain, models, name = 'Edit') {
    // Convert to serializable format
    const state = {
      terrain: terrain.map(obj => this.serializeTerrain(obj)),
      models: models.map(obj => this.serializeModel(obj)),
      timestamp: Date.now(),
      name: name
    };

    // Add to history
    this.history.push(state);

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Clear future (new action invalidates redo)
    this.future = [];
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.history.length === 0) return null;

    const currentState = this.history.pop();
    if (this.history.length > 0) {
      const previousState = this.history[this.history.length - 1];
      this.future.push(currentState);
      return previousState;
    }

    // If no previous state, return empty
    this.future.push(currentState);
    return { terrain: [], models: [], name: 'Empty' };
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (this.future.length === 0) return null;

    const nextState = this.future.pop();
    this.history.push(nextState);
    return nextState;
  }

  /**
   * Reset to generated layout (saves current as undoable state)
   */
  resetToGenerated(generatedState) {
    const currentState = {
      terrain: window.BATTLEFIELD_ENGINE.terrain.map(obj => this.serializeTerrain(obj)),
      models: window.BATTLEFIELD_ENGINE.models.map(obj => this.serializeModel(obj)),
      name: 'Before Reset'
    };

    // Save current state before reset
    this.history.push(currentState);
    this.future = [];

    // Return generated state
    return generatedState;
  }

  serializeTerrain(obj) {
    return {
      id: obj.id,
      type: obj.type,
      position: { ...obj.position },
      size: { ...obj.size },
      rotationZ: obj.rotationZ,
      blocking: obj.blocking,
      elevation: obj.elevation,
      plateauRadiusMU: obj.plateauRadiusMU,
      totalRadiusMU: obj.totalRadiusMU,
      sizeCategory: obj.sizeCategory,
      entranceFace: obj.entranceFace
    };
  }

  // Add model position tracking
  serializeModel(obj) {
    return {
      id: obj.id,
      position: { ...obj.position },
      side: obj.side,
      identifier: obj.identifier,
      height: obj.height,
      apSpent: obj.apSpent || 0, // Track AP usage
      profile: obj.profile // Store profile reference
    };
  }

  refreshModelVisuals() {
  window.BATTLEFIELD_ENGINE.models.forEach(model => {
    // Restore normal appearance for models that lost status effects
    const effects = window.STATUS_EFFECT_SYSTEM?.getStatusEffects(model.id) || new Set();
    const hasHidden = Array.from(effects).some(e => e.type === 'hidden');
    const hasOverwatch = Array.from(effects).some(e => e.type === 'overwatch');
    
    // Update hidden state
    if (hasHidden) {
      model.mesh.material.opacity = 0.5;
      model.mesh.material.transparent = true;
    } else {
      model.mesh.material.opacity = 1.0;
      model.mesh.material.transparent = false;
    }
    
    // Update overwatch indicator
    if (hasOverwatch) {
      window.STATUS_EFFECT_SYSTEM?.addOverwatchIndicator(model);
    } else {
      window.STATUS_EFFECT_SYSTEM?.removeOverwatchIndicator(model);
    }
  });
}

  // Add turn management
  startNewTurn() {
    // Save current state as turn boundary
    this.saveState(window.BATTLEFIELD_ENGINE.terrain, window.BATTLEFIELD_ENGINE.models, 'End Turn');

    // Reset AP for all models
    window.BATTLEFIELD_ENGINE.models.forEach(model => {
      model.apSpent = 0;
    });

    // Clear turn-based status effects
    window.STATUS_EFFECT_SYSTEM?.clearTurnBasedEffects();

    // Clear movement visuals
    window.MOVEMENT_SYSTEM?.clearAllVisuals();

    // Refresh tooltips and visuals
    this.refreshModelVisuals();
  }
}
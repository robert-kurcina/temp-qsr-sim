// /src/simulator/EnhancedHiddenStatus.js
/**
 * Enhanced Hidden status implementation with Suddenness modifier
 */
export class EnhancedHiddenStatus {
  constructor(situationalModifiers) {
    this.situationalModifiers = situationalModifiers;
    this.hiddenModels = new Set();
    this.firstActionAfterHidden = new Set();
  }
  
  /**
   * Set model to Hidden status
   */
  setHidden(modelId) {
    this.hiddenModels.add(modelId);
    this.firstActionAfterHidden.add(modelId); // Mark for Suddenness
  }
  
  /**
   * Check if model can use Suddenness
   */
  canUseSuddenness(modelId, actionType) {
    // Suddenness only applies to Hit Tests when Hidden at start of Action
    if (!this.firstActionAfterHidden.has(modelId)) {
      return false;
    }
    
    // Only applies to attack actions
    if (!['closeCombat', 'rangedCombat'].includes(actionType)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Apply Suddenness and clear first action flag
   */
  applySuddenness(modelId) {
    if (this.firstActionAfterHidden.has(modelId)) {
      this.firstActionAfterHidden.delete(modelId);
      return true;
    }
    return false;
  }
  
  /**
   * Reveal model (loses Hidden status)
   */
  revealModel(modelId) {
    this.hiddenModels.delete(modelId);
    this.firstActionAfterHidden.delete(modelId);
  }
  
  /**
   * Is model currently Hidden?
   */
  isHidden(modelId) {
    return this.hiddenModels.has(modelId);
  }
}
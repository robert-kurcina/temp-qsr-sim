// /src/engine/HindranceTracker.js
/**
 * Tracks hindrance counts and derived statuses
 */
export class HindranceTracker {
  constructor(tokenSystem) {
    this.tokenSystem = tokenSystem;
    this.hindrances = new Map(); // modelId -> { fear: 0, delay: 0, wounds: 0 }
  }
  
  /**
   * Add hindrance token and update derived statuses
   */
  addHindrance(modelId, type) {
    if (!this.hindrances.has(modelId)) {
      this.hindrances.set(modelId, { fear: 0, delay: 0, wounds: 0 });
    }
    
    const hindrances = this.hindrances.get(modelId);
    hindrances[type]++;
    
    // Add visual token
    this.tokenSystem.addToken(modelId, type);
    
    // Update derived statuses on model
    this.updateDerivedStatuses(modelId, hindrances);
  }
  
  /**
   * Remove hindrance token
   */
  removeHindrance(modelId, type) {
    if (!this.hindrances.has(modelId)) return;
    
    const hindrances = this.hindrances.get(modelId);
    if (hindrances[type] > 0) {
      hindrances[type]--;
      
      // Remove visual token
      this.tokenSystem.removeToken(modelId, type);
      
      // Update or clean up
      if (hindrances.fear === 0 && hindrances.delay === 0 && hindrances.wounds === 0) {
        this.hindrances.delete(modelId);
      } else {
        this.updateDerivedStatuses(modelId, hindrances);
      }
    }
  }
  
  /**
   * Update derived statuses based on hindrance counts
   */
  updateDerivedStatuses(modelId, hindrances) {
    const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
    if (!model) return;
    
    const status = [];
    
    // Delay-derived statuses
    if (hindrances.delay >= 1) status.push('Distracted');
    if (hindrances.delay >= 2) status.push('Stunned');
    
    // Fear-derived statuses
    if (hindrances.fear >= 1) status.push('Nervous');
    if (hindrances.fear >= 2) status.push('Disordered');
    if (hindrances.fear >= 3) status.push('Panicked');
    
    // Wound status
    if (hindrances.wounds >= 1) status.push('Wounded');
    
    model.derivedStatus = status;
  }
  
  /**
   * Get hindrance counts
   */
  getHindrances(modelId) {
    return this.hindrances.get(modelId) || { fear: 0, delay: 0, wounds: 0 };
  }
}
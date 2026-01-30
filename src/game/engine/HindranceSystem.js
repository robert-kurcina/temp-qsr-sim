// /src/engine/HindranceSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * MEST QSR Hindrance token system
 */
export class HindranceSystem {
  constructor() {
    this.hindrances = new Map(); // modelId -> { fear: 0, delay: 0, wounds: 0 }
    this.tokens = new Map(); // modelId -> token mesh objects
  }
  
  /**
   * Add hindrance token to model
   */
  addHindrance(modelId, type) {
    if (!this.hindrances.has(modelId)) {
      this.hindrances.set(modelId, { fear: 0, delay: 0, wounds: 0 });
    }
    
    const hindrances = this.hindrances.get(modelId);
    hindrances[type] = (hindrances[type] || 0) + 1;
    
    // Update visual tokens
    this.updateTokens(modelId, hindrances);
    
    // Update derived statuses
    this.updateDerivedStatuses(modelId, hindrances);
  }
  
  /**
   * Remove hindrance token from model
   */
  removeHindrance(modelId, type) {
    if (!this.hindrances.has(modelId)) return;
    
    const hindrances = this.hindrances.get(modelId);
    if (hindrances[type] > 0) {
      hindrances[type]--;
      
      // Clean up if all zero
      if (hindrances.fear === 0 && hindrances.delay === 0 && hindrances.wounds === 0) {
        this.hindrances.delete(modelId);
        this.removeTokens(modelId);
      } else {
        this.updateTokens(modelId, hindrances);
        this.updateDerivedStatuses(modelId, hindrances);
      }
    }
  }
  
  /**
   * Get hindrance counts for model
   */
  getHindrances(modelId) {
    return this.hindrances.get(modelId) || { fear: 0, delay: 0, wounds: 0 };
  }
  
  /**
   * Update derived statuses based on hindrances
   */
  updateDerivedStatuses(modelId, hindrances) {
    const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
    if (!model) return;
    
    // Clear previous statuses
    delete model.status;
    
    // Set derived statuses
    const status = [];
    
    // Delay statuses
    if (hindrances.delay >= 1) status.push('Distracted');
    if (hindrances.delay >= 2) status.push('Stunned');
    
    // Fear statuses  
    if (hindrances.fear >= 1) status.push('Nervous');
    if (hindrances.fear >= 2) status.push('Disordered');
    if (hindrances.fear >= 3) status.push('Panicked');
    
    // Wound status
    if (hindrances.wounds >= 1) status.push('Wounded');
    
    model.status = status;
  }
  
  /**
   * Update visual tokens for model
   */
  updateTokens(modelId, hindrances) {
    this.removeTokens(modelId);
    
    const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
    if (!model) return;
    
    const tokens = [];
    let offsetAngle = 0;
    const totalTokens = hindrances.fear + hindrances.delay + hindrances.wounds;
    
    if (totalTokens === 0) return;
    
    // Create tokens for each hindrance
    this.createTokenGroup('fear', hindrances.fear, model, tokens, offsetAngle, totalTokens);
    offsetAngle += hindrances.fear;
    
    this.createTokenGroup('delay', hindrances.delay, model, tokens, offsetAngle, totalTokens);
    offsetAngle += hindrances.delay;
    
    this.createTokenGroup('wounds', hindrances.wounds, model, tokens, offsetAngle, totalTokens);
    
    this.tokens.set(modelId, tokens);
  }
  
  /**
   * Create token group for hindrance type
   */
  createTokenGroup(type, count, model, tokens, startOffset, totalTokens) {
    const colors = {
      fear: 0xff6b6b,    // Red - Fear
      delay: 0xffd93d,   // Yellow - Delay  
      wounds: 0x4ecdc4   // Teal - Wounds
    };
    
    const labels = {
      fear: 'F',
      delay: 'D',
      wounds: 'W'
    };
    
    for (let i = 0; i < count; i++) {
      const token = this.createToken(
        colors[type],
        labels[type],
        model,
        startOffset + i,
        totalTokens
      );
      tokens.push(token);
      model.mesh.add(token);
    }
  }
  
  /**
   * Create individual token
   */
  createToken(color, label, model, index, totalTokens) {
    // Position tokens in a circle around the model base
    const radius = 0.7; // MU from model center
    const angle = (index / totalTokens) * Math.PI * 2;
    
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    // Create token mesh
    const geometry = new THREE.CircleGeometry(0.2, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.9
    });
    const token = new THREE.Mesh(geometry, material);
    token.position.set(x, y, 0.01);
    
    // Add label text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 32;
    canvas.height = 32;
    
    context.fillStyle = 'white';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 16, 16);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.3, 0.3, 1);
    sprite.position.set(0, 0, 0.02);
    
    token.add(sprite);
    token.userData = { type: 'hindrance', hindranceType: label.toLowerCase() };
    
    return token;
  }
  
  /**
   * Remove all tokens for model
   */
  removeTokens(modelId) {
    const tokens = this.tokens.get(modelId);
    if (tokens) {
      const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
      if (model) {
        tokens.forEach(token => {
          model.mesh.remove(token);
        });
      }
      this.tokens.delete(modelId);
    }
  }
  
  /**
   * Clear all hindrances (end of game/scenario)
   */
  clearAll() {
    this.hindrances.clear();
    this.tokens.forEach((tokens, modelId) => {
      this.removeTokens(modelId);
    });
    this.tokens.clear();
  }
}
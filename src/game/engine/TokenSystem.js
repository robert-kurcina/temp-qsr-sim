// /src/engine/TokenSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * MEST QSR canonical token system with correct sizes and colors
 */
export class TokenSystem {
  constructor() {
    this.tokens = new Map(); // modelId -> token objects
    this.statusTokens = new Map(); // modelId -> status tracking
  }
  
  /**
   * Token configuration per QSR specifications
   */
  getTokenConfig(status) {
    const configs = {
      // Status tokens (small, placed next to models)
      'hidden': { size: 0.15, color: 0x2c3e50, type: 'status' }, // Small & dark
      'wound': { size: 0.15, color: 0xe74c3c, type: 'hindrance' }, // Small & red
      'delay': { size: 0.15, color: 0xecf0f1, type: 'hindrance' }, // Small & white/clear
      'fear': { size: 0.15, color: 0xf1c40f, type: 'hindrance' }, // Small & yellow
      
      // Action tokens (larger, placed next to models)
      'done': { size: 0.30, color: 0x3498db, type: 'action' }, // Largest & blue
      'wait': { size: 0.25, color: 0xecf0f1, type: 'action' } // Big & white/clear
    };
    
    return configs[status] || { size: 0.15, color: 0x95a5a6, type: 'unknown' };
  }
  
  /**
   * Add token to model
   */
  addToken(modelId, status) {
    if (!this.statusTokens.has(modelId)) {
      this.statusTokens.set(modelId, new Set());
    }
    
    const statuses = this.statusTokens.get(modelId);
    statuses.add(status);
    
    this.updateTokens(modelId);
  }
  
  /**
   * Remove token from model
   */
  removeToken(modelId, status) {
    if (!this.statusTokens.has(modelId)) return;
    
    const statuses = this.statusTokens.get(modelId);
    statuses.delete(status);
    
    if (statuses.size === 0) {
      this.statusTokens.delete(modelId);
      this.removeTokens(modelId);
    } else {
      this.updateTokens(modelId);
    }
  }
  
  /**
   * Get all tokens for model
   */
  getTokens(modelId) {
    return this.statusTokens.get(modelId) || new Set();
  }
  
  /**
   * Update visual tokens for model
   */
  updateTokens(modelId) {
    this.removeTokens(modelId);
    
    const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
    if (!model) return;
    
    const statuses = Array.from(this.getTokens(modelId));
    if (statuses.length === 0) return;
    
    const tokens = [];
    const totalTokens = statuses.length;
    
    // Position tokens in circle around model base
    statuses.forEach((status, index) => {
      const config = this.getTokenConfig(status);
      const token = this.createToken(config, status, model, index, totalTokens);
      tokens.push(token);
      model.mesh.add(token);
    });
    
    this.tokens.set(modelId, tokens);
  }
  
  /**
   * Create individual token
   */
  createToken(config, status, model, index, totalTokens) {
    // Position in circle around model
    const radius = 0.7; // MU from center
    const angle = (index / totalTokens) * Math.PI * 2;
    
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    // Create token mesh
    const geometry = new THREE.CircleGeometry(config.size, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: config.color,
      transparent: true,
      opacity: config.type === 'hindrance' ? 0.9 : 0.7
    });
    const token = new THREE.Mesh(geometry, material);
    token.position.set(x, y, 0.01);
    token.userData = { type: 'token', status: status };
    
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
        tokens.forEach(token => model.mesh.remove(token));
      }
      this.tokens.delete(modelId);
    }
  }
}
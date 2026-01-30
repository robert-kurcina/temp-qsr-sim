// /src/engine/TokenManager.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
import { TOKEN_SPECS, RESOURCE_TOKENS } from '../data/tokenSpecs.js';

/**
 * Manages all tokens and markers with real-world physical specifications
 */
export class TokenManager {
  constructor(scene, models) {
    this.scene = scene;
    this.models = models;
    this.tokens = new Map(); // modelId -> [token objects]
    this.playerResources = {
      'side-a': { initiative: [], victory: [] },
      'side-b': { initiative: [], victory: [] }
    };
    this.tokenMeshes = new Map(); // For texture caching
  }
  
  /**
   * Add token to model
   */
  addToken(modelId, tokenType, count = 1) {
    const specs = TOKEN_SPECS[tokenType];
    if (!specs) {
      console.warn(`Unknown token type: ${tokenType}`);
      return;
    }
    
    // Get or create token array for model
    if (!this.tokens.has(modelId)) {
      this.tokens.set(modelId, []);
    }
    
    const modelTokens = this.tokens.get(modelId);
    
    // Add new tokens
    for (let i = 0; i < count; i++) {
      const token = {
        id: `${modelId}-${tokenType}-${Date.now()}-${i}`,
        type: tokenType,
        modelId: modelId,
        mesh: null,
        positionIndex: modelTokens.filter(t => t.type === tokenType).length
      };
      
      // Create mesh
      token.mesh = this.createTokenMesh(tokenType, token.positionIndex);
      modelTokens.push(token);
      
      // Position token
      this.positionToken(token);
      this.scene.add(token.mesh);
    }
    
    // Store reference for tooltip system
    window.TOKEN_MANAGER = this;
  }
  
  /**
   * Remove token from model
   */
  removeToken(modelId, tokenType) {
    if (!this.tokens.has(modelId)) return;
    
    const modelTokens = this.tokens.get(modelId);
    const tokenIndex = modelTokens.findIndex(t => t.type === tokenType);
    
    if (tokenIndex !== -1) {
      const token = modelTokens[tokenIndex];
      this.scene.remove(token.mesh);
      modelTokens.splice(tokenIndex, 1);
      
      // Reposition remaining tokens of same type
      this.repositionTokens(modelId, tokenType);
    }
  }
  
  /**
   * Clear all tokens for model
   */
  clearTokens(modelId) {
    if (!this.tokens.has(modelId)) return;
    
    const modelTokens = this.tokens.get(modelId);
    modelTokens.forEach(token => {
      this.scene.remove(token.mesh);
    });
    
    this.tokens.delete(modelId);
  }
  
  /**
   * Create token mesh based on specifications
   */
  createTokenMesh(tokenType, stackIndex = 0) {
    const specs = TOKEN_SPECS[tokenType];
    
    // Use cached mesh if available
    const cacheKey = `${tokenType}-${stackIndex}`;
    if (this.tokenMeshes.has(cacheKey)) {
      return this.tokenMeshes.get(cacheKey).clone();
    }
    
    let mesh;
    if (specs.shape === 'triangle') {
      mesh = this.createTriangleToken(specs, stackIndex);
    } else {
      mesh = this.createDiscToken(specs, stackIndex);
    }
    
    // Cache for performance
    this.tokenMeshes.set(cacheKey, mesh.clone());
    return mesh;
  }
  
  /**
   * Create disc-shaped token
   */
  createDiscToken(specs, stackIndex) {
    // Convert mm to MU (1 MU = 1.25 inches = 31.75mm)
    const diameterMU = specs.size.diameter / 31.75;
    const thicknessMU = specs.size.thickness / 31.75;
    
    // Create cylinder geometry
    const geometry = new THREE.CylinderGeometry(
      diameterMU / 2, 
      diameterMU / 2, 
      thicknessMU, 
      16
    );
    
    // Load SVG texture
    const material = this.createTokenMaterial(specs.svg);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Rotate to lie flat
    mesh.rotation.x = Math.PI / 2;
    
    // Add small vertical offset for stacking
    mesh.position.z = stackIndex * (thicknessMU + 0.01);
    
    return mesh;
  }
  
  /**
   * Create triangular marker
   */
  createTriangleToken(specs, stackIndex) {
    // Convert mm to MU
    const baseMU = specs.size.base / 31.75;
    const thicknessMU = specs.size.thickness / 31.75;
    
    // Create triangle geometry (equilateral)
    const heightMU = baseMU * Math.sqrt(3) / 2;
    const geometry = new THREE.ConeGeometry(baseMU / 2, heightMU, 3);
    
    // Load SVG texture
    const material = this.createTokenMaterial(specs.svg);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Rotate to point upward and lie flat
    mesh.rotation.x = Math.PI / 2;
    mesh.rotation.z = Math.PI; // Point upward
    
    // Add vertical offset for stacking (though markers typically don't stack)
    mesh.position.z = stackIndex * (thicknessMU + 0.01);
    
    return mesh;
  }
  
  /**
   * Create material from SVG
   */
  createTokenMaterial(svgPath) {
    // In practice, you'd load the actual SVG file
    // For now, use a colored material as placeholder
    const colors = {
      'blue': 0x0000ff,
      'white': 0xffffff,
      'red': 0xff0000,
      'yellow': 0xffff00,
      'dark': 0x2c3e50,
      'gold': 0xf1c40f
    };
    
    // Extract color from specs
    const tokenType = Object.keys(TOKEN_SPECS).find(key => 
      TOKEN_SPECS[key].svg === svgPath
    );
    const specs = TOKEN_SPECS[tokenType];
    const color = colors[specs.color] || 0x95a5a6;
    
    return new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.9
    });
  }
  
  /**
   * Position token aesthetically around model
   */
  positionToken(token) {
    const model = this.models.find(m => m.id === token.modelId);
    if (!model) return;
    
    // Get all tokens for this model of the same type
    const modelTokens = this.tokens.get(token.modelId) || [];
    const sameTypeTokens = modelTokens.filter(t => t.type === token.type);
    const positionIndex = sameTypeTokens.indexOf(token);
    
    // Calculate position in circle around model
    const radiusMU = 0.7; // MU from model center
    const angle = (positionIndex / Math.max(1, sameTypeTokens.length)) * Math.PI * 2;
    
    const x = model.position.x + Math.cos(angle) * radiusMU;
    const y = model.position.y + Math.sin(angle) * radiusMU;
    
    token.mesh.position.x = x;
    token.mesh.position.y = y;
    
    // Stack vertically if multiple tokens of same type
    const specs = TOKEN_SPECS[token.type];
    const thicknessMU = specs.size.thickness / 31.75;
    token.mesh.position.z = positionIndex * (thicknessMU + 0.01);
  }
  
  /**
   * Reposition all tokens of specific type for model
   */
  repositionTokens(modelId, tokenType) {
    const modelTokens = this.tokens.get(modelId) || [];
    const sameTypeTokens = modelTokens.filter(t => t.type === tokenType);
    
    sameTypeTokens.forEach((token, index) => {
      // Update position index
      token.positionIndex = index;
      this.positionToken(token);
    });
  }
  
  /**
   * Get all tokens for model
   */
  getTokens(modelId) {
    return this.tokens.get(modelId) || [];
  }
  
  /**
   * Get token counts by type for model
   */
  getTokenCounts(modelId) {
    const tokens = this.getTokens(modelId);
    const counts = {};
    
    tokens.forEach(token => {
      counts[token.type] = (counts[token.type] || 0) + 1;
    });
    
    return counts;
  }
  
  /**
   * Add player resource token
   */
  addPlayerResource(side, resourceType) {
    const resources = this.playerResources[side][resourceType];
    const token = {
      id: `${side}-${resourceType}-${resources.length}`,
      type: resourceType,
      side: side,
      mesh: this.createResourceToken(resourceType),
      index: resources.length
    };
    
    resources.push(token);
    this.positionPlayerResource(token);
    this.scene.add(token.mesh);
  }
  
  /**
   * Create resource token (Initiative/Victory Points)
   */
  createResourceToken(resourceType) {
    const specs = RESOURCE_TOKENS[resourceType];
    const diameterMU = specs.size.diameter / 31.75;
    const thicknessMU = specs.size.thickness / 31.75;
    
    const geometry = new THREE.CylinderGeometry(diameterMU / 2, diameterMU / 2, thicknessMU, 16);
    const material = this.createTokenMaterial(specs.svg);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2;
    
    return mesh;
  }
  
  /**
   * Position player resource at battlefield edge
   */
  positionPlayerResource(token) {
    const x = token.side === 'side-a' ? -18 : 18; // Battlefield edge
    const y = 18;
    const spacing = 2; // MU between tokens
    
    token.mesh.position.x = x + (token.index * spacing);
    token.mesh.position.y = y;
    token.mesh.position.z = 0.1;
  }
  
  /**
   * Clear all player resources (end of turn)
   */
  clearPlayerResources(side) {
    const resources = this.playerResources[side];
    
    // Remove Initiative tokens
    resources.initiative.forEach(token => {
      this.scene.remove(token.mesh);
    });
    resources.initiative = [];
    
    // Victory points persist between turns (only cleared when spent/used)
  }
  
  /**
   * Transfer initiative card between sides
   */
  transferInitiativeCard(fromSide, toSide) {
    // This would be handled by InitiativeCard class
    console.log(`Transferring Initiative Card from ${fromSide} to ${toSide}`);
  }
}
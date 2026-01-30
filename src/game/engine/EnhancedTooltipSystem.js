// /src/engine/EnhancedTooltipSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Enhanced tooltip system with connection lines and model highlighting
 */
export class EnhancedTooltipSystem {
  constructor(scene, models, tokenManager) {
    this.scene = scene;
    this.models = models;
    this.tokenManager = tokenManager;
    this.activeConnections = [];
    this.highlightMaterials = new Map();
    this.tooltip = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.initTooltipElement();
    this.bindEvents();
  }
  
  /**
   * Initialize tooltip DOM element
   */
  initTooltipElement() {
    this.tooltip = document.createElement('div');
    this.tooltip.style.position = 'absolute';
    this.tooltip.style.background = 'rgba(0,0,0,0.95)';
    this.tooltip.style.color = 'white';
    this.tooltip.style.padding = '12px 16px';
    this.tooltip.style.borderRadius = '8px';
    this.tooltip.style.fontFamily = 'monospace';
    this.tooltip.style.fontSize = '14px';
    this.tooltip.style.pointerEvents = 'none';
    this.tooltip.style.display = 'none';
    this.tooltip.style.zIndex = '10000';
    this.tooltip.style.maxWidth = '300px';
    this.tooltip.style.lineHeight = '1.4';
    document.body.appendChild(this.tooltip);
  }
  
  /**
   * Bind mouse events
   */
  bindEvents() {
    const canvas = document.getElementById('battlefield-canvas') || 
                  this.scene.userData.canvas;
    
    if (!canvas) return;
    
    canvas.addEventListener('mousemove', (event) => {
      this.onMouseMove(event);
    });
    
    canvas.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }
  
  /**
   * Handle mouse movement for hover detection
   */
  onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    
    // Check for token/marker hover
    const hoveredToken = this.checkTokenHover();
    if (hoveredToken) {
      this.showTokenTooltip(hoveredToken);
      return;
    }
    
    // Check for model hover
    const hoveredModel = this.checkModelHover();
    if (hoveredModel) {
      this.showModelTooltip(hoveredModel);
      return;
    }
    
    // Hide tooltip if nothing is hovered
    this.hideTooltip();
  }
  
  /**
   * Check if mouse is over any token/marker
   */
  checkTokenHover() {
    // Get all tokens from TokenManager
    let allTokens = [];
    for (const [modelId, tokens] of this.tokenManager.tokens.entries()) {
      tokens.forEach(token => {
        allTokens.push({
          ...token,
          modelId: modelId
        });
      });
    }
    
    // Check raycast against token meshes
    this.raycaster.setFromCamera(this.mouse, window.BATTLEFIELD_ENGINE.camera);
    
    for (const token of allTokens) {
      if (token.mesh) {
        const intersects = this.raycaster.intersectObject(token.mesh, true);
        if (intersects.length > 0) {
          return token;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if mouse is over any model
   */
  checkModelHover() {
    this.raycaster.setFromCamera(this.mouse, window.BATTLEFIELD_ENGINE.camera);
    const modelMeshes = this.models.map(m => m.mesh);
    const intersects = this.raycaster.intersectObjects(modelMeshes, false);
    
    if (intersects.length > 0) {
      const model = this.models.find(m => m.mesh === intersects[0].object);
      return model;
    }
    
    return null;
  }
  
  /**
   * Show tooltip for token/marker
   */
  showTokenTooltip(token) {
    // Clear previous highlights and connections
    this.clearHighlights();
    
    // Get affected model
    const model = this.models.find(m => m.id === token.modelId);
    if (!model) {
      this.hideTooltip();
      return;
    }
    
    // Create connection line
    const line = this.createConnectionLine(token.mesh.position, model.position);
    this.scene.add(line);
    this.activeConnections.push(line);
    
    // Highlight affected model
    this.highlightModel(model);
    
    // Show tooltip with token information
    const tooltipText = this.getTokenTooltipText(token.type, model.identifier);
    this.showTooltip(tooltipText, event.clientX, event.clientY);
  }
  
  /**
   * Show tooltip for model
   */
  showModelTooltip(model) {
    // Clear previous highlights and connections
    this.clearHighlights();
    
    // Get all tokens for this model
    const tokenCounts = this.tokenManager.getTokenCounts(model.id);
    
    // Build tooltip content
    let tooltipLines = [];
    
    // Add model identifier
    tooltipLines.push(`<strong>Model: ${model.identifier}</strong>`);
    
    // Add token counts
    if (Object.keys(tokenCounts).length > 0) {
      tooltipLines.push('<br><strong>Tokens:</strong>');
      
      // Status tokens
      const statusTokens = ['done', 'wait', 'hidden'];
      statusTokens.forEach(type => {
        if (tokenCounts[type]) {
          tooltipLines.push(`${this.getTokenDisplayName(type)}: ${tokenCounts[type]}`);
        }
      });
      
      // Hindrance tokens
      const hindranceTokens = ['wound', 'delay', 'fear'];
      const hindranceCount = hindranceTokens.reduce((sum, type) => sum + (tokenCounts[type] || 0), 0);
      if (hindranceCount > 0) {
        tooltipLines.push('<br><strong>Hindrances:</strong>');
        hindranceTokens.forEach(type => {
          if (tokenCounts[type]) {
            tooltipLines.push(`${this.getTokenDisplayName(type)}: ${tokenCounts[type]}`);
          }
        });
      }
      
      // Markers
      const markers = ['ko', 'eliminated', 'outOfAmmo'];
      const markerCount = markers.reduce((sum, type) => sum + (tokenCounts[type] || 0), 0);
      if (markerCount > 0) {
        tooltipLines.push('<br><strong>Markers:</strong>');
        markers.forEach(type => {
          if (tokenCounts[type]) {
            tooltipLines.push(`${this.getTokenDisplayName(type)}: ${tokenCounts[type]}`);
          }
        });
      }
    } else {
      tooltipLines.push('<em>No tokens or markers</em>');
    }
    
    const tooltipText = tooltipLines.join('<br>');
    this.showTooltip(tooltipText, event.clientX, event.clientY);
  }
  
  /**
   * Get display name for token type
   */
  getTokenDisplayName(tokenType) {
    const names = {
      done: 'Done',
      wait: 'Wait', 
      hidden: 'Hidden',
      wound: 'Wound',
      delay: 'Delay',
      fear: 'Fear',
      ko: 'Knocked Out',
      eliminated: 'Eliminated',
      outOfAmmo: 'Out of Ammo'
    };
    return names[tokenType] || tokenType;
  }
  
  /**
   * Get detailed tooltip text for token
   */
  getTokenTooltipText(tokenType, modelId) {
    const displayName = this.getTokenDisplayName(tokenType);
    return `<strong>${displayName}</strong><br>Affects: ${modelId}`;
  }
  
  /**
   * Create connection line between token and model
   */
  createConnectionLine(tokenPos, modelPos) {
    // Start slightly above token
    const start = new THREE.Vector3(tokenPos.x, tokenPos.y, tokenPos.z + 0.1);
    // End at model base
    const end = new THREE.Vector3(modelPos.x, modelPos.y, 0.1);
    
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x4a90e2, // Blue connection line
      transparent: true,
      opacity: 0.7,
      linewidth: 2
    });
    
    return new THREE.Line(geometry, material);
  }
  
  /**
   * Highlight model with outline effect
   */
  highlightModel(model) {
    // Store original material if not already stored
    if (!this.highlightMaterials.has(model.id)) {
      // Clone the original material to preserve it
      const originalMaterial = model.mesh.material.clone();
      this.highlightMaterials.set(model.id, originalMaterial);
    }
    
    // Create highlight material (wireframe outline)
    const highlightMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4a90e2, // Blue highlight
      wireframe: true,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    // Apply highlight
    model.mesh.material = highlightMaterial;
  }
  
  /**
   * Show tooltip at specified position
   */
  showTooltip(text, x, y) {
    this.tooltip.innerHTML = text;
    this.tooltip.style.display = 'block';
    this.tooltip.style.left = (x + 15) + 'px';
    this.tooltip.style.top = (y + 15) + 'px';
  }
  
  /**
   * Hide tooltip and clear highlights
   */
  hideTooltip() {
    this.tooltip.style.display = 'none';
    this.clearHighlights();
  }
  
  /**
   * Clear all highlights and connection lines
   */
  clearHighlights() {
    // Restore original materials
    this.highlightMaterials.forEach((originalMat, modelId) => {
      const model = this.models.find(m => m.id === modelId);
      if (model && model.mesh) {
        model.mesh.material = originalMat;
      }
    });
    this.highlightMaterials.clear();
    
    // Remove connection lines
    this.activeConnections.forEach(line => {
      if (line.parent) {
        line.parent.remove(line);
      }
    });
    this.activeConnections = [];
  }
  
  /**
   * Clean up system
   */
  dispose() {
    this.hideTooltip();
    this.clearHighlights();
    if (this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
  }
}
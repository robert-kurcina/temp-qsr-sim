// /src/engine/LOSPreview.js
import * as THREE from 'three';

/**
 * Real-time LOS preview during terrain placement
 */
export class LOSPreview {
  constructor(scene, models, terrain, battlefieldSizeMU) {
    this.scene = scene;
    this.models = models;
    this.terrain = terrain;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.previewLines = [];
    this.isActive = false;
    this.previewTerrain = null;
    
    // Performance: Limit preview to visible models
    this.maxPreviewModels = 12;
  }
  
  /**
   * Start real-time LOS preview for a temporary terrain object
   */
  startPreview(tempTerrain) {
    this.isActive = true;
    this.previewTerrain = tempTerrain;
    
    // Add temporary terrain to scene for visual feedback
    if (tempTerrain.mesh) {
      tempTerrain.mesh.material.opacity = 0.7;
      tempTerrain.mesh.material.transparent = true;
      this.scene.add(tempTerrain.mesh);
    }
    
    // Start preview loop
    this.updatePreview();
  }
  
  /**
   * Stop real-time LOS preview
   */
  stopPreview() {
    this.isActive = false;
    this.previewTerrain = null;
    
    // Remove temporary terrain
    if (this.previewTerrain?.mesh) {
      this.scene.remove(this.previewTerrain.mesh);
    }
    
    // Clear preview lines
    this.clearPreviewLines();
  }
  
  /**
   * Update LOS preview based on current mouse position
   */
  updatePreview() {
    if (!this.isActive || !this.previewTerrain) return;
    
    // Clear previous preview
    this.clearPreviewLines();
    
    // Get opposing model pairs (limit for performance)
    const modelPairs = this.getOpposingModelPairs();
    if (modelPairs.length === 0) return;
    
    // Create temporary terrain list including preview object
    const tempTerrainList = [...this.terrain, this.previewTerrain];
    
    // Calculate LOS for each pair
    const losEngine = new LOSEngine(
      this.scene,
      this.models,
      tempTerrainList,
      this.battlefieldSizeMU
    );
    
    // Draw preview lines
    for (const [modelA, modelB] of modelPairs) {
      const result = losEngine.validateLOS(modelA, modelB);
      
      if (result.hasLOS && result.distance > 8) {
        // Red line for violation
        this.addPreviewLine(modelA.position, modelB.position, 0xff0000, 0.6);
      } else if (result.distance > 8) {
        // Green line for blocked (good)
        this.addPreviewLine(modelA.position, modelB.position, 0x00ff00, 0.3);
      }
      // Don't show lines for short distances (<8 MU)
    }
    
    // Continue animation loop
    requestAnimationFrame(() => this.updatePreview());
  }
  
  /**
   * Get opposing model pairs (limited for performance)
   */
  getOpposingModelPairs() {
    const sideAModels = this.models.filter(m => m.side === 'side-a');
    const sideBModels = this.models.filter(m => m.side === 'side-b');
    
    // Limit to prevent performance issues
    const limitedA = sideAModels.slice(0, this.maxPreviewModels);
    const limitedB = sideBModels.slice(0, this.maxPreviewModels);
    
    const pairs = [];
    for (const modelA of limitedA) {
      for (const modelB of limitedB) {
        pairs.push([modelA, modelB]);
      }
    }
    
    return pairs;
  }
  
  /**
   * Add preview line to scene
   */
  addPreviewLine(start, end, color, opacity) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ 
      color: color,
      opacity: opacity,
      transparent: true,
      linewidth: 1
    });
    
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.previewLines.push(line);
  }
  
  /**
   * Clear all preview lines
   */
  clearPreviewLines() {
    this.previewLines.forEach(line => {
      this.scene.remove(line);
    });
    this.previewLines = [];
  }
}
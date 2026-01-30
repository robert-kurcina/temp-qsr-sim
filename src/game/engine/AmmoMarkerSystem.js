// /src/engine/AmmoMarkerSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Out-of-Ammo! marker system for ranged weapons
 */
export class AmmoMarkerSystem {
  constructor() {
    this.ammoMarkers = new Map(); // modelId -> weapon markers
  }
  
  /**
   * Add Out-of-Ammo! marker to model's weapon
   */
  addAmmoMarker(modelId, weaponType = 'ranged') {
    const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
    if (!model) return;
    
    // Create ammo marker
    const marker = this.createAmmoMarker(weaponType, model);
    model.mesh.add(marker);
    
    // Store reference
    if (!this.ammoMarkers.has(modelId)) {
      this.ammoMarkers.set(modelId, []);
    }
    this.ammoMarkers.get(modelId).push({ weapon: weaponType, marker: marker });
  }
  
  /**
   * Remove Out-of-Ammo! marker
   */
  removeAmmoMarker(modelId, weaponType = 'ranged') {
    if (!this.ammoMarkers.has(modelId)) return;
    
    const markers = this.ammoMarkers.get(modelId);
    const index = markers.findIndex(m => m.weapon === weaponType);
    
    if (index !== -1) {
      const marker = markers[index].marker;
      const model = window.BATTLEFIELD_ENGINE.models.find(m => m.id === modelId);
      if (model) {
        model.mesh.remove(marker);
      }
      
      markers.splice(index, 1);
      if (markers.length === 0) {
        this.ammoMarkers.delete(modelId);
      }
    }
  }
  
  /**
   * Check if model has Out-of-Ammo! marker
   */
  hasAmmoMarker(modelId, weaponType = 'ranged') {
    if (!this.ammoMarkers.has(modelId)) return false;
    return this.ammoMarkers.get(modelId).some(m => m.weapon === weaponType);
  }
  
  /**
   * Create Out-of-Ammo! marker (20mm / 0.75" diameter)
   */
  createAmmoMarker(weaponType, model) {
    // 20mm = 0.75" = 0.75 MU (assuming 1" = 1 MU)
    const diameterMU = 0.75;
    const radiusMU = diameterMU / 2;
    
    // Create circular marker base
    const geometry = new THREE.CircleGeometry(radiusMU, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x95a5a6, // Gray base
      transparent: true,
      opacity: 0.8
    });
    const marker = new THREE.Mesh(geometry, material);
    
    // Position next to model (offset from base)
    marker.position.set(0.8, 0.8, 0.01); // MU offset
    marker.rotation.x = -Math.PI / 2;
    
    // Add "Out of Ammo!" text/icon
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;
    
    // Red background circle
    context.fillStyle = '#e74c3c';
    context.beginPath();
    context.arc(32, 32, 30, 0, Math.PI * 2);
    context.fill();
    
    // White "X" or ammo symbol
    context.fillStyle = '#ffffff';
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('Ø', 32, 32); // Empty circle symbol
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(diameterMU, diameterMU, 1);
    sprite.position.set(0, 0, 0.02);
    
    marker.add(sprite);
    marker.userData = { type: 'ammo_marker', weapon: weaponType };
    
    return marker;
  }
}
// /src/engine/FOVSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Field of View and Movement Visualization
 */
export class FOVSystem {
  constructor(scene, models, terrain, battlefieldSizeMU) {
    this.scene = scene;
    this.models = models;
    this.terrain = terrain;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.activeModel = null;
    this.fovElements = [];
    this.movementCircle = null;
    this.dragPath = null;
    this.pathfinder = new Pathfinder(terrain, battlefieldSizeMU);
  }
  
  /**
   * Show FOV and movement range for selected model
   */
  showFOV(model) {
  this.clearFOV();
  this.activeModel = model;
  
  const mov = model.profile?.MOV || 2;
  const apAvailable = mov - (model.apSpent || 0);
  
  if (apAvailable <= 0) {
    this.showNoMovement(model);
    return;
  }
  
  // Show movement range with terrain costs
  this.showMovementRangeWithBonuses(model, apAvailable);
  
  // Show elevation indicator
  this.showElevationIndicator(model);
}

showMovementRangeWithBonuses(model, maxAP) {
  const enemyModels = window.BATTLEFIELD_ENGINE.models.filter(m => m.side !== model.side);
  const coverBonusSystem = new CoverBonusSystem(this.coverSystem, this.elevationSystem);
  
  // Create movement grid
  const gridSize = 0.5;
  const maxRange = maxAP * 2;
  
  for (let dx = -maxRange; dx <= maxRange; dx += gridSize) {
    for (let dy = -maxRange; dy <= maxRange; dy += gridSize) {
      const testX = model.position.x + dx;
      const testY = model.position.y + dy;
      
      // Skip if outside battlefield
      if (Math.abs(testX) > this.battlefieldSizeMU/2 || 
          Math.abs(testY) > this.battlefieldSizeMU/2) {
        continue;
      }
      
      // Calculate path cost
      const pathResult = this.pathfinder.findPathWithCost(model.position, {x: testX, y: testY});
      if (!pathResult || pathResult.cost > maxAP) continue;
      
      // Calculate defensive bonus
      const bonus = coverBonusSystem.calculateDefensiveBonus({x: testX, y: testY}, enemyModels);
      
      // Color code by bonus strength
      let color;
      if (bonus.total >= 4) color = 0x00ff00; // Green - excellent cover
      else if (bonus.total >= 3) color = 0x7ed321; // Light green - good cover
      else if (bonus.total >= 2) color = 0xf5a623; // Orange - moderate cover
      else if (bonus.total >= 1) color = 0xd0021b; // Red - minimal cover
      else color = 0x9b9b9b; // Gray - no cover
      
      this.showReachablePoint(testX, testY, color);
    }
  }
}

showElevationIndicator(model) {
  const elevation = this.elevationSystem.getElevationAt(model.position.x, model.position.y);
  if (elevation > 0) {
    // Show elevation marker above model
    const geometry = new THREE.CircleGeometry(0.3, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x50e3c2, // Teal for elevation
      transparent: true,
      opacity: 0.8
    });
    const circle = new THREE.Mesh(geometry, material);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(model.position.x, model.position.y, elevation + 0.6);
    
    this.scene.add(circle);
    this.fovElements.push(circle);
  }
}

  // Add AP cost visualization
showMovementRange(model, maxAP) {
  // Show different colored rings for different AP costs
  const colors = {
    clear: 0x4a90e2,    // Blue
    rough: 0xf5a623,    // Orange  
    difficult: 0xd0021b // Red
  };
  
  // Create movement grid points
  const gridSize = 0.5;
  const range = maxAP * 2; // Maximum possible range
  
  for (let dx = -range; dx <= range; dx += gridSize) {
    for (let dy = -range; dy <= range; dy += gridSize) {
      const testX = model.position.x + dx;
      const testY = model.position.y + dy;
      
      // Skip if outside battlefield
      if (Math.abs(testX) > this.battlefieldSizeMU/2 || 
          Math.abs(testY) > this.battlefieldSizeMU/2) {
        continue;
      }
      
      // Calculate path cost
      const path = this.pathfinder.findPathToPosition(model.position, {x: testX, y: testY});
      if (path && path.cost <= maxAP) {
        const terrainType = getTerrainTypeAtPosition(testX, testY, this.terrain);
        if (terrainType !== 'impassable') {
          this.showReachablePoint(testX, testY, colors[terrainType] || 0x4a90e2);
        }
      }
    }
  }
}

showReachablePoint(x, y, color) {
  const geometry = new THREE.CircleGeometry(0.1, 8);
  const material = new THREE.MeshBasicMaterial({ 
    color: color,
    transparent: true,
    opacity: 0.6
  });
  const point = new THREE.Mesh(geometry, material);
  point.rotation.x = -Math.PI / 2;
  point.position.set(x, y, 0.01);
  
  this.scene.add(point);
  this.fovElements.push(point);
}
  
  /**
   * Show movement range circle
   */
  showMovementCircle(model, ap) {
    const radius = ap; // 1 AP = 1 MU in clear terrain
    const geometry = new THREE.CircleGeometry(radius, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x4a90e2,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const circle = new THREE.Mesh(geometry, material);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(model.position.x, model.position.y, 0.01);
    
    this.scene.add(circle);
    this.movementCircle = circle;
    this.fovElements.push(circle);
  }
  
  /**
   * Show FOV range
   */
  showFOVRange(model, visibilityOR) {
    // Simple circular FOV for now
    const geometry = new THREE.RingGeometry(0.5, visibilityOR, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x7ed321,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(model.position.x, model.position.y, 0.02);
    
    this.scene.add(ring);
    this.fovElements.push(ring);
  }
  
  /**
   * Show no movement available
   */
  showNoMovement(model) {
    const geometry = new THREE.CircleGeometry(0.5, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xd0021b,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const circle = new THREE.Mesh(geometry, material);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(model.position.x, model.position.y, 0.01);
    
    this.scene.add(circle);
    this.fovElements.push(circle);
  }
  
  /**
   * Clear all FOV elements
   */
  clearFOV() {
    this.fovElements.forEach(element => {
      this.scene.remove(element);
    });
    this.fovElements = [];
    this.activeModel = null;
    this.movementCircle = null;
  }
}
// /src/engine/MovementSystem.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Constrained movement with optimal pathfinding
 */
export class MovementSystem {
  constructor(scene, models, terrain, battlefieldSizeMU, fovSystem) {
    this.scene = scene;
    this.models = models;
    this.terrain = terrain;
    this.battlefieldSizeMU = battlefieldSizeMU;
    this.fovSystem = fovSystem;
    this.isDragging = false;
    this.dragModel = null;
    this.dragStartPos = null;
    this.dragPathLine = null;
    this.grayCircle = null;
    this.pathfinder = new Pathfinder(terrain, battlefieldSizeMU);

    this.bindEvents();
  }

  /**
   * Bind mouse events
   */
  bindEvents() {
    const canvas = this.scene.userData.canvas || document.getElementById('battlefield-canvas');

    canvas.addEventListener('mousedown', (event) => {
      if (this.isDragging) return;

      const intersect = this.getIntersect(event);
      if (intersect && intersect.object.userData.model) {
        const model = intersect.object.userData.model;
        this.startDrag(model, event);
      }
    });

    canvas.addEventListener('mousemove', (event) => {
      if (this.isDragging) {
        this.updateDrag(event);
      }
    });

    canvas.addEventListener('mouseup', (event) => {
      if (this.isDragging) {
        this.endDrag(event);
      }
    });
  }

  /**
   * Get intersection with models
   */
  getIntersect(event) {
    const rect = event.target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), window.BATTLEFIELD_ENGINE.camera);

    const intersects = raycaster.intersectObjects(
      this.models.map(m => m.mesh), false
    );

    return intersects[0] || null;
  }

  /**
   * Start dragging a model
   */
  startDrag(model, event) {
    this.isDragging = true;
    this.dragModel = model;
    this.dragStartPos = { ...model.position };

    // Create gray circle at original position
    this.createGrayCircle(model.position);

    // Hide FOV during drag
    this.fovSystem.clearFOV();
  }

  /**
   * Create gray circle at original position
   */
  createGrayCircle(position) {
    const geometry = new THREE.CircleGeometry(0.5, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0x9b9b9b,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const circle = new THREE.Mesh(geometry, material);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(position.x, position.y, 0.01);

    this.scene.add(circle);
    this.grayCircle = circle;
  }

  /**
   * Update drag position with constraints
   */
  updateDrag(event) {
    const worldPos = this.screenToWorld(event.clientX, event.clientY);

    // Calculate optimal path with correct AP costs
    const pathResult = this.pathfinder.findPathWithCost(this.dragStartPos, worldPos);

    if (pathResult && pathResult.cost <= 1) { // 1 AP available
      const finalPos = pathResult.path[pathResult.path.length - 1];
      this.updateModelPosition(this.dragModel, finalPos);
      this.updateDragPath(this.dragStartPos, finalPos);
      this.dragModel.pendingAPCost = pathResult.cost;
    } else {
      // Find closest valid position within 1 AP budget
      const closestValid = this.findClosestValidPosition(this.dragStartPos, worldPos, 1);
      if (closestValid) {
        this.updateModelPosition(this.dragModel, closestValid);
        this.updateDragPath(this.dragStartPos, closestValid);
        this.dragModel.pendingAPCost = this.calculatePathCost(this.dragStartPos, closestValid);
      }
    }
  }

  // Helper method for AP cost calculation
  calculatePathCost(start, end) {
    const pathResult = this.pathfinder.findPathWithCost(start, end);
    return pathResult ? pathResult.cost : Infinity;
  }

  showTacticalBonusPreview(position) {
    if (this.tacticalPreview) {
      this.scene.remove(this.tacticalPreview);
      this.tacticalPreview = null;
    }

    // Calculate bonus
    const enemyModels = window.BATTLEFIELD_ENGINE.models.filter(m => m.side !== this.dragModel.side);
    const coverBonusSystem = new CoverBonusSystem(
      window.COVER_SYSTEM,
      window.ELEVATION_SYSTEM
    );
    const bonus = coverBonusSystem.calculateDefensiveBonus(position, enemyModels);

    if (bonus.total > 0) {
      // Show bonus indicator
      const text = `+${bonus.total}`;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 64;
      canvas.height = 32;

      context.fillStyle = 'rgba(0,0,0,0.8)';
      context.fillRect(0, 0, 64, 32);
      context.fillStyle = 'white';
      context.font = 'bold 24px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 32, 16);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(position.x, position.y, 1.0);
      sprite.scale.set(1, 0.5, 1);

      this.scene.add(sprite);
      this.tacticalPreview = sprite;
    }
  }

  /**
   * Update model position
   */
  updateModelPosition(model, position) {
    model.position.x = position.x;
    model.position.y = position.y;
    model.mesh.position.x = position.x;
    model.mesh.position.y = position.y;
  }

  // New method: Find path with cost calculation
  findPathWithCost(start, end) {
    // Use A* with AP costs
    const path = this.pathfinder.findPath(start, end);
    if (!path) return null;

    let totalCost = 0;
    for (let i = 1; i < path.length; i++) {
      const terrainType = getTerrainTypeAtPosition(path[i].x, path[i].y, this.terrain);
      totalCost += TERRAIN_COSTS[terrainType].apCost;
    }

    return { path, cost: totalCost };
  }

  // New method: Find closest valid position within AP budget
  findClosestValidPosition(start, target, maxAP) {
    // Search in expanding circles
    for (let radius = 0.5; radius <= 3; radius += 0.5) {
      const samples = Math.ceil(radius * 8);

      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const testX = target.x + Math.cos(angle) * radius;
        const testY = target.y + Math.sin(angle) * radius;

        const pathResult = this.findPathWithCost(start, { x: testX, y: testY });
        if (pathResult && pathResult.cost <= maxAP) {
          return { x: testX, y: testY };
        }
      }
    }

    return null;
  }

  /**
   * Update drag path visualization
   */
  updateDragPath(start, end) {
    // Remove existing path
    if (this.dragPathLine) {
      this.scene.remove(this.dragPathLine);
    }

    // Create new path line
    const startVec = new THREE.Vector3(start.x, start.y, 0.05);
    const endVec = new THREE.Vector3(end.x, end.y, 0.05);

    const geometry = new THREE.BufferGeometry().setFromPoints([startVec, endVec]);
    const material = new THREE.LineBasicMaterial({
      color: 0x4a90e2,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.dragPathLine = line;
  }

  /**
   * End drag and lock position
   */
  endDrag(event) {
    this.isDragging = false;

    // Record movement action for undo/redo
    if (this.dragModel && this.dragStartPos) {
      const finalPos = { ...this.dragModel.position };
      if (finalPos.x !== this.dragStartPos.x || finalPos.y !== this.dragStartPos.y) {
        window.HISTORY_MANAGER?.saveState(
          window.BATTLEFIELD_ENGINE.terrain,
          window.BATTLEFIELD_ENGINE.models,
          `Move ${this.dragModel.identifier}`
        );
      }
    }

    // Clean up visual elements
    this.cleanupDragVisuals();
  }

  /**
   * Clean up drag visuals
   */
  cleanupDragVisuals() {
    if (this.grayCircle) {
      this.scene.remove(this.grayCircle);
      this.grayCircle = null;
    }

    if (this.dragPathLine) {
      this.scene.remove(this.dragPathLine);
      this.dragPathLine = null;
    }

    this.dragModel = null;
    this.dragStartPos = null;
  }

  /**
   * Screen to world coordinates
   */
  screenToWorld(clientX, clientY) {
    const rect = document.getElementById('battlefield-canvas').getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), window.BATTLEFIELD_ENGINE.camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    return { x: intersection.x, y: intersection.z };
  }

  /**
   * Clear all movement visuals (end of turn)
   */
  clearAllVisuals() {
    this.cleanupDragVisuals();
    this.fovSystem.clearFOV();
  }
}
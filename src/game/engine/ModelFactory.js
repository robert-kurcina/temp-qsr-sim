// /src/engine/ModelFactory.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/**
 * Creates canonical MEST character models
 */
export class ModelFactory {
  /**
   * Create a character model with specified properties
   * @param {string} id - Unique model ID
   * @param {number} x - X position (meters)
   * @param {number} y - Y position (meters)  
   * @param {string} side - 'side-a' or 'side-b'
   * @param {string} identifier - Single capital letter (A-Z)
   * @param {number} MU_TO_M - Conversion factor (0.5 meters per MU)
   * @returns {Object} - Model object with mesh and metadata
   */
  static createCharacter(id, x, y, side, identifier, MU_TO_M) {
    // Model dimensions: 1 MU diameter × 1 MU height
    const radiusMU = 0.5; // 1 MU diameter = 0.5 MU radius
    const heightMU = 1.0;

    const radiusM = radiusMU * MU_TO_M;
    const heightM = heightMU * MU_TO_M;

    // Side colors
    const colors = {
      'side-a': 0xff0000, // Red
      'side-b': 0x0000ff  // Blue
    };

    const color = colors[side] || 0x808080; // Gray fallback

    // Create cylinder mesh
    const geometry = new THREE.CylinderGeometry(radiusM, radiusM, heightM, 16);
    const material = new THREE.MeshLambertMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, heightM / 2); // Center on ground plane
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add top label (white capital letter)
    const label = this.createLabel(identifier, x, y, heightM, MU_TO_M);
    mesh.add(label);

    return {
      id: id,
      mesh: mesh,
      position: new THREE.Vector3(x, y, heightM / 2),
      height: heightM,
      side: side,
      identifier: identifier,
      type: 'character'
    };
  }

  /**
   * Create top-view label for character model
   * @param {string} text - Single capital letter
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} height - Model height
   * @param {number} MU_TO_M - Conversion factor
   * @returns {THREE.Object3D} - Label object
   */
  static createLabel(text, x, y, height, MU_TO_M) {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 128;
    canvas.height = 128;

    // Style the text
    context.fillStyle = 'rgba(255, 255, 255, 0.9)'; // White with slight transparency
    context.font = 'bold 96px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 64);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false // Always visible
    });

    // Create sprite
    const sprite = new THREE.Sprite(material);

    // Position above model
    const labelHeightM = 1.5 * MU_TO_M; // Slightly above model height
    sprite.position.set(0, 0, labelHeightM);

    // Scale to be readable from top view
    const scale = 0.8 * MU_TO_M;
    sprite.scale.set(scale, scale, 1);

    return sprite;
  }

  /**
   * Update model position
   * @param {Object} model - Model object
   * @param {number} x - New X position
   * @param {number} y - New Y position
   */
  static updatePosition(model, x, y) {
    model.position.set(x, y, model.height / 2);
    model.mesh.position.set(x, y, model.height / 2);
  }

  // In ModelFactory.js, add userData to mesh
  static createCharacter(id, x, y, side, identifier, MU_TO_M) {
    // ... existing code ...

    // Add userData for click detection
    mesh.userData = { model: model };

    return model;
  }

  // In ModelFactory.js
  static createKOMarker(model) {
    // Red circle around base for KO'd models
    const geometry = new THREE.RingGeometry(0.5, 0.6, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(0, 0, 0.01);

    return marker;
  }

  static createEliminationMarker(position) {
    // Red circle with X for eliminated models
    const group = new THREE.Group();

    // Red circle
    const circleGeometry = new THREE.RingGeometry(0.5, 0.6, 32);
    const circleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8
    });
    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(0, 0, 0.01);
    group.add(circle);

    // Red X
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 64;

    context.fillStyle = 'rgba(255,0,0,0.8)';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('X', 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1, 1, 1);
    sprite.position.set(0, 0, 0.02);
    group.add(sprite);

    group.position.set(position.x, position.y, 0);
    return group;
  }
}
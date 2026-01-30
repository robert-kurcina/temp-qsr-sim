// /src/engine/BattlefieldEngine.js
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

// Add to initBattlefield function
window.BATTLEFIELD_ENGINE = {
  scene,
  camera,
  renderer,
  battlefieldSizeMU,
  MU_TO_M,
  terrain: [],
  models: [],
  selectedObjectType: null, // 'character', 'wall', 'woods', etc.
  selectedSide: 'side-a',   // 'side-a' or 'side-b'
  nextIdentifier: 'A'       // Next available letter
};

// Add click handler for placement
renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersection);
  
  placeSelectedObject(intersection.x, intersection.z);
});

// Global placement function
function placeSelectedObject(x, y) {
  const engine = window.BATTLEFIELD_ENGINE;
  const battlefieldSizeM = engine.battlefieldSizeMU * engine.MU_TO_M;
  
  // Check if position is within battlefield bounds
  if (Math.abs(x) > battlefieldSizeM/2 || Math.abs(y) > battlefieldSizeM/2) {
    console.log('Position outside battlefield');
    return;
  }
  
  if (engine.selectedObjectType === 'character') {
    // Create unique ID
    const id = `model_${Date.now()}`;
    
    // Get next identifier (A-Z, then AA, AB, etc.)
    const identifier = engine.nextIdentifier;
    engine.nextIdentifier = getNextIdentifier(engine.nextIdentifier);
    
    // Create model
    const model = ModelFactory.createCharacter(
      id,
      x,
      y,
      engine.selectedSide,
      identifier,
      engine.MU_TO_M
    );
    
    // Add to scene and engine
    engine.scene.add(model.mesh);
    engine.models.push(model);
    
    console.log(`Placed ${engine.selectedSide} model ${identifier} at (${x}, ${y})`);
  }
  // ... handle other object types
}

// In BattlefieldEngine.js
function handleBattlefieldClick(event) {
  if (!window.BATTLEFIELD_ENGINE.selectedTerrain) return;
  
  // Convert screen coordinates to world coordinates
  const worldPos = screenToWorld(event.clientX, event.clientY);
  
  // Create temporary object for validation
  const tempObject = createTemporaryObject(
    window.BATTLEFIELD_ENGINE.selectedTerrain.type,
    worldPos.x, worldPos.y,
    window.BATTLEFIELD_ENGINE.selectedTerrain.params,
    window.BATTLEFIELD_ENGINE.MU_TO_M,
    window.BATTLEFIELD_ENGINE.selectedTerrain.rotation
  );
  
  // Validate placement
  const validation = collisionSystem.isValidPlacement(tempObject);
  
  if (validation.valid) {
    // Create actual terrain object
    const terrainObj = TerrainFactory.createTerrain(
      window.BATTLEFIELD_ENGINE.selectedTerrain.type,
      worldPos.x, worldPos.y,
      window.BATTLEFIELD_ENGINE.selectedTerrain.params,
      window.BATTLEFIELD_ENGINE.MU_TO_M,
      window.BATTLEFIELD_ENGINE.selectedTerrain.rotation
    );
    
    // Add to scene and collision system
    scene.add(terrainObj.mesh);
    collisionSystem.addObject(terrainObj);
    window.BATTLEFIELD_ENGINE.terrain.push(terrainObj);
    
    showPlacementStatus('success', `Placed ${terrainObj.type}`);
  } else {
    showPlacementStatus('error', getErrorMessage(validation.reason));
  }
}

/**
 * Allow objects to be partially outside battlefield
 * Visual clipping handled by Three.js frustum culling
 */
function screenToWorld(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, intersection);
  
  return {
    x: intersection.x,
    y: intersection.z
  };
}

function getNextIdentifier(current) {
  if (current === 'Z') return 'AA';
  if (current.length === 1) {
    return String.fromCharCode(current.charCodeAt(0) + 1);
  }
  // For simplicity, just cycle A-Z
  return 'A';
}

// Add model placement functionality
export function initBattlefield(data) {
  // ... existing code ...
  
  // Add click handler for model/terrain placement
  renderer.domElement.addEventListener('click', (event) => {
    // Get mouse position
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    
    // Convert to world coordinates
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    
    // Place selected terrain/model
    placeSelectedObject(intersection.x, intersection.z);
  });
}

// Global function for object placement
function placeSelectedObject(x, y) {
  if (!window.BATTLEFIELD_ENGINE) return;
  
  // This would integrate with your terrain placement logic
  // For now, just log the position
  console.log('Place object at:', x, y);
}

/**
 * Canonical MEST battlefield engine
 */
export function initBattlefield(data) {
  // Get game size from mission or default
  const gameSize = 'medium'; // Would come from mission data
  const battlefieldSizeMU = data.gameSizes[gameSize].battlefieldSizeMU;
  const MU_TO_M = 0.5; // 1 MU = 0.5 meters
  const battlefieldSizeM = battlefieldSizeMU * MU_TO_M;
  
  // Remove loading overlay
  document.getElementById('loading-battlefield')?.remove();
  
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8d9b9);
  
  // Camera (top-down orthographic)
  const camera = new THREE.OrthographicCamera(
    -battlefieldSizeM/2, battlefieldSizeM/2,
    battlefieldSizeM/2, -battlefieldSizeM/2,
    0.1, 100
  );
  camera.position.set(0, 0, 30);
  camera.lookAt(0, 0, 0);
  
  // Renderer
  const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('battlefield-canvas'),
    antialias: true 
  });
  renderer.setSize(
    document.getElementById('battlefield-container').clientWidth,
    Math.min(400, window.innerHeight * 0.5)
  );
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(-10, -10, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  scene.add(dirLight);
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Battlefield plane
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(battlefieldSizeM, battlefieldSizeM),
    new THREE.MeshLambertMaterial({ color: 0xe8d9b9 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);
  
  // Grid helper (every 2 MU)
  const gridDivisions = Math.floor(battlefieldSizeMU / 2);
  const grid = new THREE.GridHelper(battlefieldSizeM, gridDivisions, 0xaaaaaa, 0x777777);
  grid.rotation.x = -Math.PI / 2;
  scene.add(grid);
  
  // Store engine state globally for interaction
  window.BATTLEFIELD_ENGINE = {
    scene,
    camera,
    renderer,
    battlefieldSizeMU,
    MU_TO_M,
    terrain: [],
    models: []
  };
  
  // Handle resize
  window.addEventListener('resize', () => {
    const container = document.getElementById('battlefield-container');
    renderer.setSize(container.clientWidth, Math.min(400, window.innerHeight * 0.5));
    camera.left = -battlefieldSizeM/2;
    camera.right = battlefieldSizeM/2;
    camera.top = battlefieldSizeM/2;
    camera.bottom = -battlefieldSizeM/2;
    camera.updateProjectionMatrix();
  });
  
  // Start animation loop
  animate();
  
  console.log(`✅ Battlefield initialized: ${battlefieldSizeMU}×${battlefieldSizeMU} MU`);
}

function animate() {
  requestAnimationFrame(animate);
  window.BATTLEFIELD_ENGINE?.renderer?.render(
    window.BATTLEFIELD_ENGINE.scene,
    window.BATTLEFIELD_ENGINE.camera
  );
}
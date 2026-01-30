// /src/ui/molecules/TerrainControls.js
export function TerrainPlacementControls() {
  let losPreview = null;
  // In TerrainPlacementControls.js
function placeTerrainAt(worldPos) {
  // ... existing placement logic ...
  
  // Add to collision system
  collisionSystem.addObject(terrainObj);
  
  // Notify LOS engine of terrain change
  if (window.LOS_ENGINE) {
    window.LOS_ENGINE.updateTerrainBounds();
  }
  
  // Re-run LOS validation if active
  if (window.LOS_VALIDATION_ACTIVE) {
    runLOSValidation();
  }
}

  return `
    <div class="terrain-controls organism-card">
      <h3 class="font-medium mb-2">Terrain Placement</h3>
      
      <!-- Terrain Type Selector -->
      <div class="mb-3">
        <label class="block text-sm font-medium mb-1">Terrain Type</label>
        <select id="terrain-type" class="w-full px-3 py-2 border rounded min-h-[48px]">
          <option value="hill">🏔️ Hill</option>
          <option value="tree_single">🌲 Single Tree</option>
          <option value="tree_cluster">🌳 Tree Cluster</option>
          <option value="tree_stand">🌲🌲 Tree Stand</option>
          <option value="building">🏗️ Building</option>
          <option value="wall">🧱 Wall</option>
        </select>
      </div>
      
      <!-- Hill Size Selector -->
      <div id="hill-size-controls" class="mb-3 hidden">
        <label class="block text-sm font-medium mb-1">Hill Size</label>
        <select id="hill-size" class="w-full px-3 py-2 border rounded min-h-[48px]">
          <option value="small">Small (1 MU tall)</option>
          <option value="medium">Medium (1 MU tall)</option>
          <option value="large">Large (2 MU tall)</option>
        </select>
      </div>
      
      <!-- Building Size Controls -->
      <div id="building-size-controls" class="grid grid-cols-2 gap-2 mb-3 hidden">
        <div>
          <label class="block text-sm font-medium mb-1">Width (MU)</label>
          <input type="number" id="building-width" min="2" max="8" value="4" 
                 class="w-full px-3 py-2 border rounded min-h-[48px]">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Depth (MU)</label>
          <input type="number" id="building-depth" min="2" max="6" value="4" 
                 class="w-full px-3 py-2 border rounded min-h-[48px]">
        </div>
      </div>
      
      <!-- Rotation Control -->
      <div class="mb-3">
        <label class="block text-sm font-medium mb-1">Rotation (Z-axis)</label>
        <div class="flex gap-2">
          <input type="number" id="rotation-degrees" min="0" max="345" step="15" value="0" 
                 class="flex-1 px-3 py-2 border rounded min-h-[48px]">
          <button id="rotate-15" class="btn btn-secondary min-w-[48px]" title="Rotate +15°">
            ↻
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">15° increments</p>
      </div>
      
      <!-- Placement Mode -->
      <div class="flex gap-2">
        <button id="place-terrain" class="btn btn-primary flex-1">Place Terrain</button>
        <button id="clear-terrain" class="btn btn-secondary min-w-[48px]" title="Clear Selection">
          ✕
        </button>
      </div>
      
      <!-- Status Display -->
      <div id="placement-status" class="text-sm mt-2"></div>
    </div>
  `;
}

// Initialize controls
export function initTerrainControls(collisionSystem) {
  const terrainType = document.getElementById('terrain-type');
  const hillSizeControls = document.getElementById('hill-size-controls');
  const buildingSizeControls = document.getElementById('building-size-controls');
  
  // Show/hide size controls based on terrain type
  terrainType.addEventListener('change', () => {
    hillSizeControls.classList.toggle('hidden', terrainType.value !== 'hill');
    buildingSizeControls.classList.toggle('hidden', terrainType.value !== 'building');
  });
  
  // Rotation controls
  const rotateBtn = document.getElementById('rotate-15');
  const rotationInput = document.getElementById('rotation-degrees');
  
  rotateBtn.addEventListener('click', () => {
    let current = parseInt(rotationInput.value) || 0;
    current = (current + 15) % 360;
    rotationInput.value = current;
  });
  
  // Place terrain handler
  document.getElementById('place-terrain').addEventListener('click', () => {
    const type = terrainType.value;
    const rotation = parseInt(rotationInput.value) || 0;
    
    // Store selection in global state
    window.BATTLEFIELD_ENGINE.selectedTerrain = {
      type: type,
      rotation: rotation,
      params: getTerrainParams(type)
    };
    
    document.getElementById('placement-status').innerHTML = 
      `<span class="text-green-600">Click battlefield to place ${type} at ${rotation}°</span>`;
  });
  
  function getTerrainParams(type) {
    if (type === 'hill') {
      return { size: document.getElementById('hill-size').value };
    } else if (type === 'building') {
      return {
        width: parseFloat(document.getElementById('building-width').value),
        depth: parseFloat(document.getElementById('building-depth').value)
      };
    }
    return {};
  }

  // Initialize LOS preview
  losPreview = new LOSPreview(
    window.BATTLEFIELD_ENGINE.scene,
    window.BATTLEFIELD_ENGINE.models,
    window.BATTLEFIELD_ENGINE.terrain,
    window.BATTLEFIELD_ENGINE.battlefieldSizeMU
  );
  
  // Mouse move handler for real-time preview
  window.BATTLEFIELD_ENGINE.renderer.domElement.addEventListener('mousemove', (event) => {
    if (!window.BATTLEFIELD_ENGINE.selectedTerrain) return;
    
    const worldPos = screenToWorld(event.clientX, event.clientY);
    const tempObject = createTemporaryObject(
      window.BATTLEFIELD_ENGINE.selectedTerrain.type,
      worldPos.x, worldPos.y,
      window.BATTLEFIELD_ENGINE.selectedTerrain.params,
      window.BATTLEFIELD_ENGINE.MU_TO_M,
      window.BATTLEFIELD_ENGINE.selectedTerrain.rotation
    );
    
    // Validate placement
    const validation = collisionSystem.isValidPlacement(tempObject);
    
    // Update temporary object appearance
    if (tempObject.mesh) {
      if (validation.valid) {
        tempObject.mesh.material.color.set(0x00ff00); // Green for valid
      } else {
        tempObject.mesh.material.color.set(0xff0000); // Red for invalid
      }
    }
    
    // Update LOS preview
    losPreview.startPreview(tempObject);
  });
  
  // Mouse leave handler
  window.BATTLEFIELD_ENGINE.renderer.domElement.addEventListener('mouseleave', () => {
    losPreview.stopPreview();
  });
  
  // Click handler (place terrain)
  window.BATTLEFIELD_ENGINE.renderer.domElement.addEventListener('click', (event) => {
    if (!window.BATTLEFIELD_ENGINE.selectedTerrain) return;
    
    // Stop preview
    losPreview.stopPreview();
    
    // Place actual terrain
    const worldPos = screenToWorld(event.clientX, event.clientY);
    const tempObject = createTemporaryObject(
      window.BATTLEFIELD_ENGINE.selectedTerrain.type,
      worldPos.x, worldPos.y,
      window.BATTLEFIELD_ENGINE.selectedTerrain.params,
      window.BATTLEFIELD_ENGINE.MU_TO_M,
      window.BATTLEFIELD_ENGINE.selectedTerrain.rotation
    );
    
    const validation = collisionSystem.isValidPlacement(tempObject);
    
    if (validation.valid) {
      // Create and place actual terrain
      const actualTerrain = TerrainFactory.createTerrain(
        window.BATTLEFIELD_ENGINE.selectedTerrain.type,
        worldPos.x, worldPos.y,
        window.BATTLEFIELD_ENGINE.selectedTerrain.params,
        window.BATTLEFIELD_ENGINE.MU_TO_M,
        window.BATTLEFIELD_ENGINE.selectedTerrain.rotation
      );
      
      // Add to scene and systems
      window.BATTLEFIELD_ENGINE.scene.add(actualTerrain.mesh);
      collisionSystem.addObject(actualTerrain);
      window.BATTLEFIELD_ENGINE.terrain.push(actualTerrain);
      
      // Update LOS engine
      if (window.LOS_ENGINE) {
        window.LOS_ENGINE.updateTerrainBounds();
      }
      
      showPlacementStatus('success', `Placed ${actualTerrain.type}`);
    } else {
      showPlacementStatus('error', getErrorMessage(validation.reason));
    }
  });
}
// /src/ui/molecules/BattlefieldControls.js
export function BattlefieldControls() {
  return `
    <div class="battlefield-controls organism-card">
      <h3 class="font-medium mb-2">Battlefield Tools</h3>
      
      <!-- Generation Controls -->
      <div class="grid grid-cols-2 gap-2 mb-3">
        <button id="generate-layout" class="btn btn-primary">🎲 Generate</button>
        <button id="clear-all" class="btn btn-secondary">🗑️ Clear</button>
      </div>
      
      <!-- Edit Controls -->
      <div class="grid grid-cols-2 gap-2 mb-3">
        <button id="undo-btn" class="btn btn-secondary" disabled>↩️ Undo</button>
        <button id="redo-btn" class="btn btn-secondary" disabled>↪️ Redo</button>
      </div>
      
      <!-- Reset Control -->
      <button id="reset-layout" class="btn btn-secondary w-full mb-3">🔄 Reset</button>
      
      <!-- Status Display -->
      <div id="battlefield-status" class="text-sm">
        <span id="los-warning" class="hidden text-yellow-600">⚠️ LOS violations detected</span>
        <span id="coverage-info" class="text-gray-500">Coverage: 0%</span>
      </div>
    </div>
  `;
}

export function initBattlefieldControls(generator, historyManager, collisionSystem) {
  // Generate layout
  document.getElementById('generate-layout').addEventListener('click', () => {
    const layout = generator.generateLayout();
    
    // Clear scene
    clearBattlefieldScene();
    
    // Add generated terrain
    layout.forEach(obj => {
      window.BATTLEFIELD_ENGINE.scene.add(obj.mesh);
      window.BATTLEFIELD_ENGINE.terrain.push(obj);
      collisionSystem.addObject(obj);
    });
    
    // Save to history
    historyManager.saveState(window.BATTLEFIELD_ENGINE.terrain, window.BATTLEFIELD_ENGINE.models, 'Generated Layout');
    
    // Update status
    updateCoverageDisplay();
    checkLOSCompliance();
  });
  
  // Clear all
  document.getElementById('clear-all').addEventListener('click', () => {
    if (confirm('Clear all terrain? This cannot be undone without undo.')) {
      clearBattlefieldScene();
      historyManager.saveState([], window.BATTLEFIELD_ENGINE.models, 'Cleared');
      updateCoverageDisplay();
    }
  });
  
  // Undo
  document.getElementById('undo-btn').addEventListener('click', () => {
    const state = historyManager.undo();
    if (state) {
      restoreBattlefieldState(state);
      updateCoverageDisplay();
      checkLOSCompliance();
    }
    updateUndoRedoButtons();
  });
  
  // Redo
  document.getElementById('redo-btn').addEventListener('click', () => {
    const state = historyManager.redo();
    if (state) {
      restoreBattlefieldState(state);
      updateCoverageDisplay();
      checkLOSCompliance();
    }
    updateUndoRedoButtons();
  });
  
  // Reset to generated
  document.getElementById('reset-layout').addEventListener('click', () => {
    // This assumes we store the last generated layout
    if (window.LAST_GENERATED_LAYOUT) {
      const resetState = historyManager.resetToGenerated(window.LAST_GENERATED_LAYOUT);
      restoreBattlefieldState(resetState);
      updateCoverageDisplay();
      checkLOSCompliance();
      updateUndoRedoButtons();
    }
  });
  
  function updateUndoRedoButtons() {
    document.getElementById('undo-btn').disabled = historyManager.history.length <= 1;
    document.getElementById('redo-btn').disabled = historyManager.future.length === 0;
  }
}
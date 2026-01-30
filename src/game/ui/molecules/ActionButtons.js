// Add Pushing button
export function ActionButtons() {
  return `
    <div class="action-buttons organism-card">
      <h3 class="font-medium mb-2">⚔️ Actions</h3>
      
      <div class="grid grid-cols-2 gap-2">
        <button id="action-move" class="btn btn-primary w-full">
          🚶 Move
        </button>
        <button id="action-hide" class="btn btn-secondary w-full">
          🕵️ Hide
        </button>
        <button id="action-wait" class="btn btn-secondary w-full">
          ⏸️ Wait
        </button>
        <button id="action-closeCombat" class="btn btn-danger w-full">
          ⚔️ Close Combat
        </button>
        <button id="action-rangedCombat" class="btn btn-primary w-full">
          🔫 Ranged
        </button>
        <button id="action-refresh" class="btn btn-secondary w-full">
          🔄 Refresh
        </button>
        <button id="action-pushing" class="btn btn-warning w-full">
          💪 Pushing
        </button>
      </div>
      
      <div id="action-status" class="text-xs text-gray-500 mt-2">
        Select a model to see available actions
      </div>
    </div>
  `;
}

// Add pushing to action list
export function initActionButtons(actionSystem) {
  const actions = ['move', 'hide', 'wait', 'closeCombat', 'rangedCombat', 'refresh', 'pushing'];
  
  actions.forEach(actionName => {
    const button = document.getElementById(`action-${actionName}`);
    if (button) {
      button.addEventListener('click', () => {
        actionSystem.executeAction(actionName);
      });
    }
  });
}
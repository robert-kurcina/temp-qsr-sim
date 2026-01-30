// /src/ui/molecules/AIControls.js
export function AIControls() {
  return `
    <div class="ai-controls organism-card">
      <h3 class="font-medium mb-2">🤖 AI Analysis</h3>
      
      <div class="grid grid-cols-2 gap-2 mb-3">
        <button id="analyze-battlefield" class="btn btn-primary">🔍 Analyze</button>
        <button id="clear-ai" class="btn btn-secondary">❌ Clear AI</button>
      </div>
      
      <div id="ai-suggestions" class="text-sm space-y-2">
        <!-- AI suggestions will appear here -->
      </div>
      
      <div class="mt-3 text-xs text-gray-500">
        <strong>Colors:</strong> 🟢 LOS-free • 🟡 Better cover • 🔴 Exposed
      </div>
    </div>
  `;
}

export function initAIControls(aiIntegration) {
  // Analyze battlefield
  document.getElementById('analyze-battlefield').addEventListener('click', () => {
    const suggestions = aiIntegration.analyzeBattlefield();
    aiIntegration.showAISuggestions();
    updateAISuggestionsUI(suggestions);
  });
  
  // Clear AI
  document.getElementById('clear-ai').addEventListener('click', () => {
    aiIntegration.clearDebugElements();
    document.getElementById('ai-suggestions').innerHTML = '';
  });
  
  function updateAISuggestionsUI(suggestions) {
    const container = document.getElementById('ai-suggestions');
    
    if (suggestions.length === 0) {
      container.innerHTML = '<p class="text-gray-500">No AI suggestions available</p>';
      return;
    }
    
    container.innerHTML = suggestions.map(suggestion => {
      const colorClass = suggestion.priority === 'high' ? 'text-green-600' :
                        suggestion.priority === 'medium' ? 'text-yellow-600' :
                        'text-red-600';
      
      return `
        <div class="${colorClass} flex items-start">
          <span class="mr-2">•</span>
          <span>${suggestion.description}</span>
        </div>
      `;
    }).join('');
  }
}
// /src/ui/pages/SettingsPage.js
/**
 * Settings page for data management and system controls
 */
export function renderSettingsPage(data) {
  return `
    <div class="settings-page">
      <h1>⚙️ Settings</h1>
      
      <!-- Data Management Section -->
      <div class="organism-card mb-4">
        <h2>💾 Data Management</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          ${this.renderDataButton('Export All Data', 'export-all', 'primary')}
          ${this.renderDataButton('Import Data', 'import-data', 'secondary')}
          ${this.renderDataButton('Reset All Data', 'reset-data', 'danger')}
          ${this.renderDataButton('View JSON', 'view-json', 'secondary')}
        </div>
      </div>
      
      <!-- Game Rules Section -->
      <div class="organism-card mb-4">
        <h2>📜 Game Rules</h2>
        <p class="text-gray-600 mt-2">
          Current QSR compliance: <strong>MEST Tactics Quick Start Rules</strong>
        </p>
        <p class="text-sm text-gray-500 mt-1">
          Game Size Ranges: Small (250-500 BP), Medium (500-750 BP), Large (750-1000 BP)
        </p>
        <p class="text-sm text-gray-500">
          Inter-player balance: ±25 BP tolerance
        </p>
      </div>
      
      <!-- Application Info -->
      <div class="organism-card">
        <h2>ℹ️ Application Info</h2>
        <p class="text-sm text-gray-600 mt-2">
          Version: <strong>v1.0</strong><br>
          Data Files: <strong>7 JSON files loaded</strong><br>
          Storage: <strong>localStorage</strong>
        </p>
        <div class="mt-3">
          ${this.renderDataButton('Clear Cache', 'clear-cache', 'secondary')}
        </div>
      </div>
    </div>
  `;
}

function renderDataButton(text, id, variant) {
  return `
    <button id="${id}" class="btn btn-${variant} w-full min-h-[48px]">
      ${text}
    </button>
  `;
}

// Initialize settings functionality
export function initSettings() {
  // Export all data
  document.getElementById('export-all')?.addEventListener('click', () => {
    exportAllData();
  });
  
  // Import data
  document.getElementById('import-data')?.addEventListener('click', () => {
    importData();
  });
  
  // Reset all data
  document.getElementById('reset-data')?.addEventListener('click', () => {
    resetAllData();
  });
  
  // View JSON
  document.getElementById('view-json')?.addEventListener('click', () => {
    viewJSONData();
  });
  
  // Clear cache
  document.getElementById('clear-cache')?.addEventListener('click', () => {
    clearCache();
  });
}

// Data export function
function exportAllData() {
  const data = {
    profiles: JSON.parse(localStorage.getItem('mest_profiles') || '{}'),
    assemblies: JSON.parse(localStorage.getItem('mest_assemblies') || '{}'),
    missions: JSON.parse(localStorage.getItem('mest_missions') || '{}'),
    selected: {
      assembly: JSON.parse(localStorage.getItem('mest_assembly_selected') || '[]'),
      sideA: JSON.parse(localStorage.getItem('mest_mission_side-a') || '[]'),
      sideB: JSON.parse(localStorage.getItem('mest_mission_side-b') || '[]')
    }
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mest-tactics-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert('Data exported successfully!');
}

// Data import function
function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Import data
        if (data.profiles) localStorage.setItem('mest_profiles', JSON.stringify(data.profiles));
        if (data.assemblies) localStorage.setItem('mest_assemblies', JSON.stringify(data.assemblies));
        if (data.missions) localStorage.setItem('mest_missions', JSON.stringify(data.missions));
        if (data.selected) {
          if (data.selected.assembly) localStorage.setItem('mest_assembly_selected', JSON.stringify(data.selected.assembly));
          if (data.selected.sideA) localStorage.setItem('mest_mission_side-a', JSON.stringify(data.selected.sideA));
          if (data.selected.sideB) localStorage.setItem('mest_mission_side-b', JSON.stringify(data.selected.sideB));
        }
        
        alert('Data imported successfully! Refresh to see changes.');
      } catch (error) {
        alert('Failed to import  ' + error.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Reset all data
function resetAllData() {
  if (confirm('Are you sure? This will delete all saved profiles, assemblies, and missions.')) {
    localStorage.removeItem('mest_profiles');
    localStorage.removeItem('mest_assemblies');
    localStorage.removeItem('mest_missions');
    localStorage.removeItem('mest_assembly_selected');
    localStorage.removeItem('mest_mission_side-a');
    localStorage.removeItem('mest_mission_side-b');
    alert('All data reset successfully!');
    location.reload();
  }
}

// View JSON data
function viewJSONData() {
  const data = {
    profiles: JSON.parse(localStorage.getItem('mest_profiles') || '{}'),
    assemblies: JSON.parse(localStorage.getItem('mest_assemblies') || '{}'),
    missions: JSON.parse(localStorage.getItem('mest_missions') || '{}')
  };
  
  const jsonStr = JSON.stringify(data, null, 2);
  const popup = window.open('', '_blank', 'width=600,height=400');
  popup.document.write(`
    <html>
      <head><title>MEST Data</title></head>
      <body style="font-family: monospace; padding: 20px;">
        <h2>MEST Tactics Data</h2>
        <pre>${jsonStr}</pre>
        <button onclick="window.close()">Close</button>
      </body>
    </html>
  `);
}

// Clear cache
function clearCache() {
  if (confirm('Clear browser cache? This may improve performance.')) {
    // Clear any cached data
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
    alert('Cache cleared! Refresh the page to reload fresh data.');
  }
}
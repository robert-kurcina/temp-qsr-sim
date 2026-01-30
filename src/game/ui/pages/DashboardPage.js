// /src/ui/pages/DashboardPage.js
/**
 * Dashboard page showing app info and recent missions
 */
export function renderDashboard(data) {
  const version = 'v1.0'; // Could come from package.json
  
  return `
    <div class="dashboard-page">
      <h1>MEST Tactics ${version}</h1>
      
      <div class="organism-card">
        <h2>📊 Quick Stats</h2>
        <p>• ${data.archetypes.common.length} Common Archetypes</p>
        <p>• ${data.weapons.length} Weapons</p>
        <p>• ${Object.keys(data.gameSizes).length} Game Sizes</p>
      </div>
      
      <div class="organism-card">
        <h2>🚀 Get Started</h2>
        <p>Build your first character:</p>
        <button class="btn btn-primary mt-2" onclick="window.location.hash='builder'">
          🛠️ Open Builder
        </button>
      </div>
      
      <div class="organism-card">
        <h2>📖 QSR Compliance</h2>
        <p>All data loaded from canonical JSON files.</p>
        <p>Game sizes: Small (250 BP), Medium (500 BP), Large (1000 BP)</p>
      </div>
    </div>
  `;
}
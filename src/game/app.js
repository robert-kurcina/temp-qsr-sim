
import { loadAll } from './app/DataLoader.js';
import { StateManager } from './app/StateManager.js';
import { renderDashboard } from './ui/pages/DashboardPage.js';

// Render settings page when needed
if (StateManager.currentState === 'settings') {
  document.getElementById('settings').innerHTML = renderSettingsPage(data);
  initSettings();
}

// Navigation handlers
document.querySelectorAll('[data-tab]').forEach(element => {
  element.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = e.target.dataset.tab || e.target.parentElement.dataset.tab;
    StateManager.switchTab(tab);
  });
});

// Mobile menu toggle
document.getElementById('menu-toggle')?.addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.remove('hidden');
});

document.getElementById('menu-close')?.addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.add('hidden');
});

// Render gameplay page when needed
if (StateManager.currentState === 'gameplay') {
  document.getElementById('gameplay').innerHTML = renderGameplayPage(data);
  initGameplay(data);
}

// Initialize application
async function init() {
  try {
    // Load canonical data
    const data = await loadAll();

    // Initialize state
    StateManager.initialize(data);

    // Render dashboard
    document.getElementById('dashboard').innerHTML = renderDashboard(data);

    console.log('✅ MEST Tactics initialized with canonical data');
  } catch (error) {
    console.error('❌ Application failed to initialize:', error);
    document.getElementById('loading').innerHTML = `
      <div class="organism-card">
        <h2>❌ Failed to Load</h2>
        <p>Please ensure all /data/ JSON files are present.</p>
        <p>Check browser console for details.</p>
      </div>
    `;
  }

  // Render builder page when needed
  if (StateManager.currentState === 'builder') {
    document.getElementById('builder').innerHTML = renderBuilderPage(data);
    CharacterBuilder.init(data);
    AssemblyManager.init();
    MissionBuilder.init();
  }
}

// Handle hash changes (deep linking)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  if (hash && ['dashboard', 'builder', 'gameplay', 'analysis', 'settings'].includes(hash)) {
    StateManager.switchTab(hash);
  }
});

// After initializing battlefield
function initAIIntegration() {
  window.AI_INTEGRATION = new AIIntegration(
    window.BATTLEFIELD_ENGINE.scene,
    window.BATTLEFIELD_ENGINE.terrain,
    window.BATTLEFIELD_ENGINE.models,
    window.BATTLEFIELD_ENGINE.battlefieldSizeMU
  );

  // Initialize AI controls
  initAIControls(window.AI_INTEG)
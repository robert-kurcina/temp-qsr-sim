// /src/ui/pages/GameplayPage.js
import { GameplayControls } from '../organisms/GameplayControls.js';
import { initBattlefield } from '../../engine/BattlefieldEngine.js';

/**
 * Gameplay page with Three.js battlefield
 */
export function renderGameplayPage(data) {
  // Get mission from URL or default
  const urlParams = new URLSearchParams(window.location.search);
  const missionName = urlParams.get('mission') || 'New Mission';
  
  return `
    <div class="gameplay-page">
      <h1>🎮 ${missionName}</h1>
      
      <!-- Controls Panel -->
      <div id="gameplay-controls">
        ${GameplayControls.render(data)}
      </div>
      
      <!-- Battlefield Canvas -->
      <div id="battlefield-container" class="organism-card mt-4">
        <canvas id="battlefield-canvas"></canvas>
        <div id="loading-battlefield" class="loading-overlay">
          Initializing battlefield...
        </div>
      </div>
    </div>
  `;
}

// Initialize Three.js after render
export function initGameplay(data) {
  // Set global data reference
  window.APP_DATA = data;
  
  // Initialize controls
  GameplayControls.init();
  
  // Initialize Three.js battlefield
  setTimeout(() => {
    initBattlefield(data);
  }, 100);
}
// /src/ui/pages/BuilderPage.js
import { CharacterBuilder } from '../organisms/CharacterBuilder.js';
import { AssemblyManager } from '../organisms/AssemblyManager.js';
import { MissionBuilder } from '../organisms/MissionBuilder.js';
import { ProfileManagerUI } from '../organisms/ProfileManager.js';

/**
 * Main Builder page with sub-tab navigation
 */
export function renderBuilderPage(data) {
  // Get current sub-tab from URL hash or default
  const urlParams = new URLSearchParams(window.location.search);
  const subTab = urlParams.get('sub') || 'profile';
  
  return `
    <div class="builder-page">
      <h1>🛠️ Builder Suite</h1>
      
      <!-- Sub-tab Navigation -->
      <div class="sub-tab-nav organism-card mb-4">
        <a href="?sub=profile" class="sub-tab-btn ${subTab === 'profile' ? 'active' : ''}">
          👤 Profile
        </a>
        <a href="?sub=assembly" class="sub-tab-btn ${subTab === 'assembly' ? 'active' : ''}">
          🧩 Assembly
        </a>
        <a href="?sub=mission" class="sub-tab-btn ${subTab === 'mission' ? 'active' : ''}">
          ⚔️ Mission
        </a>
      </div>
      
      <!-- Sub-tab Content -->
      <div id="builder-sub-content">
        ${renderSubTab(subTab, data)}
      </div>
    </div>
  `;
}

function renderSubTab(subTab, data) {
  switch (subTab) {
    case 'profile':
      return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            ${CharacterBuilder.render(data)}
          </div>
          <div>
            ${ProfileManagerUI.render()}
          </div>
        </div>
      `;
    case 'assembly':
      return AssemblyManager.render(data);
    case 'mission':
      return MissionBuilder.render(data);
    default:
      return '<p>Select a builder type</p>';
  }
}

// Handle sub-tab navigation
document.addEventListener('click', (e) => {
  if (e.target.closest('.sub-tab-btn')) {
    e.preventDefault();
    const tab = e.target.closest('.sub-tab-btn').href.split('?sub=')[1];
    window.history.pushState({}, '', `?sub=${tab}`);
    updateBuilderSubContent(tab);
  }
});

async function updateBuilderSubContent(subTab) {
  const data = window.APP_DATA; // Set by main app
  document.getElementById('builder-sub-content').innerHTML = renderSubTab(subTab, data);
}

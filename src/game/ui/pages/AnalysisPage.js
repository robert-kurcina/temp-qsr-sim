// /src/ui/pages/AnalysisPage.js
import { ProfileFitnessAnalyzer } from '../organisms/ProfileFitnessAnalyzer.js';
import { AssemblyBalanceChecker } from '../organisms/AssemblyBalanceChecker.js';
import { PostGameReport } from '../organisms/PostGameReport.js';

/**
 * Analysis page with sub-tab navigation
 */
export function renderAnalysisPage(data) {
  const urlParams = new URLSearchParams(window.location.search);
  const subTab = urlParams.get('sub') || 'profile';
  
  return `
    <div class="analysis-page">
      <h1>📊 Analysis Suite</h1>
      
      <!-- Sub-tab Navigation -->
      <div class="sub-tab-nav organism-card mb-4">
        <a href="?sub=profile" class="sub-tab-btn ${subTab === 'profile' ? 'active' : ''}">
          🔍 Profile
        </a>
        <a href="?sub=assembly" class="sub-tab-btn ${subTab === 'assembly' ? 'active' : ''}">
          📈 Assembly
        </a>
        <a href="?sub=report" class="sub-tab-btn ${subTab === 'report' ? 'active' : ''}">
          📉 Post-Game
        </a>
      </div>
      
      <!-- Sub-tab Content -->
      <div id="analysis-sub-content">
        ${renderSubTab(subTab, data)}
      </div>
    </div>
  `;
}

function renderSubTab(subTab, data) {
  switch (subTab) {
    case 'profile':
      return ProfileFitnessAnalyzer.render(data);
    case 'assembly':
      return AssemblyBalanceChecker.render(data);
    case 'report':
      return PostGameReport.render(data);
    default:
      return '<p>Select an analysis type</p>';
  }
}

// Handle sub-tab navigation
document.addEventListener('click', (e) => {
  if (e.target.closest('.sub-tab-btn')) {
    e.preventDefault();
    const tab = e.target.closest('.sub-tab-btn').href.split('?sub=')[1];
    window.history.pushState({}, '', `?sub=${tab}`);
    updateAnalysisSubContent(tab);
  }
});

async function updateAnalysisSubContent(subTab) {
  const data = window.APP_DATA;
  document.getElementById('analysis-sub-content').innerHTML = renderSubTab(subTab, data);
}
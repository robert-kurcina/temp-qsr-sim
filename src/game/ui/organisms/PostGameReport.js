// /src/ui/organisms/PostGameReport.js
// Future implementation
const endGameThreshold = GAME_SIZES[gameSize].endGameThreshold;
// Trigger when KO count >= endGameThreshold

/**
 * Generates post-game analysis reports
 */
export const PostGameReport = {
  render(data) {
    return `
      <div class="post-game-report organism-card">
        <h2>📉 Post-Game Report</h2>
        
        <div class="info-section mb-6">
          <p class="text-gray-600">
            Post-game analysis will be available after gameplay sessions.
            This will include:
          </p>
          <ul class="mt-2 space-y-1 list-disc pl-5">
            <li>LOS violation statistics</li>
            <li>Terrain coverage analysis</li>
            <li>Model positioning efficiency</li>
            <li>Combat outcome summaries</li>
          </ul>
        </div>
        
        <div class="placeholder-section">
          <div class="p-4 bg-yellow-50 rounded-lg">
            <div class="font-medium mb-2">Coming Soon</div>
            <p>Play a game in the Gameplay tab to generate a post-game report!</p>
          </div>
        </div>
      </div>
    `;
  }
};
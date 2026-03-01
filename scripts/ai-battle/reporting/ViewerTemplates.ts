/**
 * Viewer Templates
 * 
 * HTML template generation for battle report viewers.
 */

/**
 * Create minimal viewer template if file not found
 */
export function createMinimalViewerTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Battle Report Viewer</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 2rem; }
    h1 { color: #e94560; }
    .error { color: #e94560; background: #16213e; padding: 1rem; border-radius: 4px; }
    code { background: #0f3460; padding: 0.2rem 0.5rem; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>⚔️ Battle Report Viewer</h1>
  <div class="error">
    <h2>Viewer Template Not Found</h2>
    <p>The battle-report-viewer.html template was not found.</p>
    <p>Audit data is available in <code>audit.json</code> in this directory.</p>
  </div>
</body>
</html>`;
}

/**
 * Create full battle report viewer HTML
 */
export function createBattleReportViewer(auditPath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Battle Report Viewer</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 2rem; }
    h1 { color: #e94560; }
    .viewer-container { max-width: 1200px; margin: 0 auto; }
    .battlefield { background: #16213e; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    .controls { display: flex; gap: 1rem; margin: 1rem 0; }
    button { background: #e94560; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; }
    button:hover { background: #ff6b6b; }
    .info-panel { background: #0f3460; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
  </style>
</head>
<body>
  <div class="viewer-container">
    <h1>⚔️ Battle Report Viewer</h1>
    <div class="controls">
      <button id="playPause">⏯ Play/Pause</button>
      <button id="stepBack">⏮ Step Back</button>
      <button id="stepForward">⏭ Step Forward</button>
      <button id="stop">⏹ Stop</button>
    </div>
    <div class="info-panel">
      <h2>Battle Info</h2>
      <div id="battleInfo">Loading...</div>
    </div>
    <div class="battlefield">
      <svg id="battlefield" width="600" height="600"></svg>
    </div>
  </div>
  <script>
    // Load audit data
    fetch('${auditPath}')
      .then(r => r.json())
      .then(data => {
        document.getElementById('battleInfo').textContent = 
          'Mission: ' + (data.session?.missionName || 'Unknown') + 
          ' | Turns: ' + (data.turns?.length || 0);
      })
      .catch(err => {
        console.error('Failed to load audit:', err);
      });
  </script>
</body>
</html>`;
}

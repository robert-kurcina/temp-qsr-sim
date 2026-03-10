import { execSync } from 'node:child_process';

export function killExistingServer(port: number): void {
  try {
    const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (!result) return;

    const pids = result.split('\n');
    console.log(`🔍 Found ${pids.length} process(es) using port ${port}, killing...`);
    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`   ✓ Killed process ${pid}`);
      } catch {
        // Process may already be gone.
      }
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  } catch {
    // No process found on port.
  }
}

export function printServerBanner(port: number): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║        ⚔️  Battle Audit Dashboard Running                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Open in browser:                                         ║
║  → http://localhost:${port}/dashboard                      ║
║                                                           ║
║  Dashboard Tabs:                                          ║
║  → Tab 1: 🗺️ Battlefields (SVG previews)                  ║
║  → Tab 2: 🎬 Visual Audit (timeline viewer)               ║
║  → Tab 3: 📊 Summary (human-readable)                     ║
║  → Tab 4: 🖼️ Portraits (sheet review)                     ║
║                                                           ║
║  API Endpoints:                                           ║
║  → GET /api/battles         - List all battles            ║
║  → GET /api/battles/:id/svg - Get battlefield SVG         ║
║  → GET /api/battles/:id/audit - Get full audit JSON       ║
║  → GET /api/battles/:id/summary - Get human-readable      ║
║                                                           ║
║  Assets:                                                  ║
║  → /assets/portraits/*      - Portrait sheets             ║
║                                                           ║
║  Legacy URLs:                                             ║
║  → /battle-report-*/audit.json                            ║
║  → /battle-report-*/battle-report.html                    ║
║                                                           ║
║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
`);
}

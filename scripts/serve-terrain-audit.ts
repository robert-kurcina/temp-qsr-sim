#!/usr/bin/env node
/**
 * Battle Audit Dashboard Server
 *
 * Serves the unified battle audit dashboard on port 3001.
 * Provides API endpoints for battle listing, SVG, audit, and summary data.
 *
 * Usage:
 *   npx tsx scripts/serve-terrain-audit.ts
 *
 * Then open: http://localhost:3001
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { generateBattleSummary, formatSummaryAsText } from './ai-battle/reporting/BattleSummaryFormatter';
import { INDEX_PATH } from './generate-battle-index';

// Kill any existing server on port 3001
function killExistingServer(port: number) {
  try {
    // Find process using port 3001
    const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (result) {
      const pids = result.split('\n');
      console.log(`🔍 Found ${pids.length} process(es) using port ${port}, killing...`);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`   ✓ Killed process ${pid}`);
        } catch (e) {
          // Process may have already exited
        }
      }
      // Wait a moment for port to be released
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  } catch (e) {
    // No process found on port, which is fine
  }
}

// Kill existing server before starting
killExistingServer(3001);

const PORT = 3001;
const DASHBOARD_PATH = path.join(process.cwd(), 'src', 'lib', 'mest-tactics', 'viewer', 'audit-dashboard.html');
const BATTLE_REPORTS_DIR = path.join(process.cwd(), 'generated', 'ai-battle-reports');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

interface BattleIndexEntry {
  id: string;
  timestamp: string;
  missionId: string;
  missionName: string;
  gameSize: string;
  seed?: number;
  turnsCompleted: number;
  winner: string;
  totalActions: number;
  fitness?: string;
}

// Get list of all battles (with optional filtering)
function getBattleIndex(filters?: { mission?: string; gameSize?: string; date?: string; winner?: string }): BattleIndexEntry[] {
  try {
    // Try to use pre-generated index first
    if (fs.existsSync(INDEX_PATH)) {
      const content = fs.readFileSync(INDEX_PATH, 'utf-8');
      const index = JSON.parse(content);
      let battles = index.battles || [];
      
      // Apply filters
      if (filters?.mission) {
        battles = battles.filter(b => b.missionId === filters.mission);
      }
      if (filters?.gameSize) {
        battles = battles.filter(b => b.gameSize === filters.gameSize);
      }
      if (filters?.date) {
        battles = battles.filter(b => b.date === filters.date);
      }
      if (filters?.winner) {
        battles = battles.filter(b => b.winner === filters.winner);
      }
      
      return battles;
    }
    
    // Fallback: generate index on the fly
    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('battle-report-'));
    
    return files.map(file => {
      const filePath = path.join(BATTLE_REPORTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      return {
        id: file.replace('.json', ''),
        timestamp: file.match(/battle-report-(.+)\.json/)?.[1] || file,
        missionId: data.config?.missionId || 'Unknown',
        missionName: data.config?.missionName || 'Unknown',
        gameSize: data.config?.gameSize || 'Unknown',
        seed: data.seed,
        turnsCompleted: data.stats?.turnsCompleted || 0,
        winner: data.winner || 'Unknown',
        totalActions: data.stats?.totalActions || 0,
        fitness: 'Good',
      };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    console.error('Error reading battle reports:', error);
    return [];
  }
}

// Get battle audit data
function getBattleAudit(battleId: string): object | null {
  try {
    const filePath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Get battle SVG
function getBattleSvg(battleId: string): string | null {
  try {
    // Extract timestamp portion from battle ID (battle-report-TIMESTAMP)
    const timestampMatch = battleId.match(/battle-report-(.+)/);
    if (!timestampMatch) return null;
    
    const battleTimestamp = timestampMatch[1]; // e.g., "2026-02-28T19-57-41-914Z"
    // Get just the main part without milliseconds for matching
    const mainTimestamp = battleTimestamp.substring(0, battleTimestamp.length - 5); // Remove last 4 chars + Z
    
    // Find SVG file that matches the battle timestamp
    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.svg') && f.startsWith('battlefield-'))
      .filter(f => {
        const svgTimestamp = f.replace('battlefield-', '').replace('.svg', '');
        // Match if timestamps are within 10 seconds of each other
        return svgTimestamp.startsWith(mainTimestamp.substring(0, mainTimestamp.length - 1));
      });
    
    if (files.length === 0) return null;
    
    const filePath = path.join(BATTLE_REPORTS_DIR, files[0]);
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error getting SVG:', error);
    return null;
  }
}

// Generate human-readable summary
function getBattleSummary(battleId: string): object | null {
  try {
    const filePath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const report = JSON.parse(content);
    
    const summary = generateBattleSummary(report);
    return {
      text: formatSummaryAsText(summary),
      structured: summary,
    };
  } catch (error) {
    return null;
  }
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: List all battles (with optional filtering)
  if (req.url === '/api/battles' || req.url?.startsWith('/api/battles?')) {
    const url = new URL(req.url || '/', 'http://localhost');
    const filters = {
      mission: url.searchParams.get('mission') || undefined,
      gameSize: url.searchParams.get('gameSize') || undefined,
      date: url.searchParams.get('date') || undefined,
      winner: url.searchParams.get('winner') || undefined,
    };
    
    const battles = getBattleIndex(filters);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(battles));
    return;
  }

  // API: Get battle audit
  if (req.url?.match(/^\/api\/battles\/([^\/]+)\/audit$/)) {
    const battleId = req.url.match(/^\/api\/battles\/([^\/]+)\/audit$/)?.[1];
    if (battleId) {
      const audit = getBattleAudit(battleId);
      if (audit) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(audit));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Battle not found' }));
      }
    }
    return;
  }

  // API: Get battle SVG
  if (req.url?.match(/^\/api\/battles\/([^\/]+)\/svg$/)) {
    const battleId = req.url.match(/^\/api\/battles\/([^\/]+)\/svg$/)?.[1];
    if (battleId) {
      const svg = getBattleSvg(battleId);
      if (svg) {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(svg);
      } else {
        res.writeHead(404);
        res.end('SVG not found');
      }
    }
    return;
  }

  // API: Get battle summary
  if (req.url?.match(/^\/api\/battles\/([^\/]+)\/summary$/)) {
    const battleId = req.url.match(/^\/api\/battles\/([^\/]+)\/summary$/)?.[1];
    if (battleId) {
      const summary = getBattleSummary(battleId);
      if (summary) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(summary));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Battle not found' }));
      }
    }
    return;
  }

  // Serve static assets from /assets/
  if (req.url?.startsWith('/assets/')) {
    const filePath = path.join(process.cwd(), req.url || '');
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Asset not found');
        return;
      }
      
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return;
  }

  // API: List battlefields
  if (req.url === '/api/battlefields') {
    const battlefieldsDir = path.join(process.cwd(), 'generated', 'test-battlefields');
    
    fs.readdir(battlefieldsDir, (err, files) => {
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to read battlefields directory' }));
        return;
      }
      
      // Get unique battlefield names (without extension)
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const battlefields = jsonFiles.map(f => ({
        name: f.replace('.json', ''),
        jsonPath: `/api/battlefields/${f}`,
        svgPath: `/api/battlefields/${f.replace('.json', '.svg')}`
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(battlefields));
    });
    return;
  }

  // API: Get battlefield JSON
  if (req.url?.match(/^\/api\/battlefields\/([^\/]+)\.json$/)) {
    const match = req.url.match(/^\/api\/battlefields\/([^\/]+)\.json$/);
    if (match) {
      const battlefieldName = match[1];
      const filePath = path.join(process.cwd(), 'generated', 'test-battlefields', `${battlefieldName}.json`);
      
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Battlefield not found');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
      });
      return;
    }
  }

  // API: Get battlefield SVG
  if (req.url?.match(/^\/api\/battlefields\/([^\/]+)\.svg$/)) {
    const match = req.url.match(/^\/api\/battlefields\/([^\/]+)\.svg$/);
    if (match) {
      const battlefieldName = match[1];
      const filePath = path.join(process.cwd(), 'generated', 'test-battlefields', `${battlefieldName}.svg`);
      
      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Battlefield SVG not found');
          return;
        }
        
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        res.end(content);
      });
      return;
    }
  }

  // Serve dashboard
  if (req.url === '/' || req.url === '/dashboard') {
    fs.readFile(DASHBOARD_PATH, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error loading dashboard: ${err.message}`);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  }

  // Handle generated battle reports (legacy)
  if (req.url?.startsWith('/battle-report-')) {
    const filePath = path.join(process.cwd(), 'generated', 'battle-reports', req.url || '');

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Battle report not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return;
  }

  // Handle audit.json files (legacy)
  if (req.url?.endsWith('/audit.json')) {
    const filePath = path.join(process.cwd(), 'generated', 'battle-reports', req.url || '');

    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Audit file not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(content);
    });
    return;
  }

  // 404 for everything else
  res.writeHead(404);
  res.end('Not found. Try /dashboard or /api/battles');
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║        ⚔️  Battle Audit Dashboard Running                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Open in browser:                                         ║
║  → http://localhost:${PORT}/dashboard                      ║
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
});

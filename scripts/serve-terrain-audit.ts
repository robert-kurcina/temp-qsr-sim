#!/usr/bin/env node
/**
 * Terrain Audit Server
 * 
 * Serves the terrain audit viewer on port 3001.
 * 
 * Usage:
 *   npx tsx scripts/serve-terrain-audit.ts
 * 
 * Then open: http://localhost:3001
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3001;
const VIEWER_PATH = path.join(process.cwd(), 'src', 'lib', 'mest-tactics', 'viewer', 'terrain-audit.html');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Handle terrain audit viewer
  if (req.url === '/' || req.url === '/terrain-audit') {
    fs.readFile(VIEWER_PATH, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error loading terrain audit viewer: ${err.message}`);
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return;
  }

  // Handle generated battle reports
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

  // Handle audit.json files
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
  res.end('Not found. Try /terrain-audit or /battle-report-*/battle-report.html');
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║           🗺️  Terrain Audit Server Running               ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Open in browser:                                         ║
║  → http://localhost:${PORT}/terrain-audit                  ║
║                                                           ║
║  Battle reports:                                          ║
║  → http://localhost:${PORT}/battle-report-*/audit.json     ║
║  → http://localhost:${PORT}/battle-report-*/battle-report.html ║
║                                                           ║
║  Press Ctrl+C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
`);
});

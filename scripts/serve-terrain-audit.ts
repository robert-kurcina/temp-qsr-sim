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

import path from 'path';
import { killExistingServer, printServerBanner } from './serve/ServerLifecycle';
import { createReportServer } from './serve/ReportServerApp';

// Kill existing server before starting
killExistingServer(3001);

const PORT = 3001;
const DASHBOARD_PATH = path.join(process.cwd(), 'src', 'lib', 'mest-tactics', 'viewer', 'audit-dashboard.html');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createReportServer({
  dashboardPath: DASHBOARD_PATH,
  mimeTypes: MIME_TYPES,
});

server.listen(PORT, () => {
  printServerBanner(PORT);
});

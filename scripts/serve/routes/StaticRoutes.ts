import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface StaticRouteContext {
  dashboardPath: string;
  mimeTypes: Record<string, string>;
}

export async function handleStaticRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  context: StaticRouteContext
): Promise<boolean> {
  const url = req.url || '/';

  if (url.startsWith('/assets/')) {
    const filePath = path.join(process.cwd(), url);
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Asset not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = context.mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return true;
  }

  if (url === '/' || url === '/dashboard') {
    fs.readFile(context.dashboardPath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end(`Error loading dashboard: ${err.message}`);
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
    return true;
  }

  if (url.endsWith('/audit.json')) {
    const filePath = path.join(process.cwd(), 'generated', 'battle-reports', url);
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Audit file not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(content);
    });
    return true;
  }

  if (url.startsWith('/battle-report-')) {
    const filePath = path.join(process.cwd(), 'generated', 'battle-reports', url);
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Battle report not found');
        return;
      }
      const ext = path.extname(filePath);
      const contentType = context.mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
    return true;
  }

  return false;
}

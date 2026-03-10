import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createReportServer } from './ReportServerApp';

interface ResponseState {
  headers: Record<string, string>;
  status?: number;
  responseHeaders?: Record<string, string>;
  body?: string;
}

function dispatchToServer(server: ReturnType<typeof createReportServer>, method: string, url: string): Promise<ResponseState> {
  return new Promise(resolve => {
    const req = new EventEmitter() as any;
    req.method = method;
    req.url = url;

    const state: ResponseState = { headers: {} };
    const res = {
      setHeader(name: string, value: string) {
        state.headers[name] = value;
      },
      writeHead(status: number, headers?: Record<string, string>) {
        state.status = status;
        state.responseHeaders = headers;
      },
      end(body?: string) {
        state.body = body;
        resolve(state);
      },
    } as any;

    server.emit('request', req, res);
  });
}

describe('createReportServer', () => {
  let tempDir = '';

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('handles dispatcher flow for dashboard, preflight, and not-found without binding a real port', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'report-server-'));
    const dashboardPath = join(tempDir, 'dashboard.html');
    writeFileSync(dashboardPath, '<html><body>dashboard-smoke</body></html>', 'utf8');

    const server = createReportServer({
      dashboardPath,
      mimeTypes: {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
      },
    });

    const dashboard = await dispatchToServer(server, 'GET', '/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.body).toContain('dashboard-smoke');
    expect(dashboard.headers['Access-Control-Allow-Origin']).toBe('*');

    const preflight = await dispatchToServer(server, 'OPTIONS', '/api/battles');
    expect(preflight.status).toBe(200);

    const missing = await dispatchToServer(server, 'GET', '/definitely-missing');
    expect(missing.status).toBe(404);
    expect(missing.body).toContain('Not found');
  });
});

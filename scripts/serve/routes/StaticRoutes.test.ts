import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readFileMock } = vi.hoisted(() => ({
  readFileMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    readFile: readFileMock,
  },
}));

import { handleStaticRoutes } from './StaticRoutes';

function createResponseRecorder() {
  const state: { status?: number; headers?: Record<string, string>; body?: string } = {};
  const res = {
    writeHead(status: number, headers?: Record<string, string>) {
      state.status = status;
      state.headers = headers;
    },
    end(body?: string) {
      state.body = body;
    },
  } as any;
  return { res, state };
}

const context = {
  dashboardPath: '/tmp/dashboard.html',
  mimeTypes: {
    '.html': 'text/html',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  },
};

describe('handleStaticRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for unknown routes', async () => {
    const { res } = createResponseRecorder();
    const handled = await handleStaticRoutes({ url: '/api/unknown', method: 'GET' } as any, res, context);
    expect(handled).toBe(false);
  });

  it('serves /assets paths with configured content type', async () => {
    readFileMock.mockImplementationOnce((_path: string, cb: (err: any, content?: Buffer) => void) => {
      cb(null, Buffer.from('<svg></svg>'));
    });
    const { res, state } = createResponseRecorder();
    const handled = await handleStaticRoutes({ url: '/assets/example.svg', method: 'GET' } as any, res, context);

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(state.headers).toEqual({ 'Content-Type': 'image/svg+xml' });
  });

  it('serves dashboard HTML for /dashboard', async () => {
    readFileMock.mockImplementationOnce((_path: string, _encoding: string, cb: (err: any, content?: string) => void) => {
      cb(null, '<html>dashboard</html>');
    });
    const { res, state } = createResponseRecorder();
    const handled = await handleStaticRoutes({ url: '/dashboard', method: 'GET' } as any, res, context);

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(state.headers).toEqual({ 'Content-Type': 'text/html' });
    expect(state.body).toContain('dashboard');
  });

  it('serves legacy battle report files under /battle-report-*', async () => {
    readFileMock.mockImplementationOnce((_path: string, cb: (err: any, content?: Buffer) => void) => {
      cb(null, Buffer.from('<html>report</html>'));
    });
    const { res, state } = createResponseRecorder();
    const handled = await handleStaticRoutes(
      { url: '/battle-report-2026-03-07T10-01-14-609Z/battle-report.html', method: 'GET' } as any,
      res,
      context
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(state.headers).toEqual({ 'Content-Type': 'text/html' });
  });

  it('returns 404 for missing legacy audit file', async () => {
    readFileMock.mockImplementationOnce((_path: string, _encoding: string, cb: (err: any, content?: string) => void) => {
      cb(new Error('missing'));
    });
    const { res, state } = createResponseRecorder();
    const handled = await handleStaticRoutes({ url: '/battle-report-x/audit.json', method: 'GET' } as any, res, context);

    expect(handled).toBe(true);
    expect(state.status).toBe(404);
    expect(state.body).toBe('Audit file not found');
  });
});

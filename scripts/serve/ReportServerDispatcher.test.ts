import { describe, expect, it, vi } from 'vitest';
import { dispatchReportServerRequest, type ReportServerDispatchContext, type ReportServerHandlers } from './ReportServerDispatcher';

function createResponseRecorder() {
  const state: {
    headers: Record<string, string>;
    status?: number;
    responseHeaders?: Record<string, string>;
    body?: string;
  } = { headers: {} };

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
    },
  } as any;

  return { res, state };
}

function createHandlers(overrides?: Partial<ReportServerHandlers>): ReportServerHandlers {
  return {
    handleBattleRoutes: vi.fn().mockResolvedValue(false),
    handleBattlefieldRoutes: vi.fn().mockResolvedValue(false),
    handleStaticRoutes: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

const context: ReportServerDispatchContext = {
  dashboardPath: '/tmp/dashboard.html',
  mimeTypes: { '.html': 'text/html' },
};

describe('dispatchReportServerRequest', () => {
  it('applies CORS headers on every request', async () => {
    const handlers = createHandlers();
    const { res, state } = createResponseRecorder();

    await dispatchReportServerRequest({ method: 'GET', url: '/unknown' } as any, res, context, handlers);

    expect(state.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(state.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(state.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
  });

  it('handles OPTIONS preflight before calling route handlers', async () => {
    const handlers = createHandlers();
    const { res, state } = createResponseRecorder();

    await dispatchReportServerRequest({ method: 'OPTIONS', url: '/api/battles' } as any, res, context, handlers);

    expect(state.status).toBe(200);
    expect(handlers.handleBattleRoutes).not.toHaveBeenCalled();
    expect(handlers.handleBattlefieldRoutes).not.toHaveBeenCalled();
    expect(handlers.handleStaticRoutes).not.toHaveBeenCalled();
  });

  it('evaluates handlers in order and short-circuits on first match', async () => {
    const order: string[] = [];
    const handlers = createHandlers({
      handleBattleRoutes: vi.fn().mockImplementation(async () => {
        order.push('battle');
        return false;
      }),
      handleBattlefieldRoutes: vi.fn().mockImplementation(async () => {
        order.push('battlefield');
        return true;
      }),
      handleStaticRoutes: vi.fn().mockImplementation(async () => {
        order.push('static');
        return true;
      }),
    });
    const { res } = createResponseRecorder();

    await dispatchReportServerRequest({ method: 'GET', url: '/api/battlefields' } as any, res, context, handlers);

    expect(order).toEqual(['battle', 'battlefield']);
    expect(handlers.handleStaticRoutes).not.toHaveBeenCalled();
  });

  it('returns 404 when no handlers match', async () => {
    const handlers = createHandlers();
    const { res, state } = createResponseRecorder();

    await dispatchReportServerRequest({ method: 'GET', url: '/nope' } as any, res, context, handlers);

    expect(state.status).toBe(404);
    expect(state.body).toBe('Not found. Try /dashboard or /api/battles');
  });

  it('returns 500 json payload when a handler throws', async () => {
    const handlers = createHandlers({
      handleBattleRoutes: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const { res, state } = createResponseRecorder();

    await dispatchReportServerRequest({ method: 'GET', url: '/api/battles' } as any, res, context, handlers);

    expect(state.status).toBe(500);
    expect(state.responseHeaders).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(state.body || '{}')).toEqual({ error: 'boom' });
  });
});

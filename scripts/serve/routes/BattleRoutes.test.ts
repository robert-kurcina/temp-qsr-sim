import { describe, expect, it, vi } from 'vitest';
import { handleBattleRoutes } from './BattleRoutes';

vi.mock('../BattleReportData', () => ({
  getBattleIndex: vi.fn(),
  getBattleAudit: vi.fn(),
  getBattleSvg: vi.fn(),
  getBattleSummary: vi.fn(),
}));

import { getBattleAudit, getBattleIndex, getBattleSummary, getBattleSvg } from '../BattleReportData';

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

describe('handleBattleRoutes', () => {
  it('returns false for non-battle route', async () => {
    const { res } = createResponseRecorder();
    const handled = await handleBattleRoutes({ url: '/api/unknown', method: 'GET' } as any, res);
    expect(handled).toBe(false);
  });

  it('returns indexed battles for /api/battles', async () => {
    vi.mocked(getBattleIndex).mockReturnValueOnce([{ id: 'battle-report-1' }] as any);
    const { res, state } = createResponseRecorder();
    const handled = await handleBattleRoutes(
      { url: '/api/battles?mission=QAI_11&winner=Alpha', method: 'GET' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(getBattleIndex).toHaveBeenCalledWith({
      mission: 'QAI_11',
      gameSize: undefined,
      date: undefined,
      winner: 'Alpha',
      audit: undefined,
    });
    expect(JSON.parse(state.body || '[]')).toEqual([{ id: 'battle-report-1' }]);
  });

  it('returns 404 for missing audit report', async () => {
    vi.mocked(getBattleAudit).mockReturnValueOnce(null);
    const { res, state } = createResponseRecorder();
    const handled = await handleBattleRoutes({ url: '/api/battles/battle-report-1/audit', method: 'GET' } as any, res);

    expect(handled).toBe(true);
    expect(state.status).toBe(404);
    expect(JSON.parse(state.body || '{}')).toEqual({ error: 'Battle not found' });
  });

  it('returns svg with image/svg+xml content type', async () => {
    vi.mocked(getBattleSvg).mockReturnValueOnce('<svg></svg>');
    const { res, state } = createResponseRecorder();
    const handled = await handleBattleRoutes({ url: '/api/battles/battle-report-1/svg', method: 'GET' } as any, res);

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(state.headers).toEqual({ 'Content-Type': 'image/svg+xml' });
    expect(state.body).toBe('<svg></svg>');
  });

  it('returns summary payload for summary endpoint', async () => {
    vi.mocked(getBattleSummary).mockReturnValueOnce({ text: 'ok' });
    const { res, state } = createResponseRecorder();
    const handled = await handleBattleRoutes({ url: '/api/battles/battle-report-1/summary', method: 'GET' } as any, res);

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(JSON.parse(state.body || '{}')).toEqual({ text: 'ok' });
  });
});

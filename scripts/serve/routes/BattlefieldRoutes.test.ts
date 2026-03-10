import { beforeEach, describe, expect, it, vi } from 'vitest';

const findPathLimitedMock = vi.fn();

vi.mock('../../battlefield-generator', () => ({
  generateBattlefield: vi.fn(),
}));

vi.mock('../../shared/BattlefieldPaths', () => ({
  getBattlefieldFileById: vi.fn(),
  getBattlefieldFileByPath: vi.fn(),
  listBattlefieldFiles: vi.fn(),
}));

vi.mock('../../../src/lib/mest-tactics/battlefield/BattlefieldExporter', () => ({
  loadBattlefieldFromFile: vi.fn(),
}));

vi.mock('../../../src/lib/mest-tactics/battlefield/pathfinding/PathfindingEngine', () => ({
  PathfindingEngine: class {
    findPathLimited = findPathLimitedMock;
  },
}));

vi.mock('../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules', () => ({
  SpatialRules: {
    hasLineOfSight: vi.fn(),
    getCoverResult: vi.fn(),
  },
}));

vi.mock('../../../src/lib/mest-tactics/battlefield/los/LOSOperations', () => ({
  LOSOperations: {
    distance: vi.fn(),
  },
}));

vi.mock('../BattlefieldAnalysis', () => ({
  analyzePathForAgility: vi.fn(),
}));

vi.mock('../HttpUtils', () => ({
  parseJsonBody: vi.fn(),
  sendJson: vi.fn((res: any, statusCode: number, payload: unknown) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  }),
  sendText: vi.fn((res: any, statusCode: number, text: string, contentType: string = 'text/plain') => {
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(text);
  }),
}));

import { generateBattlefield } from '../../battlefield-generator';
import {
  getBattlefieldFileById,
  getBattlefieldFileByPath,
  listBattlefieldFiles,
} from '../../shared/BattlefieldPaths';
import { loadBattlefieldFromFile } from '../../../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { LOSOperations } from '../../../src/lib/mest-tactics/battlefield/los/LOSOperations';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import { analyzePathForAgility } from '../BattlefieldAnalysis';
import { parseJsonBody } from '../HttpUtils';
import { handleBattlefieldRoutes } from './BattlefieldRoutes';

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

describe('handleBattlefieldRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPathLimitedMock.mockReset();
  });

  it('returns false for non-battlefield routes', async () => {
    const { res } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes({ url: '/api/unknown', method: 'GET' } as any, res);
    expect(handled).toBe(false);
  });

  it('returns 400 for generate route missing gameSize', async () => {
    vi.mocked(parseJsonBody).mockResolvedValueOnce({});
    const { res, state } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes(
      { url: '/api/battlefields/generate', method: 'POST' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(400);
    expect(JSON.parse(state.body || '{}')).toEqual({ error: 'Missing required field: gameSize' });
  });

  it('returns 200 for successful generate route and rewrites battlefieldId', async () => {
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      gameSize: 'VERY_SMALL',
      args: ['A20', 'B40'],
      seed: 101,
    });
    vi.mocked(generateBattlefield).mockResolvedValueOnce({
      success: true,
      battlefieldId: 'raw-id',
      battlefieldPath: '/tmp/bf.json',
    } as any);
    vi.mocked(getBattlefieldFileByPath).mockReturnValueOnce({
      id: 'VERY_SMALL-battlefield_A20-B40-W0-R0-S0-T0',
      jsonPath: '/tmp/bf.json',
    } as any);

    const { res, state } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes(
      { url: '/api/battlefields/generate', method: 'POST' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    expect(vi.mocked(generateBattlefield)).toHaveBeenCalled();
    const payload = JSON.parse(state.body || '{}');
    expect(payload.battlefieldId).toBe('VERY_SMALL-battlefield_A20-B40-W0-R0-S0-T0');
  });

  it('returns pathfinding payload for /api/battlefields/pathfind', async () => {
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      battlefieldId: 'bf-1',
      start: { x: 1, y: 1 },
      end: { x: 3, y: 3 },
      movementAllowance: 6,
    });
    vi.mocked(getBattlefieldFileById).mockReturnValueOnce({ jsonPath: '/tmp/bf.json' } as any);
    vi.mocked(loadBattlefieldFromFile).mockReturnValueOnce({} as any);
    findPathLimitedMock.mockReturnValueOnce({
      points: [{ x: 1, y: 1 }, { x: 3, y: 3 }],
      vectors: [{ from: { x: 1, y: 1 }, to: { x: 3, y: 3 } }],
      totalLength: 2.8,
      totalEffectMu: 3.2,
      reachedEnd: true,
      remainingMu: 2.8,
    });

    const { res, state } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes(
      { url: '/api/battlefields/pathfind', method: 'POST' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    const payload = JSON.parse(state.body || '{}');
    expect(payload.success).toBe(true);
    expect(payload.path.totalLength).toBe(2.8);
    expect(payload.path.reachable).toBe(true);
  });

  it('returns agility analysis payload for /api/battlefields/analyze-agility', async () => {
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      battlefieldId: 'bf-1',
      path: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      character: { mov: 4, siz: 3, baseDiameter: 1 },
    });
    vi.mocked(getBattlefieldFileById).mockReturnValueOnce({ jsonPath: '/tmp/bf.json' } as any);
    vi.mocked(loadBattlefieldFromFile).mockReturnValueOnce({} as any);
    vi.mocked(analyzePathForAgility).mockReturnValueOnce({
      pathLength: 2,
      baseMuCost: 1.4,
      agilityMuCost: 1.0,
      muSaved: 0.4,
      opportunities: [],
      optimalPath: true,
      recommendations: [],
    });

    const { res, state } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes(
      { url: '/api/battlefields/analyze-agility', method: 'POST' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    const payload = JSON.parse(state.body || '{}');
    expect(payload.muSaved).toBe(0.4);
  });

  it('returns LOS/Cover payload for /api/battlefields/los-check', async () => {
    vi.mocked(parseJsonBody).mockResolvedValueOnce({
      battlefieldId: 'bf-1',
      activeModel: { position: { x: 1, y: 1 }, baseDiameter: 1, siz: 3 },
      target: { position: { x: 4, y: 1 }, baseDiameter: 1, siz: 3 },
      showLofArc: true,
    });
    vi.mocked(getBattlefieldFileById).mockReturnValueOnce({ jsonPath: '/tmp/bf.json' } as any);
    vi.mocked(loadBattlefieldFromFile).mockReturnValueOnce({} as any);
    vi.mocked(LOSOperations.distance).mockReturnValueOnce(3);
    vi.mocked(SpatialRules.hasLineOfSight).mockReturnValueOnce(true);
    vi.mocked(SpatialRules.getCoverResult).mockReturnValueOnce({
      hasDirectCover: true,
      hasInterveningCover: false,
      directCoverFeatures: [{ meta: { los: 'Hard' } }],
      interveningCoverFeatures: [],
      blockingFeature: { type: 'Tree' },
      coveringModelId: 'side-b-1',
    } as any);

    const { res, state } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes(
      { url: '/api/battlefields/los-check', method: 'POST' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    const payload = JSON.parse(state.body || '{}');
    expect(payload.success).toBe(true);
    expect(payload.los.hasLOS).toBe(true);
    expect(payload.cover.coverResult).toBe('hard');
    expect(payload.lof.hasLOF).toBe(true);
  });

  it('lists known battlefields for /api/battlefields', async () => {
    vi.mocked(listBattlefieldFiles).mockReturnValueOnce([
      {
        id: 'VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0',
        relativePath: 'data/battlefields/default/simple/VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json',
        source: 'default',
        gameSize: 'VERY_SMALL',
      } as any,
    ]);

    const { res, state } = createResponseRecorder();
    const handled = await handleBattlefieldRoutes(
      { url: '/api/battlefields', method: 'GET' } as any,
      res
    );

    expect(handled).toBe(true);
    expect(state.status).toBe(200);
    const payload = JSON.parse(state.body || '[]');
    expect(payload).toHaveLength(1);
    expect(payload[0].name).toContain('VERY_SMALL-battlefield');
  });
});

import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameConfig, TurnAudit } from '../../shared/BattleReportTypes';
import { buildBattleAuditTraceFromRuntime } from './BattleAuditTraceBuilder';

function createConfig(): GameConfig {
  return {
    missionId: 'QAI_11',
    missionName: 'Elimination',
    gameSize: 'VERY_SMALL' as any,
    battlefieldWidth: 24,
    battlefieldHeight: 24,
    maxTurns: 6,
    endGameTurn: 4,
    sides: [],
    densityRatio: 0,
    lighting: 'Day, Clear' as any,
    visibilityOrMu: 16,
    maxOrm: 3,
    allowConcentrateRangeExtension: true,
    perCharacterFovLos: false,
    verbose: false,
  };
}

describe('buildBattleAuditTraceFromRuntime', () => {
  it('builds base audit payload with session and battlefield fields', () => {
    const config = createConfig();
    const turns: TurnAudit[] = [];
    const trace = buildBattleAuditTraceFromRuntime({
      config,
      seed: 123,
      turns,
      battlefieldExportPath: '/tmp/battlefield.json',
    });

    expect(trace.session.missionId).toBe('QAI_11');
    expect(trace.session.seed).toBe(123);
    expect(trace.battlefield.exportPath).toBe('/tmp/battlefield.json');
    expect(trace.turns).toBe(turns);
  });

  it('includes terrain and delaunay mesh when available', () => {
    const config = createConfig();
    const battlefield = new Battlefield(24, 24);
    (battlefield as any).terrain = [
      {
        id: 'terrain-1',
        type: 'Difficult',
        vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
        meta: { name: 'test' },
      },
    ];
    (battlefield as any).navMesh = {
      points: [0, 0, 1, 0, 0, 1],
      triangles: [0, 1, 2],
    };

    const trace = buildBattleAuditTraceFromRuntime({
      config,
      seed: undefined,
      turns: [],
      battlefield,
    }) as any;

    expect(Array.isArray(trace.terrain)).toBe(true);
    expect(trace.terrain[0].id).toBe('terrain-1');
    expect(Array.isArray(trace.delaunayMesh)).toBe(true);
    expect(trace.delaunayMesh.length).toBe(1);
    expect(trace.delaunayMesh[0][0]).toEqual({ x: 0, y: 0 });
  });
});

import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { AuditLevel } from '../AIBattleConfig';
import type {
  BattleAuditTrace,
  GameConfig,
  TurnAudit,
} from '../../shared/BattleReportTypes';

interface BuildBattleAuditTraceFromRuntimeParams {
  config: GameConfig;
  seed: number | undefined;
  turns: TurnAudit[];
  battlefieldExportPath?: string | null;
  battlefield?: Battlefield;
  auditLevel?: AuditLevel;
}

function extractDelaunayMesh(battlefield: Battlefield): Array<Array<{ x: number; y: number }>> | undefined {
  const navMesh = (battlefield as unknown as { navMesh?: { points?: number[]; triangles?: number[] } }).navMesh;
  if (!navMesh?.points || !navMesh?.triangles) {
    return undefined;
  }

  const triangles: Array<Array<{ x: number; y: number }>> = [];
  for (let i = 0; i < navMesh.triangles.length; i += 3) {
    const tri: Array<{ x: number; y: number }> = [];
    for (let j = 0; j < 3; j++) {
      const idx = navMesh.triangles[i + j] * 2;
      tri.push({ x: navMesh.points[idx], y: navMesh.points[idx + 1] });
    }
    triangles.push(tri);
  }
  return triangles;
}

function extractTerrainForAudit(battlefield: Battlefield): Array<{
  id: string;
  type: string;
  vertices: Array<{ x: number; y: number }>;
  meta?: Record<string, unknown>;
}> {
  if (!battlefield.terrain || battlefield.terrain.length === 0) {
    return [];
  }

  return battlefield.terrain.map((terrainFeature) => {
    const typedFeature = terrainFeature as unknown as {
      id?: string;
      name?: string;
      type?: string;
      info?: { category?: string; color?: string };
      vertices?: Array<{ x: number; y: number }>;
      meta?: Record<string, unknown>;
    };
    return {
      id: typedFeature.id || typedFeature.name || 'unknown',
      type: typedFeature.type || typedFeature.info?.category || 'unknown',
      vertices: Array.isArray(typedFeature.vertices) ? typedFeature.vertices : [],
      meta: typedFeature.meta || (typedFeature.info?.color ? { color: typedFeature.info.color } : undefined),
    };
  });
}

export function buildBattleAuditTraceFromRuntime(
  params: BuildBattleAuditTraceFromRuntimeParams
): BattleAuditTrace {
  const {
    config,
    seed,
    turns,
    battlefieldExportPath,
    battlefield,
    auditLevel = 'full',
  } = params;
  const includeTurns = auditLevel === 'full';
  const includeTopology = auditLevel === 'full';
  const audit: BattleAuditTrace = {
    version: '1.0',
    session: {
      missionId: config.missionId,
      missionName: config.missionName,
      seed,
      lighting: config.lighting,
      visibilityOrMu: config.visibilityOrMu,
      maxOrm: config.maxOrm,
      allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      perCharacterFovLos: config.perCharacterFovLos,
    },
    battlefield: {
      widthMu: config.battlefieldWidth,
      heightMu: config.battlefieldHeight,
      movementSampleStepMu: 0.5,
      lofWidthMu: 1,
      exportPath: battlefieldExportPath || undefined,
    },
    turns: includeTurns ? turns : [],
  };

  if (battlefield && includeTopology) {
    const terrain = extractTerrainForAudit(battlefield);
    if (terrain.length > 0) {
      (audit as unknown as { terrain?: unknown }).terrain = terrain;
    }

    const delaunayMesh = extractDelaunayMesh(battlefield);
    if (delaunayMesh && delaunayMesh.length > 0) {
      (audit as unknown as { delaunayMesh?: unknown }).delaunayMesh = delaunayMesh;
    }
  }

  return audit;
}

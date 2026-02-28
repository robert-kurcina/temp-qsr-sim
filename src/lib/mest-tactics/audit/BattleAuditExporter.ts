/**
 * Battle Audit Exporter
 * 
 * Exports battle audit data for visualization and analysis.
 * Wraps AuditService to provide complete battle audit export.
 * 
 * @module mest-tactics/audit
 */

import { AuditService } from './AuditService';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainFeature } from '../battlefield/terrain/Terrain';
import { MissionSide } from '../mission/MissionSide';
import { Position } from '../battlefield/Position';

/**
 * Battle audit export data
 */
export interface BattleAuditExport {
  version: string;
  session: {
    missionId: string;
    missionName: string;
    seed?: number;
    lighting: string;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
  };
  battlefield: {
    widthMu: number;
    heightMu: number;
    movementSampleStepMu: number;
    lofWidthMu: number;
  };
  turns: any[];  // From AuditService
  terrain?: any[];
  delaunayMesh?: any[];
  deployment?: any[];
}

/**
 * Export battle audit to JSON-compatible format
 */
export function exportBattleAudit(
  auditService: AuditService,
  options: {
    missionId: string;
    missionName: string;
    seed?: number;
    lighting: string;
    visibilityOrMu: number;
    maxOrm: number;
    allowConcentrateRangeExtension: boolean;
    perCharacterFovLos: boolean;
    battlefieldWidth: number;
    battlefieldHeight: number;
    terrain?: TerrainFeature[];
    battlefield?: Battlefield;
    sides?: MissionSide[];
  }
): BattleAuditExport {
  const audit = auditService.getAudit();
  
  const exportData: BattleAuditExport = {
    version: audit.version,
    session: {
      missionId: options.missionId,
      missionName: options.missionName,
      seed: options.seed,
      lighting: options.lighting,
      visibilityOrMu: options.visibilityOrMu,
      maxOrm: options.maxOrm,
      allowConcentrateRangeExtension: options.allowConcentrateRangeExtension,
      perCharacterFovLos: options.perCharacterFovLos,
    },
    battlefield: {
      widthMu: options.battlefieldWidth,
      heightMu: options.battlefieldHeight,
      movementSampleStepMu: 0.5,
      lofWidthMu: 1,
    },
    turns: audit.turns || [],
  };
  
  // Add terrain if provided
  if (options.terrain && options.terrain.length > 0) {
    exportData.terrain = options.terrain.map(t => ({
      id: t.id,
      type: t.type,
      vertices: t.vertices,
      meta: t.meta,
    }));
  }
  
  // Add Delaunay mesh if battlefield provided
  if (options.battlefield && (options.battlefield as any).navMesh) {
    const navMesh = (options.battlefield as any).navMesh;
    if (navMesh && navMesh.points) {
      const triangles = [];
      for (let i = 0; i < navMesh.triangles.length; i += 3) {
        const tri = [];
        for (let j = 0; j < 3; j++) {
          const idx = navMesh.triangles[i + j] * 2;
          tri.push({ x: navMesh.points[idx], y: navMesh.points[idx + 1] });
        }
        triangles.push(tri);
      }
      exportData.delaunayMesh = triangles;
    }
  }
  
  // Add deployment data if sides provided
  if (options.sides) {
    exportData.deployment = options.sides.map(side => ({
      sideId: side.id,
      sideName: side.name,
      models: side.members.map(member => ({
        modelId: member.character.id,
        characterName: member.character.name || member.character.profile.name,
        assemblyName: member.assembly.name,
        position: {
          x: member.character.position?.x || 0,
          y: member.character.position?.y || 0,
        },
      })),
    }));
  }
  
  return exportData;
}

/**
 * Write audit export to file (Node.js environment)
 */
export function writeAuditExport(
  exportData: BattleAuditExport,
  outputPath: string
): string {
  const json = JSON.stringify(exportData, null, 2);
  // Return JSON string - caller writes to file
  return json;
}

/**
 * Write audit export to file synchronously (Node.js environment)
 * Use this when you need to write directly from scripts
 */
export function writeAuditExportSync(
  exportData: BattleAuditExport,
  outputPath: string
): void {
  const { writeFileSync } = require('node:fs') as typeof import('node:fs');
  const json = JSON.stringify(exportData, null, 2);
  writeFileSync(outputPath, json, 'utf-8');
}

/**
 * Export deployment data from battlefield
 */
export function exportDeployment(
  sides: MissionSide[],
  battlefield: Battlefield
): any[] {
  return sides.map(side => ({
    sideId: side.id,
    sideName: side.name,
    totalBP: side.totalBP,
    models: side.members.map(member => {
      const pos = battlefield.getCharacterPosition(member.character);
      return {
        modelId: member.character.id,
        characterName: member.character.name || member.character.profile.name,
        assemblyName: member.assembly.name,
        profile: member.character.profile.name,
        position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
      };
    }),
  }));
}

/**
 * Export terrain from battlefield
 */
export function exportTerrain(battlefield: Battlefield): any[] {
  if (!battlefield.terrain || battlefield.terrain.length === 0) {
    return [];
  }
  
  return battlefield.terrain.map(t => ({
    id: t.id,
    type: t.type,
    vertices: t.vertices.map((v: Position) => ({ x: v.x, y: v.y })),
    meta: t.meta,
  }));
}

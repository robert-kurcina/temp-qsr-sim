/**
 * Battle Report Writer
 *
 * Handles file output for battle reports (JSON, audit, viewer).
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BattleReport, BattleAuditTrace } from '../../shared/BattleReportTypes';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { SvgRenderer } from '../../../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import type { GameConfig } from '../../shared/BattleReportTypes';

/**
 * Write single battle report to JSON file
 */
export function writeSingleBattleReport(report: BattleReport): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync(outputDir, { recursive: true });

  const outputPath = join(outputDir, `battle-report-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Write battlefield SVG to file
 */
export function writeBattlefieldSvg(
  battlefield: Battlefield,
  config: GameConfig
): string {
  const outputDir = join(process.cwd(), 'generated', 'ai-battle-reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync(outputDir, { recursive: true });

  const svgPath = join(outputDir, `battlefield-${timestamp}.svg`);
  const svg = SvgRenderer.render(battlefield, {
    width: config.battlefieldSize,
    height: config.battlefieldSize,
    gridResolution: 0.5,
    title: `${config.missionId} - ${config.gameSize}`,
    layers: [
      { id: 'deployment', label: 'Deployment Zones', enabled: true },
      { id: 'grid', label: '0.5 MU Grid', enabled: true },
      { id: 'area', label: 'Area Terrain', enabled: true },
      { id: 'building', label: 'Buildings', enabled: true },
      { id: 'wall', label: 'Walls', enabled: true },
      { id: 'tree', label: 'Trees', enabled: true },
      { id: 'rocks', label: 'Rocks', enabled: true },
      { id: 'shrub', label: 'Shrubs', enabled: true },
      { id: 'delaunay', label: 'Delaunay Mesh', enabled: true },
    ],
  });
  writeFileSync(svgPath, svg, 'utf-8');
  return svgPath;
}

/**
 * Write visual audit report (audit.json)
 */
export function writeVisualAuditReport(report: BattleReport): string {
  const outputDir = join(process.cwd(), 'generated', 'battle-reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const battleDir = join(outputDir, `battle-report-${timestamp}`);
  mkdirSync(battleDir, { recursive: true });

  // Extract or create audit data
  const auditData: BattleAuditTrace = report.audit || {
    version: '1.0',
    session: {
      missionId: report.config.missionId,
      missionName: report.config.missionName,
      seed: report.seed,
      lighting: report.config.lighting,
      visibilityOrMu: report.config.visibilityOrMu,
      maxOrm: report.config.maxOrm,
      allowConcentrateRangeExtension: report.config.allowConcentrateRangeExtension,
      perCharacterFovLos: report.config.perCharacterFovLos,
    },
    battlefield: {
      widthMu: report.config.battlefieldSize,
      heightMu: report.config.battlefieldSize,
      movementSampleStepMu: 0.5,
      lofWidthMu: 0.5,
    },
    turns: [],
  };

  // Add terrain from battlefield if available
  const reportAny = report as any;
  if (reportAny.battlefield?.terrainFeatures) {
    (auditData as any).terrain = reportAny.battlefield.terrainFeatures.map((t: any) => ({
      id: t.id,
      type: t.type,
      vertices: t.vertices,
      meta: t.meta,
    }));
  } else if (reportAny.battlefield?.terrainElements) {
    (auditData as any).terrain = reportAny.battlefield.terrainElements;
  }

  const auditPath = join(battleDir, 'audit.json');
  writeFileSync(auditPath, JSON.stringify(auditData, null, 2), 'utf-8');
  return auditPath;
}

/**
 * Write HTML battle report viewer
 */
export function writeBattleReportViewer(report: BattleReport): string {
  const outputDir = join(process.cwd(), 'generated', 'battle-reports');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const battleDir = join(outputDir, `battle-report-${timestamp}`);
  mkdirSync(battleDir, { recursive: true });

  // Read the HTML viewer template
  const viewerTemplatePath = join(
    process.cwd(),
    'src',
    'lib',
    'mest-tactics',
    'viewer',
    'battle-report-viewer.html'
  );
  
  let viewerContent = '';
  try {
    viewerContent = readFileSync(viewerTemplatePath, 'utf-8');
  } catch (e) {
    // If template not found, create minimal viewer
    viewerContent = createMinimalViewerTemplate();
  }

  const viewerPath = join(battleDir, 'battle-report.html');
  writeFileSync(viewerPath, viewerContent, 'utf-8');

  // Write audit.json for viewer to load (if not already written)
  const auditPath = join(battleDir, 'audit.json');
  if (!report.audit) {
    const auditData: BattleAuditTrace = {
      version: '1.0',
      session: {
        missionId: report.config.missionId,
        missionName: report.config.missionName,
        seed: report.seed,
        lighting: report.config.lighting,
        visibilityOrMu: report.config.visibilityOrMu,
        maxOrm: report.config.maxOrm,
        allowConcentrateRangeExtension: report.config.allowConcentrateRangeExtension,
        perCharacterFovLos: report.config.perCharacterFovLos,
      },
      battlefield: {
        widthMu: report.config.battlefieldSize,
        heightMu: report.config.battlefieldSize,
        movementSampleStepMu: 0.5,
        lofWidthMu: 0.5,
      },
      turns: [],
      frames: [],
    };
    writeFileSync(auditPath, JSON.stringify(auditData, null, 2), 'utf-8');
  }

  return viewerPath;
}

/**
 * Create minimal viewer template if file not found
 */
function createMinimalViewerTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Battle Report Viewer</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 2rem; }
    h1 { color: #e94560; }
    .error { color: #e94560; background: #16213e; padding: 1rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>⚔️ Battle Report Viewer</h1>
  <div class="error">
    <h2>Viewer Template Not Found</h2>
    <p>The battle-report-viewer.html template was not found.</p>
    <p>Audit data is available in <code>audit.json</code> in this directory.</p>
  </div>
</body>
</html>`;
}

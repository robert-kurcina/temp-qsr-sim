/**
 * Battle Report Writer
 *
 * Handles file output for battle reports (JSON, audit, viewer).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BattleAuditTrace,
  BattleCombatMetricsAudit,
  BattleEntityManifest,
  BattleReport,
} from '../../shared/BattleReportTypes';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { GameConfig } from '../../shared/BattleReportTypes';
import { writeBattlefieldSvgFile } from '../../shared/BattlefieldSvg';

const JSON_REPORTS_DIR = join(process.cwd(), 'generated', 'ai-battle-reports');
const VISUAL_REPORTS_DIR = join(process.cwd(), 'generated', 'battle-reports');

export interface BattleArtifactWriteOptions {
  runId?: string;
}

export interface BattleArtifactBundle {
  runId: string;
  reportPath: string;
  auditPath?: string;
  viewerPath?: string;
}

export interface BattleArtifactBundleOptions extends BattleArtifactWriteOptions {
  audit?: boolean;
  viewer?: boolean;
}

export function createBattleArtifactRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function resolveRunId(options?: BattleArtifactWriteOptions): string {
  const runId = options?.runId?.trim();
  return runId && runId.length > 0 ? runId : createBattleArtifactRunId();
}

/**
 * Write single battle report to JSON file
 */
export function writeSingleBattleReport(report: BattleReport, options: BattleArtifactWriteOptions = {}): string {
  const runId = resolveRunId(options);
  mkdirSync(JSON_REPORTS_DIR, { recursive: true });
  const outputPath = join(JSON_REPORTS_DIR, `battle-report-${runId}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
  return outputPath;
}

/**
 * Write battlefield SVG to file
 */
export function writeBattlefieldSvg(
  battlefield: Battlefield,
  config: GameConfig,
  options: BattleArtifactWriteOptions = {}
): string {
  const runId = resolveRunId(options);
  mkdirSync(JSON_REPORTS_DIR, { recursive: true });

  const svgPath = join(JSON_REPORTS_DIR, `battlefield-${runId}.svg`);
  writeBattlefieldSvgFile(svgPath, battlefield, {
    width: config.battlefieldWidth,
    height: config.battlefieldHeight,
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
  return svgPath;
}

function createFallbackAuditTrace(report: BattleReport): BattleAuditTrace {
  return {
    version: '1.0',
    session: {
      missionId: report.config.missionId,
      missionName: report.config.missionName,
      seed: report.seed,
      lighting: report.config.lighting as any,
      visibilityOrMu: report.config.visibilityOrMu,
      maxOrm: report.config.maxOrm,
      allowConcentrateRangeExtension: report.config.allowConcentrateRangeExtension,
      perCharacterFovLos: report.config.perCharacterFovLos,
    },
    battlefield: {
      widthMu: report.config.battlefieldWidth,
      heightMu: report.config.battlefieldHeight,
      movementSampleStepMu: 0.5,
      lofWidthMu: 0.5,
    },
    turns: [],
  } as any;
}

function appendBattlefieldTerrainToAudit(trace: BattleAuditTrace, report: BattleReport): void {
  const reportAny = report as any;
  if (reportAny.battlefield?.terrainFeatures) {
    (trace as any).terrain = reportAny.battlefield.terrainFeatures.map((t: any) => ({
      id: t.id,
      type: t.type,
      vertices: t.vertices,
      meta: t.meta,
    }));
  } else if (reportAny.battlefield?.terrainElements) {
    (trace as any).terrain = reportAny.battlefield.terrainElements;
  }
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function toSafeNonNegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function deepCloneEntityManifest(manifest: BattleEntityManifest): BattleEntityManifest {
  return JSON.parse(JSON.stringify(manifest)) as BattleEntityManifest;
}

function buildCombatMetricsAudit(report: BattleReport): BattleCombatMetricsAudit {
  const hitAttempts = toSafeNonNegative((report.stats as any).hitTestsAttempted);
  const hitPasses = toSafeNonNegative((report.stats as any).hitTestsPassed);
  const hitFails = toSafeNonNegative(
    (report.stats as any).hitTestsFailed ?? Math.max(0, hitAttempts - hitPasses)
  );
  const damageAttempts = toSafeNonNegative((report.stats as any).damageTestsAttempted);
  const damagePasses = toSafeNonNegative((report.stats as any).damageTestsPassed);
  const damageFails = toSafeNonNegative(
    (report.stats as any).damageTestsFailed ?? Math.max(0, damageAttempts - damagePasses)
  );
  const totalAssignments = {
    wounds: toSafeNonNegative((report.stats as any).woundsAssigned),
    fear: toSafeNonNegative((report.stats as any).fearAssigned),
    delay: toSafeNonNegative((report.stats as any).delayAssigned),
  };
  const damageAssignments = {
    wounds: toSafeNonNegative((report.stats as any).damageWoundsAssigned ?? totalAssignments.wounds),
    fear: toSafeNonNegative((report.stats as any).damageFearAssigned ?? totalAssignments.fear),
    delay: toSafeNonNegative((report.stats as any).damageDelayAssigned ?? totalAssignments.delay),
  };
  const passiveOrOtherDelay = toSafeNonNegative(
    (report.stats as any).passiveOrOtherDelayAssigned ?? Math.max(0, totalAssignments.delay - damageAssignments.delay)
  );

  return {
    hitTests: {
      attempts: hitAttempts,
      passes: hitPasses,
      fails: hitFails,
      passRate: safeRate(hitPasses, hitAttempts),
    },
    damageTests: {
      attempts: damageAttempts,
      passes: damagePasses,
      fails: damageFails,
      passRate: safeRate(damagePasses, damageAttempts),
    },
    assignments: totalAssignments,
    damageAssignments,
    passiveOrOtherDelay,
    passiveUsageByType: {
      ...(report.advancedRules?.passiveOptions?.usedByType ?? {}),
    },
    situationalModifiersByType: {
      ...(report.advancedRules?.situationalModifiers?.byType ?? {}),
    },
  };
}

function appendEntitiesAndCombatMetricsToAudit(trace: BattleAuditTrace, report: BattleReport): void {
  if (report.entities) {
    trace.entities = deepCloneEntityManifest(report.entities);
  }
  trace.combatMetrics = buildCombatMetricsAudit(report);
}

function writeEntityManifestFiles(
  battleDir: string,
  entities: BattleEntityManifest
): BattleEntityManifest {
  const entitiesDir = join(battleDir, 'entities');
  mkdirSync(entitiesDir, { recursive: true });
  const writeJson = (relativePath: string, payload: unknown): string => {
    const outputPath = join(battleDir, relativePath);
    writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
    return relativePath;
  };

  const exportPaths = {
    sides: writeJson('entities/sides.json', entities.sides),
    assemblies: writeJson('entities/assemblies.json', entities.assemblies),
    characters: writeJson('entities/characters.json', entities.characters),
    profiles: writeJson('entities/profiles.json', entities.profiles),
    loadouts: writeJson('entities/loadouts.json', entities.loadouts),
    modelIndex: writeJson('entities/model-index.json', entities.byModelId),
    index: '',
  };

  const indexPayload = {
    version: entities.version,
    generatedAt: new Date().toISOString(),
    counts: {
      sides: entities.sides.length,
      assemblies: entities.assemblies.length,
      characters: entities.characters.length,
      profiles: entities.profiles.length,
      loadouts: entities.loadouts.length,
    },
    exportPaths: {
      sides: exportPaths.sides,
      assemblies: exportPaths.assemblies,
      characters: exportPaths.characters,
      profiles: exportPaths.profiles,
      loadouts: exportPaths.loadouts,
      modelIndex: exportPaths.modelIndex,
    },
  };
  exportPaths.index = writeJson('entities/index.json', indexPayload);

  return {
    ...entities,
    exportPaths,
  };
}

export function buildBattleAuditTrace(report: BattleReport): BattleAuditTrace {
  const trace = report.audit
    ? (JSON.parse(JSON.stringify(report.audit)) as BattleAuditTrace)
    : createFallbackAuditTrace(report);
  appendBattlefieldTerrainToAudit(trace, report);
  appendEntitiesAndCombatMetricsToAudit(trace, report);
  return trace;
}

/**
 * Write visual audit report (audit.json)
 */
export function writeVisualAuditReport(report: BattleReport, options: BattleArtifactWriteOptions = {}): string {
  const runId = resolveRunId(options);
  const battleDir = join(VISUAL_REPORTS_DIR, `battle-report-${runId}`);
  mkdirSync(battleDir, { recursive: true });

  const auditData = buildBattleAuditTrace(report);
  if (auditData.entities) {
    auditData.entities = writeEntityManifestFiles(battleDir, auditData.entities);
  }

  const auditPath = join(battleDir, 'audit.json');
  writeFileSync(auditPath, JSON.stringify(auditData, null, 2), 'utf-8');
  return auditPath;
}

/**
 * Write HTML battle report viewer
 */
export function writeBattleReportViewer(report: BattleReport): string {
  return writeBattleReportViewerWithOptions(report, {});
}

export function writeBattleReportViewerWithOptions(
  report: BattleReport,
  options: BattleArtifactWriteOptions = {}
): string {
  const runId = resolveRunId(options);
  const battleDir = join(VISUAL_REPORTS_DIR, `battle-report-${runId}`);
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
  if (!existsSync(auditPath)) {
    writeFileSync(auditPath, JSON.stringify(buildBattleAuditTrace(report), null, 2), 'utf-8');
  }

  return viewerPath;
}

export function writeBattleArtifacts(
  report: BattleReport,
  options: BattleArtifactBundleOptions = {}
): BattleArtifactBundle {
  const runId = resolveRunId(options);
  const result: BattleArtifactBundle = {
    runId,
    reportPath: writeSingleBattleReport(report, { runId }),
  };

  if (options.audit || options.viewer) {
    result.auditPath = writeVisualAuditReport(report, { runId });
  }

  if (options.viewer) {
    result.viewerPath = writeBattleReportViewerWithOptions(report, { runId });
  }

  return result;
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

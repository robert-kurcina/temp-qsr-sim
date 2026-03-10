import fs from 'node:fs';
import path from 'node:path';
import { generateBattleSummary, formatSummaryAsText } from '../ai-battle/reporting/BattleSummaryFormatter';
import { INDEX_PATH } from '../generate-battle-index';

const BATTLE_REPORTS_DIR = path.join(process.cwd(), 'generated', 'ai-battle-reports');
const VISUAL_REPORTS_DIR = path.join(process.cwd(), 'generated', 'battle-reports');

export interface BattleIndexEntry {
  id: string;
  timestamp: string;
  missionId: string;
  missionName: string;
  gameSize: string;
  seed?: number;
  turnsCompleted: number;
  winner: string;
  totalActions: number;
  fitness?: string;
  hasAuditOutput?: boolean;
  hasInlineAudit?: boolean;
  hasAuditArtifact?: boolean;
}

export interface BattleIndexFilters {
  mission?: string;
  gameSize?: string;
  date?: string;
  winner?: string;
  audit?: 'with' | 'without';
}

function hasInlineAuditTrace(report: any): boolean {
  return Boolean(report?.audit && Array.isArray(report.audit.turns));
}

function getVisualAuditPath(battleId: string): string {
  return path.join(VISUAL_REPORTS_DIR, battleId, 'audit.json');
}

function readBattleReport(battleId: string): any | null {
  try {
    const reportPath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    const content = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function withAuditFlags(entry: any): BattleIndexEntry {
  const report = readBattleReport(entry.id);
  const hasInlineAudit = report ? hasInlineAuditTrace(report) : false;
  const hasAuditArtifact = fs.existsSync(getVisualAuditPath(entry.id));
  const hasAuditOutput = hasInlineAudit || hasAuditArtifact;
  return {
    ...entry,
    hasInlineAudit,
    hasAuditArtifact,
    hasAuditOutput,
  };
}

function applyBattleFilters(entries: BattleIndexEntry[], filters?: BattleIndexFilters): BattleIndexEntry[] {
  let battles = entries;

  if (filters?.mission) {
    battles = battles.filter(b => b.missionId === filters.mission);
  }
  if (filters?.gameSize) {
    battles = battles.filter(b => b.gameSize === filters.gameSize);
  }
  if (filters?.date) {
    battles = battles.filter((b: any) => b.date === filters.date);
  }
  if (filters?.winner) {
    battles = battles.filter(b => b.winner === filters.winner);
  }
  if (filters?.audit === 'with') {
    battles = battles.filter(b => b.hasAuditOutput === true);
  }
  if (filters?.audit === 'without') {
    battles = battles.filter(b => b.hasAuditOutput !== true);
  }

  return battles;
}

export function getBattleIndex(filters?: BattleIndexFilters): BattleIndexEntry[] {
  try {
    if (fs.existsSync(INDEX_PATH)) {
      const content = fs.readFileSync(INDEX_PATH, 'utf-8');
      const index = JSON.parse(content);
      const battles = (index.battles || []).map((battle: any) => withAuditFlags(battle));
      return applyBattleFilters(battles, filters);
    }

    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.json') && f.startsWith('battle-report-'));

    const battles = files.map(file => {
      const filePath = path.join(BATTLE_REPORTS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      const id = file.replace('.json', '');
      const hasInlineAudit = hasInlineAuditTrace(data);
      const hasAuditArtifact = fs.existsSync(getVisualAuditPath(id));
      const hasAuditOutput = hasInlineAudit || hasAuditArtifact;

      return {
        id,
        timestamp: file.match(/battle-report-(.+)\.json/)?.[1] || file,
        missionId: data.config?.missionId || 'Unknown',
        missionName: data.config?.missionName || 'Unknown',
        gameSize: data.config?.gameSize || 'Unknown',
        seed: data.seed,
        turnsCompleted: data.stats?.turnsCompleted || 0,
        winner: data.winner || 'Unknown',
        totalActions: data.stats?.totalActions || 0,
        fitness: 'Good',
        hasInlineAudit,
        hasAuditArtifact,
        hasAuditOutput,
      };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return applyBattleFilters(battles, filters);
  } catch (error) {
    console.error('Error reading battle reports:', error);
    return [];
  }
}

export function getBattleAudit(battleId: string): object | null {
  try {
    const report = readBattleReport(battleId);
    if (!report) {
      return null;
    }
    if (report.audit && typeof report.audit === 'object') {
      return report.audit;
    }

    const visualAuditPath = getVisualAuditPath(battleId);
    if (fs.existsSync(visualAuditPath)) {
      return JSON.parse(fs.readFileSync(visualAuditPath, 'utf-8'));
    }

    // Fallback skeleton for reports without full audit output.
    return {
      version: '1.0',
      session: {
        missionId: report.config?.missionId || 'Unknown',
        missionName: report.config?.missionName || 'Unknown',
        seed: report.seed,
        lighting: report.config?.lighting || 'Unknown',
        visibilityOrMu: report.config?.visibilityOrMu || 0,
        maxOrm: report.config?.maxOrm || 0,
        allowConcentrateRangeExtension: Boolean(report.config?.allowConcentrateRangeExtension),
        perCharacterFovLos: Boolean(report.config?.perCharacterFovLos),
      },
      battlefield: {
        widthMu: report.config?.battlefieldWidth || 0,
        heightMu: report.config?.battlefieldHeight || 0,
        movementSampleStepMu: 0.5,
        lofWidthMu: 1,
      },
      turns: [],
    };
  } catch {
    return null;
  }
}

export function getBattleSvg(battleId: string): string | null {
  try {
    const reportPath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      let exportPath = report?.audit?.battlefield?.exportPath;
      if (!exportPath) {
        const visualAuditPath = getVisualAuditPath(battleId);
        if (fs.existsSync(visualAuditPath)) {
          try {
            const visualAudit = JSON.parse(fs.readFileSync(visualAuditPath, 'utf-8'));
            exportPath = visualAudit?.battlefield?.exportPath;
          } catch {
            // ignore malformed visual audit fallback
          }
        }
      }
      if (typeof exportPath === 'string' && exportPath.trim().length > 0) {
        const jsonPath = path.isAbsolute(exportPath)
          ? exportPath
          : path.join(process.cwd(), exportPath);
        const svgPath = jsonPath.replace(/\.json$/i, '.svg');
        if (fs.existsSync(svgPath)) {
          return fs.readFileSync(svgPath, 'utf-8');
        }
      }
    }

    const timestampMatch = battleId.match(/battle-report-(.+)/);
    if (!timestampMatch) return null;

    const battleTimestamp = timestampMatch[1];
    const mainTimestamp = battleTimestamp.substring(0, battleTimestamp.length - 5);

    const files = fs.readdirSync(BATTLE_REPORTS_DIR)
      .filter(f => f.endsWith('.svg') && f.startsWith('battlefield-'))
      .filter(f => {
        const svgTimestamp = f.replace('battlefield-', '').replace('.svg', '');
        return svgTimestamp.startsWith(mainTimestamp.substring(0, mainTimestamp.length - 1));
      });

    if (files.length === 0) return null;

    const filePath = path.join(BATTLE_REPORTS_DIR, files[0]);
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error getting SVG:', error);
    return null;
  }
}

export function getBattleSummary(battleId: string): object | null {
  try {
    const filePath = path.join(BATTLE_REPORTS_DIR, `${battleId}.json`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const report = JSON.parse(content);

    const summary = generateBattleSummary(report);
    return {
      text: formatSummaryAsText(summary),
      structured: summary,
    };
  } catch {
    return null;
  }
}

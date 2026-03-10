import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

export const BATTLEFIELD_DATA_ROOT = join(process.cwd(), 'data', 'battlefields');
export const BATTLEFIELD_DEFAULT_ROOT = join(BATTLEFIELD_DATA_ROOT, 'default');
export const BATTLEFIELD_DEFAULT_SIMPLE_ROOT = join(BATTLEFIELD_DEFAULT_ROOT, 'simple');
export const BATTLEFIELD_GENERATED_ROOT = join(BATTLEFIELD_DATA_ROOT, 'generated');
export const BATTLEFIELD_DENSITY_STEP = 20;

export type BattlefieldDensityConfig = {
  area: number;
  buildings: number;
  walls: number;
  rocks: number;
  shrubs: number;
  trees: number;
};

export const EMPTY_BATTLEFIELD_DENSITIES: BattlefieldDensityConfig = {
  area: 0,
  buildings: 0,
  walls: 0,
  rocks: 0,
  shrubs: 0,
  trees: 0,
};

export function normalizeGameSizeSegment(gameSize: string): string {
  return String(gameSize || 'unknown').trim().toUpperCase();
}

export function clampDensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function quantizeDensity(value: number, step: number = BATTLEFIELD_DENSITY_STEP): number {
  const clamped = clampDensity(value);
  if (step <= 1) return Math.round(clamped);
  return Math.max(0, Math.min(100, Math.round(clamped / step) * step));
}

export function normalizeBattlefieldDensities(
  partial: Partial<BattlefieldDensityConfig>
): BattlefieldDensityConfig {
  return {
    area: quantizeDensity(partial.area ?? 0),
    buildings: quantizeDensity(partial.buildings ?? 0),
    walls: quantizeDensity(partial.walls ?? 0),
    rocks: quantizeDensity(partial.rocks ?? 0),
    shrubs: quantizeDensity(partial.shrubs ?? 0),
    trees: quantizeDensity(partial.trees ?? 0),
  };
}

export function formatBattlefieldDensityFilename(config: BattlefieldDensityConfig): string {
  return `battlefield_A${config.area}-B${config.buildings}-W${config.walls}-R${config.rocks}-S${config.shrubs}-T${config.trees}`;
}

export function getGeneratedBattlefieldDir(gameSize: string): string {
  return join(BATTLEFIELD_GENERATED_ROOT, normalizeGameSizeSegment(gameSize));
}

export function ensureBattlefieldDirectories(gameSizes: string[] = []): void {
  mkdirSync(BATTLEFIELD_DEFAULT_SIMPLE_ROOT, { recursive: true });
  mkdirSync(BATTLEFIELD_GENERATED_ROOT, { recursive: true });
  for (const gameSize of gameSizes) {
    mkdirSync(getGeneratedBattlefieldDir(gameSize), { recursive: true });
  }
}

function walkJsonFiles(pathname: string, out: string[]): void {
  if (!existsSync(pathname)) return;
  const entries = readdirSync(pathname, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(pathname, entry.name);
    if (entry.isDirectory()) {
      walkJsonFiles(child, out);
      continue;
    }
    if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
      out.push(child);
    }
  }
}

export function listBattlefieldJsonPaths(roots: string[] = [
  BATTLEFIELD_DEFAULT_SIMPLE_ROOT,
  BATTLEFIELD_GENERATED_ROOT,
]): string[] {
  const files: string[] = [];
  for (const root of roots) {
    walkJsonFiles(root, files);
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function toBattlefieldFileId(jsonPath: string): string {
  const rel = relative(BATTLEFIELD_DATA_ROOT, jsonPath).replace(/\\/g, '/');
  return rel.replace(/\.json$/i, '').replace(/\//g, '__');
}

export interface BattlefieldFileRecord {
  id: string;
  name: string;
  jsonPath: string;
  svgPath: string | null;
  relativePath: string;
  source: 'default' | 'generated';
  gameSize?: string;
}

export function listBattlefieldFiles(): BattlefieldFileRecord[] {
  const files = listBattlefieldJsonPaths();
  const filteredFiles = files.filter(file => {
    const basename = file.split('/').pop()?.toLowerCase() ?? '';
    if (basename.endsWith('-simple-empty.json')) return false;
    if (basename === 'smoke-empty.json') return false;
    return true;
  });

  const records = filteredFiles.map((jsonPath): BattlefieldFileRecord => {
    const relativePath = relative(BATTLEFIELD_DATA_ROOT, jsonPath).replace(/\\/g, '/');
    const source: 'default' | 'generated' = relativePath.startsWith('generated/') ? 'generated' : 'default';
    const svgCandidate = jsonPath.replace(/\.json$/i, '.svg');
    const parts = relativePath.split('/');
    const gameSizeFromDir = source === 'generated' ? normalizeGameSizeSegment(parts[1] ?? '') : undefined;
    const gameSizeFromFile = source === 'default' ? normalizeGameSizeSegment((parts[parts.length - 1] ?? '').split('-')[0]) : undefined;
    return {
      id: toBattlefieldFileId(jsonPath),
      name: toBattlefieldFileId(jsonPath),
      jsonPath,
      svgPath: existsSync(svgCandidate) ? svgCandidate : null,
      relativePath,
      source,
      gameSize: gameSizeFromDir || gameSizeFromFile,
    };
  });

  return records.sort((a, b) => a.name.localeCompare(b.name));
}

export function getBattlefieldFileById(id: string): BattlefieldFileRecord | null {
  const trimmed = String(id || '').trim();
  if (!trimmed) return null;
  const match = listBattlefieldFiles().find(entry => entry.id === trimmed || entry.name === trimmed);
  return match ?? null;
}

export function getBattlefieldFileByPath(jsonPath: string): BattlefieldFileRecord | null {
  const normalized = String(jsonPath || '').trim();
  if (!normalized) return null;
  const match = listBattlefieldFiles().find(entry => entry.jsonPath === normalized);
  return match ?? null;
}

export function getDefaultSimpleBattlefieldPath(gameSize: string): string | null {
  const size = normalizeGameSizeSegment(gameSize);
  const preferredNames = [`${size}-${formatBattlefieldDensityFilename(EMPTY_BATTLEFIELD_DENSITIES)}.json`];
  for (const name of preferredNames) {
    const candidate = join(BATTLEFIELD_DEFAULT_SIMPLE_ROOT, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  if (!existsSync(BATTLEFIELD_DEFAULT_SIMPLE_ROOT)) {
    return null;
  }

  const fallback = readdirSync(BATTLEFIELD_DEFAULT_SIMPLE_ROOT)
    .filter(name => name.toLowerCase().endsWith('.json'))
    .find(name => name.toUpperCase().startsWith(`${size}-`));
  if (!fallback) return null;
  return join(BATTLEFIELD_DEFAULT_SIMPLE_ROOT, fallback);
}

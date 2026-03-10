import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const INVENTORY_ROOTS = ['src', 'scripts'] as const;
export const INVENTORY_EXCLUDED_GLOBS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts'
] as const;
const TEXT_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.md']);
const EXCLUDED_FILE_PATTERNS = [/\.test\.tsx?$/, /\.spec\.ts$/];
const KEYWORD_CATEGORIES = [
  'weight',
  'threshold',
  'trigger',
  'filter',
  'bonus',
  'penalty',
  'factor',
  'multiplier',
  'gate'
] as const;

export type KeywordCategory = (typeof KEYWORD_CATEGORIES)[number];

export interface KeywordConstantEntry {
  file: string;
  line: number;
  name: string;
  category: KeywordCategory;
  domain: string;
  sourceLine: string;
}

export interface KeywordConstantInventory {
  generatedAt: string;
  scope: {
    roots: string[];
    excludedGlobs: string[];
    declarationPattern: string;
    notes: string;
  };
  totals: {
    declarations: number;
    categories: number;
    files: number;
  };
  byCategory: Record<string, number>;
  byDomain: Record<string, number>;
  topFiles: Array<{ file: string; count: number }>;
  entries: KeywordConstantEntry[];
}

const DECLARATION_PATTERN =
  '\\bconst\\s+([A-Za-z0-9_]*(?:weight|threshold|trigger|filter|bonus|penalty|factor|multiplier|gate)[A-Za-z0-9_]*)\\b';
const DECLARATION_REGEX = new RegExp(DECLARATION_PATTERN, 'g');

export function inferKeywordCategory(name: string): KeywordCategory {
  const lowerName = name.toLowerCase();
  for (const category of KEYWORD_CATEGORIES) {
    if (lowerName.includes(category)) {
      return category;
    }
  }

  throw new Error(`Unable to infer keyword category for declaration: "${name}"`);
}

export function classifyInventoryDomain(file: string): string {
  const normalizedFile = file.replaceAll('\\', '/');
  if (
    normalizedFile === 'scripts/ai-battle-setup.ts' ||
    normalizedFile.startsWith('scripts/ai-battle/')
  ) {
    return 'ai-battle-script';
  }

  if (normalizedFile.startsWith('src/lib/mest-tactics/ai/')) {
    return 'ai-core';
  }

  if (
    normalizedFile.startsWith('src/lib/mest-tactics/missions/') ||
    normalizedFile.startsWith('src/lib/mest-tactics/mission/')
  ) {
    return 'missions';
  }

  if (
    normalizedFile.startsWith('src/lib/mest-tactics/battlefield/') ||
    normalizedFile.startsWith('scripts/battlefield') ||
    normalizedFile.startsWith('scripts/shared/Battlefield')
  ) {
    return 'battlefield';
  }

  if (normalizedFile.startsWith('src/lib/mest-tactics/actions/')) {
    return 'actions';
  }

  if (normalizedFile.startsWith('scripts/')) {
    return 'scripts';
  }

  return 'other';
}

function isExcludedFile(file: string): boolean {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(file));
}

function isCandidateFile(file: string): boolean {
  if (isExcludedFile(file)) {
    return false;
  }

  const extension = path.extname(file);
  return TEXT_FILE_EXTENSIONS.has(extension);
}

function listCandidateFiles(root: string): string[] {
  const rootPath = path.resolve(process.cwd(), root);
  if (!statPathExists(rootPath)) {
    return [];
  }

  const files: string[] = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const nextPath = stack.pop();
    if (!nextPath) {
      continue;
    }

    const stat = statSync(nextPath);
    if (stat.isDirectory()) {
      const children = readdirSync(nextPath, { withFileTypes: true });
      for (const child of children) {
        stack.push(path.join(nextPath, child.name));
      }
      continue;
    }

    const relativePath = normalizeRelativePath(path.relative(process.cwd(), nextPath));
    if (isCandidateFile(relativePath)) {
      files.push(relativePath);
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function statPathExists(targetPath: string): boolean {
  try {
    statSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRelativePath(file: string): string {
  return file.replaceAll(path.sep, '/');
}

function scanFileForKeywordConstants(file: string): KeywordConstantEntry[] {
  const absolutePath = path.resolve(process.cwd(), file);
  const source = readFileSync(absolutePath, 'utf8');
  const lines = source.split(/\r?\n/u);
  const entries: KeywordConstantEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const sourceLine = lines[index];
    DECLARATION_REGEX.lastIndex = 0;
    let match = DECLARATION_REGEX.exec(sourceLine);
    while (match) {
      const name = match[1] ?? '';
      entries.push({
        file,
        line: index + 1,
        name,
        category: inferKeywordCategory(name),
        domain: classifyInventoryDomain(file),
        sourceLine: sourceLine.trim()
      });
      match = DECLARATION_REGEX.exec(sourceLine);
    }
  }

  return entries;
}

function buildTopFiles(entries: KeywordConstantEntry[]): Array<{ file: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.file, (counts.get(entry.file) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([file, count]) => ({ file, count }));
}

function buildCountMap(values: string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  );
}

export function buildKeywordConstantInventory(
  roots: string[] = [...INVENTORY_ROOTS]
): KeywordConstantInventory {
  const files = roots.flatMap((root) => listCandidateFiles(root));
  const entries = files.flatMap((file) => scanFileForKeywordConstants(file));
  entries.sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.name.localeCompare(right.name)
  );

  const byCategory = buildCountMap(entries.map((entry) => entry.category));
  const byDomain = buildCountMap(entries.map((entry) => entry.domain));

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      roots: [...roots],
      excludedGlobs: [...INVENTORY_EXCLUDED_GLOBS],
      declarationPattern: DECLARATION_PATTERN,
      notes:
        'Any const declaration line with keyword in variable name; includes top-level and local constants.'
    },
    totals: {
      declarations: entries.length,
      categories: Object.keys(byCategory).length,
      files: new Set(entries.map((entry) => entry.file)).size
    },
    byCategory,
    byDomain,
    topFiles: buildTopFiles(entries),
    entries
  };
}

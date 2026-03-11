import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

const MODULE_LINE_BUDGETS: Array<{ file: string; maxLines: number }> = [
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorer.ts', maxLines: 1700 },
  { file: 'src/lib/mest-tactics/ai/core/CharacterAI.ts', maxLines: 2800 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerActionSupport.ts', maxLines: 1600 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerBonusActionSupport.ts', maxLines: 700 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerPressureSupport.ts', maxLines: 550 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerSessionSupport.ts', maxLines: 500 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerTargetSupport.ts', maxLines: 500 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerPositionSupport.ts', maxLines: 350 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerStrategicPathSupport.ts', maxLines: 380 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerObjectiveSupport.ts', maxLines: 320 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerMeleeSupport.ts', maxLines: 260 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerCombatSupport.ts', maxLines: 260 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerDoctrineSupport.ts', maxLines: 230 },
  { file: 'src/lib/mest-tactics/ai/core/UtilityScorerWaitSupport.ts', maxLines: 140 },
  { file: 'src/lib/mest-tactics/ai/core/MinimaxCacheKey.ts', maxLines: 320 },
  { file: 'src/lib/mest-tactics/ai/shared/ThreatProfileSupport.ts', maxLines: 180 },
];

const WRAPPER_METHOD_MAX_LINES: Array<{ name: string; maxLines: number }> = [
  { name: 'evaluateBonusActions', maxLines: 12 },
  { name: 'evaluateJumpDownAttack', maxLines: 12 },
  { name: 'evaluatePushOffLedge', maxLines: 12 },
  { name: 'evaluateGapCrossing', maxLines: 12 },
  { name: 'countFriendlyInMeleeRange', maxLines: 12 },
  { name: 'countEnemyInMeleeRange', maxLines: 12 },
  { name: 'evaluateOutnumberAdvantage', maxLines: 12 },
  { name: 'evaluateFlankingPosition', maxLines: 12 },
  { name: 'evaluateObjectiveMarkerActions', maxLines: 12 },
  { name: 'getInteractableObjectiveMarkers', maxLines: 12 },
  { name: 'evaluateObjectiveAdvance', maxLines: 14 },
  { name: 'evaluateWaitTacticalConditions', maxLines: 14 },
];

const SUPPORT_FILE_GLOB_RE = /^UtilityScorer.*Support\.ts$/;
const SUBSTANTIAL_DUPLICATE_BODY_MIN_LENGTH = 180;

function readFile(filePath: string): string {
  return readFileSync(path.resolve(ROOT, filePath), 'utf8');
}

function lineCount(source: string): number {
  return source.split(/\r?\n/).length;
}

function extractBlockFromBrace(source: string, openBraceIndex: number): string {
  let depth = 0;
  let closeBraceIndex = -1;

  for (let cursor = openBraceIndex; cursor < source.length; cursor += 1) {
    const ch = source[cursor];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        closeBraceIndex = cursor;
        break;
      }
    }
  }

  if (closeBraceIndex < 0) {
    throw new Error(`Unterminated block starting at offset ${openBraceIndex}`);
  }

  return source.slice(openBraceIndex + 1, closeBraceIndex);
}

function extractUtilityScorerMethodBody(utilityScorerSource: string, methodName: string): string {
  const marker = `private ${methodName}(`;
  const methodStart = utilityScorerSource.indexOf(marker);
  if (methodStart < 0) {
    throw new Error(`Could not find UtilityScorer method: ${methodName}`);
  }
  const openBrace = utilityScorerSource.indexOf('{', methodStart);
  if (openBrace < 0) {
    throw new Error(`Could not find opening brace for UtilityScorer method: ${methodName}`);
  }
  return extractBlockFromBrace(utilityScorerSource, openBrace);
}

function nonEmptyLineCount(source: string): number {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

type ExportedFunctionInfo = {
  file: string;
  name: string;
  body: string;
};

function getSupportFiles(): string[] {
  const coreDir = path.resolve(ROOT, 'src/lib/mest-tactics/ai/core');
  const coreSupportFiles = readdirSync(coreDir)
    .filter((file) => SUPPORT_FILE_GLOB_RE.test(file))
    .map((file) => `src/lib/mest-tactics/ai/core/${file}`);
  coreSupportFiles.push('src/lib/mest-tactics/ai/shared/ThreatProfileSupport.ts');
  return coreSupportFiles.sort((left, right) => left.localeCompare(right));
}

function extractExportedFunctions(file: string): ExportedFunctionInfo[] {
  const source = readFile(file);
  const exportedFunctions: ExportedFunctionInfo[] = [];
  const exportRegex = /export function\s+([A-Za-z0-9_]+)/g;

  for (let match = exportRegex.exec(source); match; match = exportRegex.exec(source)) {
    const functionName = match[1];
    const openBrace = source.indexOf('{', match.index);
    if (openBrace < 0) {
      throw new Error(`Could not find opening brace for exported function ${functionName} in ${file}`);
    }
    const body = extractBlockFromBrace(source, openBrace);
    exportedFunctions.push({ file, name: functionName, body });
  }

  return exportedFunctions;
}

function normalizeFunctionBody(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, '');
}

describe('AI module guardrails', () => {
  it('enforces line-count budgets for high-coupling AI modules', () => {
    const overBudget = MODULE_LINE_BUDGETS
      .map((budget) => {
        const lines = lineCount(readFile(budget.file));
        return { ...budget, lines };
      })
      .filter((entry) => entry.lines > entry.maxLines);

    expect(overBudget, [
      'AI module line-count guardrail violated.',
      ...overBudget.map((entry) =>
        `- ${entry.file}: ${entry.lines} lines (max ${entry.maxLines})`
      ),
    ].join('\n')).toEqual([]);
  });

  it('keeps extracted UtilityScorer wrappers thin to avoid helper re-embedding', () => {
    const utilityScorerSource = readFile('src/lib/mest-tactics/ai/core/UtilityScorer.ts');
    const tooLargeWrappers = WRAPPER_METHOD_MAX_LINES
      .map((wrapper) => {
        const body = extractUtilityScorerMethodBody(utilityScorerSource, wrapper.name);
        const lines = nonEmptyLineCount(body);
        return { ...wrapper, lines };
      })
      .filter((wrapper) => wrapper.lines > wrapper.maxLines);

    expect(tooLargeWrappers, [
      'UtilityScorer wrapper-size guardrail violated (likely helper logic re-embedded).',
      ...tooLargeWrappers.map((wrapper) =>
        `- ${wrapper.name}: ${wrapper.lines} non-empty body lines (max ${wrapper.maxLines})`
      ),
    ].join('\n')).toEqual([]);
  });

  it('rejects duplicate exported helper names across AI support modules', () => {
    const exportedFunctions = getSupportFiles().flatMap((file) => extractExportedFunctions(file));
    const byName = new Map<string, ExportedFunctionInfo[]>();

    for (const fn of exportedFunctions) {
      const existing = byName.get(fn.name) ?? [];
      existing.push(fn);
      byName.set(fn.name, existing);
    }

    const duplicates = [...byName.entries()]
      .filter(([, fns]) => fns.length > 1)
      .map(([name, fns]) => ({
        name,
        locations: fns.map((fn) => `${fn.file}::${fn.name}`).sort((left, right) => left.localeCompare(right)),
      }));

    expect(duplicates, [
      'Duplicate exported helper name(s) detected across AI support modules.',
      ...duplicates.map((duplicate) => `- ${duplicate.name}: ${duplicate.locations.join(', ')}`),
    ].join('\n')).toEqual([]);
  });

  it('rejects duplicate substantial exported helper implementations across AI support modules', () => {
    const exportedFunctions = getSupportFiles().flatMap((file) => extractExportedFunctions(file));
    const byBody = new Map<string, ExportedFunctionInfo[]>();

    for (const fn of exportedFunctions) {
      const normalized = normalizeFunctionBody(fn.body);
      if (normalized.length < SUBSTANTIAL_DUPLICATE_BODY_MIN_LENGTH) continue;
      const existing = byBody.get(normalized) ?? [];
      existing.push(fn);
      byBody.set(normalized, existing);
    }

    const duplicates = [...byBody.values()]
      .filter((fns) => fns.length > 1)
      .map((fns) => fns.map((fn) => `${fn.file}::${fn.name}`).sort((left, right) => left.localeCompare(right)));

    expect(duplicates, [
      'Duplicate substantial helper implementation(s) detected across AI support modules.',
      ...duplicates.map((locations) => `- ${locations.join(', ')}`),
    ].join('\n')).toEqual([]);
  });
});

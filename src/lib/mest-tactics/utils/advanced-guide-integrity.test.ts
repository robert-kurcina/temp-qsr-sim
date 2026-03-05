import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function getRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../..');
}

function getAdvancedGuideFiles(guidesDir: string): string[] {
  return fs
    .readdirSync(guidesDir)
    .filter((name: any) => name.startsWith('rules-advanced-') && name.endsWith('.md'))
    .sort();
}

function getSourcePaths(markdown: string): string[] {
  const sourceLine = markdown
    .split('\n')
    .find(line => line.trimStart().startsWith('**Source:**'));
  if (!sourceLine) return [];
  return [...sourceLine.matchAll(/`([^`]+)`/g)].map((match: any) => match[1]);
}

describe('Advanced Guide Integrity', () => {
  it('uses canonical source paths for advanced source docs', () => {
    const repoRoot = getRepoRoot();
    const guidesDir = path.join(repoRoot, 'src/guides/docs');
    const advancedGuides = getAdvancedGuideFiles(guidesDir).filter(
      name => name !== 'rules-advanced-game.md'
    );

    for (const guideFile of advancedGuides) {
      const fullPath = path.join(guidesDir, guideFile);
      const markdown = fs.readFileSync(fullPath, 'utf8');
      const sourcePaths = getSourcePaths(markdown);
      expect(sourcePaths.length, `${guideFile} should include **Source:** path(s)`).toBeGreaterThan(0);

      for (const sourcePath of sourcePaths) {
        expect(
          sourcePath.startsWith('docs/canonical/MEST.Tactics.Advanced-'),
          `${guideFile} has non-canonical source pointer: ${sourcePath}`
        ).toBe(true);
        expect(fs.existsSync(path.join(repoRoot, sourcePath)), `${sourcePath} should exist`).toBe(true);
      }
    }
  });

  it('contains no legacy docs/MEST.Tactics.Advanced source pointers', () => {
    const repoRoot = getRepoRoot();
    const guidesDir = path.join(repoRoot, 'src/guides/docs');
    const advancedGuides = getAdvancedGuideFiles(guidesDir);

    for (const guideFile of advancedGuides) {
      const fullPath = path.join(guidesDir, guideFile);
      const markdown = fs.readFileSync(fullPath, 'utf8');
      expect(markdown.includes('docs/MEST.Tactics.Advanced-'), `${guideFile} still has legacy source path`).toBe(
        false
      );
    }
  });

  it('resolves all wiki-link targets referenced by advanced guides', () => {
    const repoRoot = getRepoRoot();
    const guidesDir = path.join(repoRoot, 'src/guides/docs');
    const availableDocFiles = new Set(fs.readdirSync(guidesDir));
    const advancedGuides = getAdvancedGuideFiles(guidesDir);

    for (const guideFile of advancedGuides) {
      const fullPath = path.join(guidesDir, guideFile);
      const markdown = fs.readFileSync(fullPath, 'utf8');
      const wikiTargets = [...markdown.matchAll(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g)].map((match: any) => match[1]);

      for (const target of wikiTargets) {
        const targetFile = `${target}.md`;
        expect(
          availableDocFiles.has(targetFile),
          `${guideFile} references missing wiki target ${targetFile}`
        ).toBe(true);
      }
    }
  });
});

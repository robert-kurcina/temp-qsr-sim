import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  type KeywordConstantEntry,
  type KeywordConstantInventory,
  buildKeywordConstantInventory
} from './KeywordConstantInventory';

const DEFAULT_BASELINE_PATH = 'generated/inventories/keyword-constant-inventory.json';
const DEFAULT_GUARD_DOMAINS = new Set(['ai-core', 'ai-battle-script', 'missions']);

function parseBaselinePath(argv: string[]): string {
  const baselineArgIndex = argv.indexOf('--baseline');
  if (baselineArgIndex < 0) {
    return DEFAULT_BASELINE_PATH;
  }

  const nextValue = argv[baselineArgIndex + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error('Missing value for --baseline');
  }

  return nextValue;
}

function parseDomainSet(argv: string[]): Set<string> {
  const domainsArgIndex = argv.indexOf('--domains');
  if (domainsArgIndex < 0) {
    return new Set(DEFAULT_GUARD_DOMAINS);
  }

  const nextValue = argv[domainsArgIndex + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error('Missing value for --domains');
  }

  const domains = nextValue
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (domains.length === 0) {
    throw new Error('No valid domains supplied for --domains');
  }

  return new Set(domains);
}

function loadBaselineInventory(baselinePath: string): KeywordConstantInventory {
  const absolutePath = path.resolve(process.cwd(), baselinePath);
  const raw = readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw) as KeywordConstantInventory;
}

function entrySignature(entry: KeywordConstantEntry): string {
  return `${entry.file}::${entry.name}::${entry.sourceLine}`;
}

function filterToGuardDomains(entries: KeywordConstantEntry[], domains: Set<string>): KeywordConstantEntry[] {
  return entries.filter((entry) => domains.has(entry.domain));
}

function multiset(entries: KeywordConstantEntry[]): Map<string, number> {
  const signatures = new Map<string, number>();
  for (const entry of entries) {
    const signature = entrySignature(entry);
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
  }
  return signatures;
}

function findNewEntries(
  baselineEntries: KeywordConstantEntry[],
  currentEntries: KeywordConstantEntry[]
): KeywordConstantEntry[] {
  const baselineCounts = multiset(baselineEntries);
  const newlyIntroduced: KeywordConstantEntry[] = [];

  for (const entry of currentEntries) {
    const signature = entrySignature(entry);
    const baselineCount = baselineCounts.get(signature) ?? 0;
    if (baselineCount > 0) {
      baselineCounts.set(signature, baselineCount - 1);
      continue;
    }
    newlyIntroduced.push(entry);
  }

  return newlyIntroduced;
}

function run(): void {
  const argv = process.argv.slice(2);
  const baselinePath = parseBaselinePath(argv);
  const domains = parseDomainSet(argv);
  const domainList = [...domains].sort((left, right) => left.localeCompare(right));
  const baselineInventory = loadBaselineInventory(baselinePath);
  const currentInventory = buildKeywordConstantInventory();
  const scopedBaselineEntries = filterToGuardDomains(baselineInventory.entries, domains);
  const scopedCurrentEntries = filterToGuardDomains(currentInventory.entries, domains);
  const newEntries = findNewEntries(scopedBaselineEntries, scopedCurrentEntries);

  if (newEntries.length > 0) {
    const detailLines = newEntries
      .slice(0, 50)
      .map((entry) => `  - ${entry.file}:${entry.line} ${entry.name} [${entry.domain}]`)
      .join('\n');
    const omittedCount = newEntries.length > 50 ? `\n  ... ${newEntries.length - 50} more` : '';
    console.error(
      [
        `[tuning:guard] FAILED`,
        `Detected ${newEntries.length} new embedded tuning constant declaration(s) in guarded domains: ${domainList.join(', ')}`,
        `Baseline: ${baselinePath}`,
        'New declarations:',
        detailLines + omittedCount,
        'Externalize these values into tuning JSON blocks (or intentionally refresh baseline after review).'
      ].join('\n')
    );
    process.exit(1);
  }

  console.log(
    `[tuning:guard] PASS (${scopedCurrentEntries.length} guarded declarations across domains: ${domainList.join(', ')})`
  );
}

run();

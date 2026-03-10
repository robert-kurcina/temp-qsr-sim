import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { buildKeywordConstantInventory } from './KeywordConstantInventory';

const DEFAULT_OUTPUT_PATH = 'generated/inventories/keyword-constant-inventory.json';

function parseOutputPath(argv: string[]): string {
  const outputArgIndex = argv.indexOf('--output');
  if (outputArgIndex < 0) {
    return DEFAULT_OUTPUT_PATH;
  }

  const nextValue = argv[outputArgIndex + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error('Missing value for --output');
  }

  return nextValue;
}

function run(): void {
  const argv = process.argv.slice(2);
  const outputPath = parseOutputPath(argv);
  const inventory = buildKeywordConstantInventory();
  const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
  mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  writeFileSync(`${absoluteOutputPath}`, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

  console.log(
    `[tuning:inventory] wrote ${outputPath} (${inventory.totals.declarations} declarations across ${inventory.totals.files} files)`
  );
}

run();

#!/usr/bin/env node

import { basename } from 'node:path';
import { buildBattlefieldFromExport, loadBattlefieldExport } from '../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import {
  BATTLEFIELD_DEFAULT_SIMPLE_ROOT,
  BATTLEFIELD_GENERATED_ROOT,
  listBattlefieldJsonPaths,
} from './shared/BattlefieldPaths';
import { writeBattlefieldSvgFile } from './shared/BattlefieldSvg';

function main(): void {
  const roots = [BATTLEFIELD_DEFAULT_SIMPLE_ROOT, BATTLEFIELD_GENERATED_ROOT];
  const files = listBattlefieldJsonPaths(roots);

  if (files.length === 0) {
    console.log('[battlefield:svg] No battlefield JSON files found under data/battlefields.');
    return;
  }

  let rendered = 0;
  for (const file of files) {
    const exportData = loadBattlefieldExport(file);
    const battlefield = buildBattlefieldFromExport(exportData);
    const svgPath = file.replace(/\.json$/i, '.svg');
    writeBattlefieldSvgFile(svgPath, battlefield, {
      title: basename(file).replace(/\.json$/i, ''),
    });
    rendered++;
    console.log(`[battlefield:svg] ${svgPath}`);
  }

  console.log(`[battlefield:svg] Rendered ${rendered} battlefield SVG file(s).`);
}

main();

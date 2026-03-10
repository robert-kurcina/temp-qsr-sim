#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { type CanonicalGameSize } from '../src/lib/mest-tactics/mission/game-size-canonical';
import { type BattlefieldDensityConfig } from './shared/BattlefieldPaths';
import {
  parseBattlefieldGenerateArgs as parseBattlefieldGenerateCliArgs,
  type BattlefieldGenerateCliOptions,
} from './shared/BattlefieldGenerateCli';
import { printBattlefieldGenerateHelp } from './shared/BattlefieldGenerateHelp';
import { generateBattlefield } from './battlefield-generator';

export function parseBattlefieldGenerateArgs(argv: string[]): BattlefieldGenerateCliOptions {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  return parseBattlefieldGenerateCliArgs(argv, {
    onUnknownToken: token => {
      console.warn(`[battlefield:generate] Ignoring unrecognized token: ${token}`);
    },
  });
}

function toLayerArgs(densities: BattlefieldDensityConfig): string[] {
  return [
    `A${densities.area}`,
    `B${densities.buildings}`,
    `W${densities.walls}`,
    `R${densities.rocks}`,
    `S${densities.shrubs}`,
    `T${densities.trees}`,
  ];
}

function printHelp(): void {
  printBattlefieldGenerateHelp({
    title: 'battlefield:generate',
    usageLine: 'npm run battlefield:generate -- [GAME_SIZE ...] [A#] [B#] [W#] [R#] [S#] [T#] [options]',
    examples: [
      'npm run battlefield:generate -- VERY_SMALL',
      'npm run battlefield:generate -- VERY_SMALL SMALL A20 B40',
      'npm run battlefield:generate -- --game-sizes VERY_SMALL,LARGE A17 B73 W50',
    ],
  });
}

async function main(): Promise<void> {
  const options = parseBattlefieldGenerateArgs(process.argv.slice(2));
  const layerArgs = toLayerArgs(options.densities);

  for (const gameSize of options.gameSizes) {
    const result = await generateBattlefield({
      gameSize: gameSize as CanonicalGameSize,
      args: layerArgs,
      mode: options.mode,
      seed: options.seed,
    });

    if (!result.success) {
      console.error(`[battlefield:generate] Failed for ${gameSize}: ${result.error || 'unknown error'}`);
      continue;
    }

    console.log(`[battlefield:generate] ${gameSize}`);
    console.log(`  Config: ${result.battlefieldId.replace(`${gameSize}-`, '')}`);
    console.log(`  JSON:   ${result.jsonPath}`);
    console.log(`  SVG:    ${result.svgPath}`);
    console.log(`  Terrain placed: ${result.stats.totalTerrain}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error('[battlefield:generate] Fatal error:', error);
    process.exit(1);
  });
}

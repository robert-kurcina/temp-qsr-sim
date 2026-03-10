#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { exportBattlefield } from '../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { CANONICAL_GAME_SIZES } from '../src/lib/mest-tactics/mission/game-size-canonical';
import {
  BATTLEFIELD_DEFAULT_SIMPLE_ROOT,
  EMPTY_BATTLEFIELD_DENSITIES,
  ensureBattlefieldDirectories,
  formatBattlefieldDensityFilename,
  getGeneratedBattlefieldDir,
} from './shared/BattlefieldPaths';

const gameSizes = Object.keys(CANONICAL_GAME_SIZES);

function buildFilenameBase(gameSize: string): string {
  return `${gameSize}-${formatBattlefieldDensityFilename(EMPTY_BATTLEFIELD_DENSITIES)}`;
}

function createEmptyTerrainResult(width: number, height: number) {
  return placeTerrain({
    mode: 'balanced',
    density: 0,
    battlefieldWidth: width,
    battlefieldHeight: height,
    terrainTypes: [],
  });
}

function renderBattlefieldSvg(battlefield: Battlefield, gameSize: string): string {
  return SvgRenderer.render(battlefield, {
    width: battlefield.width,
    height: battlefield.height,
    title: `Default Simple Battlefield - ${gameSize}`,
    gridResolution: 0.5,
  });
}

function main(): void {
  ensureBattlefieldDirectories(gameSizes);

  for (const gameSize of gameSizes) {
    const canonical = CANONICAL_GAME_SIZES[gameSize as keyof typeof CANONICAL_GAME_SIZES];
    const battlefield = new Battlefield(canonical.battlefieldWidthMU, canonical.battlefieldHeightMU);
    const emptyTerrain = createEmptyTerrainResult(canonical.battlefieldWidthMU, canonical.battlefieldHeightMU);
    const filenameBase = buildFilenameBase(gameSize);
    const jsonFilename = `${filenameBase}.json`;
    const svgFilename = `${filenameBase}.svg`;

    const jsonPath = exportBattlefield(
      battlefield,
      emptyTerrain,
      BATTLEFIELD_DEFAULT_SIMPLE_ROOT,
      jsonFilename
    );

    const svg = renderBattlefieldSvg(battlefield, gameSize);
    const svgPath = join(BATTLEFIELD_DEFAULT_SIMPLE_ROOT, svgFilename);
    writeFileSync(svgPath, svg, 'utf-8');

    // Ensure the generated/{gameSize} directory exists ahead of custom generations.
    getGeneratedBattlefieldDir(gameSize);

    console.log(`[battlefield:defaults] ${gameSize}`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  SVG:  ${svgPath}`);
  }
}

main();

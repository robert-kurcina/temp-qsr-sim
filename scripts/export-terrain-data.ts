#!/usr/bin/env node
/**
 * Export Terrain Grid and Mesh Data
 * 
 * Generates JSON files with grid cells, Delaunay mesh, and terrain footprints
 * for use by the game engine and AI pathfinding systems.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { exportTerrainData, exportTerrainToJSON } from '../src/lib/mest-tactics/battlefield/terrain/TerrainGridExport';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';

const outputDir = join(process.cwd(), 'generated', 'terrain-data');
mkdirSync(outputDir, { recursive: true });

console.log('🗺️  Terrain Grid & Mesh Export\n');
console.log(`Output: ${outputDir}\n`);

// Generate max-coverage battlefield for export
const battlefieldSize = 36;
const terrainResult = placeTerrain({
  mode: 'balanced',
  density: 100,
  battlefieldSize: battlefieldSize,
  terrainTypes: [
    'Small Building', 'Medium Building',
    'Short Wall', 'Medium Wall',
    'Small Rocks', 'Medium Rocks', 'Large Rocks',
    'Shrub',
    'Tree',
    'Small Rough Patch', 'Medium Rough Patch', 'Large Rough Patch',
  ],
  areaDensity: 50,
  areaOverlapRatio: 0.20,
  structuresDensity: 100,
  structuresClearance: 0.5,
  rocksDensity: 100,
  rocksClearance: 0.5,
  shrubsDensity: 100,
  treesDensity: 100,
  treesOverlapRatio: 0.20,
  seed: 12345,  // Fixed seed for reproducibility
});

console.log(`Placed ${terrainResult.stats.placed} terrain features`);
console.log(`Rejected ${terrainResult.stats.rejected} (${terrainResult.stats.overlaps} overlaps)\n`);

// Create battlefield for Delaunay mesh
const battlefield = new Battlefield(battlefieldSize, battlefieldSize);
for (const terrainFeature of terrainResult.terrain) {
  battlefield.addTerrain(terrainFeature, true);
}
battlefield.finalizeTerrain();

// Export terrain data
console.log('Exporting terrain data...');
const terrainData = exportTerrainData(
  terrainResult.terrain,
  battlefieldSize,
  battlefieldSize,
  0.5  // 0.5 MU grid resolution
);

// Save full export
const fullPath = join(outputDir, 'terrain-full.json');
writeFileSync(fullPath, exportTerrainToJSON(terrainData), 'utf-8');
console.log(`✓ Full export: ${fullPath}`);

// Save grid-only (smaller file for runtime use)
const gridOnlyPath = join(outputDir, 'terrain-grid.json');
const gridData = {
  version: terrainData.version,
  exportedAt: terrainData.exportedAt,
  battlefield: terrainData.battlefield,
  grid: terrainData.grid,
  stats: terrainData.stats,
};
writeFileSync(gridOnlyPath, exportTerrainToJSON(gridData), 'utf-8');
console.log(`✓ Grid data: ${gridOnlyPath}`);

// Save terrain footprints only (for rendering)
const terrainOnlyPath = join(outputDir, 'terrain-footprints.json');
const terrainOnlyData = {
  version: terrainData.version,
  exportedAt: terrainData.exportedAt,
  battlefield: terrainData.battlefield,
  terrain: terrainData.terrain,
  stats: terrainData.stats,
};
writeFileSync(terrainOnlyPath, exportTerrainToJSON(terrainOnlyData), 'utf-8');
console.log(`✓ Terrain footprints: ${terrainOnlyPath}`);

// Print summary
console.log('\n═══════════════════════════════════════════════════════════');
console.log('Terrain Export Summary');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Battlefield: ${battlefieldSize}×${battlefieldSize} MU (${terrainData.battlefield.area} sq MU)`);
console.log(`Grid: ${terrainData.grid.width}×${terrainData.grid.height} cells (${terrainData.grid.cells.length} total)`);
console.log(`Cell size: ${terrainData.grid.cellSize} MU`);
console.log();
console.log('Coverage:');
console.log(`  Covered: ${terrainData.stats.coveredCells} cells (${(terrainData.stats.coverageRatio * 100).toFixed(1)}%)`);
console.log(`  Uncovered: ${terrainData.stats.totalCells - terrainData.stats.coveredCells} cells (${(terrainData.stats.uncoveredRatio * 100).toFixed(1)}%)`);
console.log();
console.log('By Category:');
for (const [category, data] of Object.entries(terrainData.stats.byCategory)) {
  if (category !== 'clear') {
    console.log(`  ${category}: ${data.cells} cells (${(data.ratio * 100).toFixed(1)}%)`);
  }
}
console.log();
console.log('Terrain Features:');
const byType = new Map<string, number>();
for (const t of terrainData.terrain) {
  byType.set(t.type, (byType.get(t.type) || 0) + 1);
}
for (const [type, count] of Array.from(byType.entries()).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}
console.log();
console.log('Files Generated:');
console.log(`  terrain-full.json       - Complete data (grid + mesh + terrain)`);
console.log(`  terrain-grid.json       - Grid cells only (for pathfinding)`);
console.log(`  terrain-footprints.json - Terrain polygons only (for rendering)`);
console.log('═══════════════════════════════════════════════════════════');

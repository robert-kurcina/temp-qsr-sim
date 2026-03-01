#!/usr/bin/env node
/**
 * Generate SVG visualization of area terrain placement
 * 
 * Uses existing TerrainPlacement and SvgRenderer to show
 * rough patch placement with overlap.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';

const outputDir = join(process.cwd(), 'generated', 'area-terrain-demo');
mkdirSync(outputDir, { recursive: true });

console.log('🗺️  Area Terrain Placement Demo\n');
console.log(`Output: ${outputDir}\n`);

// Demo configurations
const demos = [
  { name: 'low-density', size: 24, density: 20, description: '20% density - sparse coverage' },
  { name: 'medium-density', size: 24, density: 50, description: '50% density - moderate coverage' },
  { name: 'high-density', size: 24, density: 80, description: '80% density - heavy coverage' },
  { name: 'overlap-demo', size: 36, density: 60, description: '36×36 MU with 60% density showing overlap' },
];

for (const demo of demos) {
  console.log(`Generating: ${demo.name} (${demo.size}×${demo.size} MU, ${demo.density}% density)`);
  console.log(`  ${demo.description}`);

  // Place terrain using layered placement - Area Terrain ONLY for this demo
  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: demo.density,
    battlefieldSize: demo.size,
    terrainTypes: [
      'Small Rough Patch',
      'Medium Rough Patch', 
      'Large Rough Patch',
    ],
    areaDensity: demo.density,
    areaOverlapRatio: 0.20,
    seed: Math.floor(Math.random() * 1000000),
  });

  // Create battlefield
  const battlefield = new Battlefield(demo.size, demo.size);
  
  // Add terrain to battlefield
  for (const terrainFeature of terrainResult.terrain) {
    battlefield.addTerrain(terrainFeature, true);
  }
  battlefield.finalizeTerrain();

  // Export SVG - Area Terrain layer ONLY
  const svg = SvgRenderer.render(battlefield, {
    width: demo.size,
    height: demo.size,
    gridResolution: 0.5,
    title: `${demo.name.toUpperCase()}: ${demo.description}`,
    layers: [
      { id: 'area', label: 'Area Terrain (Rough)', enabled: true },
      { id: 'grid', label: '0.5 MU Grid', enabled: false },
      { id: 'tree', label: 'Trees', enabled: false },
      { id: 'rocks', label: 'Rocks', enabled: false },
      { id: 'shrub', label: 'Shrubs', enabled: false },
      { id: 'delaunay', label: 'Delaunay Mesh', enabled: false },
      { id: 'building', label: 'Buildings', enabled: false },
      { id: 'wall', label: 'Walls', enabled: false },
      { id: 'terrain', label: 'Other Terrain', enabled: false },
    ],
  });

  const svgPath = join(outputDir, `area-terrain-${demo.name}.svg`);
  writeFileSync(svgPath, svg, 'utf-8');

  console.log(`  ✓ Placed: ${terrainResult.stats.placed} rough patches`);
  console.log(`  ✓ Rejected: ${terrainResult.stats.rejected} (${terrainResult.stats.overlaps} overlaps)`);
  console.log(`  ✓ SVG: ${svgPath}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Generated ${demos.length} area terrain demonstrations`);
console.log(`   Location: ${outputDir}`);
console.log('');
console.log('Open any SVG file to visualize area terrain placement.');
console.log('Area terrain (rough patches) rendered in brown/tan colors.');
console.log('═══════════════════════════════════════════════════════════');

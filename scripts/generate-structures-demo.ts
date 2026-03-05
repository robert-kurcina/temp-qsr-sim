#!/usr/bin/env node
/**
 * Generate SVG visualization of structures layer placement
 * 
 * Uses existing TerrainPlacement and SvgRenderer to show
 * building and wall placement with clearance rules.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';

const outputDir = join(process.cwd(), 'generated', 'structures-demo');
mkdirSync(outputDir, { recursive: true });

console.log('🏗️  Structures Layer Placement Demo\n');
console.log(`Output: ${outputDir}\n`);

// Demo configurations
const demos = [
  { name: 'low-density', size: 24, density: 20, description: '20% density - sparse structures' },
  { name: 'medium-density', size: 24, density: 50, description: '50% density - moderate structures' },
  { name: 'high-density', size: 24, density: 80, description: '80% density - heavy structures' },
  { name: 'clearance-demo', size: 36, density: 60, description: '36×36 MU with 1 MU clearance' },
];

for (const demo of demos) {
  console.log(`Generating: ${demo.name} (${demo.size}×${demo.size} MU, ${demo.density}% density)`);
  console.log(`  ${demo.description}`);

  // Place terrain using layered placement - Structures ONLY for this demo
  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: demo.density,
    battlefieldWidth: demo.size,
    battlefieldHeight: demo.size,
    terrainTypes: [
      'Small Building',
      'Medium Building',
      'Short Wall',
      'Medium Wall',
    ],
    structuresDensity: demo.density,
    structuresClearance: 0.5,  // Reduced to 0.5 MU for better coverage
    seed: Math.floor(Math.random() * 1000000),
  });

  // Create battlefield
  const battlefield = new Battlefield(demo.size, demo.size);
  
  // Add terrain to battlefield
  for (const terrainFeature of terrainResult.terrain) {
    battlefield.addTerrain(terrainFeature, true);
  }
  battlefield.finalizeTerrain();

  // Export SVG - Structures layer ONLY
  const svg = SvgRenderer.render(battlefield, {
    width: demo.size,
    height: demo.size,
    gridResolution: 0.5,
    title: `${demo.name.toUpperCase()}: ${demo.description}`,
    layers: [
      { id: 'building', label: 'Buildings', enabled: true },
      { id: 'wall', label: 'Walls', enabled: true },
      { id: 'grid', label: '0.5 MU Grid', enabled: false },
      { id: 'area', label: 'Area Terrain', enabled: false },
      { id: 'tree', label: 'Trees', enabled: false },
      { id: 'rocks', label: 'Rocks', enabled: false },
      { id: 'shrub', label: 'Shrubs', enabled: false },
      { id: 'delaunay', label: 'Delaunay Mesh', enabled: false },
      { id: 'terrain', label: 'Other Terrain', enabled: false },
    ],
  });

  const svgPath = join(outputDir, `structures-${demo.name}.svg`);
  writeFileSync(svgPath, svg, 'utf-8');

  console.log(`  ✓ Placed: ${terrainResult.stats.placed} structures`);
  console.log(`  ✓ Rejected: ${terrainResult.stats.rejected} (${terrainResult.stats.overlaps} clearance violations)`);
  console.log(`  ✓ SVG: ${svgPath}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Generated ${demos.length} structures layer demonstrations`);
console.log(`   Location: ${outputDir}`);
console.log('');
console.log('Open any SVG file to visualize structures placement.');
console.log('Buildings rendered in black, walls in gray.');
console.log('═══════════════════════════════════════════════════════════');

#!/usr/bin/env node
/**
 * Generate SVG visualization of rocks layer placement
 * 
 * Uses existing TerrainPlacement and SvgRenderer to show
 * rock placement with structure overlap rules.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';

const outputDir = join(process.cwd(), 'generated', 'rocks-demo');
mkdirSync(outputDir, { recursive: true });

console.log('🪨  Rocks Layer Placement Demo\n');
console.log(`Output: ${outputDir}\n`);

// Demo configurations
const demos = [
  { name: 'low-density', size: 24, density: 20, description: '20% density - sparse rocks' },
  { name: 'medium-density', size: 24, density: 50, description: '50% density - moderate rocks' },
  { name: 'high-density', size: 24, density: 80, description: '80% density - heavy rocks' },
  { name: 'with-structures', size: 36, density: 100, description: '36×36 MU at 100% rocks density' },
];

for (const demo of demos) {
  console.log(`Generating: ${demo.name} (${demo.size}×${demo.size} MU, ${demo.density}% density)`);
  console.log(`  ${demo.description}`);

  // Place terrain using layered placement - Rocks + Structures for this demo
  const terrainTypes = demo.name === 'with-structures'
    ? ['Small Building', 'Medium Building', 'Short Wall', 'Medium Wall', 'Small Rocks', 'Medium Rocks', 'Large Rocks']
    : ['Small Rocks', 'Medium Rocks', 'Large Rocks'];

  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: demo.density,
    battlefieldSize: demo.size,
    terrainTypes: terrainTypes,
    structuresDensity: demo.name === 'with-structures' ? 50 : 0,
    structuresClearance: 0.5,
    rocksDensity: demo.density,  // 100% for max density test
    rocksClearance: 0.5,
    seed: Math.floor(Math.random() * 1000000),
  });

  // Calculate coverage statistics
  const battlefieldArea = demo.size * demo.size;
  const structuresArea = terrainResult.terrain
    .filter(t => t.meta?.category === 'building' || t.meta?.category === 'wall')
    .reduce((sum, t) => {
      const bounds = t.vertices;
      const minX = Math.min(...bounds.map(v => v.x));
      const maxX = Math.max(...bounds.map(v => v.x));
      const minY = Math.min(...bounds.map(v => v.y));
      const maxY = Math.max(...bounds.map(v => v.y));
      return sum + (maxX - minX) * (maxY - minY);
    }, 0);
  
  const rocksArea = terrainResult.terrain
    .filter(t => t.meta?.category === 'rocks')
    .reduce((sum, t) => {
      const bounds = t.vertices;
      const minX = Math.min(...bounds.map(v => v.x));
      const maxX = Math.max(...bounds.map(v => v.x));
      const minY = Math.min(...bounds.map(v => v.y));
      const maxY = Math.max(...bounds.map(v => v.y));
      return sum + (maxX - minX) * (maxY - minY);
    }, 0);

  const totalCoveredArea = structuresArea + rocksArea;
  const uncoveredArea = battlefieldArea - totalCoveredArea;
  const coveragePercent = (totalCoveredArea / battlefieldArea) * 100;

  if (demo.name === 'with-structures') {
    console.log(`  Battlefield: ${battlefieldArea} sq MU`);
    console.log(`  Structures: ${structuresArea.toFixed(1)} sq MU (${(structuresArea/battlefieldArea*100).toFixed(1)}%)`);
    console.log(`  Rocks: ${rocksArea.toFixed(1)} sq MU (${(rocksArea/battlefieldArea*100).toFixed(1)}%)`);
    console.log(`  Total Covered: ${totalCoveredArea.toFixed(1)} sq MU (${coveragePercent.toFixed(1)}%)`);
    console.log(`  Uncovered: ${uncoveredArea.toFixed(1)} sq MU (${(100-coveragePercent).toFixed(1)}%)`);
    console.log(`  → At 100% rocks density, this is the MAXIMUM achievable coverage`);
  }

  // Create battlefield
  const battlefield = new Battlefield(demo.size, demo.size);
  
  // Add terrain to battlefield
  for (const terrainFeature of terrainResult.terrain) {
    battlefield.addTerrain(terrainFeature, true);
  }
  battlefield.finalizeTerrain();

  // Export SVG - Rocks and Structures layers only, with clearance zones and covered cells
  const svg = SvgRenderer.render(battlefield, {
    width: demo.size,
    height: demo.size,
    gridResolution: 0.5,
    title: `${demo.name.toUpperCase()}: ${demo.description}`,
    showClearanceZones: true,  // Show red clearance zone outlines
    clearanceZoneColor: '#ff0000',
    showCoveredCells: true,    // Show grid cells covered by terrain
    coveredCellColor: '#90EE90',
    layers: [
      { id: 'rocks', label: 'Rocks', enabled: true },
      { id: 'building', label: 'Buildings', enabled: demo.name === 'with-structures' },
      { id: 'wall', label: 'Walls', enabled: demo.name === 'with-structures' },
      { id: 'clearance', label: 'Clearance (0.5 MU)', enabled: true },
      { id: 'grid', label: '0.5 MU Grid', enabled: true },
      { id: 'area', label: 'Area Terrain', enabled: false },
      { id: 'tree', label: 'Trees', enabled: false },
      { id: 'shrub', label: 'Shrubs', enabled: false },
      { id: 'delaunay', label: 'Delaunay Mesh', enabled: false },
      { id: 'terrain', label: 'Other Terrain', enabled: false },
    ],
  });

  const svgPath = join(outputDir, `rocks-${demo.name}.svg`);
  writeFileSync(svgPath, svg, 'utf-8');

  console.log(`  ✓ Placed: ${terrainResult.stats.placed} terrain`);
  console.log(`  ✓ Rejected: ${terrainResult.stats.rejected} (${terrainResult.stats.overlaps} overlaps)`);
  console.log(`  ✓ SVG: ${svgPath}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Generated ${demos.length} rocks layer demonstrations`);
console.log(`   Location: ${outputDir}`);
console.log('');
console.log('Open any SVG file to visualize rocks placement.');
console.log('Rocks rendered in light gray, structures in black/gray.');
console.log('═══════════════════════════════════════════════════════════');

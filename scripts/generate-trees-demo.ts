#!/usr/bin/env node
/**
 * Generate SVG visualization of trees layer placement
 * 
 * Uses existing TerrainPlacement and SvgRenderer to show
 * tree placement with 20% overlap allowance.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';

const outputDir = join(process.cwd(), 'generated', 'trees-demo');
mkdirSync(outputDir, { recursive: true });

console.log('🌳  Trees Layer Placement Demo\n');
console.log(`Output: ${outputDir}\n`);

// Demo configurations
const demos = [
  { name: 'low-density', size: 24, density: 20, description: '20% density - sparse trees' },
  { name: 'medium-density', size: 24, density: 50, description: '50% density - moderate trees' },
  { name: 'high-density', size: 24, density: 80, description: '80% density - heavy trees' },
  { name: 'max-coverage', size: 36, density: 100, description: '100% trees + all other layers' },
];

for (const demo of demos) {
  console.log(`Generating: ${demo.name} (${demo.size}×${demo.size} MU, ${demo.density}% density)`);
  console.log(`  ${demo.description}`);

  // Place terrain using layered placement - Trees + all other layers for max-coverage demo
  const terrainTypes = demo.name === 'max-coverage'
    ? ['Small Building', 'Medium Building', 'Short Wall', 'Medium Wall', 'Small Rocks', 'Medium Rocks', 'Large Rocks', 'Shrub', 'Tree']
    : ['Tree'];

  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: demo.density,
    battlefieldSize: demo.size,
    terrainTypes: terrainTypes,
    structuresDensity: demo.name === 'max-coverage' ? 100 : 0,
    structuresClearance: 0.5,
    rocksDensity: demo.name === 'max-coverage' ? 100 : 0,
    rocksClearance: 0.5,
    shrubsDensity: demo.name === 'max-coverage' ? 100 : 0,
    treesDensity: demo.density,  // 100% for max density test
    treesOverlapRatio: 0.20,  // 20% overlap allowed
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

  const shrubsArea = terrainResult.terrain
    .filter(t => t.meta?.category === 'shrub')
    .reduce((sum, t) => {
      const bounds = t.vertices;
      const minX = Math.min(...bounds.map(v => v.x));
      const maxX = Math.max(...bounds.map(v => v.x));
      const minY = Math.min(...bounds.map(v => v.y));
      const maxY = Math.max(...bounds.map(v => v.y));
      return sum + (maxX - minX) * (maxY - minY);
    }, 0);

  const treesArea = terrainResult.terrain
    .filter(t => t.meta?.category === 'tree')
    .reduce((sum, t) => {
      const bounds = t.vertices;
      const minX = Math.min(...bounds.map(v => v.x));
      const maxX = Math.max(...bounds.map(v => v.x));
      const minY = Math.min(...bounds.map(v => v.y));
      const maxY = Math.max(...bounds.map(v => v.y));
      return sum + (maxX - minX) * (maxY - minY);
    }, 0);

  const totalCoveredArea = structuresArea + rocksArea + shrubsArea + treesArea;
  const uncoveredArea = battlefieldArea - totalCoveredArea;
  const coveragePercent = (totalCoveredArea / battlefieldArea) * 100;

  if (demo.name === 'max-coverage') {
    console.log(`  Battlefield: ${battlefieldArea} sq MU`);
    console.log(`  Structures: ${structuresArea.toFixed(1)} sq MU (${(structuresArea/battlefieldArea*100).toFixed(1)}%)`);
    console.log(`  Rocks: ${rocksArea.toFixed(1)} sq MU (${(rocksArea/battlefieldArea*100).toFixed(1)}%)`);
    console.log(`  Shrubs: ${shrubsArea.toFixed(1)} sq MU (${(shrubsArea/battlefieldArea*100).toFixed(1)}%)`);
    console.log(`  Trees: ${treesArea.toFixed(1)} sq MU (${(treesArea/battlefieldArea*100).toFixed(1)}%)`);
    console.log(`  Total Covered: ${totalCoveredArea.toFixed(1)} sq MU (${coveragePercent.toFixed(1)}%)`);
    console.log(`  Uncovered: ${uncoveredArea.toFixed(1)} sq MU (${(100-coveragePercent).toFixed(1)}%)`);
    console.log(`  → At 100% density for ALL layers, this is the ABSOLUTE MAXIMUM coverage`);
  }

  // Create battlefield
  const battlefield = new Battlefield(demo.size, demo.size);
  
  // Add terrain to battlefield
  for (const terrainFeature of terrainResult.terrain) {
    battlefield.addTerrain(terrainFeature, true);
  }
  battlefield.finalizeTerrain();

  // Export SVG - All layers with covered cells
  const svg = SvgRenderer.render(battlefield, {
    width: demo.size,
    height: demo.size,
    gridResolution: 0.5,
    title: `${demo.name.toUpperCase()}: ${demo.description}`,
    showClearanceZones: demo.name === 'max-coverage',
    clearanceZoneColor: '#ff0000',
    showCoveredCells: true,
    coveredCellColor: '#90EE90',
    layers: [
      { id: 'tree', label: 'Trees', enabled: true },
      { id: 'shrub', label: 'Shrubs', enabled: demo.name === 'max-coverage' },
      { id: 'rocks', label: 'Rocks', enabled: demo.name === 'max-coverage' },
      { id: 'building', label: 'Buildings', enabled: demo.name === 'max-coverage' },
      { id: 'wall', label: 'Walls', enabled: demo.name === 'max-coverage' },
      { id: 'clearance', label: 'Clearance (0.5 MU)', enabled: demo.name === 'max-coverage' },
      { id: 'grid', label: '0.5 MU Grid', enabled: true },
      { id: 'area', label: 'Area Terrain', enabled: false },
      { id: 'delaunay', label: 'Delaunay Mesh', enabled: false },
      { id: 'terrain', label: 'Other Terrain', enabled: false },
    ],
  });

  const svgPath = join(outputDir, `trees-${demo.name}.svg`);
  writeFileSync(svgPath, svg, 'utf-8');

  console.log(`  ✓ Placed: ${terrainResult.stats.placed} terrain`);
  console.log(`  ✓ Rejected: ${terrainResult.stats.rejected} (${terrainResult.stats.overlaps} overlaps)`);
  console.log(`  ✓ SVG: ${svgPath}`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Generated ${demos.length} trees layer demonstrations`);
console.log(`   Location: ${outputDir}`);
console.log('');
console.log('Open any SVG file to visualize trees placement.');
console.log('Trees rendered in light green, can overlap by 20%.');
console.log('═══════════════════════════════════════════════════════════');

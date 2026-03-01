#!/usr/bin/env node
/**
 * Generate Test Battlefields
 * 
 * Generates 30 battlefields for testing the battlefield audit dashboard.
 * 2 battles per game size at 3 density ratios (20, 50, 80).
 * 
 * Total: 5 game sizes × 3 densities × 2 battles = 30 battles
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeTerrain } from '../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { SvgRenderer } from '../src/lib/mest-tactics/battlefield/rendering/SvgRenderer';
import { Battlefield } from '../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { exportBattlefield } from '../src/lib/mest-tactics/battlefield/BattlefieldExporter';

const GAME_SIZES = [
  { name: 'VERY_SMALL', size: 24 },
  { name: 'SMALL', size: 36 },
  { name: 'MEDIUM', size: 48 },
  { name: 'LARGE', size: 60 },
  { name: 'VERY_LARGE', size: 72 },
];

const DENSITIES = [50];  // Just test 50% density
const BATTLES_PER_CONFIG = 1;

const outputDir = join(process.cwd(), 'generated', 'test-battlefields');
mkdirSync(outputDir, { recursive: true });

console.log('🗺️  Generating Test Battlefields\n');
console.log(`Output: ${outputDir}\n`);

let totalGenerated = 0;

for (const gameSize of GAME_SIZES) {
  for (const density of DENSITIES) {
    for (let battle = 1; battle <= BATTLES_PER_CONFIG; battle++) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const battleId = `${gameSize.name}-${density}-${battle}`;

      console.log(`Generating: ${battleId} (${gameSize.size}×${gameSize.size} MU, ${density}% density)`);

      // Generate terrain with layered placement
      const terrainResult = placeTerrain({
        mode: 'balanced',
        density: density,
        battlefieldSize: gameSize.size,
        terrainTypes: ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks', 'Small Rough Patch', 'Medium Rough Patch', 'Large Rough Patch'],
        seed: Math.floor(Math.random() * 1000000),
      });

      // Create battlefield
      const battlefield = new Battlefield(gameSize.size, gameSize.size);
      for (const terrainFeature of terrainResult.terrain) {
        const centroid = getCentroid(terrainFeature.vertices);
        const typeLower = (terrainFeature.id || terrainFeature.type || 'Tree').toLowerCase();
        let terrainName = 'Tree';

        if (typeLower.includes('shrub') || typeLower.includes('bush')) {
          terrainName = 'Shrub';
        } else if (typeLower.includes('rock')) {
          terrainName = Math.random() > 0.5 ? 'Small Rocks' : 'Medium Rocks';
        } else if (typeLower.includes('tree')) {
          terrainName = 'Tree';
        } else if (typeLower.includes('small building')) {
          terrainName = 'Small Building';
        } else if (typeLower.includes('building')) {
          terrainName = 'Medium Building';
        } else if (typeLower.includes('short wall')) {
          terrainName = 'Short Wall';
        } else if (typeLower.includes('wall')) {
          terrainName = 'Medium Wall';
        } else if (typeLower.includes('small rough')) {
          terrainName = 'Small Rough Patch';
        } else if (typeLower.includes('medium rough')) {
          terrainName = 'Medium Rough Patch';
        } else if (typeLower.includes('large rough')) {
          terrainName = 'Large Rough Patch';
        }

        const rotation = Math.floor(Math.random() * 360);
        battlefield.addTerrainElement(new TerrainElement(terrainName, centroid, rotation));
      }

      // Export battlefield.json
      const battlefieldJsonPath = join(outputDir, `battlefield-${battleId}.json`);
      const exportedPath = exportBattlefieldToFile(battlefield, terrainResult, outputDir, `battlefield-${battleId}.json`);

      // Export SVG
      const svg = SvgRenderer.render(battlefield, {
        width: gameSize.size,
        height: gameSize.size,
        gridResolution: 0.5,
        title: `${gameSize.name} - ${density}% Density`,
        layers: [
          { id: 'deployment', label: 'Deployment Zones', enabled: true },
          { id: 'grid', label: '0.5 MU Grid', enabled: true },
          { id: 'area', label: 'Area Terrain', enabled: true },
          { id: 'building', label: 'Buildings', enabled: true },
          { id: 'wall', label: 'Walls', enabled: true },
          { id: 'tree', label: 'Trees', enabled: true },
          { id: 'rocks', label: 'Rocks', enabled: true },
          { id: 'shrub', label: 'Shrubs', enabled: true },
          { id: 'delaunay', label: 'Delaunay Mesh', enabled: true },
        ],
      });

      const svgPath = join(outputDir, `battlefield-${battleId}.svg`);
      writeFileSync(svgPath, svg, 'utf-8');

      console.log(`  ✓ ${battleId}`);
      totalGenerated++;
    }
    console.log('');
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Generated ${totalGenerated} test battlefields`);
console.log(`   Location: ${outputDir}`);
console.log('');
console.log('Files per battlefield:');
console.log('  - battlefield-*.json  (terrain + mesh data)');
console.log('  - battlefield-*.svg   (visualization)');
console.log('═══════════════════════════════════════════════════════════');

function getCentroid(vertices) {
  if (!vertices || vertices.length === 0) return { x: 0, y: 0 };
  let x = 0, y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }
  return { x: x / vertices.length, y: y / vertices.length };
}

function exportBattlefieldToFile(battlefield, terrainResult, outputPath, filename) {
  const filePath = join(outputPath, filename);
  const exportData = buildBattlefieldExport(battlefield, terrainResult);
  writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  return filePath;
}

function buildBattlefieldExport(battlefield, terrainResult) {
  const terrainTypes = extractTerrainTypes(terrainResult.terrain);
  const terrainInstances = terrainResult.terrain.map(feature => ({
    typeRef: feature.meta?.name || feature.id || 'Unknown',
    position: {
      x: feature.vertices[0]?.x || 0,
      y: feature.vertices[0]?.y || 0,
    },
    rotation: feature.meta?.rotationDegrees || 0,
    vertices: feature.vertices.map(v => ({ x: v.x, y: v.y })),
    meta: feature.meta,  // Include meta for layer identification
  }));

  const delaunayMesh = extractDelaunayMesh(battlefield);
  
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    dimensions: {
      width: battlefield.width,
      height: battlefield.height,
    },
    terrainTypes,
    terrainInstances,
    delaunayMesh,
    stats: {
      placed: terrainResult.stats.placed,
      density: terrainResult.stats.placed / (battlefield.width * battlefield.height) * 100,
      fitnessScore: terrainResult.fitness?.score,
    },
    metadata: {
      seed: terrainResult.stats.seed,
      mode: 'balanced',
      generator: 'Test Battlefield Generator v1.0',
    },
  };
}

function extractTerrainTypes(terrain) {
  const types = {};
  const defaultTypes = {
    'Tree': { name: 'Tree', los: 'blocking', movement: 'impassable', cover: 'hard', baseSize: 1.5 },
    'Shrub': { name: 'Shrub', los: 'soft', movement: 'difficult', cover: 'soft', baseSize: 1.0 },
    'Small Rocks': { name: 'Small Rocks', los: 'clear', movement: 'difficult', cover: 'soft', baseSize: 1.0 },
    'Medium Rocks': { name: 'Medium Rocks', los: 'clear', movement: 'difficult', cover: 'soft', baseSize: 1.5 },
    'Large Rocks': { name: 'Large Rocks', los: 'clear', movement: 'difficult', cover: 'soft', baseSize: 2.0 },
  };
  
  const usedTypes = new Set(terrain.map(f => f.type));
  for (const typeName of usedTypes) {
    if (defaultTypes[typeName]) {
      types[typeName] = defaultTypes[typeName];
    } else {
      types[typeName] = { name: typeName, los: 'clear', movement: 'normal', cover: 'none', baseSize: 1.0 };
    }
  }
  
  return types;
}

function extractDelaunayMesh(battlefield) {
  const navMesh = battlefield.getNavMesh();
  
  if (!navMesh) {
    return { vertices: [], triangles: [] };
  }
  
  const vertices = Array.from(navMesh.points).map(p => ({ x: p.x, y: p.y }));
  const triangles = [];
  const numTriangles = navMesh.triangles.length / 3;
  
  for (let i = 0; i < numTriangles; i++) {
    const i0 = navMesh.triangles[i * 3];
    const i1 = navMesh.triangles[i * 3 + 1];
    const i2 = navMesh.triangles[i * 3 + 2];
    
    if (i0 >= 0 && i1 >= 0 && i2 >= 0) {
      triangles.push([i0, i1, i2]);
    }
  }
  
  return { vertices, triangles };
}

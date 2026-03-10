import { mkdirSync } from 'node:fs';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { TerrainElement } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { placeTerrain, type TerrainPlacementResult } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { exportBattlefield, loadBattlefieldFromFile } from '../../../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import type { MissionDeploymentType } from '../../../src/lib/mest-tactics/missions/mission-deployment';
import { getGeneratedBattlefieldDir } from '../../shared/BattlefieldPaths';

export type { TerrainPlacementResult };

export interface CreateBattlefieldResult {
  battlefield: Battlefield;
  terrainResult: TerrainPlacementResult;
  exportPath: string | null;
}

export function createBattlefieldWithTerrain(
  width: number,
  height: number,
  densityRatio: number,
  gameSizeSegment: string
): CreateBattlefieldResult {
  const battlefield = new Battlefield(width, height);
  const clampedDensity = Math.max(0, Math.min(100, densityRatio));
  const terrainTypes = clampedDensity <= 0
    ? []
    : ['Tree', 'Shrub', 'Small Rocks', 'Medium Rocks', 'Large Rocks'];

  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: clampedDensity,
    battlefieldWidth: width,
    battlefieldHeight: height,
    terrainTypes,
    areaDensity: 0,
    rocksDensity: clampedDensity,
    shrubsDensity: clampedDensity,
    treesDensity: clampedDensity,
  });

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
    }

    const rotation = Math.floor(Math.random() * 360);
    battlefield.addTerrainElement(new TerrainElement(terrainName, centroid, rotation));
  }

  const exportPath = exportBattlefieldToGenerated(battlefield, terrainResult, gameSizeSegment);
  return {
    battlefield,
    terrainResult,
    exportPath,
  };
}

export function loadBattlefieldFromPath(filePath: string): Battlefield {
  return loadBattlefieldFromFile(filePath);
}

export function deployModels(
  assembly: { characters: Character[] },
  battlefield: Battlefield,
  sideIndex: number,
  battlefieldWidth: number,
  battlefieldHeight: number,
  deploymentDepth: number,
  deploymentType: MissionDeploymentType
): void {
  const zone = getDeploymentBoundsForSide(
    sideIndex,
    battlefieldWidth,
    battlefieldHeight,
    deploymentDepth,
    deploymentType
  );
  const count = assembly.characters.length;
  const zoneWidth = zone.maxX - zone.minX + 1;
  const zoneHeight = zone.maxY - zone.minY + 1;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * (zoneWidth / Math.max(1, zoneHeight)))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const xSpacing = cols > 1 ? (zoneWidth - 1) / (cols - 1) : 0;
  const ySpacing = rows > 1 ? (zoneHeight - 1) / (rows - 1) : 0;

  assembly.characters.forEach((character, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;

    const x = zone.minX + col * xSpacing;
    const y = zone.minY + row * ySpacing;
    const preferred = {
      x: Math.max(zone.minX, Math.min(zone.maxX, Math.round(x))),
      y: Math.max(zone.minY, Math.min(zone.maxY, Math.round(y))),
    };
    const fallbackRadius = Math.max(2, Math.ceil(Math.sqrt(count)));
    const deploymentCell = findOpenCellNear(preferred, battlefield, fallbackRadius, zone);
    if (!deploymentCell) {
      throw new Error(`Unable to deploy model ${character.id} at side index ${sideIndex}.`);
    }
    battlefield.placeCharacter(character, deploymentCell);
  });
}

export function getDeploymentBoundsForSide(
  sideIndex: number,
  battlefieldWidth: number,
  battlefieldHeight: number,
  deploymentDepth: number,
  deploymentType: MissionDeploymentType
): { minX: number; maxX: number; minY: number; maxY: number } {
  const zoneDepth = Math.max(1, Math.floor(deploymentDepth));
  if (deploymentType === 'corners') {
    const depthX = Math.min(zoneDepth, battlefieldWidth);
    const depthY = Math.min(zoneDepth, battlefieldHeight);
    const corner = sideIndex % 4;

    if (corner === 0) {
      return {
        minX: 0,
        maxX: depthX - 1,
        minY: 0,
        maxY: depthY - 1,
      };
    }

    if (corner === 1) {
      return {
        minX: battlefieldWidth - depthX,
        maxX: battlefieldWidth - 1,
        minY: battlefieldHeight - depthY,
        maxY: battlefieldHeight - 1,
      };
    }

    if (corner === 2) {
      return {
        minX: battlefieldWidth - depthX,
        maxX: battlefieldWidth - 1,
        minY: 0,
        maxY: depthY - 1,
      };
    }

    return {
      minX: 0,
      maxX: depthX - 1,
      minY: battlefieldHeight - depthY,
      maxY: battlefieldHeight - 1,
    };
  }

  const edgeOrder = battlefieldWidth >= battlefieldHeight
    ? ['north', 'south', 'west', 'east']
    : ['west', 'east', 'north', 'south'];
  const edge = edgeOrder[sideIndex % edgeOrder.length];

  if (edge === 'north') {
    return {
      minX: 0,
      maxX: battlefieldWidth - 1,
      minY: 0,
      maxY: Math.min(battlefieldHeight - 1, zoneDepth - 1),
    };
  }

  if (edge === 'south') {
    const minY = Math.max(0, battlefieldHeight - zoneDepth);
    return {
      minX: 0,
      maxX: battlefieldWidth - 1,
      minY,
      maxY: battlefieldHeight - 1,
    };
  }

  if (edge === 'west') {
    return {
      minX: 0,
      maxX: Math.min(battlefieldWidth - 1, zoneDepth - 1),
      minY: 0,
      maxY: battlefieldHeight - 1,
    };
  }

  const minX = Math.max(0, battlefieldWidth - zoneDepth);
  return {
    minX,
    maxX: battlefieldWidth - 1,
    minY: 0,
    maxY: battlefieldHeight - 1,
  };
}

export function findOpenCellNear(
  preferred: Position,
  battlefield: Battlefield,
  maxRadius: number,
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
): Position | null {
  const cx = Math.max(0, Math.min(battlefield.width - 1, Math.round(preferred.x)));
  const cy = Math.max(0, Math.min(battlefield.height - 1, Math.round(preferred.y)));

  for (let radius = 0; radius <= maxRadius; radius++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
          continue;
        }
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= battlefield.width || y < 0 || y >= battlefield.height) {
          continue;
        }
        if (bounds && (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY)) {
          continue;
        }
        if (!battlefield.getCharacterAt({ x, y })) {
          return { x, y };
        }
      }
    }
  }
  return null;
}

export function getCentroid(vertices: Position[]): Position {
  if (!vertices || vertices.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const vertex of vertices) {
    x += vertex.x;
    y += vertex.y;
  }
  return { x: x / vertices.length, y: y / vertices.length };
}

function exportBattlefieldToGenerated(
  battlefield: Battlefield,
  terrainResult: TerrainPlacementResult,
  gameSizeSegment: string
): string | null {
  try {
    const outputDir = getGeneratedBattlefieldDir(gameSizeSegment);
    mkdirSync(outputDir, { recursive: true });
    const filePath = exportBattlefield(battlefield, terrainResult, outputDir);
    console.log(`🗺️  Battlefield exported: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('⚠️  Failed to export battlefield:', error);
    return null;
  }
}

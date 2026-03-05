/**
 * Deployment Helper
 *
 * Utilities for model deployment and battlefield setup.
 * Handles assembly creation, terrain placement, and model positioning.
 */

import { Character } from '../../../src/lib/mest-tactics/core/Character';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainType } from '../../../src/lib/mest-tactics/battlefield/terrain/Terrain';
import { TerrainElement } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { placeTerrain, type TerrainPlacementResult } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainPlacement';
import { exportBattlefield, getBattlefieldReference } from '../../../src/lib/mest-tactics/battlefield/BattlefieldExporter';
import { Position } from '../../../src/lib/mest-tactics/battlefield/Position';
import { buildAssembly, buildProfile, type GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { SideConfig } from '../../shared/BattleReportTypes';

export interface DeploymentConfig {
  gameSize: GameSize;
  battlefieldSize: number;
  densityRatio: number;
  seed?: number;
}

export interface AssemblyResult {
  characters: Character[];
  totalBP: number;
}

export async function createAssembly(
  sideConfig: SideConfig
): Promise<AssemblyResult> {
  const characters: Character[] = [];
  let totalBP = 0;

  for (const model of sideConfig.models || []) {
    const profile = buildProfile(model.archetypeId || 'Average', {
      itemNames: model.items || [],
    });
    const character = new Character(profile);
    characters.push(character);
    totalBP += profile.bp || 0;
  }

  return { characters, totalBP };
}

export function createBattlefield(
  size: number,
  densityRatio: number
): Battlefield {
  const battlefield = new Battlefield(size, size);

  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: densityRatio,
    battlefieldSize: size,
    seed: Math.floor(Math.random() * 1000000),
  });

  for (const feature of terrainResult.terrain) {
    battlefield.addTerrain(feature);
  }

  return battlefield;
}

export function exportBattlefieldToJson(
  battlefield: Battlefield,
  result: TerrainPlacementResult,
  outputDir: string,
  filename?: string
): string {
  return exportBattlefield(battlefield, result, outputDir, filename);
}

export function getCentroid(vertices: Position[]): Position {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;
  for (const v of vertices) {
    x += v.x;
    y += v.y;
  }

  return {
    x: x / vertices.length,
    y: y / vertices.length,
  };
}

export function deployModels(
  assembly: AssemblyResult,
  battlefield: Battlefield,
  sideIndex: number,
  size: number
): void {
  const isTop = sideIndex % 2 === 0;
  const deployY = isTop ? size * 0.25 : size * 0.75;
  const spacing = size / Math.max(1, assembly.characters.length);

  for (let i = 0; i < assembly.characters.length; i++) {
    const character = assembly.characters[i];
    const deployX = spacing * (i + 0.5);

    const position = findOpenCellNear(
      { x: deployX, y: deployY },
      character,
      battlefield
    );

    if (position) {
      character.position = position;
    }
  }
}

export function findOpenCellNear(
  targetPosition: Position,
  actor: Character,
  battlefield: Battlefield,
  maxRadius: number = 3
): Position | null {
  const radius = actor.baseDiameter || 1;

  for (let r = 0; r <= maxRadius; r += 0.5) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = targetPosition.x + r * Math.cos(angle);
      const y = targetPosition.y + r * Math.sin(angle);
      const position = { x, y };

      if (isPositionValid(position, actor, battlefield)) {
        return snapToOpenCell(position, actor, battlefield);
      }
    }
  }

  return snapToOpenCell(targetPosition, actor, battlefield);
}

export function isPositionValid(
  position: Position,
  actor: Character,
  battlefield: Battlefield
): boolean {
  const radius = actor.baseDiameter || 1;

  if (
    position.x < radius ||
    position.x > battlefield.width - radius ||
    position.y < radius ||
    position.y > battlefield.height - radius
  ) {
    return false;
  }

  for (const feature of battlefield.terrain) {
    if (feature.type === TerrainType.Impassable || feature.type === TerrainType.Obstacle) {
      if (isPointInPolygon(position, feature.vertices)) {
        return false;
      }
    }
  }

  return true;
}

export function snapToOpenCell(
  position: Position,
  actor: Character,
  battlefield: Battlefield
): Position | null {
  const cellSize = 0.5;
  const cellX = Math.round(position.x / cellSize) * cellSize;
  const cellY = Math.round(position.y / cellSize) * cellSize;
  const snapped = { x: cellX, y: cellY };

  if (isPositionValid(snapped, actor, battlefield)) {
    return snapped;
  }

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const test = {
        x: cellX + dx * cellSize,
        y: cellY + dy * cellSize,
      };
      if (isPositionValid(test, actor, battlefield)) {
        return test;
      }
    }
  }

  return position;
}

function isPointInPolygon(point: Position, polygon: Position[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

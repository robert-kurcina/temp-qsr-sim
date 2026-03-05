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
import { createDefaultDeploymentZones } from '../../../src/lib/mest-tactics/mission/deployment-system';
import type { MissionDeploymentType } from '../../../src/lib/mest-tactics/missions/mission-deployment';
import type { SideConfig } from '../../shared/BattleReportTypes';

export interface DeploymentConfig {
  gameSize: GameSize;
  battlefieldWidth: number;
  battlefieldHeight: number;
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
  battlefieldWidth: number,
  battlefieldHeight: number,
  densityRatio: number
): Battlefield {
  const battlefield = new Battlefield(battlefieldWidth, battlefieldHeight);

  const terrainResult = placeTerrain({
    mode: 'balanced',
    density: densityRatio,
    battlefieldWidth,
    battlefieldHeight,
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
  battlefieldWidth: number,
  battlefieldHeight: number,
  deploymentDepth: number = 6,
  deploymentType: MissionDeploymentType = 'opposing_edges'
): void {
  const pseudoSideIds = ['side-0', 'side-1', 'side-2', 'side-3'];
  const zones = createDefaultDeploymentZones(
    battlefieldWidth,
    battlefieldHeight,
    pseudoSideIds,
    deploymentDepth,
    deploymentType
  );
  const zone = zones[Math.min(sideIndex, zones.length - 1)]?.bounds ?? {
    x: 0,
    y: 0,
    width: battlefieldWidth,
    height: battlefieldHeight,
  };

  const count = assembly.characters.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * (zone.width / Math.max(1, zone.height)))));
  const rows = Math.max(1, Math.ceil(count / cols));
  const xSpacing = cols > 1 ? (zone.width - 1) / (cols - 1) : 0;
  const ySpacing = rows > 1 ? (zone.height - 1) / (rows - 1) : 0;

  for (let i = 0; i < assembly.characters.length; i++) {
    const character = assembly.characters[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const deployX = zone.x + col * xSpacing;
    const deployY = zone.y + row * ySpacing;

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

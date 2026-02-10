import { gameData } from '../../data';
import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainElement, TerrainElementInfo } from './TerrainElement';
import { LOSOperations } from './LOSOperations';

export interface TerrainWeights {
  area: number;
  shrub: number;
  tree: number;
  rocks: number;
  wall: number;
  building: number;
}

export interface BattlefieldFactoryConfig {
  terrain?: Partial<TerrainWeights>;
  densityRatio?: number; // 10 to 100
  blockLos?: number; // 0 to 100
}

const defaultTerrainWeights: TerrainWeights = {
  area: 5,
  shrub: 10,
  tree: 5,
  rocks: 2,
  wall: 0,
  building: 0,
};

const categoryOrder: (keyof TerrainWeights)[] = ['area', 'building', 'wall', 'tree', 'rocks', 'shrub'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomRotation(): number {
  const steps = 360 / 15;
  return Math.floor(Math.random() * steps) * 15;
}

function snapRotation(degrees: number): number {
  const steps = 360 / 15;
  const normalized = ((degrees % 360) + 360) % 360;
  return Math.round((normalized / 360) * steps) * 15 % 360;
}

function degreesFromVector(from: Position, to: Position): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function minSpacing(category: string, otherCategory: string): number {
  if (category === 'area' && otherCategory === 'area') {
    return 3;
  }
  if (category === 'area' || otherCategory === 'area') {
    return 0;
  }
  if (category === 'wall' && (otherCategory === 'wall' || otherCategory === 'building')) {
    return 1;
  }
  if (category === 'tree' && (otherCategory === 'wall' || otherCategory === 'building')) {
    return 1;
  }
  return 3;
}

function pickWallRotation(
  position: Position,
  placed: { position: Position; radius: number; category: string; rotation: number }[]
): number {
  const walls = placed.filter(item => item.category === 'wall');
  const buildings = placed.filter(item => item.category === 'building');

  if (walls.length > 0) {
    const randomWall = walls[Math.floor(Math.random() * walls.length)];
    return snapRotation(randomWall.rotation);
  }

  if (buildings.length > 0) {
    let closest = buildings[0];
    let closestDistance = distance(position, closest.position);
    for (const building of buildings) {
      const d = distance(position, building.position);
      if (d < closestDistance) {
        closest = building;
        closestDistance = d;
      }
    }
    const baseAngle = degreesFromVector(position, closest.position);
    const perpendicular = baseAngle + 90;
    const chosen = Math.random() < 0.5 ? baseAngle : perpendicular;
    return snapRotation(chosen);
  }

  return randomRotation();
}

export class BattlefieldFactory {
  static create(width: number, height: number, config: BattlefieldFactoryConfig = {}): Battlefield {
    const battlefield = new Battlefield(width, height);
    const densityRatio = clamp(config.densityRatio ?? 25, 10, 100);
    const blockLos = clamp(config.blockLos ?? 25, 0, 100);
    const weights: TerrainWeights = {
      ...defaultTerrainWeights,
      ...(config.terrain || {}),
    };

    const terrainInfo = gameData.terrain_info as Record<string, TerrainElementInfo>;
    const elementsByCategory: Record<string, string[]> = {};
    for (const name of Object.keys(terrainInfo)) {
      const category = terrainInfo[name].category;
      if (!elementsByCategory[category]) {
        elementsByCategory[category] = [];
      }
      elementsByCategory[category].push(name);
    }

    const battlefieldArea = width * height;
    const targetArea = battlefieldArea * (densityRatio / 100);

    const placed: { position: Position; radius: number; category: string; rotation: number }[] = [];
    let blockingTargetReached = blockLos <= 0;

    for (const category of categoryOrder) {
      const weight = clamp(weights[category] ?? 0, 0, 100);
      if (weight <= 0) continue;
      const categoryElements = elementsByCategory[category] || [];
      if (categoryElements.length === 0) continue;

      const categoryTargetArea = targetArea * (weight / 100);

      for (const elementName of categoryElements) {
        const info = terrainInfo[elementName];
        const element = new TerrainElement(elementName, { x: 0, y: 0 });
        const area = element.getArea();
        const distribution = clamp(info.distribution ?? 1, 1, 3);
        const isBlocking = info.los === 'Blocking';

        if (isBlocking && blockingTargetReached) continue;

        const count = Math.floor(categoryTargetArea / (3 * distribution * area));
        if (count <= 0) continue;

        for (let i = 0; i < count; i++) {
          const rotation = category === 'wall'
            ? pickWallRotation({ x: width / 2, y: height / 2 }, placed)
            : randomRotation();
          const radius = element.getBoundingRadius();
          const margin = radius + 0.1;
          const maxAttempts = 100;
          let placedElement = false;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const position = {
              x: margin + Math.random() * (width - margin * 2),
              y: margin + Math.random() * (height - margin * 2),
            };

            const wallRotation = category === 'wall'
              ? pickWallRotation(position, placed)
              : rotation;

            const tooClose = placed.some(existing => {
              const spacing = minSpacing(category, existing.category);
              const minDistance = existing.radius + radius + spacing;
              return distance(existing.position, position) < minDistance;
            });

            if (tooClose) continue;

            const terrainElement = new TerrainElement(elementName, position, wallRotation);
            const feature = terrainElement.toFeature();
            battlefield.addTerrain(feature);

            if (isBlocking) {
              const blockedFraction = LOSOperations.estimateBlockedFraction(battlefield, width, height);
              if (blockedFraction >= blockLos / 100) {
                blockingTargetReached = true;
              }
              if (blockedFraction > blockLos / 100 && blockLos < 100) {
                battlefield.removeTerrain(feature);
                continue;
              }
            }

            placed.push({ position, radius, category, rotation: wallRotation });
            placedElement = true;
            break;
          }

          if (!placedElement) {
            // Skip if we can't find a valid placement
            continue;
          }
        }
      }
    }

    return battlefield;
  }

  // LOS sampling moved to LOSOperations.
}

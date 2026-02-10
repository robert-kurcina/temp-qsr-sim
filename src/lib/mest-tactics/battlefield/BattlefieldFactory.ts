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

export interface DeploymentZoneConfig {
  side?: 'top' | 'bottom' | 'both';
  height?: number; // MU
  buffer?: number; // MU
  corridorWidth?: number; // MU
}

export interface BattlefieldFactoryConfig {
  terrain?: Partial<TerrainWeights>;
  densityRatio?: number; // 10 to 100
  areaDensityRatio?: number; // 0 to 100
  blockLos?: number; // 0 to 100
  deploymentZone?: DeploymentZoneConfig;
}

const defaultTerrainWeights: TerrainWeights = {
  area: 5,
  shrub: 3,
  tree: 5,
  rocks: 2,
  wall: 10,
  building: 10,
};

const categoryOrder: (keyof TerrainWeights)[] = ['area', 'building', 'wall', 'tree', 'rocks', 'shrub'];
const DISTANCE_EPSILON = 1e-6;

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

function minSpacing(category: string, otherCategory: string, densityRatio: number): number {
  if (category === 'area' && otherCategory === 'area') {
    return 3;
  }
  if (category === 'area' || otherCategory === 'area') {
    return 0;
  }
  if (category === otherCategory) {
    return 0;
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
    const areaDensityRatio = clamp(config.areaDensityRatio ?? 25, 0, 100);
    const blockLos = clamp(config.blockLos ?? 25, 0, 100);
    const deployment = BattlefieldFactory.resolveDeploymentZone(width, height, config.deploymentZone);
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
    const nonAreaCoverageRatio = densityRatio === 100 ? 0.8 : 1;
    const targetArea = battlefieldArea * (densityRatio / 100) * nonAreaCoverageRatio;
    const areaTargetArea = battlefieldArea * (areaDensityRatio / 100);

    const totalWeight = categoryOrder.reduce((sum, category) => sum + Math.max(0, weights[category] ?? 0), 0);
    const nonAreaCategories = categoryOrder.filter(category => category !== 'area');
    const totalNonAreaWeight = nonAreaCategories.reduce((sum, category) => sum + Math.max(0, weights[category] ?? 0), 0);

    const placedArea: { position: Position; radius: number; category: string; rotation: number; feature: TerrainElement }[] = [];
    const placedNonArea: { position: Position; radius: number; category: string; rotation: number; feature: TerrainElement }[] = [];
    let blockingTargetReached = blockLos <= 0;

    const candidateCache = new Map<string, Position[]>();

    for (const category of categoryOrder) {
      const weight = clamp(weights[category] ?? 0, 0, 100);
      if (weight <= 0) continue;
      const categoryElements = elementsByCategory[category] || [];
      if (categoryElements.length === 0) continue;

      const categoryTargetArea = category === 'area'
        ? areaTargetArea
        : (totalNonAreaWeight > 0 ? targetArea * (weight / totalNonAreaWeight) : 0);
      const effectiveTargetArea = categoryTargetArea;

      const elementsByArea = [...categoryElements].sort((a, b) => {
        const areaA = new TerrainElement(a, { x: 0, y: 0 }).getArea();
        const areaB = new TerrainElement(b, { x: 0, y: 0 }).getArea();
        return areaB - areaA;
      });

      let placedAreaTotal = 0;
      const maxAttempts = 2000;
      let attempts = 0;
      const placedList = category === 'area' ? placedArea : placedNonArea;

      const shouldPack = densityRatio === 100
        && ['tree', 'rocks', 'shrub'].includes(category)
        && elementsByArea.length === 1
        && terrainInfo[elementsByArea[0]].shape === 'circle';

      if (shouldPack) {
        const elementName = elementsByArea[0];
        const element = new TerrainElement(elementName, { x: 0, y: 0 });
        const area = element.getArea();
        const radius = element.getBoundingRadius();
        const positions = BattlefieldFactory.generateCandidatePositions(width, height, radius, 0, true, false);

        for (const position of positions) {
          if (category !== 'area' && BattlefieldFactory.isInDeploymentExclusion(position, radius, deployment)) {
            continue;
          }
          const tooClose = placedList.some(existing => {
            const spacing = category === 'area'
              ? 3
              : minSpacing(category, existing.category, densityRatio);
            const minDistance = existing.radius + radius + spacing;
            if (distance(existing.position, position) < minDistance - DISTANCE_EPSILON) {
              return true;
            }
            if (category !== 'area') {
              if (terrainInfo[elementName].shape !== 'circle' || existing.feature.toFeature().meta?.shape !== 'circle') {
                const newFeature = new TerrainElement(elementName, position);
                return BattlefieldFactory.polygonsOverlap(
                  newFeature.toFeature().vertices,
                  existing.feature.toFeature().vertices
                );
              }
            }
            return false;
          });

          if (tooClose) continue;

          const terrainElement = new TerrainElement(elementName, position);
          battlefield.addTerrain(terrainElement.toFeature());
          placedList.push({ position, radius, category, rotation: 0, feature: terrainElement });
          placedAreaTotal += area;
          if (placedAreaTotal >= effectiveTargetArea) {
            break;
          }
        }
        continue;
      }

      while (placedAreaTotal < effectiveTargetArea && attempts < maxAttempts) {
        const elementName = elementsByArea[attempts % elementsByArea.length];
        const info = terrainInfo[elementName];
        const element = new TerrainElement(elementName, { x: 0, y: 0 });
        const area = element.getArea();
        const isBlocking = info.los === 'Blocking';

        if (isBlocking && blockingTargetReached) {
          attempts++;
          continue;
        }

        const rotation = category === 'wall'
          ? pickWallRotation({ x: width / 2, y: height / 2 }, placedNonArea)
          : randomRotation();
        const radius = element.getBoundingRadius();
        let placedElement = false;

        if (!candidateCache.has(elementName)) {
          const spacing = category === 'area'
            ? 3
            : (densityRatio === 100 && ['tree', 'rocks', 'shrub'].includes(category) ? 0 : 1);
          const useHex = spacing === 0 && ['tree', 'rocks', 'shrub'].includes(category);
          candidateCache.set(
            elementName,
            BattlefieldFactory.generateCandidatePositions(width, height, radius, spacing, useHex, true)
          );
        }

        const candidatePositions = candidateCache.get(elementName) || [];

        for (let index = attempts % candidatePositions.length; index < candidatePositions.length; index++) {
          const position = candidatePositions[index];
          if (category !== 'area' && BattlefieldFactory.isInDeploymentExclusion(position, radius, deployment)) {
            continue;
          }
          const wallRotation = category === 'wall'
            ? pickWallRotation(position, placedNonArea)
            : rotation;

          const tooClose = placedList.some(existing => {
            const spacing = category === 'area'
              ? 3
              : minSpacing(category, existing.category, densityRatio);
            const minDistance = existing.radius + radius + spacing;
            if (distance(existing.position, position) < minDistance - DISTANCE_EPSILON) {
              return true;
            }
            if (category !== 'area') {
              const newFeature = new TerrainElement(elementName, position, wallRotation);
              return BattlefieldFactory.polygonsOverlap(
                newFeature.toFeature().vertices,
                existing.feature.toFeature().vertices
              );
            }
            return false;
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

          placedList.push({ position, radius, category, rotation: wallRotation, feature: terrainElement });
          placedAreaTotal += area;
          placedElement = true;
          break;
        }

        attempts++;
        if (!placedElement) {
          continue;
        }
      }
    }
    return battlefield;
  }

  private static resolveDeploymentZone(
    width: number,
    height: number,
    config: DeploymentZoneConfig | undefined
  ): { zones: { x: number; y: number; width: number; height: number }[]; buffer: number; corridors: { x: number; y: number; width: number; height: number }[] } {
    const zoneHeight = Math.max(0, config?.height ?? BattlefieldFactory.inferDeploymentZoneHeight(width, height));
    const buffer = Math.max(0, config?.buffer ?? 3);
    const corridorWidth = Math.max(0, config?.corridorWidth ?? 2);
    const side = config?.side ?? 'bottom';

    const zones: { x: number; y: number; width: number; height: number }[] = [];
    if (side === 'bottom' || side === 'both') {
      zones.push({ x: 0, y: 0, width, height: zoneHeight });
    }
    if (side === 'top' || side === 'both') {
      zones.push({ x: 0, y: height - zoneHeight, width, height: zoneHeight });
    }

    const corridorX = Math.max(0, (width - corridorWidth) / 2);
    const corridors: { x: number; y: number; width: number; height: number }[] = [];
    if (side === 'bottom' || side === 'both') {
      const corridorHeight = Math.max(0, height / 2 - zoneHeight);
      corridors.push({ x: corridorX, y: zoneHeight, width: corridorWidth, height: corridorHeight });
    }
    if (side === 'top' || side === 'both') {
      const corridorHeight = Math.max(0, height / 2 - zoneHeight);
      corridors.push({ x: corridorX, y: height / 2, width: corridorWidth, height: corridorHeight });
    }

    return { zones, buffer, corridors };
  }

  private static isInDeploymentExclusion(
    position: Position,
    radius: number,
    deployment: { zones: { x: number; y: number; width: number; height: number }[]; buffer: number; corridors: { x: number; y: number; width: number; height: number }[] }
  ): boolean {
    for (const zone of deployment.zones) {
      const distanceToZone = BattlefieldFactory.distancePointToRect(position, zone);
      if (distanceToZone <= radius + deployment.buffer) {
        return true;
      }
    }
    for (const corridor of deployment.corridors) {
      const distanceToCorridor = BattlefieldFactory.distancePointToRect(position, corridor);
      if (distanceToCorridor <= radius) {
        return true;
      }
    }
    return false;
  }

  private static inferDeploymentZoneHeight(width: number, height: number): number {
    const maxDimension = Math.max(width, height);
    if (maxDimension <= 24) return 2;
    if (maxDimension <= 36) return 4;
    if (maxDimension <= 48) return 6;
    return 8;
  }

  private static distancePointToRect(
    point: Position,
    rect: { x: number; y: number; width: number; height: number }
  ): number {
    const rx1 = rect.x;
    const ry1 = rect.y;
    const rx2 = rect.x + rect.width;
    const ry2 = rect.y + rect.height;
    const dx = Math.max(rx1 - point.x, 0, point.x - rx2);
    const dy = Math.max(ry1 - point.y, 0, point.y - ry2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private static polygonsOverlap(a: Position[], b: Position[]): boolean {
    if (a.length === 0 || b.length === 0) return false;
    // Edge intersection check
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      for (let m = 0, n = b.length - 1; m < b.length; n = m++) {
        if (BattlefieldFactory.segmentIntersection(a[j], a[i], b[n], b[m])) {
          return true;
        }
      }
    }
    // Containment check
    if (BattlefieldFactory.pointInPolygon(a[0], b)) return true;
    if (BattlefieldFactory.pointInPolygon(b[0], a)) return true;
    return false;
  }

  private static segmentIntersection(p1: Position, p2: Position, p3: Position, p4: Position): boolean {
    const o1 = BattlefieldFactory.orientation(p1, p2, p3);
    const o2 = BattlefieldFactory.orientation(p1, p2, p4);
    const o3 = BattlefieldFactory.orientation(p3, p4, p1);
    const o4 = BattlefieldFactory.orientation(p3, p4, p2);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && BattlefieldFactory.onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && BattlefieldFactory.onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && BattlefieldFactory.onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && BattlefieldFactory.onSegment(p3, p2, p4)) return true;
    return false;
  }

  private static orientation(p: Position, q: Position, r: Position): number {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < DISTANCE_EPSILON) return 0;
    return val > 0 ? 1 : 2;
  }

  private static onSegment(p: Position, q: Position, r: Position): boolean {
    return (
      q.x <= Math.max(p.x, r.x) + DISTANCE_EPSILON &&
      q.x >= Math.min(p.x, r.x) - DISTANCE_EPSILON &&
      q.y <= Math.max(p.y, r.y) + DISTANCE_EPSILON &&
      q.y >= Math.min(p.y, r.y) - DISTANCE_EPSILON
    );
  }

  private static pointInPolygon(point: Position, polygon: Position[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (BattlefieldFactory.onSegment(polygon[j], point, polygon[i])) {
        return true;
      }
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  private static generateCandidatePositions(
    width: number,
    height: number,
    radius: number,
    spacing: number,
    useHex: boolean,
    shuffle: boolean
  ): Position[] {
    const positions: Position[] = [];
    if (useHex) {
      const stepX = radius * 2 + spacing;
      const stepY = Math.sqrt(3) * radius + spacing;
      let row = 0;
      for (let y = radius; y <= height - radius; y += stepY) {
        const offset = (row % 2) * (stepX / 2);
        for (let x = radius + offset; x <= width - radius; x += stepX) {
          positions.push({ x, y });
        }
        row++;
      }
    } else {
      const step = Math.max(0.5, radius * 2 + spacing);
      for (let y = radius; y <= height - radius; y += step) {
        for (let x = radius; x <= width - radius; x += step) {
          positions.push({ x, y });
        }
      }
    }
    if (shuffle) {
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
    }
    return positions;
  }

  // LOS sampling moved to LOSOperations.
}

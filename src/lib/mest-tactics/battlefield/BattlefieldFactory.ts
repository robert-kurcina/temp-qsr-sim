import { gameData } from '../../data';
import { Battlefield, BattlefieldOpennessStats } from './Battlefield';
import { Position } from './Position';
import { TerrainElement, TerrainElementInfo } from './TerrainElement';
import { LOSOperations } from './LOSOperations';
import { PathfindingEngine } from './PathfindingEngine';
import { TerrainType } from './Terrain';

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
  maxNonAreaSpacing?: number; // MU cap for non-area spacing
  maxPlacementAttempts?: number; // per category
  maxFillerAttempts?: number;
  maxPlacementMs?: number; // time budget per battlefield
  fitnessRetries?: number; // additional attempts to minimize open LOS chunks
  opennessMaxPairs?: number; // cap LOS pair checks to keep fitness sampling fast
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

function shufflePositions(positions: Position[]): Position[] {
  const result = [...positions];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function bandWeight(position: Position, height: number): number {
  const topMax = height * 0.25;
  const bottomMin = height * 0.75;
  const middleMin = height * 0.125;
  const middleMax = height * 0.875;
  let weight = 0;
  if (position.y <= topMax) weight += 0.25;
  if (position.y >= bottomMin) weight += 0.25;
  if (position.y >= middleMin && position.y <= middleMax) weight += 0.5;
  return weight;
}

function orderPositionsByBandWeight(positions: Position[], height: number): Position[] {
  const scored = positions.map(position => {
    const weight = Math.max(0.0001, bandWeight(position, height));
    const key = -Math.log(Math.random()) / weight;
    return { position, key };
  });
  scored.sort((a, b) => a.key - b.key);
  return scored.map(entry => entry.position);
}

function isEcological(category: string): boolean {
  return category === 'tree' || category === 'rocks' || category === 'shrub';
}

function scaleSpacingForDensity(base: number, densityRatio: number): number {
  if (base <= 0) return base;
  const clamped = clamp(densityRatio, 10, 100);
  if (clamped <= 50) return base;
  if (clamped >= 100) return 0;
  const t = (clamped - 50) / 50;
  return base * (1 - t);
}

function minSpacing(
  category: string,
  otherCategory: string,
  densityRatio: number,
  maxNonAreaSpacing?: number
): number {
  if (category === 'area' && otherCategory === 'area') {
    return 3;
  }
  if (category === 'area' || otherCategory === 'area') {
    return -1;
  }

  const hasWall = category === 'wall' || otherCategory === 'wall';
  const hasBuilding = category === 'building' || otherCategory === 'building';
  const hasTree = category === 'tree' || otherCategory === 'tree';

  let spacing = 3;
  if (hasWall && hasBuilding) {
    spacing = 1;
  } else if (hasTree && (hasWall || hasBuilding)) {
    spacing = 1;
  } else if (category === otherCategory && category === 'wall') {
    spacing = 1;
  }

  if (isEcological(category) && isEcological(otherCategory)) {
    spacing = scaleSpacingForDensity(spacing, densityRatio);
  }

  if (maxNonAreaSpacing !== undefined && maxNonAreaSpacing >= 0) {
    spacing = Math.min(spacing, maxNonAreaSpacing);
  }

  return spacing;
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
    const retries = Math.max(0, config.fitnessRetries ?? 2);
    let best: Battlefield | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const battlefield = BattlefieldFactory.createOnce(width, height, config);
      const score = battlefield.opennessStats?.meanChunkLongLosRatio ?? Number.POSITIVE_INFINITY;
      if (!best || score < bestScore) {
        best = battlefield;
        bestScore = score;
      }
    }
    return best ?? BattlefieldFactory.createOnce(width, height, config);
  }

  private static createOnce(width: number, height: number, config: BattlefieldFactoryConfig = {}): Battlefield {
    const battlefield = new Battlefield(width, height);
    const densityRatio = clamp(config.densityRatio ?? 25, 10, 100);
    const areaDensityRatio = clamp(config.areaDensityRatio ?? 25, 0, 100);
    const deployment = BattlefieldFactory.resolveDeploymentZone(width, height, config.deploymentZone);
    const weights: TerrainWeights = {
      ...defaultTerrainWeights,
      ...(config.terrain || {}),
    };
    const maxNonAreaSpacing = config.maxNonAreaSpacing;
    const maxPlacementAttempts = Math.max(1, config.maxPlacementAttempts ?? 2000);
    const maxFillerAttempts = Math.max(1, config.maxFillerAttempts ?? 4000);
    const maxPlacementMs = Math.max(0, config.maxPlacementMs ?? 0);
    const startTime = Date.now();
    const timeExceeded = () => maxPlacementMs > 0 && Date.now() - startTime > maxPlacementMs;

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
    const nonAreaCoverageRatio = densityRatio === 100 ? 0.5 : 1;
    const targetArea = battlefieldArea * (densityRatio / 100) * nonAreaCoverageRatio;
    const areaTargetArea = battlefieldArea * (areaDensityRatio / 100);

    const totalWeight = categoryOrder.reduce((sum, category) => sum + Math.max(0, weights[category] ?? 0), 0);
    const nonAreaCategories = categoryOrder.filter(category => category !== 'area');
    const totalNonAreaWeight = nonAreaCategories.reduce((sum, category) => sum + Math.max(0, weights[category] ?? 0), 0);

    const placedArea: { position: Position; radius: number; category: string; rotation: number; feature: TerrainElement }[] = [];
    const placedNonArea: { position: Position; radius: number; category: string; rotation: number; feature: TerrainElement }[] = [];
    let totalNonAreaPlaced = 0;
    let remainingNonAreaTarget = targetArea;

    const candidateCache = new Map<string, Position[]>();
    const candidateCursor = new Map<string, number>();

    const tryPlaceElement = (elementName: string, category: string, rotationOverride?: number): { placed: boolean; area: number } => {
      if (timeExceeded()) {
        return { placed: false, area: 0 };
      }
      const info = terrainInfo[elementName];
      const element = new TerrainElement(elementName, { x: 0, y: 0 });
      const area = element.getArea();
      const radius = element.getBoundingRadius();
      const rotation = rotationOverride ?? (category === 'wall'
        ? pickWallRotation({ x: width / 2, y: height / 2 }, placedNonArea)
        : randomRotation());

      if (!candidateCache.has(elementName)) {
        const group = BattlefieldFactory.categoryGroup(category);
        const spacing = Math.max(0, minSpacing(category, category, densityRatio, maxNonAreaSpacing));
        const useHex = group === 'ecological'
          && spacing <= 1
          && terrainInfo[elementName].shape === 'circle';
        let candidates = BattlefieldFactory.generateCandidatePositions(width, height, radius, spacing, useHex, false);
        candidates = category === 'area'
          ? shufflePositions(candidates)
          : orderPositionsByBandWeight(candidates, height);
        candidateCache.set(elementName, candidates);
      }

      const candidatePositions = candidateCache.get(elementName) || [];
      const startIndex = candidateCursor.get(elementName) ?? 0;
      for (let index = startIndex; index < candidatePositions.length; index++) {
        const position = candidatePositions[index];
        if (timeExceeded()) {
          return { placed: false, area };
        }
        const wallRotation = category === 'wall'
          ? pickWallRotation(position, placedNonArea)
          : rotation;

        const placedList = category === 'area' ? placedArea : placedNonArea;
        const tooClose = placedList.some(existing => {
          const spacing = minSpacing(category, existing.category, densityRatio, maxNonAreaSpacing);
          if (spacing < 0) {
            return false;
          }
          if (spacing === 0) {
            const centerDistance = distance(position, existing.position);
            return centerDistance < radius + existing.radius - DISTANCE_EPSILON;
          }
          const newFeature = new TerrainElement(elementName, position, wallRotation);
          const distanceBetween = BattlefieldFactory.polygonsDistance(
            newFeature.toFeature().vertices,
            existing.feature.toFeature().vertices
          );
          return distanceBetween < spacing - DISTANCE_EPSILON;
        });

        if (tooClose) continue;

        const terrainElement = new TerrainElement(elementName, position, wallRotation);
        const feature = terrainElement.toFeature();
        battlefield.addTerrain(feature, true);

        placedList.push({ position, radius, category, rotation: wallRotation, feature: terrainElement });
        candidateCursor.set(elementName, index + 1);
        return { placed: true, area };
      }

      candidateCursor.set(elementName, candidatePositions.length);
      return { placed: false, area };
    };

    for (const category of categoryOrder) {
      if (timeExceeded()) break;
      const weight = clamp(weights[category] ?? 0, 0, 100);
      if (weight <= 0) continue;
      const categoryElements = elementsByCategory[category] || [];
      if (categoryElements.length === 0) continue;

      const fillToCapacity = densityRatio === 100
        && category !== 'area'
        && areaDensityRatio === 0
        && weight > 0
        && totalNonAreaWeight === weight;

      const categoryTargetArea = category === 'area'
        ? areaTargetArea
        : (totalNonAreaWeight > 0 ? targetArea * (weight / totalNonAreaWeight) : 0);
      const effectiveTargetArea = fillToCapacity
        ? Number.POSITIVE_INFINITY
        : (category === 'area'
          ? categoryTargetArea
          : Math.min(categoryTargetArea, remainingNonAreaTarget));

      const elementsByArea = [...categoryElements].sort((a, b) => {
        const areaA = new TerrainElement(a, { x: 0, y: 0 }).getArea();
        const areaB = new TerrainElement(b, { x: 0, y: 0 }).getArea();
        return areaB - areaA;
      });

      let placedAreaTotal = 0;
      const maxAttempts = maxPlacementAttempts;
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
        const spacing = Math.max(0, minSpacing(category, category, densityRatio, maxNonAreaSpacing));
        let positions = BattlefieldFactory.generateCandidatePositions(width, height, radius, spacing, true, false);
        positions = category === 'area'
          ? shufflePositions(positions)
          : orderPositionsByBandWeight(positions, height);

        for (const position of positions) {
          if (timeExceeded()) break;
          const tooClose = placedList.some(existing => {
            const spacing = minSpacing(category, existing.category, densityRatio, maxNonAreaSpacing);
            if (spacing < 0) {
              return false;
            }
            if (spacing === 0) {
              const centerDistance = distance(position, existing.position);
              return centerDistance < radius + existing.radius - DISTANCE_EPSILON;
            }
            const newFeature = new TerrainElement(elementName, position);
            const distanceBetween = BattlefieldFactory.polygonsDistance(
              newFeature.toFeature().vertices,
              existing.feature.toFeature().vertices
            );
            return distanceBetween < spacing - DISTANCE_EPSILON;
          });

          if (tooClose) continue;

          const terrainElement = new TerrainElement(elementName, position);
          battlefield.addTerrain(terrainElement.toFeature(), true);
          placedList.push({ position, radius, category, rotation: 0, feature: terrainElement });
          placedAreaTotal += area;
          if (placedAreaTotal >= effectiveTargetArea) {
            break;
          }
        }
        continue;
      }

      while (placedAreaTotal < effectiveTargetArea && attempts < maxAttempts) {
        if (timeExceeded()) break;
        const elementName = elementsByArea[attempts % elementsByArea.length];
        const result = tryPlaceElement(elementName, category);
        if (result.placed) {
          placedAreaTotal += result.area;
        }
        attempts++;
      }

      if (category !== 'area') {
        totalNonAreaPlaced += placedAreaTotal;
        remainingNonAreaTarget = Math.max(0, remainingNonAreaTarget - placedAreaTotal);
      }
    }

    if (remainingNonAreaTarget > 0) {
      const fillerOrder: (keyof TerrainWeights)[] = ['tree', 'shrub', 'rocks'];
      let fillerAttempts = 0;
      const fillerMaxAttempts = maxFillerAttempts;
      while (remainingNonAreaTarget > 0 && fillerAttempts < fillerMaxAttempts) {
        if (timeExceeded()) break;
        for (const category of fillerOrder) {
          if (remainingNonAreaTarget <= 0) break;
          const categoryElements = elementsByCategory[category] || [];
          if (categoryElements.length === 0) continue;
          const smallest = [...categoryElements].sort((a, b) => {
            const areaA = new TerrainElement(a, { x: 0, y: 0 }).getArea();
            const areaB = new TerrainElement(b, { x: 0, y: 0 }).getArea();
            return areaA - areaB;
          })[0];
          const result = tryPlaceElement(smallest, category);
          if (result.placed) {
            totalNonAreaPlaced += result.area;
            remainingNonAreaTarget = Math.max(0, remainingNonAreaTarget - result.area);
          }
        }
        fillerAttempts++;
      }
    }
    BattlefieldFactory.ensureDeploymentClearance(battlefield, deployment, width, height, timeExceeded);
    battlefield.finalizeTerrain();
    battlefield.opennessStats = BattlefieldFactory.computeOpennessStats(
      battlefield,
      undefined,
      undefined,
      config.opennessMaxPairs
    );
    return battlefield;
  }

  private static categoryGroup(category: string): 'area' | 'artificial' | 'ecological' | 'other' {
    if (category === 'area') return 'area';
    if (category === 'building' || category === 'wall') return 'artificial';
    if (category === 'tree' || category === 'rocks' || category === 'shrub') return 'ecological';
    return 'other';
  }

  private static estimateDeploymentRequirement(width: number, height: number): number {
    const maxDimension = Math.max(width, height);
    if (maxDimension <= 24) {
      return 16;
    }
    return 0;
  }

  private static ensureDeploymentClearance(
    battlefield: Battlefield,
    deployment: { zones: { x: number; y: number; width: number; height: number }[] },
    width: number,
    height: number,
    timeExceeded?: () => boolean
  ): void {
    const required = BattlefieldFactory.estimateDeploymentRequirement(width, height);
    if (required <= 0) return;
    const modelDiameter = 1;
    const tolerance = 0.5;
    const expandedDiameter = modelDiameter + tolerance * 2;
    const spacing = modelDiameter + tolerance;

    let removed = false;

    for (const zone of deployment.zones) {
      if (timeExceeded?.()) break;
      let available = BattlefieldFactory.countDeploymentSlots(
        battlefield,
        zone,
        modelDiameter,
        expandedDiameter,
        spacing
      );
      let attempts = 0;
      while (available < required && attempts < 200) {
        if (timeExceeded?.()) break;
        const blockers = battlefield.terrain
          .filter(feature => feature.meta?.category !== 'area' && feature.meta?.layer !== 'area')
          .filter(feature => BattlefieldFactory.featureIntersectsRect(feature.vertices, zone));
        if (blockers.length === 0) break;
        blockers.sort((a, b) => BattlefieldFactory.polygonArea(b.vertices) - BattlefieldFactory.polygonArea(a.vertices));
        battlefield.removeTerrain(blockers[0], true);
        removed = true;
        available = BattlefieldFactory.countDeploymentSlots(
          battlefield,
          zone,
          modelDiameter,
          expandedDiameter,
          spacing
        );
        attempts++;
      }
    }

    if (removed) {
      battlefield.finalizeTerrain();
    }
  }

  private static countDeploymentSlots(
    battlefield: Battlefield,
    zone: { x: number; y: number; width: number; height: number },
    modelDiameter: number,
    expandedDiameter: number,
    spacing: number
  ): number {
    const radius = modelDiameter / 2;
    let count = 0;
    for (let y = zone.y + radius; y <= zone.y + zone.height - radius + DISTANCE_EPSILON; y += spacing) {
      for (let x = zone.x + radius; x <= zone.x + zone.width - radius + DISTANCE_EPSILON; x += spacing) {
        const position = { x, y };
        if (BattlefieldFactory.isModelClear(battlefield, position, expandedDiameter)) {
          count++;
        }
      }
    }
    return count;
  }

  private static isModelClear(
    battlefield: Battlefield,
    position: Position,
    expandedDiameter: number
  ): boolean {
    const samples = LOSOperations.buildCircularPerimeterPoints(position, expandedDiameter);
    samples.push(position);
    for (const feature of battlefield.terrain) {
      if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') continue;
      for (const sample of samples) {
        if (PathfindingEngine.isPointInPolygon(sample, feature.vertices)) {
          return false;
        }
      }
    }
    return true;
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

  private static polygonArea(points: Position[]): number {
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      area += (points[j].x + points[i].x) * (points[j].y - points[i].y);
    }
    return Math.abs(area) / 2;
  }

  private static featureIntersectsRect(
    polygon: Position[],
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    const rx1 = rect.x;
    const ry1 = rect.y;
    const rx2 = rect.x + rect.width;
    const ry2 = rect.y + rect.height;

    for (const point of polygon) {
      if (point.x >= rx1 && point.x <= rx2 && point.y >= ry1 && point.y <= ry2) {
        return true;
      }
    }

    const rectPoints: Position[] = [
      { x: rx1, y: ry1 },
      { x: rx2, y: ry1 },
      { x: rx2, y: ry2 },
      { x: rx1, y: ry2 },
    ];

    for (const point of rectPoints) {
      if (BattlefieldFactory.pointInPolygon(point, polygon)) {
        return true;
      }
    }

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const p1 = polygon[j];
      const p2 = polygon[i];
      for (let m = 0; m < rectPoints.length; m++) {
        const n = (m + 1) % rectPoints.length;
        if (BattlefieldFactory.segmentIntersection(p1, p2, rectPoints[m], rectPoints[n])) {
          return true;
        }
      }
    }

    return false;
  }

  private static polygonsDistance(a: Position[], b: Position[]): number {
    if (a.length === 0 || b.length === 0) return Infinity;
    if (BattlefieldFactory.polygonsOverlap(a, b)) return 0;
    let min = Infinity;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const a1 = a[j];
      const a2 = a[i];
      for (let m = 0, n = b.length - 1; m < b.length; n = m++) {
        const b1 = b[n];
        const b2 = b[m];
        const dist = BattlefieldFactory.segmentDistance(a1, a2, b1, b2);
        if (dist < min) min = dist;
        if (min <= 0) return 0;
      }
    }
    return min;
  }

  private static segmentDistance(a1: Position, a2: Position, b1: Position, b2: Position): number {
    if (BattlefieldFactory.segmentIntersection(a1, a2, b1, b2)) return 0;
    return Math.min(
      BattlefieldFactory.pointToSegmentDistance(a1, b1, b2),
      BattlefieldFactory.pointToSegmentDistance(a2, b1, b2),
      BattlefieldFactory.pointToSegmentDistance(b1, a1, a2),
      BattlefieldFactory.pointToSegmentDistance(b2, a1, a2)
    );
  }

  private static pointToSegmentDistance(point: Position, segStart: Position, segEnd: Position): number {
    const dx = segEnd.x - segStart.x;
    const dy = segEnd.y - segStart.y;
    if (Math.abs(dx) < DISTANCE_EPSILON && Math.abs(dy) < DISTANCE_EPSILON) {
      return Math.hypot(point.x - segStart.x, point.y - segStart.y);
    }
    const t = ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / (dx * dx + dy * dy);
    if (t <= 0) return Math.hypot(point.x - segStart.x, point.y - segStart.y);
    if (t >= 1) return Math.hypot(point.x - segEnd.x, point.y - segEnd.y);
    const projX = segStart.x + t * dx;
    const projY = segStart.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
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

  private static computeOpennessStats(
    battlefield: Battlefield,
    chunkSize = 4,
    losThreshold = 8,
    maxPairs = 200
  ): BattlefieldOpennessStats {
    const chunkCols = Math.ceil(battlefield.width / chunkSize);
    const chunkRows = Math.ceil(battlefield.height / chunkSize);
    const chunkPoints: Position[] = [];

    for (let row = 0; row < chunkRows; row++) {
      for (let col = 0; col < chunkCols; col++) {
        const x = col * chunkSize;
        const y = row * chunkSize;
        const width = Math.min(chunkSize, battlefield.width - x);
        const height = Math.min(chunkSize, battlefield.height - y);
        const point = BattlefieldFactory.selectChunkOpenPoint(battlefield, x, y, width, height);
        chunkPoints.push(point);
      }
    }

    const chunkCount = chunkPoints.length;
    const perChunkPossible = new Array<number>(chunkCount).fill(0);
    const perChunkClear = new Array<number>(chunkCount).fill(0);
    let totalPairs = 0;
    let longLosPairs = 0;
    const blockers = battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature));

    let capped = false;
    const pairLimit = Math.max(0, Math.floor(maxPairs));

    for (let i = 0; i < chunkCount; i++) {
      for (let j = i + 1; j < chunkCount; j++) {
        if (pairLimit > 0 && totalPairs >= pairLimit) {
          capped = true;
          break;
        }
        const a = chunkPoints[i];
        const b = chunkPoints[j];
        const dist = LOSOperations.distance(a, b);
        if (dist < losThreshold) {
          continue;
        }
        totalPairs++;
        perChunkPossible[i]++;
        perChunkPossible[j]++;
        if (!LOSOperations.hasBlockingBetweenPoints(battlefield, a, b, blockers)) {
          longLosPairs++;
          perChunkClear[i]++;
          perChunkClear[j]++;
        }
      }
      if (capped) break;
    }

    let meanChunkLongLosRatio = 0;
    for (let i = 0; i < chunkCount; i++) {
      const possible = perChunkPossible[i];
      const ratio = possible > 0 ? perChunkClear[i] / possible : 0;
      meanChunkLongLosRatio += ratio;
    }
    meanChunkLongLosRatio = chunkCount > 0 ? meanChunkLongLosRatio / chunkCount : 0;

    const longLosPairRatio = totalPairs > 0 ? longLosPairs / totalPairs : 0;

    return {
      chunkSize,
      losThreshold,
      totalChunks: chunkCount,
      totalPairs,
      longLosPairs,
      longLosPairRatio,
      meanChunkLongLosRatio,
    };
  }

  private static selectChunkOpenPoint(
    battlefield: Battlefield,
    chunkX: number,
    chunkY: number,
    chunkWidth: number,
    chunkHeight: number
  ): Position {
    const candidates = BattlefieldFactory.sampleChunkPoints(chunkX, chunkY, chunkWidth, chunkHeight);
    let bestClear: Position | null = null;
    let bestClearDistance = -Infinity;
    let bestAny: Position | null = null;
    let bestAnyDistance = -Infinity;

    for (const point of candidates) {
      const distanceToBlocker = BattlefieldFactory.distanceToNearestBlocking(battlefield, point);
      if (BattlefieldFactory.isPointClear(battlefield, point)) {
        if (distanceToBlocker > bestClearDistance) {
          bestClear = point;
          bestClearDistance = distanceToBlocker;
        }
      }
      if (distanceToBlocker > bestAnyDistance) {
        bestAny = point;
        bestAnyDistance = distanceToBlocker;
      }
    }

    return bestClear ?? bestAny ?? {
      x: chunkX + chunkWidth / 2,
      y: chunkY + chunkHeight / 2,
    };
  }

  private static sampleChunkPoints(
    chunkX: number,
    chunkY: number,
    chunkWidth: number,
    chunkHeight: number
  ): Position[] {
    const samplesPerSide = 3;
    const stepX = chunkWidth / samplesPerSide;
    const stepY = chunkHeight / samplesPerSide;
    const positions: Position[] = [];
    for (let y = 0; y < samplesPerSide; y++) {
      for (let x = 0; x < samplesPerSide; x++) {
        positions.push({
          x: chunkX + (x + 0.5) * stepX,
          y: chunkY + (y + 0.5) * stepY,
        });
      }
    }
    return positions;
  }

  private static isPointClear(battlefield: Battlefield, point: Position): boolean {
    for (const feature of battlefield.terrain) {
      if (!PathfindingEngine.isPointInPolygon(point, feature.vertices)) continue;
      if (feature.type !== TerrainType.Clear) {
        return false;
      }
    }
    return true;
  }

  private static distanceToNearestBlocking(battlefield: Battlefield, point: Position): number {
    let min = Infinity;
    for (const feature of battlefield.terrain) {
      if (feature.type !== TerrainType.Obstacle) continue;
      const distance = PathfindingEngine.distancePointToPolygon(point, feature.vertices);
      if (distance < min) {
        min = distance;
      }
    }
    return min;
  }
}

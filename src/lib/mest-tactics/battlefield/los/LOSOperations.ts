import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from '../terrain/Terrain';
import { distance, segmentIntersection } from '../terrain/BattlefieldUtils';

export interface LOSSampleOptions {
  samples?: number;
  segmentLength?: number;
  rayWidth?: number; // Placeholder for future width-aware LOS checks
}

export interface LOSResult {
  clear: boolean;
  blockedBy?: TerrainFeature;
}

export interface LOSModelFootprint {
  id?: string;
  position: Position;
  baseDiameter: number;
  siz?: number;
}

export class LOSOperations {
  private static readonly SIZE_EPSILON = 1e-6;
  private static readonly VISIBLE_HEIGHT_SAMPLES = 5;
  private static readonly TERRAIN_HEIGHT_BY_CATEGORY: Record<string, number> = {
    shrub: 0.5,
    rocks: 0.5,
    tree: 6,
    wall: 1,
    building: 3,
    area: 0,
  };

  private static readonly TERRAIN_HEIGHT_BY_NAME: Record<string, number> = {
    shrub: 0.5,
    tree: 6,
    'small rocks': 0.5,
    'medium rocks': 0.5,
    'large rocks': 0.5,
    'short wall': 1,
    'medium wall': 1,
    'large wall': 1.5,
    'small building': 3,
    'medium building': 3,
    'large building': 4,
  };

  // TODO: Review LOS blocker classification for higher-fidelity RAW (Soft/Hard may not always fully block LOS).
  static isLosBlocking(feature: TerrainFeature): boolean {
    if (feature.type === TerrainType.Obstacle) return true;
    const los = feature.meta?.los ?? 'Clear';
    return los === 'Blocking';
  }

  static getTerrainHeightMu(feature: TerrainFeature): number {
    if (LOSOperations.isLosBlocking(feature)) {
      return Number.POSITIVE_INFINITY;
    }

    const named = feature.meta?.name?.toLowerCase?.() ?? '';
    if (named && named in LOSOperations.TERRAIN_HEIGHT_BY_NAME) {
      return LOSOperations.TERRAIN_HEIGHT_BY_NAME[named];
    }

    const category = feature.meta?.category?.toLowerCase?.() ?? '';
    if (category && category in LOSOperations.TERRAIN_HEIGHT_BY_CATEGORY) {
      return LOSOperations.TERRAIN_HEIGHT_BY_CATEGORY[category];
    }

    const los = feature.meta?.los ?? 'Clear';
    if (los === 'Hard' || los === 'Soft') {
      return 0.5;
    }
    return 0;
  }

  static isLosBlockingForSizes(
    feature: TerrainFeature,
    sourceSiz?: number,
    targetSiz?: number
  ): boolean {
    if (LOSOperations.isLosBlocking(feature)) return true;
    const sourceHeight = LOSOperations.resolveBaseHeightFromSiz(sourceSiz);
    const targetHeight = LOSOperations.resolveBaseHeightFromSiz(targetSiz);
    const smallestBaseHeight = Math.min(sourceHeight, targetHeight);
    if (smallestBaseHeight <= 0) return false;

    // QSR LOS.5: terrain larger than half base-height blocks LOS.
    const halfBaseHeight = smallestBaseHeight / 2;
    const terrainHeight = LOSOperations.getTerrainHeightMu(feature);
    return terrainHeight > halfBaseHeight + LOSOperations.SIZE_EPSILON;
  }

  static checkLOSBetweenPoints(battlefield: Battlefield, start: Position, end: Position): LOSResult {
    const blockers = battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature));
    const hit = LOSOperations.findNearestBlockingElement(start, end, blockers);
    if (hit) {
      return { clear: false, blockedBy: hit };
    }
    return { clear: true };
  }

  static hasBlockingBetweenPoints(
    battlefield: Battlefield,
    start: Position,
    end: Position,
    blockersOverride?: TerrainFeature[]
  ): boolean {
    const blockers = blockersOverride ?? battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature));
    for (const feature of blockers) {
      if (LOSOperations.segmentIntersectsFeature(start, end, feature)) {
        return true;
      }
    }
    return false;
  }

  static checkLOSFromModelToPoint(
    battlefield: Battlefield,
    model: LOSModelFootprint,
    target: Position
  ): LOSResult {
    const perimeter = LOSOperations.buildCircularPerimeterPoints(model.position, model.baseDiameter);
    const sourceHeights = LOSOperations.buildVisibleAreaHeightSamples(model);
    let nearestBlocked: { feature: TerrainFeature; distance: number } | null = null;
    const blockers = battlefield.terrain.filter(feature =>
      LOSOperations.isLosBlockingForSizes(feature, model.siz, model.siz)
    );

    for (const point of perimeter) {
      for (const sourceHeight of sourceHeights) {
        const hit = LOSOperations.findNearestBlockingElementWithHeight(
          point,
          target,
          blockers,
          sourceHeight
        );
        if (!hit) {
          return { clear: true };
        }
        const distance = LOSOperations.distance(point, target);
        if (!nearestBlocked || distance < nearestBlocked.distance) {
          nearestBlocked = { feature: hit, distance };
        }
      }
    }

    return nearestBlocked ? { clear: false, blockedBy: nearestBlocked.feature } : { clear: false };
  }

  static checkLOSFromPointToModel(
    battlefield: Battlefield,
    start: Position,
    targetModel: LOSModelFootprint
  ): LOSResult {
    const perimeter = LOSOperations.buildCircularPerimeterPoints(targetModel.position, targetModel.baseDiameter);
    const targetHeights = LOSOperations.buildVisibleAreaHeightSamples(targetModel);
    let nearestBlocked: { feature: TerrainFeature; distance: number } | null = null;
    const blockers = battlefield.terrain.filter(feature =>
      LOSOperations.isLosBlockingForSizes(feature, targetModel.siz, targetModel.siz)
    );

    for (const point of perimeter) {
      for (const targetHeight of targetHeights) {
        const hit = LOSOperations.findNearestBlockingElementWithHeight(
          start,
          point,
          blockers,
          targetHeight
        );
        if (!hit) {
          return { clear: true };
        }
        const distance = LOSOperations.distance(start, point);
        if (!nearestBlocked || distance < nearestBlocked.distance) {
          nearestBlocked = { feature: hit, distance };
        }
      }
    }

    return nearestBlocked ? { clear: false, blockedBy: nearestBlocked.feature } : { clear: false };
  }

  static checkLOSFromModelToModel(
    battlefield: Battlefield,
    source: LOSModelFootprint,
    target: LOSModelFootprint
  ): LOSResult {
    const sourcePerimeter = LOSOperations.buildCircularPerimeterPoints(source.position, source.baseDiameter);
    const targetPerimeter = LOSOperations.buildCircularPerimeterPoints(target.position, target.baseDiameter);
    const sourceHeights = LOSOperations.buildVisibleAreaHeightSamples(source);
    const targetHeights = LOSOperations.buildVisibleAreaHeightSamples(target);
    const requiredVisibleSamples = 1;

    let visibleCount = 0;
    let nearestBlocked: { feature: TerrainFeature; distance: number } | null = null;
    const blockers = battlefield.terrain.filter(feature =>
      LOSOperations.isLosBlockingForSizes(feature, source.siz, target.siz)
    );

    for (const targetPoint of targetPerimeter) {
      for (const targetHeight of targetHeights) {
        let targetVisible = false;
        for (const sourcePoint of sourcePerimeter) {
          for (const sourceHeight of sourceHeights) {
            const hit = LOSOperations.findNearestBlockingElementWithHeight(
              sourcePoint,
              targetPoint,
              blockers,
              Math.min(sourceHeight, targetHeight)
            );
            if (!hit) {
              targetVisible = true;
              break;
            }
          }
          if (targetVisible) {
            break;
          }
        }

        if (targetVisible) {
          visibleCount++;
          if (visibleCount >= requiredVisibleSamples) {
            return { clear: true };
          }
        } else {
          const distance = LOSOperations.distance(source.position, targetPoint);
          const hit = LOSOperations.findNearestBlockingElementWithHeight(
            source.position,
            targetPoint,
            blockers,
            targetHeight
          );
          if (hit) {
            if (!nearestBlocked || distance < nearestBlocked.distance) {
              nearestBlocked = { feature: hit, distance };
            }
          }
        }
      }
    }

    return nearestBlocked ? { clear: false, blockedBy: nearestBlocked.feature } : { clear: false };
  }

  static estimateBlockedFraction(
    battlefield: Battlefield,
    width: number,
    height: number,
    options: LOSSampleOptions = {}
  ): number {
    const samples = options.samples ?? 60;
    const segmentLength = options.segmentLength ?? 8;

    if (samples <= 0) return 0;

    let blocked = 0;
    let tested = 0;

    for (let i = 0; i < samples; i++) {
      const angle = Math.random() * Math.PI * 2;
      const start: Position = {
        x: Math.random() * width,
        y: Math.random() * height,
      };
      const end: Position = {
        x: start.x + Math.cos(angle) * segmentLength,
        y: start.y + Math.sin(angle) * segmentLength,
      };

      if (end.x < 0 || end.x > width || end.y < 0 || end.y > height) {
        continue;
      }

      tested++;
      if (!battlefield.hasLineOfSight(start, end)) {
        blocked++;
      }
    }

    if (tested === 0) return 0;
    return blocked / tested;
  }

  static buildCircularPerimeterPoints(center: Position, diameter: number): Position[] {
    const radius = diameter / 2;
    const perimeter = Math.PI * diameter;
    const density = 2; // points per MU
    const count = Math.max(8, Math.ceil(perimeter * density));
    const points: Position[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    return points;
  }

  static findNearestBlockingElement(
    start: Position,
    end: Position,
    blockers: TerrainFeature[]
  ): TerrainFeature | null {
    let nearest: { feature: TerrainFeature; distance: number } | null = null;

    for (const feature of blockers) {
      const hit = LOSOperations.findNearestIntersectionOnFeature(start, end, feature);
      if (!hit) continue;
      if (!nearest || hit.distance < nearest.distance) {
        nearest = { feature, distance: hit.distance };
      }
    }

    return nearest ? nearest.feature : null;
  }

  static findNearestBlockingElementWithHeight(
    start: Position,
    end: Position,
    blockers: TerrainFeature[],
    sampleHeightMu: number
  ): TerrainFeature | null {
    let nearest: { feature: TerrainFeature; distance: number } | null = null;

    for (const feature of blockers) {
      if (!LOSOperations.blocksAtHeight(feature, sampleHeightMu)) {
        continue;
      }
      const hit = LOSOperations.findNearestIntersectionOnFeature(start, end, feature);
      if (!hit) continue;
      if (!nearest || hit.distance < nearest.distance) {
        nearest = { feature, distance: hit.distance };
      }
    }

    return nearest ? nearest.feature : null;
  }

  private static segmentIntersectsFeature(
    start: Position,
    end: Position,
    feature: TerrainFeature
  ): boolean {
    const vertices = feature.vertices;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      if (LOSOperations.segmentIntersection(start, end, vertices[j], vertices[i])) {
        return true;
      }
    }
    return false;
  }

  private static findNearestIntersectionOnFeature(
    start: Position,
    end: Position,
    feature: TerrainFeature
  ): { distance: number } | null {
    let nearestDistance = Infinity;
    const vertices = feature.vertices;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const intersection = LOSOperations.segmentIntersection(start, end, vertices[j], vertices[i]);
      if (!intersection) continue;
      const distance = LOSOperations.distance(start, intersection);
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    }
    return Number.isFinite(nearestDistance) ? { distance: nearestDistance } : null;
  }

  private static blocksAtHeight(feature: TerrainFeature, sampleHeightMu: number): boolean {
    if (LOSOperations.isLosBlocking(feature)) {
      return true;
    }
    const terrainHeight = LOSOperations.getTerrainHeightMu(feature);
    return terrainHeight > sampleHeightMu + LOSOperations.SIZE_EPSILON;
  }

  private static buildVisibleAreaHeightSamples(model: LOSModelFootprint): number[] {
    const baseHeight = LOSOperations.resolveVisibleAreaHeight(model);
    if (baseHeight <= 0) {
      return [0];
    }

    const samples: number[] = [];
    const denominator = LOSOperations.VISIBLE_HEIGHT_SAMPLES + 1;
    for (let i = 1; i <= LOSOperations.VISIBLE_HEIGHT_SAMPLES; i++) {
      samples.push((baseHeight * i) / denominator);
    }
    return samples;
  }

  private static resolveVisibleAreaHeight(model: LOSModelFootprint): number {
    if (Number.isFinite(model.baseDiameter) && model.baseDiameter > 0) {
      return model.baseDiameter;
    }
    return LOSOperations.resolveBaseHeightFromSiz(model.siz);
  }

  private static resolveBaseHeightFromSiz(siz?: number): number {
    if (!Number.isFinite(siz) || siz === undefined || siz <= 0) {
      return 0;
    }
    return siz;
  }

  static segmentIntersection(
    p1: Position,
    p2: Position,
    p3: Position,
    p4: Position
  ): Position | null {
    return segmentIntersection(p1, p2, p3, p4);
  }

  static distance(a: Position, b: Position): number {
    return distance(a, b);
  }
}

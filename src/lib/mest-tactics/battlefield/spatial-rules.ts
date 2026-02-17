import { Battlefield } from './Battlefield';
import { LOSOperations } from './LOSOperations';
import { LOFOperations, LOFModel } from './LOFOperations';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';
import { TestContext } from '../TestContext';

export interface SpatialModel extends LOFModel {
  position: Position;
  baseDiameter: number;
  siz?: number;
}

export interface SpatialAttackContext {
  battlefield: Battlefield;
  attacker: SpatialModel;
  target: SpatialModel;
}

export interface CoverResult {
  hasLOS: boolean;
  hasDirectCover: boolean;
  hasInterveningCover: boolean;
  blockingFeature?: TerrainFeature;
  blockingModelId?: string;
  coveringModelId?: string;
  coverFeatures: TerrainFeature[];
}

const DISTANCE_EPSILON = 1e-6;

export class SpatialRules {
  static isEngaged(a: SpatialModel, b: SpatialModel): boolean {
    return LOFOperations.isBaseContact(a, b);
  }

  static getEngagedModels(source: SpatialModel, models: SpatialModel[]): SpatialModel[] {
    return models.filter(model => model.id !== source.id && SpatialRules.isEngaged(source, model));
  }

  static distanceEdgeToEdge(a: SpatialModel, b: SpatialModel): number {
    return LOFOperations.distanceEdgeToEdge(a, b);
  }

  static hasLineOfSight(battlefield: Battlefield, source: SpatialModel, target: SpatialModel): boolean {
    return LOSOperations.checkLOSFromModelToModel(battlefield, source, target).clear;
  }

  static getCoverResult(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel
  ): CoverResult {
    const coverFeatures = battlefield.terrain.filter(feature => SpatialRules.isCoverFeature(feature));
    const sourceDirectCover = coverFeatures.filter(feature => SpatialRules.modelOverlapsFeature(source, feature));
    const targetDirectCover = coverFeatures.filter(feature => SpatialRules.modelOverlapsFeature(target, feature));

    let hasDirectCover = targetDirectCover.length > 0;
    let hasInterveningCover = coverFeatures.some(feature => {
      if (targetDirectCover.includes(feature)) return false;
      return SpatialRules.segmentIntersectsFeature(
        source.position,
        target.position,
        feature,
        target.baseDiameter / 2
      );
    });

    if (sourceDirectCover.length > 0) {
      hasInterveningCover = true;
    }

    const modelCoverId = SpatialRules.findCoveringModel(battlefield, source, target);
    if (modelCoverId) {
      hasInterveningCover = true;
    }

    const modelBlocker = SpatialRules.findBlockingModel(battlefield, source, target);
    if (modelBlocker) {
      return {
        hasLOS: false,
        hasDirectCover: false,
        hasInterveningCover: false,
        blockingModelId: modelBlocker.id,
        coveringModelId: modelCoverId ?? undefined,
        coverFeatures: [],
      };
    }

    const losResult = LOSOperations.checkLOSFromModelToModel(battlefield, source, target);
    if (!losResult.clear) {
      return {
        hasLOS: false,
        hasDirectCover: false,
        hasInterveningCover: false,
        blockingFeature: losResult.blockedBy,
        coveringModelId: modelCoverId ?? undefined,
        coverFeatures: [],
      };
    }

    return {
      hasLOS: true,
      hasDirectCover,
      hasInterveningCover,
      coveringModelId: modelCoverId ?? undefined,
      coverFeatures,
    };
  }

  static buildRangedContextFromSpatial(
    context: SpatialAttackContext
  ): Partial<TestContext> {
    const cover = SpatialRules.getCoverResult(context.battlefield, context.attacker, context.target);
    const hasHardCover = cover.coverFeatures.some(feature => feature.meta?.los === 'Hard');
    return {
      hasDirectCover: cover.hasDirectCover,
      hasInterveningCover: cover.hasInterveningCover,
      hasHardCover,
    };
  }

  private static isCoverFeature(feature: TerrainFeature): boolean {
    if (feature.type === TerrainType.Obstacle) return false;
    const los = feature.meta?.los ?? 'Clear';
    return los === 'Soft' || los === 'Hard';
  }

  private static findBlockingModel(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel
  ): { id: string; position: Position; baseDiameter: number; siz: number } | null {
    const maxSize = Math.max(source.siz ?? 0, target.siz ?? 0);
    const blockers = battlefield.getModelBlockers([source.id, target.id]);
    for (const blocker of blockers) {
      const shouldCheck = blocker.isKOd || blocker.siz > maxSize;
      if (!shouldCheck) continue;
      const radius = blocker.isKOd ? blocker.baseDiameter / 4 : blocker.baseDiameter / 2;
      const distance = LOFOperations.distancePointToSegment(
        blocker.position,
        source.position,
        target.position
      );
      if (distance <= radius + DISTANCE_EPSILON) {
        return blocker;
      }
    }
    return null;
  }

  private static findCoveringModel(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel
  ): string | null {
    const blockers = battlefield.getModelBlockers([source.id, target.id]);
    const targetSiz = target.siz ?? 0;
    for (const blocker of blockers) {
      if (!blocker.isKOd) continue;
      if (targetSiz > blocker.siz - 3) continue;
      const radius = blocker.baseDiameter / 2;
      const distance = LOFOperations.distancePointToSegment(
        blocker.position,
        source.position,
        target.position
      );
      if (distance <= radius + DISTANCE_EPSILON) {
        return blocker.id;
      }
    }
    return null;
  }

  private static modelOverlapsFeature(model: SpatialModel, feature: TerrainFeature): boolean {
    const radius = model.baseDiameter / 2;
    const samples = LOSOperations.buildCircularPerimeterPoints(model.position, model.baseDiameter);
    samples.push(model.position);
    for (const sample of samples) {
      if (SpatialRules.pointInPolygon(sample, feature.vertices)) {
        return true;
      }
    }
    const closest = SpatialRules.closestDistanceToPolygon(model.position, feature.vertices);
    return closest <= radius + DISTANCE_EPSILON;
  }

  private static segmentIntersectsFeature(
    start: Position,
    end: Position,
    feature: TerrainFeature,
    targetRadius: number
  ): boolean {
    const intersections = SpatialRules.segmentPolygonIntersections(start, end, feature.vertices);
    if (intersections.length === 0) {
      return false;
    }
    const targetDistance = LOSOperations.distance(start, end);
    for (const hit of intersections) {
      const hitDistance = LOSOperations.distance(start, hit);
      if (hitDistance <= targetDistance - targetRadius - DISTANCE_EPSILON) {
        return true;
      }
    }
    return false;
  }

  private static segmentPolygonIntersections(
    start: Position,
    end: Position,
    polygon: Position[]
  ): Position[] {
    const intersections: Position[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const hit = LOSOperations.segmentIntersection(start, end, polygon[j], polygon[i]);
      if (hit) intersections.push(hit);
    }
    return intersections;
  }

  private static closestDistanceToPolygon(point: Position, polygon: Position[]): number {
    let min = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const distance = SpatialRules.pointToSegmentDistance(point, polygon[j], polygon[i]);
      if (distance < min) min = distance;
    }
    return min;
  }

  private static pointToSegmentDistance(point: Position, a: Position, b: Position): number {
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (lengthSquared === 0) return LOSOperations.distance(point, a);
    let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    return LOSOperations.distance(point, projection);
  }

  private static pointInPolygon(point: Position, polygon: Position[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }
}

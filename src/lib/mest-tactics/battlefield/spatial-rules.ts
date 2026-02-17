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
const COVER_EXTENSION_MU = 0.5;

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
    const sourceDirectCover = coverFeatures.filter(feature =>
      SpatialRules.modelOverlapsFeature(source, feature, SpatialRules.coverExtension(feature))
    );
    const targetDirectCover = coverFeatures.filter(feature =>
      SpatialRules.modelOverlapsFeature(target, feature, SpatialRules.coverExtension(feature))
    );

    let hasDirectCover = targetDirectCover.length > 0;
    let hasInterveningCover = coverFeatures.some(feature => {
      if (targetDirectCover.includes(feature)) return false;
      return SpatialRules.segmentIntersectsFeature(
        source.position,
        target.position,
        feature,
        target.baseDiameter / 2,
        SpatialRules.coverExtension(feature)
      );
    });

    if (sourceDirectCover.length > 0) {
      hasInterveningCover = true;
    }

    const modelCoverId = SpatialRules.findCoveringModel(battlefield, source, target);
    if (modelCoverId) {
      hasInterveningCover = true;
    }

    const coverBlocker = SpatialRules.findBlockingCoverFeature(source, target, coverFeatures);
    if (coverBlocker) {
      return {
        hasLOS: false,
        hasDirectCover: false,
        hasInterveningCover: false,
        blockingFeature: coverBlocker,
        coveringModelId: modelCoverId ?? undefined,
        coverFeatures: [],
      };
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

  private static coverExtension(feature: TerrainFeature): number {
    const los = feature.meta?.los ?? 'Clear';
    if (los === 'Soft' || los === 'Hard') {
      return COVER_EXTENSION_MU;
    }
    return 0;
  }

  private static findBlockingCoverFeature(
    source: SpatialModel,
    target: SpatialModel,
    coverFeatures: TerrainFeature[]
  ): TerrainFeature | null {
    const targetRadius = target.baseDiameter / 2;
    for (const feature of coverFeatures) {
      const extension = SpatialRules.coverExtension(feature);
      if (SpatialRules.segmentIntersectsFeature(source.position, target.position, feature, targetRadius, extension)) {
        return feature;
      }
    }
    return null;
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

  private static modelOverlapsFeature(
    model: SpatialModel,
    feature: TerrainFeature,
    buffer = 0
  ): boolean {
    const radius = model.baseDiameter / 2;
    const samples = LOSOperations.buildCircularPerimeterPoints(model.position, model.baseDiameter);
    samples.push(model.position);
    for (const sample of samples) {
      if (SpatialRules.pointInPolygon(sample, feature.vertices)) {
        return true;
      }
    }
    const closest = SpatialRules.closestDistanceToPolygon(model.position, feature.vertices);
    return closest <= radius + buffer + DISTANCE_EPSILON;
  }

  private static segmentIntersectsFeature(
    start: Position,
    end: Position,
    feature: TerrainFeature,
    targetRadius: number,
    buffer = 0
  ): boolean {
    const clipped = SpatialRules.clipSegmentEnd(start, end, targetRadius);
    if (!clipped) {
      return false;
    }
    const intersections = SpatialRules.segmentPolygonIntersections(clipped.start, clipped.end, feature.vertices);
    if (intersections.length === 0) {
      if (buffer <= 0) {
        return false;
      }
      const distance = SpatialRules.segmentDistanceToPolygon(clipped.start, clipped.end, feature.vertices);
      return distance <= buffer + DISTANCE_EPSILON;
    }
    const targetDistance = LOSOperations.distance(clipped.start, clipped.end);
    for (const hit of intersections) {
      const hitDistance = LOSOperations.distance(clipped.start, hit);
      if (hitDistance <= targetDistance + DISTANCE_EPSILON) {
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

  private static clipSegmentEnd(
    start: Position,
    end: Position,
    clipDistance: number
  ): { start: Position; end: Position } | null {
    if (clipDistance <= 0) return { start, end };
    const length = LOSOperations.distance(start, end);
    if (length <= clipDistance + DISTANCE_EPSILON) return null;
    const ratio = (length - clipDistance) / length;
    return {
      start,
      end: {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      },
    };
  }

  private static segmentDistanceToPolygon(
    start: Position,
    end: Position,
    polygon: Position[]
  ): number {
    let min = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const distance = SpatialRules.segmentToSegmentDistance(start, end, polygon[j], polygon[i]);
      if (distance < min) min = distance;
      if (min <= 0) return 0;
    }
    return min;
  }

  private static segmentToSegmentDistance(
    a1: Position,
    a2: Position,
    b1: Position,
    b2: Position
  ): number {
    if (SpatialRules.segmentsIntersect(a1, a2, b1, b2)) return 0;
    return Math.min(
      SpatialRules.pointToSegmentDistance(a1, b1, b2),
      SpatialRules.pointToSegmentDistance(a2, b1, b2),
      SpatialRules.pointToSegmentDistance(b1, a1, a2),
      SpatialRules.pointToSegmentDistance(b2, a1, a2)
    );
  }

  private static segmentsIntersect(
    p1: Position,
    p2: Position,
    p3: Position,
    p4: Position
  ): boolean {
    const o1 = SpatialRules.orientation(p1, p2, p3);
    const o2 = SpatialRules.orientation(p1, p2, p4);
    const o3 = SpatialRules.orientation(p3, p4, p1);
    const o4 = SpatialRules.orientation(p3, p4, p2);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && SpatialRules.onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && SpatialRules.onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && SpatialRules.onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && SpatialRules.onSegment(p3, p2, p4)) return true;
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

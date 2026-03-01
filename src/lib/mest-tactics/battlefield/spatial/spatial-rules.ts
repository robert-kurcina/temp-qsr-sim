import { Battlefield } from '../Battlefield';
import { LOSOperations } from '../los/LOSOperations';
import { LOFOperations, LOFModel } from '../los/LOFOperations';
import { Position } from '../battlefield/Position';
import { TerrainFeature, TerrainType } from '../terrain/Terrain';
import { TestContext } from '../../utils/TestContext';
import {
  orientation,
  onSegment,
  segmentsIntersect,
  pointInPolygon,
  pointToSegmentDistance,
  segmentToSegmentDistance,
  closestDistanceToPolygon,
  segmentDistanceToPolygon,
  segmentPolygonIntersections,
  clipSegmentEnd,
} from '../terrain/BattlefieldUtils';

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
  directCoverFeatures: TerrainFeature[];
  interveningCoverFeatures: TerrainFeature[];
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
    if (!LOSOperations.checkLOSFromModelToModel(battlefield, source, target).clear) {
      return false;
    }
    return !SpatialRules.findBlockingModel(battlefield, source, target);
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
    const interveningCoverFeatures = coverFeatures.filter(feature => {
      if (targetDirectCover.includes(feature)) return false;
      return SpatialRules.segmentIntersectsFeature(
        source.position,
        target.position,
        feature,
        target.baseDiameter / 2,
        SpatialRules.coverExtension(feature)
      );
    });
    let hasInterveningCover = interveningCoverFeatures.length > 0;

    if (sourceDirectCover.length > 0) {
      hasInterveningCover = true;
    }

    const modelCoverId = SpatialRules.findCoveringModel(battlefield, source, target);
    if (modelCoverId) {
      hasInterveningCover = true;
    }

    const overlapBlocker = targetDirectCover.find(feature =>
      LOSOperations.isLosBlockingForSizes(feature, source.siz, target.siz)
    );
    if (overlapBlocker) {
      return {
        hasLOS: false,
        hasDirectCover: false,
        hasInterveningCover: false,
        directCoverFeatures: [],
        interveningCoverFeatures: [],
        blockingFeature: overlapBlocker,
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
        directCoverFeatures: [],
        interveningCoverFeatures: [],
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
        directCoverFeatures: [],
        interveningCoverFeatures: [],
        blockingFeature: losResult.blockedBy,
        coveringModelId: modelCoverId ?? undefined,
        coverFeatures: [],
      };
    }

    return {
      hasLOS: true,
      hasDirectCover,
      hasInterveningCover,
      directCoverFeatures: targetDirectCover,
      interveningCoverFeatures: [
        ...interveningCoverFeatures,
        ...sourceDirectCover.filter(feature => !interveningCoverFeatures.includes(feature)),
      ],
      coveringModelId: modelCoverId ?? undefined,
      coverFeatures,
    };
  }

  static buildRangedContextFromSpatial(
    context: SpatialAttackContext
  ): Partial<TestContext> {
    const cover = SpatialRules.getCoverResult(context.battlefield, context.attacker, context.target);
    const hasHardCover = cover.directCoverFeatures.some(feature => feature.meta?.los === 'Hard');
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
      if (pointInPolygon(sample, feature.vertices)) {
        return true;
      }
    }
    const closest = closestDistanceToPolygon(model.position, feature.vertices);
    return closest <= radius + buffer + DISTANCE_EPSILON;
  }

  private static segmentIntersectsFeature(
    start: Position,
    end: Position,
    feature: TerrainFeature,
    targetRadius: number,
    buffer = 0
  ): boolean {
    const clipped = clipSegmentEnd(start, end, targetRadius);
    if (!clipped) {
      return false;
    }
    const intersections = segmentPolygonIntersections(clipped.start, clipped.end, feature.vertices);
    if (intersections.length === 0) {
      if (buffer <= 0) {
        return false;
      }
      const distance = segmentDistanceToPolygon(clipped.start, clipped.end, feature.vertices);
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
}

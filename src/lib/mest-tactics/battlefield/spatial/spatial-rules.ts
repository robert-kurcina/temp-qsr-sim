import { Battlefield } from '../Battlefield';
import { LOSOperations } from '../los/LOSOperations';
import { LOFOperations, LOFModel } from '../los/LOFOperations';
import { Position } from '../Position';
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
  isPanicked?: boolean;
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
  visibleAreaObscuredFraction: number;
  isHalfVisibleAreaObscured: boolean;
  directCoverFeatures: TerrainFeature[];
  interveningCoverFeatures: TerrainFeature[];
  blockingFeature?: TerrainFeature;
  blockingModelId?: string;
  coveringModelId?: string;
  coverFeatures: TerrainFeature[];
}

const DISTANCE_EPSILON = 1e-6;
const COVER_EXTENSION_MU = 0.5;
const VISIBLE_AREA_THRESHOLD = 0.4;
const VISIBLE_AREA_HEIGHT_SAMPLES = 5;

export class SpatialRules {
  static isEngaged(a: SpatialModel, b: SpatialModel): boolean {
    // QSR PN.5: Panicked characters never cause opposing models to be Engaged.
    if (a.isPanicked || b.isPanicked) {
      return false;
    }
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

  static hasLineOfFire(battlefield: Battlefield, source: SpatialModel, target: SpatialModel): boolean {
    const points = [source.position, target.position];
    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return false;
      }
    }

    if (!battlefield.isWithinBounds(source.position, source.baseDiameter)) {
      return false;
    }
    if (!battlefield.isWithinBounds(target.position, target.baseDiameter)) {
      return false;
    }

    return true;
  }

  static getCoverResult(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel
  ): CoverResult {
    const coverFeatures = battlefield.terrain.filter(feature => SpatialRules.isCoverFeature(feature));
    const sourceDirectCover = coverFeatures.filter(feature =>
      SpatialRules.modelOverlapsFeature(source, feature, SpatialRules.coverExtension(feature))
      && SpatialRules.passesCoverDistanceGate(feature, source, target)
    );
    const targetDirectCover = coverFeatures.filter(feature =>
      SpatialRules.modelOverlapsFeature(target, feature, SpatialRules.coverExtension(feature))
      && SpatialRules.passesCoverDistanceGate(feature, source, target)
    );
    const visibleAreaObscuredFraction = SpatialRules.estimateVisibleAreaObscuredFraction(
      source,
      target,
      coverFeatures
    );
    const isHalfVisibleAreaObscured = visibleAreaObscuredFraction >= VISIBLE_AREA_THRESHOLD;

    let hasDirectCover = targetDirectCover.length > 0;
    const interveningCoverFeatures = coverFeatures.filter(feature => {
      if (targetDirectCover.includes(feature)) return false;
      if (!SpatialRules.passesCoverDistanceGate(feature, source, target)) return false;
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

    // QSR CV.1: explicit ~half visible-area obscuration baseline.
    if (!hasDirectCover && !hasInterveningCover && isHalfVisibleAreaObscured) {
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
        visibleAreaObscuredFraction,
        isHalfVisibleAreaObscured,
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
        visibleAreaObscuredFraction,
        isHalfVisibleAreaObscured,
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
        visibleAreaObscuredFraction,
        isHalfVisibleAreaObscured,
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
      visibleAreaObscuredFraction,
      isHalfVisibleAreaObscured,
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

  private static passesCoverDistanceGate(
    feature: TerrainFeature,
    source: SpatialModel,
    target: SpatialModel
  ): boolean {
    // QSR CV.5: Base-height-only cover must be closer to target than attacker.
    if (LOSOperations.isLosBlockingForSizes(feature, source.siz, target.siz)) {
      return true;
    }
    const sourceDistance = closestDistanceToPolygon(source.position, feature.vertices);
    const targetDistance = closestDistanceToPolygon(target.position, feature.vertices);
    return targetDistance <= sourceDistance + DISTANCE_EPSILON;
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
      const radius = blocker.baseDiameter / 2;
      const distance = LOFOperations.distancePointToSegment(
        blocker.position,
        source.position,
        target.position
      );

      // QSR CV.6: LOF crossing a Distracted model always causes Intervening Cover.
      if (blocker.isDistracted && distance <= radius + DISTANCE_EPSILON) {
        return blocker.id;
      }

      if (!blocker.isKOd) continue;
      if (targetSiz > blocker.siz - 3) continue;
      if (distance <= radius + DISTANCE_EPSILON) {
        return blocker.id;
      }
    }
    return null;
  }

  private static estimateVisibleAreaObscuredFraction(
    source: SpatialModel,
    target: SpatialModel,
    coverFeatures: TerrainFeature[]
  ): number {
    if (coverFeatures.length === 0) {
      return 0;
    }

    const sourcePoints = LOSOperations.buildCircularPerimeterPoints(source.position, source.baseDiameter);
    sourcePoints.push(source.position);
    const targetPoints = LOSOperations.buildCircularPerimeterPoints(target.position, target.baseDiameter);
    targetPoints.push(target.position);

    const sourceHeights = SpatialRules.buildVisibleAreaHeightSamples(source.baseDiameter);
    const targetHeights = SpatialRules.buildVisibleAreaHeightSamples(target.baseDiameter);

    let obscuredSamples = 0;
    let totalSamples = 0;

    for (const targetPoint of targetPoints) {
      for (const targetHeight of targetHeights) {
        totalSamples++;
        let visible = false;

        for (const sourcePoint of sourcePoints) {
          for (const sourceHeight of sourceHeights) {
            if (!SpatialRules.segmentObscuredByCoverFeatures(
              sourcePoint,
              targetPoint,
              Math.min(sourceHeight, targetHeight),
              source,
              target,
              coverFeatures
            )) {
              visible = true;
              break;
            }
          }
          if (visible) {
            break;
          }
        }

        if (!visible) {
          obscuredSamples++;
        }
      }
    }

    if (totalSamples <= 0) {
      return 0;
    }
    return obscuredSamples / totalSamples;
  }

  private static segmentObscuredByCoverFeatures(
    start: Position,
    end: Position,
    sampleHeightMu: number,
    source: SpatialModel,
    target: SpatialModel,
    features: TerrainFeature[]
  ): boolean {
    for (const feature of features) {
      if (!SpatialRules.passesCoverDistanceGate(feature, source, target)) {
        continue;
      }
      if (!SpatialRules.segmentIntersectsFeature(start, end, feature, 0, SpatialRules.coverExtension(feature))) {
        continue;
      }

      if (LOSOperations.isLosBlockingForSizes(feature, source.siz, target.siz)) {
        return true;
      }

      const terrainHeight = LOSOperations.getTerrainHeightMu(feature);
      if (terrainHeight > sampleHeightMu + DISTANCE_EPSILON) {
        return true;
      }
    }
    return false;
  }

  private static buildVisibleAreaHeightSamples(baseDiameter: number): number[] {
    if (!Number.isFinite(baseDiameter) || baseDiameter <= 0) {
      return [0];
    }

    const samples: number[] = [];
    const denominator = VISIBLE_AREA_HEIGHT_SAMPLES + 1;
    for (let i = 1; i <= VISIBLE_AREA_HEIGHT_SAMPLES; i++) {
      samples.push((baseDiameter * i) / denominator);
    }
    return samples;
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

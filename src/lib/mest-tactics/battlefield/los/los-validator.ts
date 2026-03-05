import { Battlefield } from '../';
import { Position } from '../';
import { LOSOperations, LOSModelFootprint, LOSResult } from './LOSOperations';
import { TerrainFeature, TerrainType } from '../terrain/Terrain';
import { SpatialModel } from '../spatial/spatial-rules';
import { LOFOperations, LOFModel } from './LOFOperations';

/**
 * Extended LOS result with model occlusion information
 */
export interface ExtendedLOSResult extends LOSResult {
  blockedByModel?: string;
  blockedByTerrain?: TerrainFeature;
  partialCover: boolean;
  softCover: boolean;
  hardCover: boolean;
}

/**
 * LOS query options
 */
export interface LOSQueryOptions {
  checkModelOcclusion?: boolean;
  checkTerrainBlocking?: boolean;
  checkCoverType?: boolean;
  widthMu?: number; // For width-aware LOS checks
}

/**
 * LOSValidator provides comprehensive line-of-sight validation
 * including terrain blocking, model occlusion, and cover classification
 */
export class LOSValidator {
  /**
   * Check LOS between two models with full validation
   */
  static checkLOS(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel,
    options: LOSQueryOptions = {}
  ): ExtendedLOSResult {
    const checkModels = options.checkModelOcclusion ?? true;
    const checkTerrain = options.checkTerrainBlocking ?? true;
    const checkCover = options.checkCoverType ?? true;

    // Start with base LOS check from existing LOSOperations
    const baseResult = LOSOperations.checkLOSFromModelToModel(battlefield, source, target);

    const result: ExtendedLOSResult = {
      clear: baseResult.clear,
      blockedByModel: undefined,
      blockedByTerrain: baseResult.blockedBy,
      partialCover: false,
      softCover: false,
      hardCover: false,
    };

    // Check model occlusion
    if (checkModels && result.clear) {
      const modelBlocker = this.findOccludingModel(battlefield, source, target);
      if (modelBlocker) {
        result.clear = false;
        result.blockedByModel = modelBlocker;
      }
    }

    // Classify cover type
    if (checkCover) {
      const coverType = this.classifyCover(battlefield, source, target);
      result.partialCover = coverType.partial;
      result.softCover = coverType.soft;
      result.hardCover = coverType.hard;
    }

    return result;
  }

  /**
   * Check if a model has LOS to a position
   */
  static checkLOSToPosition(
    battlefield: Battlefield,
    source: SpatialModel,
    targetPosition: Position,
    options: LOSQueryOptions = {}
  ): ExtendedLOSResult {
    const checkModels = options.checkModelOcclusion ?? true;
    const checkCover = options.checkCoverType ?? true;

    const baseResult = LOSOperations.checkLOSFromModelToPoint(battlefield, source, targetPosition);

    const result: ExtendedLOSResult = {
      clear: baseResult.clear,
      blockedByModel: undefined,
      blockedByTerrain: baseResult.blockedBy,
      partialCover: false,
      softCover: false,
      hardCover: false,
    };

    if (checkModels && result.clear) {
      const modelBlocker = this.findOccludingModelToPoint(battlefield, source, targetPosition);
      if (modelBlocker) {
        result.clear = false;
        result.blockedByModel = modelBlocker;
      }
    }

    if (checkCover) {
      const coverType = this.classifyCoverToPoint(battlefield, source, targetPosition);
      result.partialCover = coverType.partial;
      result.softCover = coverType.soft;
      result.hardCover = coverType.hard;
    }

    return result;
  }

  /**
   * Find a model that blocks LOS between source and target
   */
  static findOccludingModel(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel
  ): string | null {
    const blockers = battlefield.getModelBlockers([source.id, target.id]);
    const maxSiz = Math.max(source.siz ?? 0, target.siz ?? 0);

    for (const blocker of blockers) {
      // KO'd models block at reduced radius
      const radius = blocker.isKOd ? blocker.baseDiameter / 4 : blocker.baseDiameter / 2;

      // Check if LOS passes through blocker
      const distance = LOFOperations.distancePointToSegment(
        blocker.position,
        source.position,
        target.position
      );

      if (distance <= radius) {
        // Large models always block, small models only block if bigger than source/target
        if (blocker.siz > maxSiz || blocker.isKOd) {
          return blocker.id;
        }
      }
    }

    return null;
  }

  /**
   * Find a model that blocks LOS to a point
   */
  static findOccludingModelToPoint(
    battlefield: Battlefield,
    source: SpatialModel,
    targetPosition: Position
  ): string | null {
    const blockers = battlefield.getModelBlockers([source.id]);

    for (const blocker of blockers) {
      const radius = blocker.baseDiameter / 2;
      const distance = LOFOperations.distancePointToSegment(
        blocker.position,
        source.position,
        targetPosition
      );

      if (distance <= radius) {
        return blocker.id;
      }
    }

    return null;
  }

  /**
   * Classify cover type between two models
   */
  static classifyCover(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel
  ): { partial: boolean; soft: boolean; hard: boolean } {
    const coverFeatures = battlefield.terrain.filter(f => this.isCoverFeature(f));

    let hasSoft = false;
    let hasHard = false;

    // Check for cover overlapping target
    for (const feature of coverFeatures) {
      if (this.modelOverlapsFeature(target, feature)) {
        if (feature.meta?.los === 'Hard') {
          hasHard = true;
        } else if (feature.meta?.los === 'Soft') {
          hasSoft = true;
        }
      }
    }

    return {
      partial: hasSoft || hasHard,
      soft: hasSoft && !hasHard,
      hard: hasHard,
    };
  }

  /**
   * Classify cover type to a point
   */
  static classifyCoverToPoint(
    battlefield: Battlefield,
    source: SpatialModel,
    targetPosition: Position
  ): { partial: boolean; soft: boolean; hard: boolean } {
    const coverFeatures = battlefield.terrain.filter(f => this.isCoverFeature(f));

    let hasSoft = false;
    let hasHard = false;

    for (const feature of coverFeatures) {
      if (this.pointInPolygon(targetPosition, feature.vertices)) {
        if (feature.meta?.los === 'Hard') {
          hasHard = true;
        } else if (feature.meta?.los === 'Soft') {
          hasSoft = true;
        }
      }
    }

    return {
      partial: hasSoft || hasHard,
      soft: hasSoft && !hasHard,
      hard: hasHard,
    };
  }

  /**
   * Check if a feature provides cover
   */
  private static isCoverFeature(feature: TerrainFeature): boolean {
    if (feature.type === TerrainType.Obstacle) return false;
    const los = feature.meta?.los ?? 'Clear';
    return los === 'Soft' || los === 'Hard';
  }

  /**
   * Check if a model overlaps a terrain feature
   */
  private static modelOverlapsFeature(model: SpatialModel, feature: TerrainFeature): boolean {
    const radius = model.baseDiameter / 2;
    const samples = LOSOperations.buildCircularPerimeterPoints(model.position, model.baseDiameter);
    samples.push(model.position);

    for (const sample of samples) {
      if (this.pointInPolygon(sample, feature.vertices)) {
        return true;
      }
    }

    // Check if any perimeter point is within radius of feature
    for (const sample of samples) {
      const closest = this.closestDistanceToPolygon(sample, feature.vertices);
      if (closest <= radius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a point is inside a polygon
   */
  private static pointInPolygon(point: Position, polygon: Position[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y))
        && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Get closest distance from point to polygon
   */
  private static closestDistanceToPolygon(point: Position, polygon: Position[]): number {
    let minDistance = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const distance = this.distancePointToSegment(point, polygon[j], polygon[i]);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return minDistance;
  }

  /**
   * Distance from point to line segment
   */
  private static distancePointToSegment(point: Position, a: Position, b: Position): number {
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (lengthSquared === 0) return LOSOperations.distance(point, a);

    let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projection = {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    };

    return LOSOperations.distance(point, projection);
  }

  /**
   * Check if a position is visible from any model in a list
   */
  static isVisibleFromAny(
    battlefield: Battlefield,
    position: Position,
    observers: SpatialModel[],
    options: LOSQueryOptions = {}
  ): { visible: boolean; observerId?: string } {
    for (const observer of observers) {
      const result = this.checkLOSToPosition(battlefield, observer, position, options);
      if (result.clear) {
        return { visible: true, observerId: observer.id };
      }
    }
    return { visible: false };
  }

  /**
   * Get all models that can see a target
   */
  static getObserversOf(
    battlefield: Battlefield,
    target: SpatialModel,
    potentialObservers: SpatialModel[],
    options: LOSQueryOptions = {}
  ): string[] {
    const observers: string[] = [];
    for (const observer of potentialObservers) {
      if (observer.id === target.id) continue;
      const result = this.checkLOS(battlefield, observer, target, options);
      if (result.clear) {
        observers.push(observer.id);
      }
    }
    return observers;
  }

  /**
   * Check mutual LOS (both models can see each other)
   */
  static hasMutualLOS(
    battlefield: Battlefield,
    source: SpatialModel,
    target: SpatialModel,
    options: LOSQueryOptions = {}
  ): boolean {
    const result1 = this.checkLOS(battlefield, source, target, options);
    if (!result1.clear) return false;

    const result2 = this.checkLOS(battlefield, target, source, options);
    return result2.clear;
  }

  /**
   * Check if a model is in the open (no cover)
   */
  static isInTheOpen(
    battlefield: Battlefield,
    model: SpatialModel
  ): boolean {
    const coverFeatures = battlefield.terrain.filter(f => this.isCoverFeature(f));
    for (const feature of coverFeatures) {
      if (this.modelOverlapsFeature(model, feature)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get the best cover available for a model at a position
   */
  static getBestCoverAt(
    battlefield: Battlefield,
    position: Position,
    baseDiameter: number
  ): { type: 'none' | 'soft' | 'hard'; feature?: TerrainFeature } {
    const coverFeatures = battlefield.terrain.filter(f => this.isCoverFeature(f));
    const tempModel: SpatialModel = {
      id: 'temp',
      position,
      baseDiameter,
      siz: 3,
    };

    let bestCover: { type: 'none' | 'soft' | 'hard'; feature?: TerrainFeature } = { type: 'none' };

    for (const feature of coverFeatures) {
      if (this.modelOverlapsFeature(tempModel, feature)) {
        if (feature.meta?.los === 'Hard') {
          return { type: 'hard', feature };
        }
        if (bestCover.type !== 'hard') {
          bestCover = { type: 'soft', feature };
        }
      }
    }

    return bestCover;
  }
}

/**
 * LOFValidator provides line-of-fire validation for ranged attacks
 */
export class LOFValidator {
  /**
   * Check LOF for a ranged attack with friendly fire detection
   */
  static checkLOF(
    battlefield: Battlefield,
    attacker: SpatialModel,
    target: SpatialModel,
    options: { lofWidthMu?: number; checkFriendlyFire?: boolean } = {}
  ): {
    clear: boolean;
    blockedBy?: string | TerrainFeature;
    friendlyFireRisk: { candidates: string[]; selected?: string };
  } {
    const lofWidth = options.lofWidthMu ?? 1;
    const checkFriendlyFire = options.checkFriendlyFire ?? true;

    // Check base LOS
    const losResult = LOSOperations.checkLOSFromModelToModel(battlefield, attacker, target);

    // Get blockers (other models)
    const blockers = battlefield.getModelBlockers([attacker.id, target.id]);

    // Check for models along LOF
    const modelsAlongLof = LOFOperations.getModelsAlongLOF(
      attacker.position,
      target.position,
      blockers.map(b => ({
        id: b.id,
        position: b.position,
        baseDiameter: b.baseDiameter,
        isFriendly: true, // Would need side information for real implementation
      })),
      { lofWidth }
    );

    let friendlyFireResult = { candidates: [] as string[], selected: undefined as string | undefined };
    if (checkFriendlyFire && modelsAlongLof.length > 0) {
      const ffResult = LOFOperations.resolveFriendlyFire(
        attacker,
        target,
        modelsAlongLof.map(m => ({ ...m, isFriendly: true })),
        { lofWidth }
      );
      friendlyFireResult = {
        candidates: ffResult.candidates.map(c => c.id),
        selected: ffResult.selected?.id,
      };
    }

    return {
      clear: losResult.clear,
      blockedBy: losResult.blockedBy,
      friendlyFireRisk: friendlyFireResult,
    };
  }

  /**
   * Find the best valid target within range
   */
  static findBestTarget(
    battlefield: Battlefield,
    attacker: SpatialModel,
    potentialTargets: SpatialModel[],
    maxRange: number,
    options: { lofWidthMu?: number; preferClosest?: boolean } = {}
  ): SpatialModel | null {
    const lofWidth = options.lofWidthMu ?? 1;
    const preferClosest = options.preferClosest ?? true;

    const validTargets = potentialTargets.filter(target => {
      if (target.id === attacker.id) return false;

      const distance = LOFOperations.distance(attacker.position, target.position);
      if (distance > maxRange) return false;

      const lofResult = this.checkLOF(battlefield, attacker, target, { lofWidthMu: lofWidth, checkFriendlyFire: false });
      return lofResult.clear;
    });

    if (validTargets.length === 0) return null;

    if (preferClosest) {
      return validTargets.reduce((closest, current) => {
        const closestDist = LOFOperations.distance(attacker.position, closest.position);
        const currentDist = LOFOperations.distance(attacker.position, current.position);
        return currentDist < closestDist ? current : closest;
      });
    }

    return validTargets[0];
  }
}

import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from '../terrain/Terrain';

export interface PathVector {
  from: Position;
  to: Position;
  dx: number;
  dy: number;
  length: number;
  terrain: TerrainType;
}

export interface PathResult {
  vectors: PathVector[];
  totalLength: number;
  totalEffectMu: number;
}

export interface PathLimitedResult extends PathResult {
  points: Position[];
  reachedEnd: boolean;
  usedMu: number;
  remainingMu: number;
}

export interface PathSegmentedResult {
  segments: PathLimitedResult[];
  reachedEnd: boolean;
}

export interface PathfindingOptions {
  gridResolution?: number; // MU per cell
  footprintDiameter?: number; // MU
  tightSpotFraction?: number; // fraction of base diameter allowed in tight spots (0.5 = half diameter)
  movementMetric?: 'length' | 'effect'; // how to measure MU when limiting movement
  useNavMesh?: boolean;
  optimizeWithLOS?: boolean;
  useHierarchical?: boolean;
  hierarchicalChunkSize?: number; // grid cells per chunk
  clearancePenalty?: number; // cost multiplier when only half-width clearance exists
  useTheta?: boolean;
  turnPenalty?: number; // cost added per direction change
  portalNarrowPenalty?: number; // additional cost on near-threshold portal crossings in navmesh
  portalNarrowThresholdFactor?: number; // preferred portal width multiplier vs diameter
}

const defaultGridResolution = 0.5;
const MAX_GRID_CACHE_ENTRIES = 32;
const MAX_PATH_CACHE_ENTRIES = 8000;

interface CachedGridData {
  gridWidth: number;
  gridHeight: number;
  walkable: boolean[][];
  terrainCost: number[][];
  terrainGrid: TerrainType[][];
}

interface BattlefieldPathCache {
  lastTerrainVersion: number;
  grids: Map<string, CachedGridData>;
  paths: Map<string, PathResult>;
  stats: {
    gridHits: number;
    gridMisses: number;
    pathHits: number;
    pathMisses: number;
  };
}

export interface PathfindingCacheStats {
  terrainVersion: number;
  gridCacheSize: number;
  gridCacheMaxSize: number;
  pathCacheSize: number;
  pathCacheMaxSize: number;
  gridHits: number;
  gridMisses: number;
  pathHits: number;
  pathMisses: number;
}

export class PathfindingEngine {
  private battlefield: Battlefield;
  private static battlefieldCaches = new WeakMap<Battlefield, BattlefieldPathCache>();

  constructor(battlefield: Battlefield) {
    this.battlefield = battlefield;
  }

  private getTerrainVersion(): number {
    return this.battlefield.getTerrainVersion();
  }

  private getBattlefieldCache(): BattlefieldPathCache {
    let cache = PathfindingEngine.battlefieldCaches.get(this.battlefield);
    if (!cache) {
      cache = {
        lastTerrainVersion: this.getTerrainVersion(),
        grids: new Map<string, CachedGridData>(),
        paths: new Map<string, PathResult>(),
        stats: {
          gridHits: 0,
          gridMisses: 0,
          pathHits: 0,
          pathMisses: 0,
        },
      };
      PathfindingEngine.battlefieldCaches.set(this.battlefield, cache);
      return cache;
    }

    const terrainVersion = this.getTerrainVersion();
    if (cache.lastTerrainVersion !== terrainVersion) {
      cache.lastTerrainVersion = terrainVersion;
      cache.grids.clear();
      cache.paths.clear();
    }
    return cache;
  }

  private touchMapEntry<K, V>(map: Map<K, V>, key: K, value: V): void {
    map.delete(key);
    map.set(key, value);
  }

  private setBoundedCacheEntry<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
    this.touchMapEntry(map, key, value);
    while (map.size > maxEntries) {
      const oldestKey = map.keys().next().value;
      if (oldestKey === undefined) break;
      map.delete(oldestKey);
    }
  }

  private quantize(value: number): string {
    return value.toFixed(3);
  }

  private buildGridCacheKey(
    gridResolution: number,
    footprintDiameter: number,
    tightSpotFraction: number,
    clearancePenalty: number
  ): string {
    return [
      this.getTerrainVersion(),
      this.quantize(gridResolution),
      this.quantize(footprintDiameter),
      this.quantize(tightSpotFraction),
      this.quantize(clearancePenalty),
    ].join(':');
  }

  private buildPathCacheKey(
    start: Position,
    end: Position,
    gridCacheKey: string,
    options: {
      useNavMesh: boolean;
      useHierarchical: boolean;
      optimizeWithLOS: boolean;
      useTheta: boolean;
      turnPenalty: number;
      hierarchicalChunkSize: number;
      portalNarrowPenalty: number;
      portalNarrowThresholdFactor: number;
    }
  ): string {
    const startKey = `${this.quantize(start.x)},${this.quantize(start.y)}`;
    const endKey = `${this.quantize(end.x)},${this.quantize(end.y)}`;
    return [
      gridCacheKey,
      startKey,
      endKey,
      options.useNavMesh ? 1 : 0,
      options.useHierarchical ? 1 : 0,
      options.optimizeWithLOS ? 1 : 0,
      options.useTheta ? 1 : 0,
      this.quantize(options.turnPenalty),
      options.hierarchicalChunkSize,
      this.quantize(options.portalNarrowPenalty),
      this.quantize(options.portalNarrowThresholdFactor),
    ].join('|');
  }

  private buildGridData(
    gridResolution: number,
    footprintRadius: number,
    fullRadius: number,
    clearancePenalty: number
  ): CachedGridData {
    const gridWidth = Math.max(1, Math.round(this.battlefield.width / gridResolution));
    const gridHeight = Math.max(1, Math.round(this.battlefield.height / gridResolution));
    const walkable: boolean[][] = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(true));
    const terrainCost: number[][] = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(1));
    const terrainGrid: TerrainType[][] = [];

    for (let y = 0; y < gridHeight; y++) {
      const row: TerrainType[] = [];
      for (let x = 0; x < gridWidth; x++) {
        const center = {
          x: (x + 0.5) * gridResolution,
          y: (y + 0.5) * gridResolution,
        };
        const terrainType = this.getTerrainTypeAt(center);
        row.push(terrainType);

        const halfWalkable = this.isWalkable(center, footprintRadius);
        if (!halfWalkable) {
          walkable[y][x] = false;
          continue;
        }
        const fullWalkable = fullRadius > 0 ? this.isWalkable(center, fullRadius) : true;
        const clearancePenaltyFactor = fullWalkable ? 1 : clearancePenalty;
        const weight = terrainType === TerrainType.Rough || terrainType === TerrainType.Difficult ? 2 : 1;
        terrainCost[y][x] = weight * clearancePenaltyFactor;
      }
      terrainGrid.push(row);
    }

    return {
      gridWidth,
      gridHeight,
      walkable,
      terrainCost,
      terrainGrid,
    };
  }

  public getCacheStats(): PathfindingCacheStats {
    const cache = this.getBattlefieldCache();
    return {
      terrainVersion: cache.lastTerrainVersion,
      gridCacheSize: cache.grids.size,
      gridCacheMaxSize: MAX_GRID_CACHE_ENTRIES,
      pathCacheSize: cache.paths.size,
      pathCacheMaxSize: MAX_PATH_CACHE_ENTRIES,
      gridHits: cache.stats.gridHits,
      gridMisses: cache.stats.gridMisses,
      pathHits: cache.stats.pathHits,
      pathMisses: cache.stats.pathMisses,
    };
  }

  /**
   * Finds a path using obstacle inflation + hierarchical grid search.
   *
   * Heuristic: if the effective diameter (tight-spot allowance) <= 0.5 MU and gridResolution is not provided,
   * automatically use a finer grid of 0.25 MU to better model small bases.
   * Clearance: when a cell is only traversable at half-width, apply a penalty so
   * paths prefer full-footprint clearance when available.
   * Tight spots: clearance checks use a fraction of the base diameter (default 0.5).
   */
  findPath(
    start: Position,
    end: Position,
    options: PathfindingOptions = {}
  ): PathResult {
    const footprintDiameter = options.footprintDiameter ?? 0;
    const tightSpotDiameter = this.resolveTightSpotDiameter(footprintDiameter, options.tightSpotFraction);
    const effectiveDiameter = tightSpotDiameter || footprintDiameter;
    const gridResolution = options.gridResolution ?? (effectiveDiameter > 0 && effectiveDiameter <= 0.5 ? 0.25 : defaultGridResolution);
    const footprintRadius = tightSpotDiameter > 0 ? tightSpotDiameter / 2 : 0; // tight-spot radius
    const fullRadius = footprintDiameter > 0 ? footprintDiameter / 2 : 0;
    const useNavMesh = options.useNavMesh ?? true;
    const useHierarchical = options.useHierarchical ?? true;
    const optimizeWithLOS = options.optimizeWithLOS ?? true;
    const clearancePenalty = options.clearancePenalty ?? 1;
    const useTheta = options.useTheta ?? true;
    const turnPenalty = options.turnPenalty ?? 0.1;
    const portalNarrowPenalty = Math.max(0, options.portalNarrowPenalty ?? 0);
    const portalNarrowThresholdFactor = Math.max(1, options.portalNarrowThresholdFactor ?? 1.35);
    const hierarchicalChunkSize = Math.max(2, options.hierarchicalChunkSize ?? 8);
    const tightSpotFraction = Math.max(0, Math.min(1, options.tightSpotFraction ?? 0.5));
    const cache = this.getBattlefieldCache();
    const gridCacheKey = this.buildGridCacheKey(
      gridResolution,
      footprintDiameter,
      tightSpotFraction,
      clearancePenalty
    );
    let cachedGrid = cache.grids.get(gridCacheKey);
    if (cachedGrid) {
      cache.stats.gridHits += 1;
      this.touchMapEntry(cache.grids, gridCacheKey, cachedGrid);
    } else {
      cache.stats.gridMisses += 1;
      cachedGrid = this.buildGridData(
        gridResolution,
        footprintRadius,
        fullRadius,
        clearancePenalty
      );
      this.setBoundedCacheEntry(cache.grids, gridCacheKey, cachedGrid, MAX_GRID_CACHE_ENTRIES);
    }

    const pathCacheKey = this.buildPathCacheKey(start, end, gridCacheKey, {
      useNavMesh,
      useHierarchical,
      optimizeWithLOS,
      useTheta,
      turnPenalty,
      hierarchicalChunkSize,
      portalNarrowPenalty,
      portalNarrowThresholdFactor,
    });
    const cachedPath = cache.paths.get(pathCacheKey);
    if (cachedPath) {
      cache.stats.pathHits += 1;
      this.touchMapEntry(cache.paths, pathCacheKey, cachedPath);
      return cachedPath;
    }
    cache.stats.pathMisses += 1;

    const {
      gridWidth,
      gridHeight,
      walkable,
      terrainCost,
      terrainGrid,
    } = cachedGrid;

    const startNode = this.toGridCoordinate(start, gridResolution, gridWidth, gridHeight);
    const endNode = this.toGridCoordinate(end, gridResolution, gridWidth, gridHeight);

    const gridPath: number[][] = [];
    const waypoints = useNavMesh
      ? this.findNavMeshWaypoints(start, end, tightSpotDiameter, {
        portalNarrowPenalty,
        portalNarrowThresholdFactor,
      })
      : [start, end];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const segmentStart = this.toGridCoordinate(waypoints[i], gridResolution, gridWidth, gridHeight);
      const segmentEnd = this.toGridCoordinate(waypoints[i + 1], gridResolution, gridWidth, gridHeight);
      let segmentPath: number[][] = [];

      if (useHierarchical) {
        segmentPath = this.findHierarchicalPath(
          segmentStart,
          segmentEnd,
          walkable,
          terrainCost,
          gridWidth,
          gridHeight,
          gridResolution,
          {
            ...options,
            useTheta,
            turnPenalty,
          }
        );
      }

      if (!useHierarchical || segmentPath.length === 0) {
        segmentPath = this.findWeightedPath(
          segmentStart,
          segmentEnd,
          walkable,
          terrainCost,
          gridWidth,
          gridHeight,
          gridResolution,
          undefined,
          {
            halfRadius: footprintRadius,
            fullRadius,
            clearancePenalty,
            useTheta,
            turnPenalty,
          }
        );
      }

      if (segmentPath.length === 0) {
        continue;
      }
      if (gridPath.length > 0) {
        gridPath.pop();
      }
      gridPath.push(...segmentPath);
    }

    const pathPoints = gridPath.map(node => this.fromGridCoordinate(node[0], node[1], gridResolution));
    if (pathPoints.length > 0) {
      pathPoints[0] = start;
      pathPoints[pathPoints.length - 1] = end;
    }
    const optimizedPoints = optimizeWithLOS
      ? this.optimizePathWithLOS(pathPoints, footprintRadius, fullRadius, clearancePenalty, turnPenalty)
      : pathPoints;

    const vectors = this.buildTerrainAwareVectors(optimizedPoints);
    const totals = this.computeTotals(vectors);

    const pathResult: PathResult = {
      vectors,
      totalLength: totals.totalLength,
      totalEffectMu: totals.totalEffectMu,
    };
    this.setBoundedCacheEntry(cache.paths, pathCacheKey, pathResult, MAX_PATH_CACHE_ENTRIES);
    return pathResult;
  }

  findPathWithMaxMu(
    start: Position,
    end: Position,
    options: PathfindingOptions,
    maxMu: number
  ): PathLimitedResult {
    const full = this.findPath(start, end, options);
    const limit = Math.max(0, maxMu);
    const limited = this.limitVectorsByMu(full.vectors, limit, this.muMetric(options));
    const totals = this.computeTotals(limited.vectors);
    return {
      vectors: limited.vectors,
      totalLength: totals.totalLength,
      totalEffectMu: totals.totalEffectMu,
      points: this.buildPointsFromVectors(limited.vectors, start),
      reachedEnd: limited.reachedEnd,
      usedMu: limited.usedMu,
      remainingMu: Math.max(0, limit - limited.usedMu),
    };
  }

  findPathSegmentsByMu(
    start: Position,
    end: Position,
    options: PathfindingOptions,
    maxMuPerSegment: number,
    segmentCount: number
  ): PathSegmentedResult {
    const full = this.findPath(start, end, options);
    const limit = Math.max(0, maxMuPerSegment);
    const maxSegments = Math.max(0, Math.floor(segmentCount));
    if (full.vectors.length === 0 || limit === 0 || maxSegments === 0) {
      return { segments: [], reachedEnd: full.vectors.length === 0 };
    }

    const metric = this.muMetric(options);
    const split = this.splitVectorsByMu(full.vectors, limit, maxSegments, metric);
    const endPoint = full.vectors[full.vectors.length - 1]?.to ?? end;
    const segments = split.map(segmentVectors => {
      const totals = this.computeTotals(segmentVectors);
      const usedMu = segmentVectors.reduce((sum, vector) => sum + this.vectorMu(vector, metric), 0);
      const fallbackStart = segmentVectors[0]?.from ?? start;
      const points = this.buildPointsFromVectors(segmentVectors, fallbackStart);
      const lastPoint = points[points.length - 1] ?? start;
      const reachedEnd = this.pointsClose(lastPoint, endPoint);
      return {
        vectors: segmentVectors,
        totalLength: totals.totalLength,
        totalEffectMu: totals.totalEffectMu,
        points,
        reachedEnd,
        usedMu,
        remainingMu: Math.max(0, limit - usedMu),
      };
    });

    const reachedEnd = segments.some(segment => segment.reachedEnd);
    return { segments, reachedEnd };
  }

  private buildVectors(
    path: number[][],
    gridResolution: number,
    terrainGrid: TerrainType[][]
  ): PathVector[] {
    const vectors: PathVector[] = [];
    for (let i = 1; i < path.length; i++) {
      const fromCell = path[i - 1];
      const toCell = path[i];
      const from = this.fromGridCoordinate(fromCell[0], fromCell[1], gridResolution);
      const to = this.fromGridCoordinate(toCell[0], toCell[1], gridResolution);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      const terrain = terrainGrid[toCell[1]]?.[toCell[0]] ?? TerrainType.Clear;

      vectors.push({
        from,
        to,
        dx,
        dy,
        length,
        terrain,
      });
    }

    return vectors;
  }

  private muMetric(options: PathfindingOptions): 'length' | 'effect' {
    return options.movementMetric === 'effect' ? 'effect' : 'length';
  }

  private vectorMu(vector: PathVector, metric: 'length' | 'effect'): number {
    if (metric === 'length') return vector.length;
    const weight = vector.terrain === TerrainType.Rough || vector.terrain === TerrainType.Difficult ? 2 : 1;
    return vector.length * weight;
  }

  private limitVectorsByMu(
    vectors: PathVector[],
    maxMu: number,
    metric: 'length' | 'effect'
  ): { vectors: PathVector[]; usedMu: number; reachedEnd: boolean } {
    if (vectors.length === 0 || maxMu <= 0) {
      return { vectors: [], usedMu: 0, reachedEnd: vectors.length === 0 };
    }
    const limited: PathVector[] = [];
    let usedMu = 0;
    let reachedEnd = true;
    for (const vector of vectors) {
      const cost = this.vectorMu(vector, metric);
      if (usedMu + cost <= maxMu + 1e-6) {
        limited.push(vector);
        usedMu += cost;
        continue;
      }
      const remaining = maxMu - usedMu;
      if (remaining > 1e-6 && cost > 0) {
        const ratio = Math.max(0, Math.min(1, remaining / cost));
        const split = this.splitVector(vector, ratio);
        limited.push(split.head);
        usedMu = maxMu;
      }
      reachedEnd = false;
      break;
    }
    return { vectors: limited, usedMu, reachedEnd };
  }

  private splitVectorsByMu(
    vectors: PathVector[],
    maxMu: number,
    maxSegments: number,
    metric: 'length' | 'effect'
  ): PathVector[][] {
    const segments: PathVector[][] = [];
    if (vectors.length === 0 || maxMu <= 0 || maxSegments <= 0) return segments;
    let current: PathVector[] = [];
    let remainingMu = maxMu;

    for (const vector of vectors) {
      let currentVector: PathVector | null = vector;
      while (currentVector) {
        const cost = this.vectorMu(currentVector, metric);
        if (cost <= remainingMu + 1e-6) {
          current.push(currentVector);
          remainingMu -= cost;
          currentVector = null;
          continue;
        }

        if (remainingMu <= 1e-6) {
          segments.push(current);
          if (segments.length >= maxSegments) return segments;
          current = [];
          remainingMu = maxMu;
          continue;
        }

        const ratio = Math.max(0, Math.min(1, remainingMu / cost));
        const split = this.splitVector(currentVector, ratio);
        current.push(split.head);
        segments.push(current);
        if (segments.length >= maxSegments) return segments;
        current = [];
        remainingMu = maxMu;
        currentVector = split.tail ?? null;
      }
    }

    if (current.length > 0 && segments.length < maxSegments) {
      segments.push(current);
    }
    return segments;
  }

  private splitVector(vector: PathVector, ratio: number): { head: PathVector; tail?: PathVector } {
    const clamped = Math.max(0, Math.min(1, ratio));
    const dx = vector.dx * clamped;
    const dy = vector.dy * clamped;
    const headTo = { x: vector.from.x + dx, y: vector.from.y + dy };
    const head: PathVector = {
      from: vector.from,
      to: headTo,
      dx,
      dy,
      length: Math.hypot(dx, dy),
      terrain: vector.terrain,
    };
    if (clamped >= 1 || vector.length <= 0) {
      return { head };
    }
    const tailDx = vector.dx - dx;
    const tailDy = vector.dy - dy;
    const tail: PathVector = {
      from: headTo,
      to: vector.to,
      dx: tailDx,
      dy: tailDy,
      length: Math.hypot(tailDx, tailDy),
      terrain: vector.terrain,
    };
    return { head, tail };
  }

  private buildPointsFromVectors(vectors: PathVector[], fallbackStart: Position): Position[] {
    if (vectors.length === 0) return [fallbackStart];
    const points: Position[] = [vectors[0].from];
    for (const vector of vectors) {
      points.push(vector.to);
    }
    return points;
  }

  private pointsClose(a: Position, b: Position): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) <= 1e-3;
  }

  private optimizePathWithLOS(
    points: Position[],
    halfRadius: number,
    fullRadius: number,
    clearancePenalty: number,
    turnPenalty: number
  ): Position[] {
    if (points.length <= 2) return points;
    const optimized: Position[] = [];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1) {
        if (this.hasMovementClearPath(points[i], points[j], halfRadius)) {
          const directCost = this.computeMovementCostForSegment(points[i], points[j], halfRadius, fullRadius, clearancePenalty);
          const originalCost = this.computeMovementCostForPath(points.slice(i, j + 1), halfRadius, fullRadius, clearancePenalty, turnPenalty);
          if (directCost <= originalCost) {
            break;
          }
        }
        j--;
      }
      optimized.push(points[i]);
      i = j;
    }
    optimized.push(points[points.length - 1]);
    return optimized;
  }

  private buildTerrainAwareVectors(points: Position[]): PathVector[] {
    if (points.length <= 1) return [];
    const vectors: PathVector[] = [];
    for (let i = 1; i < points.length; i++) {
      const segmentVectors = this.splitSegmentByTerrain(points[i - 1], points[i]);
      vectors.push(...segmentVectors);
    }
    return vectors;
  }

  private splitSegmentByTerrain(start: Position, end: Position): PathVector[] {
    const vectors: PathVector[] = [];
    const totalLength = PathfindingEngine.distance(start, end);
    if (totalLength === 0) return vectors;

    const step = Math.max(0.25, defaultGridResolution / 2);
    const steps = Math.max(1, Math.ceil(totalLength / step));
    let segmentStart = start;
    let lastType = this.getTerrainTypeAt(start);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      const currentType = this.getTerrainTypeAt(point);

      if (currentType !== lastType) {
        vectors.push(this.buildVector(segmentStart, point, lastType));
        segmentStart = point;
        lastType = currentType;
      }
    }

    vectors.push(this.buildVector(segmentStart, end, lastType));
    return vectors;
  }

  private buildVector(from: Position, to: Position, terrain: TerrainType): PathVector {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    return { from, to, dx, dy, length, terrain };
  }

  private computeEffectForSegment(start: Position, end: Position): number {
    const vectors = this.splitSegmentByTerrain(start, end);
    const totals = this.computeTotals(vectors);
    return totals.totalEffectMu;
  }

  private computeEffectForPath(points: Position[]): number {
    if (points.length <= 1) return 0;
    let effect = 0;
    for (let i = 1; i < points.length; i++) {
      effect += this.computeEffectForSegment(points[i - 1], points[i]);
    }
    return effect;
  }

  private computeMovementCostForPath(
    points: Position[],
    halfRadius: number,
    fullRadius: number,
    clearancePenalty: number,
    turnPenalty: number
  ): number {
    if (points.length <= 1) return 0;
    let cost = 0;
    let prevDirection: { x: number; y: number } | null = null;
    for (let i = 1; i < points.length; i++) {
      const segmentCost = this.computeMovementCostForSegment(points[i - 1], points[i], halfRadius, fullRadius, clearancePenalty);
      if (!Number.isFinite(segmentCost)) {
        return Number.POSITIVE_INFINITY;
      }
      cost += segmentCost;

      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const direction = { x: dx / length, y: dy / length };
        if (prevDirection) {
          const dot = prevDirection.x * direction.x + prevDirection.y * direction.y;
          if (dot < 0.99) {
            cost += turnPenalty;
          }
        }
        prevDirection = direction;
      }
    }
    return cost;
  }

  private computeMovementCostForSegment(
    start: Position,
    end: Position,
    halfRadius: number,
    fullRadius: number,
    clearancePenalty: number
  ): number {
    const totalLength = PathfindingEngine.distance(start, end);
    if (totalLength === 0) return 0;
    const step = 0.25;
    const steps = Math.max(1, Math.ceil(totalLength / step));
    let cost = 0;
    let prev = start;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      const segmentLength = PathfindingEngine.distance(prev, point);
      const weight = this.movementCostAt(point, halfRadius, fullRadius, clearancePenalty);
      if (!Number.isFinite(weight)) {
        return Number.POSITIVE_INFINITY;
      }
      cost += segmentLength * weight;
      prev = point;
    }

    return cost;
  }

  private movementCostAt(
    point: Position,
    halfRadius: number,
    fullRadius: number,
    clearancePenalty: number
  ): number {
    if (!this.isWalkable(point, halfRadius)) {
      return Number.POSITIVE_INFINITY;
    }
    const terrainType = this.getTerrainTypeAt(point);
    let weight = terrainType === TerrainType.Rough || terrainType === TerrainType.Difficult ? 2 : 1;
    if (fullRadius > 0 && !this.isWalkable(point, fullRadius)) {
      weight *= clearancePenalty;
    }
    return weight;
  }

  private computeTotals(vectors: PathVector[]): { totalLength: number; totalEffectMu: number } {
    let totalLength = 0;
    let totalEffectMu = 0;

    for (const vector of vectors) {
      if (vector.length < 0.5) continue;
      totalLength += vector.length;
      if (vector.terrain === TerrainType.Rough || vector.terrain === TerrainType.Difficult) {
        totalEffectMu += 1;
      } else {
        totalEffectMu += vector.length;
      }
    }

    return { totalLength, totalEffectMu };
  }

  private getTerrainTypeAt(point: Position): TerrainType {
    let current = TerrainType.Clear;
    for (const feature of this.battlefield.terrain) {
      if (!PathfindingEngine.isPointInPolygon(point, feature.vertices)) continue;
      if (this.isMovementBlocking(feature)) {
        return TerrainType.Impassable;
      }
      if (feature.type === TerrainType.Difficult) {
        current = TerrainType.Difficult;
      } else if (feature.type === TerrainType.Rough && current !== TerrainType.Difficult) {
        current = TerrainType.Rough;
      }
    }
    return current;
  }

  private findNavMeshWaypoints(
    start: Position,
    end: Position,
    diameter: number,
    options: { portalNarrowPenalty: number; portalNarrowThresholdFactor: number }
  ): Position[] {
    const mesh = this.battlefield.getConstrainedNavMesh();
    if (!mesh) {
      this.battlefield.finalizeTerrain();
    }
    const navMesh = this.battlefield.getConstrainedNavMesh();
    if (!navMesh) {
      return [start, end];
    }

    const trianglePath = navMesh.findTrianglePath(start, end, diameter, {
      portalNarrowPenalty: options.portalNarrowPenalty,
      portalNarrowThresholdFactor: options.portalNarrowThresholdFactor,
    });
    if (trianglePath.length === 0) {
      return [start, end];
    }

    const portals = navMesh.buildPortals(trianglePath);
    const navPath = navMesh.funnelPath(start, end, portals);
    return navPath.length > 1 ? navPath : [start, end];
  }

  private findHierarchicalPath(
    startNode: { x: number; y: number },
    endNode: { x: number; y: number },
    walkable: boolean[][],
    terrainCost: number[][],
    gridWidth: number,
    gridHeight: number,
    gridResolution: number,
    options: PathfindingOptions
  ): number[][] {
    const chunkSize = Math.max(2, options.hierarchicalChunkSize ?? 8);
    const coarseWidth = Math.ceil(gridWidth / chunkSize);
    const coarseHeight = Math.ceil(gridHeight / chunkSize);

    const resolvedStart = this.findNearestWalkable(startNode, walkable, gridWidth, gridHeight) ?? startNode;
    const resolvedEnd = this.findNearestWalkable(endNode, walkable, gridWidth, gridHeight) ?? endNode;

    const coarseWalkable = this.buildCoarseWalkable(walkable, coarseWidth, coarseHeight, chunkSize, gridWidth, gridHeight);
    const startChunk = { x: Math.floor(resolvedStart.x / chunkSize), y: Math.floor(resolvedStart.y / chunkSize) };
    const endChunk = { x: Math.floor(resolvedEnd.x / chunkSize), y: Math.floor(resolvedEnd.y / chunkSize) };

    const coarsePath = this.findCoarsePath(startChunk, endChunk, coarseWalkable, coarseWidth, coarseHeight);
    if (coarsePath.length < 2) {
      return this.findWeightedPath(
        resolvedStart,
        resolvedEnd,
        walkable,
        terrainCost,
        gridWidth,
        gridHeight,
        gridResolution,
        undefined,
        {
          halfRadius: this.resolveTightSpotRadius(options),
          fullRadius: options.footprintDiameter ? options.footprintDiameter / 2 : 0,
          clearancePenalty: options.clearancePenalty ?? 1.25,
          useTheta: options.useTheta ?? true,
          turnPenalty: options.turnPenalty ?? 0.1,
        }
      );
    }

    let path: number[][] = [];
    let currentStart = resolvedStart;
    for (let i = 1; i < coarsePath.length; i++) {
      const prevChunk = coarsePath[i - 1];
      const nextChunk = coarsePath[i];
      const isLast = i === coarsePath.length - 1;
      const targetNode = isLast
        ? resolvedEnd
        : this.findChunkWaypoint(nextChunk, walkable, chunkSize, gridWidth, gridHeight);
      const bounds = this.buildChunkBounds(prevChunk, nextChunk, chunkSize, gridWidth, gridHeight, 2);
      const segment = this.findWeightedPath(
        currentStart,
        targetNode,
        walkable,
        terrainCost,
        gridWidth,
        gridHeight,
        gridResolution,
        bounds,
        {
          halfRadius: this.resolveTightSpotRadius(options),
          fullRadius: options.footprintDiameter ? options.footprintDiameter / 2 : 0,
          clearancePenalty: options.clearancePenalty ?? 1.25,
          useTheta: options.useTheta ?? true,
          turnPenalty: options.turnPenalty ?? 0.1,
        }
      );
      if (segment.length === 0) {
        return this.findWeightedPath(
          resolvedStart,
          resolvedEnd,
          walkable,
          terrainCost,
          gridWidth,
          gridHeight,
        gridResolution,
        undefined,
        {
          halfRadius: this.resolveTightSpotRadius(options),
          fullRadius: options.footprintDiameter ? options.footprintDiameter / 2 : 0,
          clearancePenalty: options.clearancePenalty ?? 1.25,
          useTheta: options.useTheta ?? true,
          turnPenalty: options.turnPenalty ?? 0.1,
          }
        );
      }
      if (path.length > 0) {
        path.pop();
      }
      path.push(...segment);
      currentStart = targetNode;
    }

    return path;
  }

  private buildCoarseWalkable(
    walkable: boolean[][],
    coarseWidth: number,
    coarseHeight: number,
    chunkSize: number,
    gridWidth: number,
    gridHeight: number
  ): boolean[][] {
    const coarse: boolean[][] = Array.from({ length: coarseHeight }, () => Array(coarseWidth).fill(false));
    for (let cy = 0; cy < coarseHeight; cy++) {
      for (let cx = 0; cx < coarseWidth; cx++) {
        const startX = cx * chunkSize;
        const startY = cy * chunkSize;
        const endX = Math.min(gridWidth - 1, startX + chunkSize - 1);
        const endY = Math.min(gridHeight - 1, startY + chunkSize - 1);
        let hasWalkable = false;
        for (let y = startY; y <= endY && !hasWalkable; y++) {
          for (let x = startX; x <= endX; x++) {
            if (walkable[y][x]) {
              hasWalkable = true;
              break;
            }
          }
        }
        coarse[cy][cx] = hasWalkable;
      }
    }
    return coarse;
  }

  private findCoarsePath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    walkable: boolean[][],
    width: number,
    height: number
  ): { x: number; y: number }[] {
    if (!walkable[start.y]?.[start.x] || !walkable[end.y]?.[end.x]) {
      return [];
    }
    const open: { x: number; y: number; f: number; g: number }[] = [];
    const cameFrom = new Map<string, { x: number; y: number }>();
    const gScore = new Map<string, number>();
    const startKey = `${start.x},${start.y}`;
    gScore.set(startKey, 0);
    open.push({ x: start.x, y: start.y, f: this.heuristic(start, end), g: 0 });

    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (!current) break;
      if (current.x === end.x && current.y === end.y) {
        return this.reconstructCoarsePath(cameFrom, current);
      }

      for (const neighbor of neighbors) {
        const nx = current.x + neighbor.dx;
        const ny = current.y + neighbor.dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (!walkable[ny][nx]) continue;
        const stepDistance = Math.hypot(neighbor.dx, neighbor.dy);
        const tentativeG = current.g + stepDistance;
        const key = `${nx},${ny}`;
        const existingG = gScore.get(key);
        if (existingG !== undefined && tentativeG >= existingG) continue;
        cameFrom.set(key, { x: current.x, y: current.y });
        gScore.set(key, tentativeG);
        const f = tentativeG + this.heuristic({ x: nx, y: ny }, end);
        open.push({ x: nx, y: ny, f, g: tentativeG });
      }
    }

    return [];
  }

  private reconstructCoarsePath(
    cameFrom: Map<string, { x: number; y: number }>,
    current: { x: number; y: number }
  ): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [{ x: current.x, y: current.y }];
    let key = `${current.x},${current.y}`;
    while (cameFrom.has(key)) {
      const prev = cameFrom.get(key);
      if (!prev) break;
      path.push({ x: prev.x, y: prev.y });
      key = `${prev.x},${prev.y}`;
    }
    return path.reverse();
  }

  private findChunkWaypoint(
    chunk: { x: number; y: number },
    walkable: boolean[][],
    chunkSize: number,
    gridWidth: number,
    gridHeight: number
  ): { x: number; y: number } {
    const startX = chunk.x * chunkSize;
    const startY = chunk.y * chunkSize;
    const endX = Math.min(gridWidth - 1, startX + chunkSize - 1);
    const endY = Math.min(gridHeight - 1, startY + chunkSize - 1);
    const center = { x: (startX + endX) / 2, y: (startY + endY) / 2 };

    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (!walkable[y][x]) continue;
        const d = Math.hypot(x - center.x, y - center.y);
        if (d < bestDistance) {
          bestDistance = d;
          best = { x, y };
        }
      }
    }

    return best ?? { x: Math.min(gridWidth - 1, Math.max(0, Math.round(center.x))), y: Math.min(gridHeight - 1, Math.max(0, Math.round(center.y))) };
  }

  private buildChunkBounds(
    a: { x: number; y: number },
    b: { x: number; y: number },
    chunkSize: number,
    gridWidth: number,
    gridHeight: number,
    margin: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const minChunkX = Math.min(a.x, b.x);
    const maxChunkX = Math.max(a.x, b.x);
    const minChunkY = Math.min(a.y, b.y);
    const maxChunkY = Math.max(a.y, b.y);
    const minX = Math.max(0, minChunkX * chunkSize - margin);
    const minY = Math.max(0, minChunkY * chunkSize - margin);
    const maxX = Math.min(gridWidth - 1, (maxChunkX + 1) * chunkSize - 1 + margin);
    const maxY = Math.min(gridHeight - 1, (maxChunkY + 1) * chunkSize - 1 + margin);
    return { minX, maxX, minY, maxY };
  }

  private findNearestWalkable(
    start: { x: number; y: number },
    walkable: boolean[][],
    gridWidth: number,
    gridHeight: number
  ): { x: number; y: number } | null {
    if (walkable[start.y]?.[start.x]) return start;
    const queue: { x: number; y: number }[] = [start];
    const visited = new Set<string>([`${start.x},${start.y}`]);
    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      for (const neighbor of neighbors) {
        const nx = current.x + neighbor.dx;
        const ny = current.y + neighbor.dy;
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (walkable[ny][nx]) return { x: nx, y: ny };
        visited.add(key);
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  private isWalkable(center: Position, radius: number): boolean {
    for (const feature of this.battlefield.terrain) {
      if (!this.isMovementBlocking(feature)) continue;
      const distance = PathfindingEngine.distancePointToPolygon(center, feature.vertices);
      if (distance <= radius) {
        return false;
      }
    }
    return true;
  }

  private isMovementBlocking(feature: TerrainFeature): boolean {
    if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') {
      return false;
    }
    if (feature.type === TerrainType.Obstacle || feature.type === TerrainType.Impassable) {
      return true;
    }
    return feature.meta?.initialMovement === 'Impassable';
  }

  private hasMovementClearPath(start: Position, end: Position, radius: number): boolean {
    const blockers = this.battlefield.terrain.filter(feature => this.isMovementBlocking(feature));
    const totalLength = PathfindingEngine.distance(start, end);
    if (totalLength === 0) return true;
    const step = 0.25;
    const steps = Math.max(1, Math.ceil(totalLength / step));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      for (const feature of blockers) {
        const distance = PathfindingEngine.distancePointToPolygon(point, feature.vertices);
        if (distance <= radius) {
          return false;
        }
      }
    }

    return true;
  }

  private toGridCoordinate(
    point: Position,
    gridResolution: number,
    gridWidth: number,
    gridHeight: number
  ): { x: number; y: number } {
    const x = Math.max(0, Math.min(gridWidth - 1, Math.floor(point.x / gridResolution)));
    const y = Math.max(0, Math.min(gridHeight - 1, Math.floor(point.y / gridResolution)));
    return { x, y };
  }

  private fromGridCoordinate(x: number, y: number, gridResolution: number): Position {
    return {
      x: (x + 0.5) * gridResolution,
      y: (y + 0.5) * gridResolution,
    };
  }

  private findWeightedPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    walkable: boolean[][],
    terrainCost: number[][],
    gridWidth: number,
    gridHeight: number,
    gridResolution: number,
    bounds?: { minX: number; maxX: number; minY: number; maxY: number },
    movement?: {
      halfRadius: number;
      fullRadius: number;
      clearancePenalty: number;
      useTheta: boolean;
      turnPenalty: number;
    }
  ): number[][] {
    const open: { x: number; y: number; f: number; g: number }[] = [];
    const cameFrom = new Map<string, { x: number; y: number }>();
    const gScore = new Map<string, number>();

    const startKey = `${start.x},${start.y}`;
    gScore.set(startKey, 0);
    open.push({ x: start.x, y: start.y, f: this.heuristic(start, end), g: 0 });

    const neighbors = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: 1 },
      { dx: -1, dy: -1 },
    ];

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (!current) break;

      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(cameFrom, current);
      }

      for (const neighbor of neighbors) {
        const nx = current.x + neighbor.dx;
        const ny = current.y + neighbor.dy;
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
        if (bounds) {
          if (nx < bounds.minX || nx > bounds.maxX || ny < bounds.minY || ny > bounds.maxY) continue;
        }
        if (!walkable[ny][nx]) continue;

        const key = `${nx},${ny}`;
        const existingG = gScore.get(key);

        const currentKey = `${current.x},${current.y}`;
        const parent = cameFrom.get(currentKey) ?? { x: current.x, y: current.y };
        const useTheta = movement?.useTheta ?? false;

        let candidateParent = { x: current.x, y: current.y };
        let candidateG = current.g;

        if (useTheta) {
          const parentKey = `${parent.x},${parent.y}`;
          const parentG = gScore.get(parentKey) ?? current.g;
          const parentPos = this.fromGridCoordinate(parent.x, parent.y, gridResolution);
          const neighborPos = this.fromGridCoordinate(nx, ny, gridResolution);
          const halfRadius = movement?.halfRadius ?? 0;
          if (this.hasMovementClearPath(parentPos, neighborPos, halfRadius)) {
            const fullRadius = movement?.fullRadius ?? 0;
            const clearancePenalty = movement?.clearancePenalty ?? 1;
            const segmentCost = this.computeMovementCostForSegment(parentPos, neighborPos, halfRadius, fullRadius, clearancePenalty);
            if (Number.isFinite(segmentCost)) {
              candidateParent = parent;
              candidateG = parentG + segmentCost;
            }
          }
        }

        if (candidateParent.x === current.x && candidateParent.y === current.y) {
          const stepDistance = Math.hypot(neighbor.dx, neighbor.dy) * gridResolution;
          const cost = terrainCost[ny][nx] ?? 1;
          candidateG = current.g + stepDistance * cost;
          const prev = cameFrom.get(currentKey);
          if (prev) {
            const dirPrev = { x: current.x - prev.x, y: current.y - prev.y };
            const dirNext = { x: nx - current.x, y: ny - current.y };
            if (dirPrev.x !== dirNext.x || dirPrev.y !== dirNext.y) {
              candidateG += movement?.turnPenalty ?? 0;
            }
          }
        }

        if (existingG !== undefined && candidateG >= existingG) {
          continue;
        }

        cameFrom.set(key, candidateParent);
        gScore.set(key, candidateG);
        const f = candidateG + this.heuristic({ x: nx, y: ny }, end);
        open.push({ x: nx, y: ny, f, g: candidateG });
      }
    }

    return [];
  }

  private reconstructPath(
    cameFrom: Map<string, { x: number; y: number }>,
    current: { x: number; y: number }
  ): number[][] {
    const path: number[][] = [[current.x, current.y]];
    let key = `${current.x},${current.y}`;
    while (cameFrom.has(key)) {
      const prev = cameFrom.get(key);
      if (!prev) break;
      path.push([prev.x, prev.y]);
      key = `${prev.x},${prev.y}`;
    }
    return path.reverse();
  }

  private resolveTightSpotDiameter(footprintDiameter: number, tightSpotFraction?: number): number {
    if (footprintDiameter <= 0) return 0;
    const fraction = tightSpotFraction ?? 0.5;
    const clamped = Math.max(0, Math.min(1, fraction));
    return footprintDiameter * clamped;
  }

  private resolveTightSpotRadius(options: PathfindingOptions): number {
    const diameter = options.footprintDiameter ?? 0;
    if (diameter <= 0) return 0;
    const tightSpotDiameter = this.resolveTightSpotDiameter(diameter, options.tightSpotFraction);
    return tightSpotDiameter / 2;
  }

  private heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  static isPointInPolygon(point: Position, polygon: Position[]): boolean {
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

  static distancePointToPolygon(point: Position, polygon: Position[]): number {
    if (PathfindingEngine.isPointInPolygon(point, polygon)) {
      return 0;
    }
    let minDistance = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const distance = PathfindingEngine.distancePointToSegment(point, polygon[j], polygon[i]);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return minDistance;
  }

  static distancePointToSegment(point: Position, a: Position, b: Position): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) {
      return PathfindingEngine.distance(point, a);
    }
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
    const closest = { x: a.x + abx * t, y: a.y + aby * t };
    return PathfindingEngine.distance(point, closest);
  }

  static buildCircleSamplePoints(center: Position, radius: number): Position[] {
    if (radius <= 0) {
      return [center];
    }
    const perimeter = 2 * Math.PI * radius;
    const density = 2;
    const count = Math.max(8, Math.ceil(perimeter * density));
    const points: Position[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    points.push(center);
    return points;
  }

  static distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

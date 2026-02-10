import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';

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

export interface PathfindingOptions {
  gridResolution?: number; // MU per cell
  footprintDiameter?: number; // MU
  useNavMesh?: boolean;
  optimizeWithLOS?: boolean;
  useHierarchical?: boolean;
  hierarchicalChunkSize?: number; // grid cells per chunk
  clearancePenalty?: number; // cost multiplier when only half-width clearance exists
  useTheta?: boolean;
  turnPenalty?: number; // cost added per direction change
}

const defaultGridResolution = 0.5;

export class PathfindingEngine {
  private battlefield: Battlefield;

  constructor(battlefield: Battlefield) {
    this.battlefield = battlefield;
  }

  /**
   * Finds a path using obstacle inflation + hierarchical grid search.
   *
   * Heuristic: if footprintDiameter <= 0.5 MU and gridResolution is not provided,
   * automatically use a finer grid of 0.25 MU to better model small bases.
   * Clearance: when a cell is only traversable at half-width, apply a penalty so
   * paths prefer full-footprint clearance when available.
   */
  findPath(
    start: Position,
    end: Position,
    options: PathfindingOptions = {}
  ): PathResult {
    const footprintDiameter = options.footprintDiameter ?? 0;
    const gridResolution = options.gridResolution ?? (footprintDiameter > 0 && footprintDiameter <= 0.5 ? 0.25 : defaultGridResolution);
    const footprintRadius = footprintDiameter > 0 ? footprintDiameter / 4 : 0; // middle 2/4 of model
    const fullRadius = footprintDiameter > 0 ? footprintDiameter / 2 : 0;
    const useNavMesh = options.useNavMesh ?? false;
    const useHierarchical = options.useHierarchical ?? true;
    const optimizeWithLOS = options.optimizeWithLOS ?? true;
    const clearancePenalty = options.clearancePenalty ?? 1.25;
    const useTheta = options.useTheta ?? true;
    const turnPenalty = options.turnPenalty ?? 0.1;

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

    const startNode = this.toGridCoordinate(start, gridResolution, gridWidth, gridHeight);
    const endNode = this.toGridCoordinate(end, gridResolution, gridWidth, gridHeight);

    const gridPath: number[][] = [];
    if (useHierarchical) {
      const hierarchicalPath = this.findHierarchicalPath(
        startNode,
        endNode,
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
      gridPath.push(...hierarchicalPath);
    } else {
      const waypoints = useNavMesh
        ? this.findNavMeshWaypoints(start, end)
        : [start, end];

      for (let i = 0; i < waypoints.length - 1; i++) {
        const segmentStart = this.toGridCoordinate(waypoints[i], gridResolution, gridWidth, gridHeight);
        const segmentEnd = this.toGridCoordinate(waypoints[i + 1], gridResolution, gridWidth, gridHeight);
        const segmentPath = this.findWeightedPath(
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
        if (segmentPath.length === 0) {
          continue;
        }
        if (gridPath.length > 0) {
          gridPath.pop();
        }
        gridPath.push(...segmentPath);
      }
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

    return {
      vectors,
      totalLength: totals.totalLength,
      totalEffectMu: totals.totalEffectMu,
    };
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

  private findNavMeshWaypoints(start: Position, end: Position): Position[] {
    const mesh = this.battlefield.getNavMesh();
    if (!mesh) {
      this.battlefield.generateNavigationMesh();
    }
    const navMesh = this.battlefield.getNavMesh();
    if (!navMesh) {
      return [start, end];
    }

    const voronoi = navMesh.voronoi([0, 0, this.battlefield.width, this.battlefield.height]);
    const startIndex = navMesh.find(start.x, start.y);
    const endIndex = navMesh.find(end.x, end.y);

    if (startIndex === endIndex) {
      return [start, end];
    }

    const queue: number[] = [startIndex];
    const visited = new Set<number>([startIndex]);
    const parent = new Map<number, number>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      if (current === endIndex) break;
      for (const neighbor of navMesh.neighbors(current)) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    }

    if (!parent.has(endIndex)) {
      return [start, end];
    }

    const indices: number[] = [];
    let current = endIndex;
    indices.push(current);
    while (current !== startIndex) {
      const prev = parent.get(current);
      if (prev === undefined) break;
      current = prev;
      indices.push(current);
    }
    indices.reverse();

    const waypoints: Position[] = [start];
    for (const index of indices.slice(1, -1)) {
      const cell = voronoi.cellPolygon(index);
      if (!cell || cell.length === 0) continue;
      let sumX = 0;
      let sumY = 0;
      for (const point of cell) {
        sumX += point[0];
        sumY += point[1];
      }
      const count = cell.length;
      waypoints.push({
        x: sumX / count,
        y: sumY / count,
      });
    }
    waypoints.push(end);
    return waypoints;
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
          halfRadius: options.footprintDiameter ? options.footprintDiameter / 4 : 0,
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
          halfRadius: options.footprintDiameter ? options.footprintDiameter / 4 : 0,
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
            halfRadius: options.footprintDiameter ? options.footprintDiameter / 4 : 0,
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

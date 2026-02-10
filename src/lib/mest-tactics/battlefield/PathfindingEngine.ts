import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';
import { LOSOperations } from './LOSOperations';

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
}

const defaultGridResolution = 0.5;

export class PathfindingEngine {
  private battlefield: Battlefield;

  constructor(battlefield: Battlefield) {
    this.battlefield = battlefield;
  }

  /**
   * Finds a path using a hybrid navmesh (coarse) + grid (fine) approach.
   *
   * Heuristic: if footprintDiameter <= 0.5 MU and gridResolution is not provided,
   * automatically use a finer grid of 0.25 MU to better model small bases.
   */
  findPath(
    start: Position,
    end: Position,
    options: PathfindingOptions = {}
  ): PathResult {
    const footprintDiameter = options.footprintDiameter ?? 0;
    const gridResolution = options.gridResolution ?? (footprintDiameter > 0 && footprintDiameter <= 0.5 ? 0.25 : defaultGridResolution);
    const footprintRadius = footprintDiameter > 0 ? footprintDiameter / 4 : 0; // middle 2/4 of model
    const useNavMesh = options.useNavMesh ?? true;
    const optimizeWithLOS = options.optimizeWithLOS ?? true;

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

        if (!this.isWalkable(center, footprintRadius)) {
          walkable[y][x] = false;
          continue;
        }
        const weight = terrainType === TerrainType.Rough || terrainType === TerrainType.Difficult ? 2 : 1;
        terrainCost[y][x] = weight;
      }
      terrainGrid.push(row);
    }

    const startNode = this.toGridCoordinate(start, gridResolution, gridWidth, gridHeight);
    const endNode = this.toGridCoordinate(end, gridResolution, gridWidth, gridHeight);

    const waypoints = useNavMesh
      ? this.findNavMeshWaypoints(start, end)
      : [start, end];

    const gridPath: number[][] = [];
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
        gridResolution
      );
      if (segmentPath.length === 0) {
        continue;
      }
      if (gridPath.length > 0) {
        gridPath.pop();
      }
      gridPath.push(...segmentPath);
    }

    const pathPoints = gridPath.map(node => this.fromGridCoordinate(node[0], node[1], gridResolution));
    const optimizedPoints = optimizeWithLOS
      ? this.optimizePathWithLOS(pathPoints)
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

  private optimizePathWithLOS(points: Position[]): Position[] {
    if (points.length <= 2) return points;
    const optimized: Position[] = [];
    let i = 0;
    while (i < points.length - 1) {
      let j = points.length - 1;
      while (j > i + 1) {
        const result = LOSOperations.checkLOSBetweenPoints(this.battlefield, points[i], points[j]);
        if (result.clear) {
          const directEffect = this.computeEffectForSegment(points[i], points[j]);
          const originalEffect = this.computeEffectForPath(points.slice(i, j + 1));
          if (directEffect <= originalEffect) {
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
      if (feature.type === TerrainType.Obstacle || feature.type === TerrainType.Impassable) {
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

  private isWalkable(center: Position, radius: number): boolean {
    for (const feature of this.battlefield.terrain) {
      if (feature.type !== TerrainType.Obstacle && feature.type !== TerrainType.Impassable) continue;
      const samples = PathfindingEngine.buildCircleSamplePoints(center, radius);
      for (const sample of samples) {
        if (PathfindingEngine.isPointInPolygon(sample, feature.vertices)) {
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
    const x = Math.max(0, Math.min(gridWidth - 1, Math.round(point.x / gridResolution)));
    const y = Math.max(0, Math.min(gridHeight - 1, Math.round(point.y / gridResolution)));
    return { x, y };
  }

  private fromGridCoordinate(x: number, y: number, gridResolution: number): Position {
    return {
      x: x * gridResolution,
      y: y * gridResolution,
    };
  }

  private findWeightedPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    walkable: boolean[][],
    terrainCost: number[][],
    gridWidth: number,
    gridHeight: number,
    gridResolution: number
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
        if (!walkable[ny][nx]) continue;

        const stepDistance = Math.hypot(neighbor.dx, neighbor.dy) * gridResolution;
        const cost = terrainCost[ny][nx] ?? 1;
        const tentativeG = current.g + stepDistance * cost;

        const key = `${nx},${ny}`;
        const existingG = gScore.get(key);
        if (existingG !== undefined && tentativeG >= existingG) {
          continue;
        }

        cameFrom.set(key, { x: current.x, y: current.y });
        gScore.set(key, tentativeG);
        const f = tentativeG + this.heuristic({ x: nx, y: ny }, end);
        open.push({ x: nx, y: ny, f, g: tentativeG });
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

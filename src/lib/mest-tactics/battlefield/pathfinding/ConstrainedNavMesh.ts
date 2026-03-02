import { Delaunay } from 'd3-delaunay';
import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from '../terrain/Terrain';

export interface NavMeshEdge {
  a: number;
  b: number;
  constrained: boolean;
  triangles: number[];
}

export interface NavMeshData {
  points: Position[];
  triangles: [number, number, number][];
  edges: NavMeshEdge[];
  triangleEdges: number[][];
  triangleNeighbors: number[][];
  triangleEdgeClearance: number[][];
}

export interface TrianglePathOptions {
  portalNarrowPenalty?: number;
  portalNarrowThresholdFactor?: number;
}

const EPSILON = 1e-6;

export class ConstrainedNavMesh {
  private data: NavMeshData;

  constructor(data: NavMeshData) {
    this.data = data;
  }

  get points(): Position[] {
    return this.data.points;
  }

  get triangles(): [number, number, number][] {
    return this.data.triangles;
  }

  get triangleEdges(): number[][] {
    return this.data.triangleEdges;
  }

  get triangleNeighbors(): number[][] {
    return this.data.triangleNeighbors;
  }

  get edges(): NavMeshEdge[] {
    return this.data.edges;
  }

  findContainingTriangle(point: Position): number | null {
    for (let i = 0; i < this.data.triangles.length; i++) {
      const tri = this.data.triangles[i];
      if (ConstrainedNavMesh.pointInTriangle(point, this.data.points[tri[0]], this.data.points[tri[1]], this.data.points[tri[2]])) {
        return i;
      }
    }
    return null;
  }

  findTrianglePath(
    start: Position,
    end: Position,
    diameter: number,
    options: TrianglePathOptions = {}
  ): number[] {
    const startTri = this.findContainingTriangle(start);
    const endTri = this.findContainingTriangle(end);
    if (startTri === null || endTri === null) return [];

    const portalNarrowPenalty = Math.max(0, options.portalNarrowPenalty ?? 0);
    const portalNarrowThresholdFactor = Math.max(1, options.portalNarrowThresholdFactor ?? 1.35);

    const open: { tri: number; f: number; g: number }[] = [];
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>();

    gScore.set(startTri, 0);
    open.push({ tri: startTri, f: this.heuristic(startTri, endTri), g: 0 });

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      if (!current) break;
      if (current.tri === endTri) {
        return this.reconstructTrianglePath(cameFrom, current.tri);
      }

      const neighbors = this.data.triangleNeighbors[current.tri];
      const edges = this.data.triangleEdges[current.tri];
      for (let edgeIndex = 0; edgeIndex < neighbors.length; edgeIndex++) {
        const neighbor = neighbors[edgeIndex];
        if (neighbor < 0) continue;
        const clearanceHere = this.data.triangleEdgeClearance[current.tri][edgeIndex];
        const neighborEdgeIndex = this.findLocalEdgeIndex(neighbor, edges[edgeIndex]);
        const clearanceThere = neighborEdgeIndex >= 0 ? this.data.triangleEdgeClearance[neighbor][neighborEdgeIndex] : 0;
        const portalClearance = Math.min(clearanceHere, clearanceThere);
        if (diameter > 0 && portalClearance + EPSILON < diameter) {
          continue;
        }

        const transitionDistance = this.heuristic(current.tri, neighbor);
        const preferredPortalWidth = diameter > 0
          ? diameter * portalNarrowThresholdFactor
          : portalNarrowThresholdFactor;
        const squeezeRatio = preferredPortalWidth > EPSILON
          ? Math.max(0, (preferredPortalWidth - portalClearance) / preferredPortalWidth)
          : 0;
        const transitionPenalty = portalNarrowPenalty > 0
          ? transitionDistance * portalNarrowPenalty * squeezeRatio
          : 0;
        const tentativeG = current.g + transitionDistance + transitionPenalty;
        const existingG = gScore.get(neighbor);
        if (existingG !== undefined && tentativeG >= existingG) {
          continue;
        }
        cameFrom.set(neighbor, current.tri);
        gScore.set(neighbor, tentativeG);
        open.push({ tri: neighbor, f: tentativeG + this.heuristic(neighbor, endTri), g: tentativeG });
      }
    }

    return [];
  }

  buildPortals(trianglePath: number[]): { left: Position; right: Position }[] {
    if (trianglePath.length < 2) return [];
    const portals: { left: Position; right: Position }[] = [];
    for (let i = 0; i < trianglePath.length - 1; i++) {
      const tri = trianglePath[i];
      const next = trianglePath[i + 1];
      const edgeIndex = this.findSharedEdgeIndex(tri, next);
      if (edgeIndex < 0) continue;
      
      const edgeIdx = this.data.triangleEdges[tri][edgeIndex];
      if (edgeIdx === undefined || edgeIdx < 0 || edgeIdx >= this.data.edges.length) continue;
      
      const edge = this.data.edges[edgeIdx];
      if (!edge) continue;
      
      const a = this.data.points[edge.a];
      const b = this.data.points[edge.b];
      
      // Validate points
      if (!a || !b ||
          !Number.isFinite(a.x) || !Number.isFinite(a.y) ||
          !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      
      const centerA = this.triangleCentroid(tri);
      const centerB = this.triangleCentroid(next);
      
      // Validate centroids
      if (!centerA || !centerB ||
          !Number.isFinite(centerA.x) || !Number.isFinite(centerA.y) ||
          !Number.isFinite(centerB.x) || !Number.isFinite(centerB.y)) continue;
      
      const dir = { x: centerB.x - centerA.x, y: centerB.y - centerA.y };
      const edgeVec = { x: b.x - a.x, y: b.y - a.y };
      const cross = ConstrainedNavMesh.cross(dir, edgeVec);
      if (cross >= 0) {
        portals.push({ left: a, right: b });
      } else {
        portals.push({ left: b, right: a });
      }
    }
    return portals;
  }

  funnelPath(start: Position, end: Position, portals: { left: Position; right: Position }[]): Position[] {
    if (portals.length === 0) return [start, end];
    
    // Validate portal data to prevent invalid array operations
    for (const portal of portals) {
      if (!portal.left || !portal.right || 
          !Number.isFinite(portal.left.x) || !Number.isFinite(portal.left.y) ||
          !Number.isFinite(portal.right.x) || !Number.isFinite(portal.right.y)) {
        return [start, end];
      }
    }
    
    // Validate start and end positions
    if (!start || !end ||
        !Number.isFinite(start.x) || !Number.isFinite(start.y) ||
        !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
      return [start, end];
    }
    
    const path: Position[] = [];
    let apex = start;
    let left = portals[0].left;
    let right = portals[0].right;
    let apexIndex = 0;
    let leftIndex = 0;
    let rightIndex = 0;

    path.push(apex);

    // Add iteration limit to prevent infinite loops
    const maxIterations = portals.length * 3;
    let iterations = 0;

    for (let i = 1; i < portals.length && iterations < maxIterations; i++) {
      iterations++;
      const nextLeft = portals[i].left;
      const nextRight = portals[i].right;

      if (ConstrainedNavMesh.triArea2(apex, right, nextRight) <= 0) {
        if (ConstrainedNavMesh.triArea2(apex, left, nextRight) > 0) {
          right = nextRight;
          rightIndex = i;
        } else {
          path.push(left);
          apex = left;
          apexIndex = leftIndex;
          left = apex;
          right = apex;
          leftIndex = apexIndex;
          rightIndex = apexIndex;
          i = apexIndex;
          continue;
        }
      }

      if (ConstrainedNavMesh.triArea2(apex, left, nextLeft) >= 0) {
        if (ConstrainedNavMesh.triArea2(apex, right, nextLeft) < 0) {
          left = nextLeft;
          leftIndex = i;
        } else {
          path.push(right);
          apex = right;
          apexIndex = rightIndex;
          left = apex;
          right = apex;
          leftIndex = apexIndex;
          rightIndex = apexIndex;
          i = apexIndex;
          continue;
        }
      }
    }

    // If we hit the iteration limit, just return what we have
    if (iterations >= maxIterations) {
      path.push(end);
      return path;
    }

    path.push(end);
    return path;
  }

  private heuristic(a: number, b: number): number {
    const ca = this.triangleCentroid(a);
    const cb = this.triangleCentroid(b);
    return Math.hypot(cb.x - ca.x, cb.y - ca.y);
  }

  private triangleCentroid(index: number): Position {
    const tri = this.data.triangles[index];
    const a = this.data.points[tri[0]];
    const b = this.data.points[tri[1]];
    const c = this.data.points[tri[2]];
    return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  }

  private findSharedEdgeIndex(triIndex: number, neighborIndex: number): number {
    const edges = this.data.triangleEdges[triIndex];
    for (let i = 0; i < edges.length; i++) {
      const edge = this.data.edges[edges[i]];
      if (edge.triangles.includes(neighborIndex)) {
        return i;
      }
    }
    return -1;
  }

  private findLocalEdgeIndex(triIndex: number, edgeIndex: number): number {
    const edges = this.data.triangleEdges[triIndex];
    for (let i = 0; i < edges.length; i++) {
      if (edges[i] === edgeIndex) return i;
    }
    return -1;
  }

  private reconstructTrianglePath(cameFrom: Map<number, number>, current: number): number[] {
    const path: number[] = [current];
    let cur = current;
    while (cameFrom.has(cur)) {
      cur = cameFrom.get(cur)!;
      path.push(cur);
    }
    return path.reverse();
  }

  static build(battlefield: Battlefield): ConstrainedNavMesh | null {
    const mesh = battlefield.getNavMesh();
    if (!mesh) return null;
    const points: Position[] = [];
    for (let i = 0; i < mesh.points.length; i += 2) {
      points.push({ x: mesh.points[i], y: mesh.points[i + 1] });
    }

    const obstacles = battlefield.terrain.filter(feature => ConstrainedNavMesh.isMovementBlocking(feature));

    const triangles: [number, number, number][] = [];
    for (let i = 0; i < mesh.triangles.length; i += 3) {
      const a = mesh.triangles[i];
      const b = mesh.triangles[i + 1];
      const c = mesh.triangles[i + 2];
      const tri = [a, b, c] as [number, number, number];
      const centroid = {
        x: (points[a].x + points[b].x + points[c].x) / 3,
        y: (points[a].y + points[b].y + points[c].y) / 3,
      };
      if (obstacles.some(ob => ConstrainedNavMesh.pointInPolygon(centroid, ob.vertices))) {
        continue;
      }
      if (ConstrainedNavMesh.triangleIntersectsObstacles(points, tri, obstacles)) {
        continue;
      }
      triangles.push(tri);
    }

    const edgeMap = new Map<string, NavMeshEdge>();
    const triangleEdges: number[][] = [];
    const triangleNeighbors: number[][] = [];

    const edgeKey = (i: number, j: number) => (i < j ? `${i}:${j}` : `${j}:${i}`);

    for (let t = 0; t < triangles.length; t++) {
      const [v0, v1, v2] = triangles[t];
      const edgeIndices: number[] = [];

      const edges = [
        [v1, v2],
        [v2, v0],
        [v0, v1],
      ];

      for (const [a, b] of edges) {
        const key = edgeKey(a, b);
        let edge = edgeMap.get(key);
        if (!edge) {
          edge = { a, b, constrained: false, triangles: [] };
          edgeMap.set(key, edge);
        }
        edge.triangles.push(t);
      }

      for (const [a, b] of edges) {
        const key = edgeKey(a, b);
        edgeIndices.push(Array.from(edgeMap.keys()).indexOf(key));
      }

      triangleEdges.push(edgeIndices);
      triangleNeighbors.push([-1, -1, -1]);
    }

    const edges: NavMeshEdge[] = Array.from(edgeMap.values());

    const edgeIndexMap = new Map<string, number>();
    edges.forEach((edge, index) => {
      edgeIndexMap.set(edgeKey(edge.a, edge.b), index);
    });

    // Update triangleEdges to use correct edge indices
    for (let t = 0; t < triangles.length; t++) {
      const [v0, v1, v2] = triangles[t];
      const edgesForTriangle = [
        edgeIndexMap.get(edgeKey(v1, v2))!,
        edgeIndexMap.get(edgeKey(v2, v0))!,
        edgeIndexMap.get(edgeKey(v0, v1))!,
      ];
      triangleEdges[t] = edgesForTriangle;
    }

    // Build triangle neighbors and constrained edges
    for (let e = 0; e < edges.length; e++) {
      const edge = edges[e];
      if (edge.triangles.length === 1) {
        edge.constrained = true;
      }
      if (edge.triangles.length === 2) {
        const [t0, t1] = edge.triangles;
        const t0Index = triangleEdges[t0].indexOf(e);
        const t1Index = triangleEdges[t1].indexOf(e);
        if (t0Index >= 0) triangleNeighbors[t0][t0Index] = t1;
        if (t1Index >= 0) triangleNeighbors[t1][t1Index] = t0;
      }
    }

    const triangleEdgeClearance: number[][] = [];
    const widthCache = new Map<string, number>();

    for (let t = 0; t < triangles.length; t++) {
      const edgesForTriangle = triangleEdges[t];
      const clearance: number[] = [];
      for (let localEdgeIndex = 0; localEdgeIndex < 3; localEdgeIndex++) {
        const otherA = (localEdgeIndex + 1) % 3;
        const otherB = (localEdgeIndex + 2) % 3;
        const widthA = ConstrainedNavMesh.calculateWidth(
          points,
          triangles,
          edges,
          triangleEdges,
          triangleNeighbors,
          widthCache,
          t,
          localEdgeIndex,
          otherA
        );
        const widthB = ConstrainedNavMesh.calculateWidth(
          points,
          triangles,
          edges,
          triangleEdges,
          triangleNeighbors,
          widthCache,
          t,
          localEdgeIndex,
          otherB
        );
        clearance.push(Math.min(widthA, widthB));
      }
      triangleEdgeClearance.push(clearance);
    }

    return new ConstrainedNavMesh({
      points,
      triangles,
      edges,
      triangleEdges,
      triangleNeighbors,
      triangleEdgeClearance,
    });
  }

  private static calculateWidth(
    points: Position[],
    triangles: [number, number, number][],
    edges: NavMeshEdge[],
    triangleEdges: number[][],
    triangleNeighbors: number[][],
    cache: Map<string, number>,
    triangleIndex: number,
    edgeAIndex: number,
    edgeBIndex: number
  ): number {
    const key = `${triangleIndex}:${edgeAIndex}:${edgeBIndex}`;
    if (cache.has(key)) return cache.get(key)!;

    const triangle = triangles[triangleIndex];
    const localEdges = triangleEdges[triangleIndex];
    const edgeA = edges[localEdges[edgeAIndex]];
    const edgeB = edges[localEdges[edgeBIndex]];

    const sharedVertex = ConstrainedNavMesh.sharedVertex(edgeA, edgeB);
    if (sharedVertex === null) {
      cache.set(key, 0);
      return 0;
    }

    const vertexOppositeA = ConstrainedNavMesh.vertexOppositeEdge(triangle, edgeA);
    const vertexOppositeB = ConstrainedNavMesh.vertexOppositeEdge(triangle, edgeB);

    const edgeLengthA = ConstrainedNavMesh.edgeLength(points, edgeA);
    const edgeLengthB = ConstrainedNavMesh.edgeLength(points, edgeB);
    let d = Math.min(edgeLengthA, edgeLengthB);

    const A = points[vertexOppositeA];
    const B = points[vertexOppositeB];
    const C = points[sharedVertex];

    if (ConstrainedNavMesh.isObtuse(C, A, B) || ConstrainedNavMesh.isObtuse(C, B, A)) {
      cache.set(key, d);
      return d;
    }

    const edgeCIndex = ConstrainedNavMesh.edgeOppositeVertex(triangle, sharedVertex);
    const edgeC = edges[localEdges[edgeCIndex]];

    if (edgeC.constrained) {
      const distance = ConstrainedNavMesh.distancePointToSegment(C, points[edgeC.a], points[edgeC.b]);
      cache.set(key, distance);
      return distance;
    }

    const distance = ConstrainedNavMesh.searchWidth(
      points,
      triangles,
      edges,
      triangleEdges,
      triangleNeighbors,
      sharedVertex,
      triangleIndex,
      edgeCIndex,
      d,
      new Set<string>()
    );

    cache.set(key, distance);
    return distance;
  }

  private static searchWidth(
    points: Position[],
    triangles: [number, number, number][],
    edges: NavMeshEdge[],
    triangleEdges: number[][],
    triangleNeighbors: number[][],
    vertexIndex: number,
    triangleIndex: number,
    edgeIndex: number,
    distance: number,
    visited: Set<string>
  ): number {
    const key = `${triangleIndex}:${edgeIndex}:${vertexIndex}`;
    if (visited.has(key)) return distance;
    visited.add(key);

    const edge = edges[triangleEdges[triangleIndex][edgeIndex]];
    const U = points[edge.a];
    const V = points[edge.b];
    const C = points[vertexIndex];

    if (ConstrainedNavMesh.isObtuse(C, U, V) || ConstrainedNavMesh.isObtuse(C, V, U)) {
      return distance;
    }

    const d0 = ConstrainedNavMesh.distancePointToSegment(C, U, V);
    if (d0 > distance) {
      return distance;
    }
    if (edge.constrained) {
      return d0;
    }

    const neighbor = triangleNeighbors[triangleIndex][edgeIndex];
    if (neighbor < 0) {
      return d0;
    }

    const neighborEdges = triangleEdges[neighbor];
    const sharedEdge = triangleEdges[triangleIndex][edgeIndex];
    const otherEdges = neighborEdges.filter(e => e !== sharedEdge);
    let d = distance;
    for (const edgeIdx of otherEdges) {
      const local = neighborEdges.indexOf(edgeIdx);
      d = ConstrainedNavMesh.searchWidth(
        points,
        triangles,
        edges,
        triangleEdges,
        triangleNeighbors,
        vertexIndex,
        neighbor,
        local,
        d,
        visited
      );
    }
    return d;
  }

  private static sharedVertex(edgeA: NavMeshEdge, edgeB: NavMeshEdge): number | null {
    if (edgeA.a === edgeB.a || edgeA.a === edgeB.b) return edgeA.a;
    if (edgeA.b === edgeB.a || edgeA.b === edgeB.b) return edgeA.b;
    return null;
  }

  private static vertexOppositeEdge(triangle: [number, number, number], edge: NavMeshEdge): number {
    for (const v of triangle) {
      if (v !== edge.a && v !== edge.b) return v;
    }
    return triangle[0];
  }

  private static edgeOppositeVertex(triangle: [number, number, number], vertex: number): number {
    if (triangle[0] === vertex) return 0;
    if (triangle[1] === vertex) return 1;
    return 2;
  }

  private static edgeLength(points: Position[], edge: NavMeshEdge): number {
    return Math.hypot(points[edge.a].x - points[edge.b].x, points[edge.a].y - points[edge.b].y);
  }

  private static isObtuse(c: Position, a: Position, b: Position): boolean {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ac = { x: c.x - a.x, y: c.y - a.y };
    const dot = ab.x * ac.x + ab.y * ac.y;
    return dot <= 0;
  }

  private static triangleIntersectsObstacles(
    points: Position[],
    triangle: [number, number, number],
    obstacles: TerrainFeature[]
  ): boolean {
    const verts = [points[triangle[0]], points[triangle[1]], points[triangle[2]]];
    for (const obstacle of obstacles) {
      const poly = obstacle.vertices;
      for (const vertex of poly) {
        if (ConstrainedNavMesh.pointInTriangle(vertex, verts[0], verts[1], verts[2])) {
          return true;
        }
      }
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        for (let m = 0; m < 3; m++) {
          const n = (m + 1) % 3;
          if (ConstrainedNavMesh.segmentsIntersect(poly[j], poly[i], verts[m], verts[n])) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private static isMovementBlocking(feature: TerrainFeature): boolean {
    // Area terrain (zones) are never blocking
    if (feature.meta?.category === 'area' || feature.meta?.layer === 'area') {
      return false;
    }
    // Only true obstacles and impassable terrain block navMesh
    if (feature.type === TerrainType.Obstacle || feature.type === TerrainType.Impassable) {
      return true;
    }
    // Rough and Difficult terrain are traversable (just costly), not blocking
    // Only treat explicit structures (buildings, walls) as blocking
    const blockingCategories = ['building', 'wall', 'structure'];
    if (feature.meta?.category && blockingCategories.includes(feature.meta.category)) {
      return true;
    }
    // Default: terrain features like trees, rocks, shrubs are NOT navMesh-blocking
    // They affect movement cost but don't make the area completely impassable
    return false;
  }

  private static pointInTriangle(p: Position, a: Position, b: Position, c: Position): boolean {
    const v0 = { x: c.x - a.x, y: c.y - a.y };
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: p.x - a.x, y: p.y - a.y };
    const dot00 = v0.x * v0.x + v0.y * v0.y;
    const dot01 = v0.x * v1.x + v0.y * v1.y;
    const dot02 = v0.x * v2.x + v0.y * v2.y;
    const dot11 = v1.x * v1.x + v1.y * v1.y;
    const dot12 = v1.x * v2.x + v1.y * v2.y;
    const denom = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(denom) < EPSILON) return false;
    const inv = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * inv;
    const v = (dot00 * dot12 - dot01 * dot02) * inv;
    return u >= -EPSILON && v >= -EPSILON && u + v <= 1 + EPSILON;
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

  private static distancePointToSegment(p: Position, a: Position, b: Position): number {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ap = { x: p.x - a.x, y: p.y - a.y };
    const abLenSq = ab.x * ab.x + ab.y * ab.y;
    if (abLenSq === 0) {
      return Math.hypot(ap.x, ap.y);
    }
    const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / abLenSq));
    const closest = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return Math.hypot(p.x - closest.x, p.y - closest.y);
  }

  private static segmentsIntersect(p1: Position, p2: Position, p3: Position, p4: Position): boolean {
    const o1 = ConstrainedNavMesh.orientation(p1, p2, p3);
    const o2 = ConstrainedNavMesh.orientation(p1, p2, p4);
    const o3 = ConstrainedNavMesh.orientation(p3, p4, p1);
    const o4 = ConstrainedNavMesh.orientation(p3, p4, p2);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && ConstrainedNavMesh.onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && ConstrainedNavMesh.onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && ConstrainedNavMesh.onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && ConstrainedNavMesh.onSegment(p3, p2, p4)) return true;
    return false;
  }

  private static orientation(p: Position, q: Position, r: Position): number {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < EPSILON) return 0;
    return val > 0 ? 1 : 2;
  }

  private static onSegment(p: Position, q: Position, r: Position): boolean {
    return (
      q.x <= Math.max(p.x, r.x) + EPSILON &&
      q.x >= Math.min(p.x, r.x) - EPSILON &&
      q.y <= Math.max(p.y, r.y) + EPSILON &&
      q.y >= Math.min(p.y, r.y) - EPSILON
    );
  }

  private static triArea2(a: Position, b: Position, c: Position): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  private static cross(a: Position, b: Position): number {
    return a.x * b.y - a.y * b.x;
  }
}

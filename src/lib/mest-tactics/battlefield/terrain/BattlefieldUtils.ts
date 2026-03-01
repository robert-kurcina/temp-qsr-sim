/**
 * Battlefield Utilities
 *
 * Shared utility functions for geometry, distance calculations, and spatial operations.
 * Eliminates code duplication across battlefield module files.
 */

import { Position } from '../Position';

/**
 * Orientation of three points
 * @returns 0: Collinear, 1: Clockwise, 2: Counterclockwise
 */
export function orientation(p: Position, q: Position, r: Position): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-6) return 0;
  return val > 0 ? 1 : 2;
}

/**
 * Check if point q lies on segment pr
 */
export function onSegment(p: Position, q: Position, r: Position): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-6 &&
    q.x >= Math.min(p.x, r.x) - 1e-6 &&
    q.y <= Math.max(p.y, r.y) + 1e-6 &&
    q.y >= Math.min(p.y, r.y) - 1e-6
  );
}

/**
 * Check if two line segments intersect
 */
export function segmentsIntersect(
  p1: Position,
  q1: Position,
  p2: Position,
  q2: Position
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
}

/**
 * Calculate intersection point of two line segments (if it exists)
 */
export function segmentIntersection(
  p1: Position,
  q1: Position,
  p2: Position,
  q2: Position
): Position | null {
  const d1 = (q1.x - p1.x) * (p2.y - q2.y) - (p1.y - q1.y) * (q2.x - p2.x);
  if (Math.abs(d1) < 1e-6) return null; // Parallel

  const t = ((p1.x - p2.x) * (p2.y - q2.y) - (p1.y - p2.y) * (q2.x - p2.x)) / d1;
  if (t < 0 || t > 1) return null; // Intersection outside segment

  return {
    x: p1.x + t * (q1.x - p1.x),
    y: p1.y + t * (q1.y - p1.y),
  };
}

/**
 * Check if two polygons overlap
 */
export function polygonsOverlap(poly1: Position[], poly2: Position[]): boolean {
  // Check if any vertex of poly1 is inside poly2
  for (const vertex of poly1) {
    if (pointInPolygon(vertex, poly2)) return true;
  }

  // Check if any vertex of poly2 is inside poly1
  for (const vertex of poly2) {
    if (pointInPolygon(vertex, poly1)) return true;
  }

  // Check if any edges intersect
  for (let i = 0; i < poly1.length; i++) {
    const p1 = poly1[i];
    const q1 = poly1[(i + 1) % poly1.length];
    for (let j = 0; j < poly2.length; j++) {
      const p2 = poly2[j];
      const q2 = poly2[(j + 1) % poly2.length];
      if (segmentsIntersect(p1, q1, p2, q2)) return true;
    }
  }

  return false;
}

/**
 * Check if point is inside polygon using ray casting algorithm
 */
export function pointInPolygon(point: Position, polygon: Position[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersects =
      ((yi > point.y) !== (yj > point.y)) &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Calculate distance between two points
 */
export function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance from point to line segment
 */
export function pointToSegmentDistance(
  point: Position,
  a: Position,
  b: Position
): number {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (lengthSquared === 0) return distance(point, a);

  let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projection = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };

  return distance(point, projection);
}

/**
 * Calculate distance between two line segments
 */
export function segmentToSegmentDistance(
  a1: Position,
  a2: Position,
  b1: Position,
  b2: Position
): number {
  if (segmentsIntersect(a1, a2, b1, b2)) return 0;

  return Math.min(
    pointToSegmentDistance(a1, b1, b2),
    pointToSegmentDistance(a2, b1, b2),
    pointToSegmentDistance(b1, a1, a2),
    pointToSegmentDistance(b2, a1, a2)
  );
}

/**
 * Calculate closest distance from point to polygon
 */
export function closestDistanceToPolygon(
  point: Position,
  polygon: Position[]
): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const dist = pointToSegmentDistance(point, polygon[j], polygon[i]);
    if (dist < min) min = dist;
  }
  return min;
}

/**
 * Calculate segment to polygon distance
 */
export function segmentDistanceToPolygon(
  start: Position,
  end: Position,
  polygon: Position[]
): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const dist = segmentToSegmentDistance(start, end, polygon[j], polygon[i]);
    if (dist < min) min = dist;
    if (min <= 0) return 0;
  }
  return min;
}

/**
 * Find all intersections between a segment and a polygon
 */
export function segmentPolygonIntersections(
  start: Position,
  end: Position,
  polygon: Position[]
): Position[] {
  const intersections: Position[] = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const hit = segmentIntersection(start, end, polygon[j], polygon[i]);
    if (hit) intersections.push(hit);
  }
  return intersections;
}

/**
 * Clip segment end by a distance from start
 */
export function clipSegmentEnd(
  start: Position,
  end: Position,
  clipDistance: number
): { start: Position; end: Position } | null {
  if (clipDistance <= 0) return { start, end };

  const length = distance(start, end);
  if (length <= clipDistance + 1e-6) return null;

  const ratio = (length - clipDistance) / length;
  return {
    start,
    end: {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    },
  };
}

/**
 * Calculate distance between two polygons (minimum edge-to-edge distance)
 */
export function polygonsDistance(a: Position[], b: Position[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  if (polygonsOverlap(a, b)) return 0;

  let min = Infinity;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const a1 = a[j];
    const a2 = a[i];
    for (let m = 0, n = b.length - 1; m < b.length; n = m++) {
      const b1 = b[n];
      const b2 = b[m];
      const dist = segmentToSegmentDistance(a1, a2, b1, b2);
      if (dist < min) min = dist;
      if (min <= 0) return 0;
    }
  }
  return min;
}

/**
 * Calculate distance from point to rectangle
 */
export function distancePointToRect(
  point: Position,
  rect: { x: number; y: number; width: number; height: number }
): number {
  const rx1 = rect.x;
  const ry1 = rect.y;
  const rx2 = rect.x + rect.width;
  const ry2 = rect.y + rect.height;

  const dx = Math.max(rx1 - point.x, 0, point.x - rx2);
  const dy = Math.max(ry1 - point.y, 0, point.y - ry2);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance from point to polygon
 */
export function distancePointToPolygon(
  point: Position,
  polygon: Position[]
): number {
  if (polygon.length === 0) return Infinity;
  if (pointInPolygon(point, polygon)) return 0;
  return closestDistanceToPolygon(point, polygon);
}

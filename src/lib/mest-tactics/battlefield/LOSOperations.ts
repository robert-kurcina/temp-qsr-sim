import { Battlefield } from './Battlefield';
import { Position } from './Position';
import { TerrainFeature, TerrainType } from './Terrain';

export interface LOSSampleOptions {
  samples?: number;
  segmentLength?: number;
  rayWidth?: number; // Placeholder for future width-aware LOS checks
}

export interface LOSResult {
  clear: boolean;
  blockedBy?: TerrainFeature;
}

export interface LOSModelFootprint {
  id?: string;
  position: Position;
  baseDiameter: number;
}

export class LOSOperations {
  // TODO: Review LOS blocker classification for higher-fidelity RAW (Soft/Hard may not always fully block LOS).
  static isLosBlocking(feature: TerrainFeature): boolean {
    if (feature.type === TerrainType.Obstacle) return true;
    const los = feature.meta?.los ?? 'Clear';
    return los === 'Soft' || los === 'Hard';
  }

  static checkLOSBetweenPoints(battlefield: Battlefield, start: Position, end: Position): LOSResult {
    const blockers = battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature));
    const hit = LOSOperations.findNearestBlockingElement(start, end, blockers);
    if (hit) {
      return { clear: false, blockedBy: hit };
    }
    return { clear: true };
  }

  static checkLOSFromModelToPoint(
    battlefield: Battlefield,
    model: LOSModelFootprint,
    target: Position
  ): LOSResult {
    const perimeter = LOSOperations.buildCircularPerimeterPoints(model.position, model.baseDiameter);
    let nearestBlocked: { feature: TerrainFeature; distance: number } | null = null;

    for (const point of perimeter) {
      const hit = LOSOperations.findNearestBlockingElement(
        point,
        target,
        battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature))
      );
      if (!hit) {
        return { clear: true };
      }
      const distance = LOSOperations.distance(point, target);
      if (!nearestBlocked || distance < nearestBlocked.distance) {
        nearestBlocked = { feature: hit, distance };
      }
    }

    return nearestBlocked ? { clear: false, blockedBy: nearestBlocked.feature } : { clear: false };
  }

  static checkLOSFromPointToModel(
    battlefield: Battlefield,
    start: Position,
    targetModel: LOSModelFootprint
  ): LOSResult {
    const perimeter = LOSOperations.buildCircularPerimeterPoints(targetModel.position, targetModel.baseDiameter);
    let nearestBlocked: { feature: TerrainFeature; distance: number } | null = null;

    for (const point of perimeter) {
      const hit = LOSOperations.findNearestBlockingElement(
        start,
        point,
        battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature))
      );
      if (!hit) {
        return { clear: true };
      }
      const distance = LOSOperations.distance(start, point);
      if (!nearestBlocked || distance < nearestBlocked.distance) {
        nearestBlocked = { feature: hit, distance };
      }
    }

    return nearestBlocked ? { clear: false, blockedBy: nearestBlocked.feature } : { clear: false };
  }

  static checkLOSFromModelToModel(
    battlefield: Battlefield,
    source: LOSModelFootprint,
    target: LOSModelFootprint
  ): LOSResult {
    const sourcePerimeter = LOSOperations.buildCircularPerimeterPoints(source.position, source.baseDiameter);
    const targetPerimeter = LOSOperations.buildCircularPerimeterPoints(target.position, target.baseDiameter);
    const requiredVisiblePoints = 1; // 0.5 MU at 2 pts per MU => at least 1 point

    let visibleCount = 0;
    let nearestBlocked: { feature: TerrainFeature; distance: number } | null = null;
    const blockers = battlefield.terrain.filter(feature => LOSOperations.isLosBlocking(feature));

    for (const targetPoint of targetPerimeter) {
      let targetVisible = false;
      for (const sourcePoint of sourcePerimeter) {
        const hit = LOSOperations.findNearestBlockingElement(sourcePoint, targetPoint, blockers);
        if (!hit) {
          targetVisible = true;
          break;
        }
      }

      if (targetVisible) {
        visibleCount++;
        if (visibleCount >= requiredVisiblePoints) {
          return { clear: true };
        }
      } else {
        const distance = LOSOperations.distance(source.position, targetPoint);
        const hit = LOSOperations.findNearestBlockingElement(source.position, targetPoint, blockers);
        if (hit) {
          if (!nearestBlocked || distance < nearestBlocked.distance) {
            nearestBlocked = { feature: hit, distance };
          }
        }
      }
    }

    return nearestBlocked ? { clear: false, blockedBy: nearestBlocked.feature } : { clear: false };
  }

  static estimateBlockedFraction(
    battlefield: Battlefield,
    width: number,
    height: number,
    options: LOSSampleOptions = {}
  ): number {
    const samples = options.samples ?? 60;
    const segmentLength = options.segmentLength ?? 8;

    if (samples <= 0) return 0;

    let blocked = 0;
    let tested = 0;

    for (let i = 0; i < samples; i++) {
      const angle = Math.random() * Math.PI * 2;
      const start: Position = {
        x: Math.random() * width,
        y: Math.random() * height,
      };
      const end: Position = {
        x: start.x + Math.cos(angle) * segmentLength,
        y: start.y + Math.sin(angle) * segmentLength,
      };

      if (end.x < 0 || end.x > width || end.y < 0 || end.y > height) {
        continue;
      }

      tested++;
      if (!battlefield.hasLineOfSight(start, end)) {
        blocked++;
      }
    }

    if (tested === 0) return 0;
    return blocked / tested;
  }

  static buildCircularPerimeterPoints(center: Position, diameter: number): Position[] {
    const radius = diameter / 2;
    const perimeter = Math.PI * diameter;
    const density = 2; // points per MU
    const count = Math.max(8, Math.ceil(perimeter * density));
    const points: Position[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      });
    }
    return points;
  }

  static findNearestBlockingElement(
    start: Position,
    end: Position,
    blockers: TerrainFeature[]
  ): TerrainFeature | null {
    let nearest: { feature: TerrainFeature; distance: number } | null = null;

    for (const feature of blockers) {
      const vertices = feature.vertices;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const intersection = LOSOperations.segmentIntersection(start, end, vertices[j], vertices[i]);
        if (!intersection) continue;
        const distance = LOSOperations.distance(start, intersection);
        if (!nearest || distance < nearest.distance) {
          nearest = { feature, distance };
        }
      }
    }

    return nearest ? nearest.feature : null;
  }

  static segmentIntersection(
    p1: Position,
    p2: Position,
    p3: Position,
    p4: Position
  ): Position | null {
    const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (denominator === 0) return null;

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denominator;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      };
    }

    return null;
  }

  static distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

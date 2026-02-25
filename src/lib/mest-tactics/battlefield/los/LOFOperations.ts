import { Position } from './Position';

export interface LOFModel {
  id: string;
  position: Position;
  baseDiameter: number;
  isFriendly?: boolean;
  isAttentive?: boolean;
  isOrdered?: boolean;
}

export interface LOFQueryOptions {
  lofWidth?: number; // MU, default 1
}

export interface FriendlyFireResult {
  candidates: LOFModel[];
  selected: LOFModel | null;
}

export class LOFOperations {
  static getModelsAlongLOF(
    start: Position,
    end: Position,
    models: LOFModel[],
    options: LOFQueryOptions = {}
  ): LOFModel[] {
    const lofWidth = options.lofWidth ?? 1;
    const halfWidth = lofWidth / 2;

    return models.filter(model => {
      const distance = LOFOperations.distancePointToSegment(model.position, start, end);
      const radius = model.baseDiameter / 2;
      return distance <= radius + halfWidth;
    });
  }

  static resolveFriendlyFire(
    attacker: LOFModel,
    target: LOFModel,
    models: LOFModel[],
    options: LOFQueryOptions = {}
  ): FriendlyFireResult {
    const lofWidth = options.lofWidth ?? 1;
    const halfWidth = lofWidth / 2;

    const excluded = new Set<string>();
    excluded.add(attacker.id);

    // Friendly attentive ordered models in base-contact with attacker are never at risk.
    for (const model of models) {
      if (!model.isFriendly) continue;
      if (!model.isAttentive || !model.isOrdered) continue;
      if (LOFOperations.isBaseContact(attacker, model)) {
        excluded.add(model.id);
      }
    }

    const candidates = models.filter(model => !excluded.has(model.id));

    const baseContact = candidates.filter(model => LOFOperations.isBaseContact(target, model));
    if (baseContact.length > 0) {
      return { candidates: baseContact, selected: LOFOperations.pickClosestToTarget(target, baseContact) };
    }

    const withinOne = candidates.filter(model => LOFOperations.distanceEdgeToEdge(target, model) <= 1);
    if (withinOne.length > 0) {
      return { candidates: withinOne, selected: LOFOperations.pickClosestToTarget(target, withinOne) };
    }

    const lofCandidates = candidates.filter(model => {
      const distance = LOFOperations.distancePointToSegment(model.position, attacker.position, target.position);
      const radius = model.baseDiameter / 2;
      return distance <= radius + halfWidth + 1;
    });

    if (lofCandidates.length > 0) {
      return { candidates: lofCandidates, selected: LOFOperations.pickClosestToTarget(target, lofCandidates) };
    }

    return { candidates: [], selected: null };
  }

  static pickClosestToTarget(target: LOFModel, candidates: LOFModel[]): LOFModel {
    let closest = candidates[0];
    let closestDistance = LOFOperations.distance(target.position, closest.position);
    for (const model of candidates) {
      const distance = LOFOperations.distance(target.position, model.position);
      if (distance < closestDistance) {
        closest = model;
        closestDistance = distance;
      }
    }
    return closest;
  }

  static isBaseContact(a: LOFModel, b: LOFModel): boolean {
    const distance = LOFOperations.distance(a.position, b.position);
    return distance <= (a.baseDiameter / 2) + (b.baseDiameter / 2);
  }

  static distanceEdgeToEdge(a: LOFModel, b: LOFModel): number {
    const distance = LOFOperations.distance(a.position, b.position);
    return Math.max(0, distance - (a.baseDiameter / 2) - (b.baseDiameter / 2));
  }

  static distancePointToSegment(point: Position, a: Position, b: Position): number {
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (lengthSquared === 0) return LOFOperations.distance(point, a);
    let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projection = {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
    };
    return LOFOperations.distance(point, projection);
  }

  static distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

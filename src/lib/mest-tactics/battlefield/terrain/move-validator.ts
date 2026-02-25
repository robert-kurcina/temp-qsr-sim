import { Character } from '../../core/Character';
import { Battlefield } from '../Battlefield';
import { Position } from '../battlefield/Position';
import { TerrainType } from './Terrain';
import { SpatialModel, SpatialRules } from '../spatial/spatial-rules';
import { ModelRegistry, MeasurementUtils } from '../spatial/model-registry';
import { EngagementManager } from '../spatial/engagement-manager';
import { LOSValidator } from '../los/los-validator';

/**
 * Movement validation result
 */
export interface MovementValidationResult {
  valid: boolean;
  blocked: boolean;
  blockedBy?: string;
  engagementBroken: boolean;
  engagementGained: boolean;
  cohesionBroken: boolean;
  inThreatZone: boolean;
  threatModels: string[];
}

/**
 * Compulsory action trigger result
 */
export interface CompulsoryActionTrigger {
  triggered: boolean;
  actionType: 'disengage' | 'fall_back' | 'compulsory_move' | 'morale_test';
  reason: string;
  models: string[];
}

/**
 * MoveValidator provides movement validation and compulsory action detection
 */
export class MoveValidator {
  private battlefield: Battlefield;
  private registry: ModelRegistry;
  private engagementManager: EngagementManager;

  constructor(
    battlefield: Battlefield,
    registry: ModelRegistry,
    engagementManager: EngagementManager
  ) {
    this.battlefield = battlefield;
    this.registry = registry;
    this.engagementManager = engagementManager;
  }

  /**
   * Validate a movement action
   */
  validateMove(
    character: Character,
    from: Position,
    to: Position,
    options: {
      maxDistance?: number;
      checkEngagement?: boolean;
      checkCohesion?: boolean;
      checkThreatZones?: boolean;
      cohesionDistance?: number;
      squadIds?: string[];
    } = {}
  ): MovementValidationResult {
    const checkEngagement = options.checkEngagement ?? true;
    const checkCohesion = options.checkCohesion ?? false;
    const checkThreatZones = options.checkThreatZones ?? true;
    const cohesionDistance = options.cohesionDistance ?? 2;
    const squadIds = options.squadIds;

    const result: MovementValidationResult = {
      valid: true,
      blocked: false,
      engagementBroken: false,
      engagementGained: false,
      cohesionBroken: false,
      inThreatZone: false,
      threatModels: [],
    };

    // Check terrain blocking
    const terrainBlock = this.checkTerrainBlocking(from, to);
    if (terrainBlock.blocked) {
      result.valid = false;
      result.blocked = true;
      result.blockedBy = terrainBlock.blockedBy;
      return result;
    }

    // Check movement distance
    if (options.maxDistance) {
      const distance = MeasurementUtils.centerToCenter(
        { id: character.id, position: from, baseDiameter: 1 },
        { id: character.id, position: to, baseDiameter: 1 }
      );
      if (distance > options.maxDistance) {
        result.valid = false;
        result.blocked = true;
        result.blockedBy = 'max_distance';
        return result;
      }
    }

    // Check engagement breaking
    if (checkEngagement) {
      const wouldBreak = this.engagementManager.wouldBreakEngagement(character.id, to);
      if (wouldBreak) {
        result.engagementBroken = true;
        // Breaking engagement is not invalid, but requires disengage action
      }

      const wouldGain = this.engagementManager.getPotentialEngagements(character.id, to).length > 0;
      if (wouldGain && !this.engagementManager.getEngagedModels(character.id).length) {
        result.engagementGained = true;
      }
    }

    // Check cohesion
    if (checkCohesion && squadIds) {
      const squadModels = squadIds
        .map(id => this.registry.getModel(id))
        .filter((m): m is SpatialModel => m !== undefined && m.id !== character.id);

      if (squadModels.length > 0) {
        const tempModel: SpatialModel = {
          id: character.id,
          position: to,
          baseDiameter: MeasurementUtils.centerToCenter(
            { id: 'temp', position: from, baseDiameter: 1 },
            { id: 'temp', position: to, baseDiameter: 1 }
          ) * 2, // Approximate
          siz: character.finalAttributes.siz,
        };

        const maintains = MeasurementUtils.maintainsCohesion(
          tempModel,
          squadModels,
          cohesionDistance
        );

        if (!maintains) {
          result.cohesionBroken = true;
        }
      }
    }

    // Check threat zones
    if (checkThreatZones) {
      const threat = this.engagementManager.isInAnyThreatZone(to);
      if (threat) {
        result.inThreatZone = true;
        result.threatModels.push(threat.modelId);
      }
    }

    return result;
  }

  /**
   * Check if terrain blocks movement between two points
   */
  private checkTerrainBlocking(from: Position, to: Position): { blocked: boolean; blockedBy?: string } {
    // Check if endpoints are in bounds
    if (!this.battlefield.grid.isValid(from) || !this.battlefield.grid.isValid(to)) {
      return { blocked: true, blockedBy: 'out_of_bounds' };
    }

    // Sample points along the movement path
    const samples = this.samplePath(from, to, 0.5);

    for (const point of samples) {
      // Check terrain at this point
      for (const feature of this.battlefield.terrain) {
        if (this.pointInFeature(point, feature)) {
          if (feature.type === TerrainType.Impassable || feature.type === TerrainType.Obstacle) {
            return { blocked: true, blockedBy: feature.id };
          }
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Sample points along a path
   */
  private samplePath(from: Position, to: Position, interval: number): Position[] {
    const points: Position[] = [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return [from];

    const steps = Math.ceil(distance / interval);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: from.x + dx * t,
        y: from.y + dy * t,
      });
    }

    return points;
  }

  /**
   * Check if a point is inside a terrain feature
   */
  private pointInFeature(point: Position, feature: { vertices: Position[] }): boolean {
    let inside = false;
    const polygon = feature.vertices;
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
   * Check for compulsory action triggers
   */
  checkCompulsoryActions(character: Character): CompulsoryActionTrigger[] {
    const triggers: CompulsoryActionTrigger[] = [];
    const model = this.registry.getModel(character.id);

    if (!model) return triggers;

    // Check for being surrounded (compulsory fall back)
    const engagement = this.engagementManager.queryEngagement(character.id);
    if (engagement.isSurrounded && !character.state.isKOd && !character.state.isEliminated) {
      triggers.push({
        triggered: true,
        actionType: 'fall_back',
        reason: 'Model is surrounded by enemies',
        models: [character.id],
      });
    }

    // Check for disengage requirement
    if (engagement.isEngaged && engagement.engagedCount > 0) {
      // If engaged and wants to move away, must disengage
      triggers.push({
        triggered: engagement.isEngaged,
        actionType: 'disengage',
        reason: 'Model is engaged in melee',
        models: [character.id],
      });
    }

    // Check for fear/morale triggers
    if (character.state.fearTokens >= 3) {
      triggers.push({
        triggered: true,
        actionType: 'morale_test',
        reason: 'Model has 3+ fear tokens',
        models: [character.id],
      });
    }

    return triggers;
  }

  /**
   * Get valid movement destinations for a character
   */
  getValidDestinations(
    character: Character,
    from: Position,
    maxDistance: number,
    options: {
      checkEngagement?: boolean;
      allowEngagementBreak?: boolean;
    } = {}
  ): Position[] {
    const validDestinations: Position[] = [];
    const checkEngagement = options.checkEngagement ?? true;
    const allowEngagementBreak = options.allowEngagementBreak ?? false;

    // Sample positions in a circle around the character
    const samples = 36; // Every 10 degrees
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * 2 * Math.PI;

      for (let dist = 0.5; dist <= maxDistance; dist += 0.5) {
        const to: Position = {
          x: from.x + Math.cos(angle) * dist,
          y: from.y + Math.sin(angle) * dist,
        };

        // Check bounds
        if (!this.battlefield.grid.isValid(to)) continue;

        // Validate movement
        const validation = this.validateMove(character, from, to, {
          maxDistance: dist,
          checkEngagement,
          checkThreatZones: false,
        });

        if (validation.valid) {
          if (!validation.engagementBroken || allowEngagementBreak) {
            validDestinations.push(to);
          }
        }
      }
    }

    return validDestinations;
  }

  /**
   * Check if a move is a safe retreat (away from enemies)
   */
  isSafeRetreat(character: Character, from: Position, to: Position): boolean {
    const model = this.registry.getModel(character.id);
    if (!model) return false;

    const engagedModels = this.engagementManager.getEngagedModels(character.id);
    if (engagedModels.length === 0) return true; // Not engaged, any move is "safe"

    // Check if moving away from all engaged enemies
    for (const engagedId of engagedModels) {
      const enemy = this.registry.getModel(engagedId);
      if (!enemy) continue;

      const oldDist = MeasurementUtils.centerToCenter(model, enemy);
      const newDist = MeasurementUtils.centerToCenter(
        { ...model, position: to },
        enemy
      );

      if (newDist <= oldDist) {
        return false; // Not moving away from this enemy
      }
    }

    return true;
  }

  /**
   * Get the safest move direction (away from most threats)
   */
  getSafestMoveDirection(
    character: Character,
    from: Position,
    maxDistance: number
  ): Position | null {
    const validDestinations = this.getValidDestinations(character, from, maxDistance, {
      allowEngagementBreak: true,
    });

    if (validDestinations.length === 0) return null;

    // Find the destination furthest from all enemies
    const enemies = this.registry.getAllModels().filter(m => m.id !== character.id);
    let bestPosition: Position | null = null;
    let bestScore = -Infinity;

    for (const dest of validDestinations) {
      let score = 0;
      for (const enemy of enemies) {
        const dist = MeasurementUtils.centerToCenter(
          { id: character.id, position: dest, baseDiameter: 1 },
          enemy
        );
        score += dist;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPosition = dest;
      }
    }

    return bestPosition;
  }
}

/**
 * Create a move validator from game state
 */
export function createMoveValidator(
  battlefield: Battlefield,
  characters: Character[],
  positions: Map<string, Position>
): MoveValidator {
  const registry = new ModelRegistry();
  for (const character of characters) {
    const position = positions.get(character.id);
    if (position) {
      registry.register(character, position);
    }
  }

  const engagementManager = new EngagementManager(registry);
  return new MoveValidator(battlefield, registry, engagementManager);
}

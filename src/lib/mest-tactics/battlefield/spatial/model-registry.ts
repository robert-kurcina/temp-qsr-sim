import { Character } from '../core/Character';
import { Position } from './Position';
import { SpatialModel } from './spatial-rules';
import { getBaseDiameterFromSiz } from './size-utils';
import { LOFOperations } from '../los/LOFOperations';

/**
 * ModelRegistry provides a centralized way to track all models on the battlefield
 * and perform spatial queries against them.
 */
export class ModelRegistry {
  private models: Map<string, SpatialModel> = new Map();

  /**
   * Register a character as a spatial model
   */
  register(character: Character, position: Position): void {
    const baseDiameter = getBaseDiameterFromSiz(character.finalAttributes.siz);
    this.models.set(character.id, {
      id: character.id,
      position,
      baseDiameter,
      siz: character.finalAttributes.siz,
      isFriendly: true,
      isAttentive: character.state.isAttentive,
      isOrdered: character.state.isOrdered,
    });
  }

  /**
   * Unregister a model (e.g., when eliminated)
   */
  unregister(id: string): boolean {
    return this.models.delete(id);
  }

  /**
   * Update a model's position
   */
  updatePosition(id: string, position: Position): boolean {
    const model = this.models.get(id);
    if (model) {
      model.position = position;
      return true;
    }
    return false;
  }

  /**
   * Update a model's status flags from character state
   */
  updateStatus(id: string, character: Character): boolean {
    const model = this.models.get(id);
    if (model) {
      model.isAttentive = character.state.isAttentive;
      model.isOrdered = character.state.isOrdered;
      return true;
    }
    return false;
  }

  /**
   * Get a model by ID
   */
  getModel(id: string): SpatialModel | undefined {
    return this.models.get(id);
  }

  /**
   * Get all registered models
   */
  getAllModels(): SpatialModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get models within a certain distance of a position
   */
  getModelsInRange(position: Position, range: number): SpatialModel[] {
    return this.getAllModels().filter(model => {
      const distance = LOFOperations.distance(position, model.position);
      return distance <= range + model.baseDiameter / 2;
    });
  }

  /**
   * Get models within base contact of a model
   */
  getModelsInBaseContact(modelId: string): SpatialModel[] {
    const model = this.models.get(modelId);
    if (!model) return [];
    return this.getAllModels().filter(other => {
      if (other.id === modelId) return false;
      return LOFOperations.isBaseContact(model, other);
    });
  }

  /**
   * Get engaged models (in base contact with opposing models)
   */
  getEngagedModels(modelId: string, opposingIds: Set<string>): SpatialModel[] {
    const model = this.models.get(modelId);
    if (!model) return [];
    return this.getAllModels().filter(other => {
      if (!opposingIds.has(other.id)) return false;
      return LOFOperations.isBaseContact(model, other);
    });
  }

  /**
   * Clear all models
   */
  clear(): void {
    this.models.clear();
  }

  /**
   * Get the count of registered models
   */
  getCount(): number {
    return this.models.size;
  }
}

/**
 * Measurement utilities for spatial calculations
 */
export class MeasurementUtils {
  /**
   * Calculate center-to-center distance between two models
   */
  static centerToCenter(a: SpatialModel, b: SpatialModel): number {
    return LOFOperations.distance(a.position, b.position);
  }

  /**
   * Calculate edge-to-edge distance between two models
   */
  static edgeToEdge(a: SpatialModel, b: SpatialModel): number {
    return LOFOperations.distanceEdgeToEdge(a, b);
  }

  /**
   * Check if two models are in base contact
   */
  static isBaseContact(a: SpatialModel, b: SpatialModel): boolean {
    return LOFOperations.isBaseContact(a, b);
  }

  /**
   * Calculate melee reach for a character (base diameter + weapon reach modifier)
   */
  static calculateMeleeReach(model: SpatialModel, weaponReachModifier = 0): number {
    return model.baseDiameter / 2 + weaponReachModifier;
  }

  /**
   * Check if a model can reach another in melee
   */
  static canReachInMelee(
    attacker: SpatialModel,
    target: SpatialModel,
    attackerWeaponReach = 0
  ): boolean {
    const reach = MeasurementUtils.calculateMeleeReach(attacker, attackerWeaponReach);
    const distance = MeasurementUtils.edgeToEdge(attacker, target);
    return distance <= reach;
  }

  /**
   * Check if a position is within a model's melee threat zone
   */
  static isInThreatZone(
    model: SpatialModel,
    position: Position,
    weaponReach = 0
  ): boolean {
    const threatRadius = model.baseDiameter / 2 + weaponReach;
    const distance = LOFOperations.distance(model.position, position);
    return distance <= threatRadius;
  }

  /**
   * Get the midpoint between two positions
   */
  static midpoint(a: Position, b: Position): Position {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }

  /**
   * Calculate the bearing angle from one position to another (in degrees)
   */
  static bearing(from: Position, to: Position): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const radians = Math.atan2(dy, dx);
    const degrees = radians * (180 / Math.PI);
    return degrees >= 0 ? degrees : degrees + 360;
  }

  /**
   * Check if three models are in a flanking configuration
   * (attacker and ally are on opposite sides of target)
   */
  static isFlankingConfiguration(
    attacker: SpatialModel,
    ally: SpatialModel,
    target: SpatialModel
  ): boolean {
    const angleAtTarget = this.angleBetweenPoints(
      attacker.position,
      target.position,
      ally.position
    );
    // Flanking if angle is greater than 120 degrees (models on opposite sides)
    return angleAtTarget > 120;
  }

  /**
   * Calculate the angle between three points (at the middle point)
   */
  static angleBetweenPoints(a: Position, b: Position, c: Position): number {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };
    const dot = ba.x * bc.x + ba.y * bc.y;
    const magBa = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
    const magBc = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
    if (magBa === 0 || magBc === 0) return 0;
    const cosAngle = dot / (magBa * magBc);
    const clamped = Math.max(-1, Math.min(1, cosAngle));
    return Math.acos(clamped) * (180 / Math.PI);
  }

  /**
   * Check if a model is surrounded (engaged by multiple enemies)
   */
  static isSurrounded(model: SpatialModel, enemies: SpatialModel[], minCount = 2): boolean {
    let engagedCount = 0;
    for (const enemy of enemies) {
      if (LOFOperations.isBaseContact(model, enemy)) {
        engagedCount++;
        if (engagedCount >= minCount) return true;
      }
    }
    return false;
  }

  /**
   * Calculate cohesion distance - how far a model is from its squad
   */
  static getCohesionDistance(model: SpatialModel, squadModels: SpatialModel[]): number {
    if (squadModels.length === 0) return Infinity;
    let minDistance = Infinity;
    for (const squadMate of squadModels) {
      if (squadMate.id === model.id) continue;
      const distance = MeasurementUtils.edgeToEdge(model, squadMate);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
    return minDistance;
  }

  /**
   * Check if a model maintains cohesion with its squad
   */
  static maintainsCohesion(
    model: SpatialModel,
    squadModels: SpatialModel[],
    maxCohesionDistance: number
  ): boolean {
    const cohesionDistance = MeasurementUtils.getCohesionDistance(model, squadModels);
    return cohesionDistance <= maxCohesionDistance;
  }

  /**
   * Find the nearest squad mate
   */
  static findNearestSquadMate(
    model: SpatialModel,
    squadModels: SpatialModel[]
  ): SpatialModel | null {
    let nearest: SpatialModel | null = null;
    let minDistance = Infinity;
    for (const squadMate of squadModels) {
      if (squadMate.id === model.id) continue;
      const distance = MeasurementUtils.centerToCenter(model, squadMate);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = squadMate;
      }
    }
    return nearest;
  }

  /**
   * Calculate the center of mass for a group of models
   */
  static getGroupCenter(models: SpatialModel[]): Position {
    if (models.length === 0) {
      return { x: 0, y: 0 };
    }
    let sumX = 0;
    let sumY = 0;
    for (const model of models) {
      sumX += model.position.x;
      sumY += model.position.y;
    }
    return {
      x: sumX / models.length,
      y: sumY / models.length,
    };
  }

  /**
   * Check if a model is on the flank of an enemy line
   */
  static isOnFlank(
    model: SpatialModel,
    enemyModels: SpatialModel[],
    flankAngleThreshold = 45
  ): boolean {
    if (enemyModels.length < 2) return false;

    // Calculate the enemy line's orientation
    const center = MeasurementUtils.getGroupCenter(enemyModels);
    const bearing = MeasurementUtils.bearing(center, model.position);

    // Check if model is within flank angle of any enemy
    for (const enemy of enemyModels) {
      const enemyBearing = MeasurementUtils.bearing(center, enemy.position);
      const angleDiff = Math.abs(bearing - enemyBearing);
      const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
      if (normalizedAngle >= 90 - flankAngleThreshold / 2 &&
          normalizedAngle <= 90 + flankAngleThreshold / 2) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a model is in the rear arc of another model
   */
  static isInRearArc(
    observer: SpatialModel,
    target: SpatialModel,
    frontArcDegrees = 180
  ): boolean {
    // For now, assume models face their movement direction or nearest enemy
    // This is a simplified check - full implementation would track facing
    const rearArcThreshold = (360 - frontArcDegrees) / 2;
    // Simplified: check if target is behind observer based on some reference
    // In a full implementation, we'd track model facing direction
    return false; // Placeholder - needs facing tracking
  }
}

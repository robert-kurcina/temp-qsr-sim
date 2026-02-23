/**
 * Utility Scoring System
 * 
 * Evaluates actions, positions, and targets using weighted factors.
 * Allows fine-tuning AI behavior without code changes.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { AIContext, ActionDecision, ActionType } from './AIController';
import { getMultipleWeaponsBonus, getWeaponClassification, qualifiesForMultipleWeapons } from '../../traits/combat-traits';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';

/**
 * Weight configuration for utility scoring
 */
export interface UtilityWeights {
  // Distance weights
  distanceToTarget: number;
  optimalRange: number;

  // Cover weights
  coverValue: number;
  highGroundValue: number;

  // Combat weights
  targetHealth: number;
  targetThreat: number;
  killProbability: number;

  // Positioning weights
  cohesionValue: number;
  flankValue: number;
  chokepointValue: number;

  // Mission weights
  objectiveValue: number;
  victoryConditionValue: number;

  // Survival weights
  selfPreservation: number;
  allyProtection: number;

  // Risk weights
  riskAvoidance: number;
  aggression: number;
}

/**
 * Default utility weights
 */
export const DEFAULT_WEIGHTS: UtilityWeights = {
  distanceToTarget: 1.0,
  optimalRange: 1.5,
  coverValue: 2.0,
  highGroundValue: 1.0,
  targetHealth: 1.5,
  targetThreat: 2.0,
  killProbability: 2.5,
  cohesionValue: 1.0,
  flankValue: 1.5,
  chokepointValue: 0.5,
  objectiveValue: 3.0,
  victoryConditionValue: 4.0,
  selfPreservation: 2.0,
  allyProtection: 1.0,
  riskAvoidance: 1.0,
  aggression: 1.0,
};

/**
 * Scored action candidate
 */
export interface ScoredAction {
  action: ActionType;
  target?: Character;
  position?: Position;
  score: number;
  factors: Record<string, number>;
}

/**
 * Scored position candidate
 */
export interface ScoredPosition {
  position: Position;
  score: number;
  factors: {
    cover: number;
    distance: number;
    visibility: number;
    cohesion: number;
  };
}

/**
 * Scored target candidate
 */
export interface ScoredTarget {
  target: Character;
  score: number;
  factors: {
    health: number;
    threat: number;
    distance: number;
    visibility: number;
    missionPriority: number;
  };
}

/**
 * Utility Scorer class
 */
export class UtilityScorer {
  weights: UtilityWeights;

  constructor(weights: Partial<UtilityWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Update weights
   */
  setWeights(weights: Partial<UtilityWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  /**
   * Score all possible actions and return the best
   */
  evaluateActions(context: AIContext): ScoredAction[] {
    const actions: ScoredAction[] = [];

    // Evaluate movement actions
    const movePositions = this.evaluatePositions(context);
    for (const pos of movePositions.slice(0, 3)) {
      actions.push({
        action: 'move',
        position: pos.position,
        score: pos.score * 0.8,
        factors: { ...pos.factors },
      });
    }

    // Evaluate attack actions
    const attackTargets = this.evaluateTargets(context);
    for (const target of attackTargets) {
      // Check if in melee range
      const inMelee = this.isInMeleeRange(context.character, target.target, context.battlefield);
      if (inMelee) {
        let score = target.score * 1.2;
        
        // Multiple Weapons bonus consideration for melee
        if (qualifiesForMultipleWeapons(context.character, true)) {
          const bonus = getMultipleWeaponsBonus(context.character, 0, true);
          score += bonus * 0.3;
        }
        
        actions.push({
          action: 'close_combat',
          target: target.target,
          score: score,
          factors: { ...target.factors, multipleWeapons: qualifiesForMultipleWeapons(context.character, true) },
        });
      }

      // Check if in range for ranged attack
      const inRange = this.isInRange(context.character, target.target, context.battlefield);
      if (inRange) {
        let score = target.score;
        
        // Multiple Weapons bonus consideration
        if (qualifiesForMultipleWeapons(context.character, false)) {
          const bonus = getMultipleWeaponsBonus(context.character, 0, false);
          score += bonus * 0.3; // Bonus adds to score
        }
        
        actions.push({
          action: 'ranged_combat',
          target: target.target,
          score: score,
          factors: { ...target.factors, multipleWeapons: qualifiesForMultipleWeapons(context.character, false) },
        });
      }
    }

    // Evaluate disengage if engaged
    if (context.battlefield.isEngaged?.(context.character)) {
      const shouldDisengage = this.shouldDisengage(context);
      if (shouldDisengage) {
        const enemies = this.getEngagedEnemies(context.character, context.battlefield);
        for (const enemy of enemies) {
          actions.push({
            action: 'disengage',
            target: enemy,
            score: 3.0 + context.config.aggression,
            factors: { survival: 3.0 },
          });
        }
      }
    }

    // Evaluate support actions
    const supportActions = this.evaluateSupportActions(context);
    actions.push(...supportActions);

    // Sort by score
    actions.sort((a, b) => b.score - a.score);

    return actions;
  }

  /**
   * Evaluate positions for movement
   */
  evaluatePositions(context: AIContext): ScoredPosition[] {
    const positions: ScoredPosition[] = [];
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) return positions;

    // Sample positions around character
    const sampleRadius = Math.max(4, context.character.finalAttributes.mov ?? 4);
    const samples = this.samplePositions(characterPos, sampleRadius, 16);

    for (const pos of samples) {
      const cover = this.evaluateCover(pos, context);
      const distance = this.evaluateDistance(pos, context);
      const visibility = this.evaluateVisibility(pos, context);
      const cohesion = this.evaluateCohesion(pos, context);

      const score =
        cover * this.weights.coverValue +
        distance * this.weights.distanceToTarget +
        visibility * 0.5 +
        cohesion * this.weights.cohesionValue;

      positions.push({
        position: pos,
        score,
        factors: { cover, distance, visibility, cohesion },
      });
    }

    positions.sort((a, b) => b.score - a.score);
    return positions;
  }

  /**
   * Evaluate targets for attack
   */
  evaluateTargets(context: AIContext): ScoredTarget[] {
    const targets: ScoredTarget[] = [];
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) return targets;

    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;

      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const health = this.evaluateTargetHealth(enemy);
      const threat = this.evaluateTargetThreat(enemy, context);
      const distance = this.evaluateTargetDistance(characterPos, enemyPos);
      const visibility = this.hasLOS(context.character, enemy, context.battlefield) ? 1.0 : 0.0;
      const missionPriority = this.evaluateMissionPriority(enemy, context);

      const score =
        health * this.weights.targetHealth +
        threat * this.weights.targetThreat +
        distance * this.weights.distanceToTarget +
        visibility * 2.0 +
        missionPriority * this.weights.victoryConditionValue;

      targets.push({
        target: enemy,
        score,
        factors: { health, threat, distance, visibility, missionPriority },
      });
    }

    targets.sort((a, b) => b.score - a.score);
    return targets;
  }

  /**
   * Evaluate support actions (rally, revive, etc.)
   */
  evaluateSupportActions(context: AIContext): ScoredAction[] {
    const actions: ScoredAction[] = [];

    // Rally - for allies with fear
    for (const ally of context.allies) {
      if (ally.state.fearTokens > 0) {
        const distance = this.getDistance(context.character, ally, context.battlefield);
        const score = (ally.state.fearTokens * 2.0) / (distance + 1);
        actions.push({
          action: 'rally',
          target: ally,
          score,
          factors: { fear: ally.state.fearTokens, distance },
        });
      }
    }

    // Revive - for KO'd allies
    for (const ally of context.allies) {
      if (ally.state.isKOd) {
        const distance = this.getDistance(context.character, ally, context.battlefield);
        const score = 5.0 / (distance + 1);
        actions.push({
          action: 'revive',
          target: ally,
          score,
          factors: { distance },
        });
      }
    }

    return actions;
  }

  // ============================================================================
  // Evaluation Helpers
  // ============================================================================

  private evaluateCover(position: Position, context: AIContext): number {
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) return 0;

    // Check for cover from nearest enemy
    let bestCover = 0;
    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      // Simplified cover check - use LOS as proxy
      // TODO: Use actual cover detection when available
      const hasLOS = context.battlefield.hasLineOfSight(characterPos, position);
      if (!hasLOS) bestCover = Math.max(bestCover, 1.0); // Full cover if no LOS
    }

    return bestCover;
  }

  private evaluateDistance(position: Position, context: AIContext): number {
    if (context.enemies.length === 0) return 0.5;

    // Score based on distance to nearest enemy (prefer optimal engagement range)
    const nearestEnemy = context.enemies[0];
    const enemyPos = context.battlefield.getCharacterPosition(nearestEnemy);
    if (!enemyPos) return 0.5;

    const dist = Math.sqrt(
      Math.pow(position.x - enemyPos.x, 2) +
      Math.pow(position.y - enemyPos.y, 2)
    );

    // Prefer medium range (not too close, not too far)
    const optimalRange = 6;
    const deviation = Math.abs(dist - optimalRange);
    return Math.max(0, 1 - deviation / optimalRange);
  }

  private evaluateVisibility(position: Position, context: AIContext): number {
    let visibleEnemies = 0;
    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      // Simplified visibility check
      visibleEnemies++;
    }
    return visibleEnemies / Math.max(1, context.enemies.length);
  }

  private evaluateCohesion(position: Position, context: AIContext): number {
    if (context.allies.length === 0) return 1.0;

    let totalDistance = 0;
    let count = 0;
    for (const ally of context.allies) {
      const allyPos = context.battlefield.getCharacterPosition(ally);
      if (!allyPos) continue;
      totalDistance += Math.sqrt(
        Math.pow(position.x - allyPos.x, 2) +
        Math.pow(position.y - allyPos.y, 2)
      );
      count++;
    }

    const avgDistance = count > 0 ? totalDistance / count : 0;
    // Prefer staying within 8 MU of allies
    return Math.max(0, 1 - avgDistance / 8);
  }

  private evaluateTargetHealth(target: Character): number {
    const siz = target.finalAttributes.siz ?? target.attributes.siz ?? 3;
    const healthRatio = 1 - (target.state.wounds / siz);
    // Prefer wounded targets
    return 1 - healthRatio;
  }

  private evaluateTargetThreat(target: Character, context: AIContext): number {
    let threat = 0;

    // CCA threat
    if (target.finalAttributes.cca >= 3) threat += 0.5;
    if (target.finalAttributes.cca >= 4) threat += 0.5;

    // RCA threat
    if (target.finalAttributes.rca >= 3) threat += 0.5;
    if (target.finalAttributes.rca >= 4) threat += 0.5;

    // Elite/veteran threat
    if (target.profile.name.includes('elite')) threat += 1.0;
    else if (target.profile.name.includes('veteran')) threat += 0.5;

    return threat;
  }

  private evaluateTargetDistance(from: Position, to: Position): number {
    const dist = Math.sqrt(
      Math.pow(from.x - to.x, 2) +
      Math.pow(from.y - to.y, 2)
    );
    // Prefer closer targets
    return Math.max(0, 1 - dist / 24);
  }

  private evaluateMissionPriority(target: Character, context: AIContext): number {
    // TODO: Mission-specific priority evaluation
    // For Elimination: all targets equal priority
    // For Recovery: VIP has highest priority
    // For Assault: mechanism has highest priority
    return 1.0;
  }

  private shouldDisengage(context: AIContext): boolean {
    const character = context.character;
    const cca = character.finalAttributes.cca ?? character.attributes.cca ?? 2;

    // Check if outnumbered
    let friendlyCount = 0;
    let enemyCount = 0;

    for (const ally of context.allies) {
      if (context.battlefield.isEngaged?.(ally)) friendlyCount++;
    }
    for (const enemy of context.enemies) {
      if (context.battlefield.isEngaged?.(enemy)) enemyCount++;
    }

    // Disengage if significantly outnumbered
    if (enemyCount > friendlyCount * 2) return true;

    // Disengage if low on wounds
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    if (character.state.wounds >= siz - 1) return true;

    // Disengage if CCA is much lower than enemies
    // (simplified check)
    return false;
  }

  private getEngagedEnemies(character: Character, battlefield: Battlefield): Character[] {
    // TODO: Get list of enemies engaged with this character
    return [];
  }

  private isInMeleeRange(from: Character, to: Character, battlefield: Battlefield): boolean {
    const fromPos = battlefield.getCharacterPosition(from);
    const toPos = battlefield.getCharacterPosition(to);
    if (!fromPos || !toPos) return false;

    const fromModel = {
      id: from.id,
      position: fromPos,
      baseDiameter: getBaseDiameterFromSiz(from.finalAttributes.siz ?? 3),
      siz: from.finalAttributes.siz ?? 3,
    };
    const toModel = {
      id: to.id,
      position: toPos,
      baseDiameter: getBaseDiameterFromSiz(to.finalAttributes.siz ?? 3),
      siz: to.finalAttributes.siz ?? 3,
    };

    return SpatialRules.isEngaged(fromModel, toModel);
  }

  private isInRange(from: Character, to: Character, battlefield: Battlefield): boolean {
    // Simplified range check (within 16 MU for ranged attacks)
    const fromPos = battlefield.getCharacterPosition(from);
    const toPos = battlefield.getCharacterPosition(to);
    if (!fromPos || !toPos) return false;

    const dist = Math.sqrt(
      Math.pow(fromPos.x - toPos.x, 2) +
      Math.pow(fromPos.y - toPos.y, 2)
    );

    return dist <= 16 && dist > 1;
  }

  private hasLOS(from: Character, to: Character, battlefield: Battlefield): boolean {
    const fromPos = battlefield.getCharacterPosition(from);
    const toPos = battlefield.getCharacterPosition(to);
    if (!fromPos || !toPos) return false;

    const fromModel = {
      id: from.id,
      position: fromPos,
      baseDiameter: getBaseDiameterFromSiz(from.finalAttributes.siz ?? 3),
      siz: from.finalAttributes.siz ?? 3,
    };
    const toModel = {
      id: to.id,
      position: toPos,
      baseDiameter: getBaseDiameterFromSiz(to.finalAttributes.siz ?? 3),
      siz: to.finalAttributes.siz ?? 3,
    };

    return SpatialRules.hasLineOfSight(battlefield, fromModel, toModel);
  }

  private getDistance(from: Character, to: Character, battlefield: Battlefield): number {
    const fromPos = battlefield.getCharacterPosition(from);
    const toPos = battlefield.getCharacterPosition(to);
    if (!fromPos || !toPos) return 999;

    return Math.sqrt(
      Math.pow(fromPos.x - toPos.x, 2) +
      Math.pow(fromPos.y - toPos.y, 2)
    );
  }

  private samplePositions(center: Position, radius: number, count: number): Position[] {
    const positions: Position[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = (i % 3 + 1) * (radius / 3);
      positions.push({
        x: Math.round(center.x + Math.cos(angle) * dist),
        y: Math.round(center.y + Math.sin(angle) * dist),
      });
    }
    return positions;
  }
}

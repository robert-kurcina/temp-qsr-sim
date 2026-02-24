/**
 * Utility Scoring System
 * 
 * Evaluates actions, positions, and targets using weighted factors.
 * Allows fine-tuning AI behavior without code changes.
 */

import { Character } from '../../core/Character';
import { Item } from '../../core/Item';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { AIContext, AIControllerConfig, ActionDecision, ActionType } from './AIController';
import { isAttackableEnemy } from './ai-utils';
import { getMultipleWeaponsBonus, qualifiesForMultipleWeapons } from '../../traits/combat-traits';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { PathfindingEngine } from '../../battlefield/pathfinding/PathfindingEngine';
import { evaluateRangeWithVisibility, parseWeaponOptimalRangeMu } from '../../utils/visibility';

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
    const attackActions: ScoredAction[] = [];

    // Evaluate attack actions first so move pressure can adapt when no legal attacks exist.
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
        
        attackActions.push({
          action: 'close_combat',
          target: target.target,
          score: score,
          factors: { ...target.factors, multipleWeapons: qualifiesForMultipleWeapons(context.character, true) },
        });
      }

      // Check if in range for ranged attack using session visibility + ORM logic
      const rangedOpportunity = this.evaluateRangedOpportunity(context, target.target);
      if (rangedOpportunity.canAttack) {
        let score = target.score;

        // Multiple Weapons bonus consideration
        if (qualifiesForMultipleWeapons(context.character, false)) {
          const bonus = getMultipleWeaponsBonus(context.character, 0, false);
          score += bonus * 0.3;
        }
        // Heavier ORM penalties make long, low-probability shots less dominant.
        score *= 1 / (1 + (rangedOpportunity.orm * 0.35));
        if (rangedOpportunity.requiresConcentrate) {
          // Keep this viable, but less preferred than immediate fire.
          score *= 0.8;
        }

        attackActions.push({
          action: 'ranged_combat',
          target: target.target,
          score: score,
          factors: {
            ...target.factors,
            multipleWeapons: qualifiesForMultipleWeapons(context.character, false),
            requiresConcentrate: rangedOpportunity.requiresConcentrate ? 1 : 0,
            orm: rangedOpportunity.orm,
          },
        });
      }
    }

    // Evaluate movement actions
    const movePositions = this.evaluatePositions(context);
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    const nearestEnemyDistance = characterPos
      ? this.distanceToClosestAttackableEnemy(characterPos, context)
      : Number.POSITIVE_INFINITY;
    const moveMultiplier = attackActions.length > 0 ? 0.8 : 1.4;
    const advanceBonus = nearestEnemyDistance > 10 ? 0.7 : 0;
    for (const pos of movePositions.slice(0, 3)) {
      actions.push({
        action: 'move',
        position: pos.position,
        score: pos.score * moveMultiplier + advanceBonus,
        factors: {
          ...pos.factors,
          moveMultiplier,
          advanceBonus,
        },
      });
    }
    actions.push(...attackActions);

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
    const movementAllowance = Math.max(
      1,
      (context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2) + 2
    );

    // Local + strategic sampling:
    // - local ring to retain tactical nuance
    // - board-aware path endpoints to avoid short-horizon stagnation
    const sampleRadius = Math.max(
      1,
      (context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2) + 2
    );
    const localSamples = this.samplePositions(characterPos, sampleRadius, 16);
    const strategicSamples = this.sampleStrategicPositions(context, characterPos);
    const samples = this.dedupePositions([...localSamples, ...strategicSamples], context.battlefield);

    for (const pos of samples) {
      if (pos.x === characterPos.x && pos.y === characterPos.y) continue;
      const distance = Math.hypot(pos.x - characterPos.x, pos.y - characterPos.y);
      if (distance > movementAllowance + 1e-6) continue;
      const occupant = context.battlefield.getCharacterAt(pos);
      if (occupant && occupant.id !== context.character.id) continue;

      const cover = this.evaluateCover(pos, context);
      const distanceScore = this.evaluateDistance(pos, context);
      const visibility = this.evaluateVisibility(pos, context);
      const cohesion = this.evaluateCohesion(pos, context);

      const score =
        cover * this.weights.coverValue +
        distanceScore * this.weights.distanceToTarget +
        visibility * 0.5 +
        cohesion * this.weights.cohesionValue;

      positions.push({
        position: pos,
        score,
        factors: { cover, distance: distanceScore, visibility, cohesion },
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
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;

      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const health = this.evaluateTargetHealth(enemy);
      const threat = this.evaluateTargetThreat(enemy, context);
      const distance = this.evaluateTargetDistance(characterPos, enemyPos);
      const visibility = context.config.perCharacterFovLos
        ? (this.hasLOS(context.character, enemy, context.battlefield) ? 1.0 : 0.0)
        : 1.0;
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
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
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
    const nearestDistance = this.distanceToClosestAttackableEnemy(position, context);
    if (!Number.isFinite(nearestDistance)) return 0.2;

    const currentPos = context.battlefield.getCharacterPosition(context.character);
    const currentDistance = currentPos
      ? this.distanceToClosestAttackableEnemy(currentPos, context)
      : nearestDistance;

    const improvement = Number.isFinite(currentDistance)
      ? currentDistance - nearestDistance
      : 0;
    const progressScore = Number.isFinite(currentDistance) && currentDistance > 0
      ? improvement / currentDistance
      : 0;

    const hasRanged = this.getRangedWeapons(context.character).length > 0;
    const preferredDistance = hasRanged ? 10 : 2;
    const spread = hasRanged ? 10 : 6;
    const preferredBandScore = Math.max(0, 1 - Math.abs(nearestDistance - preferredDistance) / spread);

    return Math.max(0, Math.min(1.5, 0.15 + preferredBandScore * 0.45 + Math.max(-0.5, progressScore) * 0.9));
  }

  private evaluateVisibility(position: Position, context: AIContext): number {
    if (!context.config.perCharacterFovLos) {
      return context.enemies.length > 0 ? 1.0 : 0.0;
    }

    const myModel = {
      id: context.character.id,
      position,
      baseDiameter: getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? 3),
      siz: context.character.finalAttributes.siz ?? 3,
    };
    let visibleEnemies = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes.siz ?? 3),
        siz: enemy.finalAttributes.siz ?? 3,
      };
      if (SpatialRules.hasLineOfSight(context.battlefield, myModel, enemyModel)) {
        visibleEnemies++;
      }
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

  private isInRange(
    from: Character,
    to: Character,
    battlefield: Battlefield,
    config: AIControllerConfig = { aggression: 0.5, caution: 0.5, accuracyModifier: 0, godMode: true }
  ): boolean {
    const fromPos = battlefield.getCharacterPosition(from);
    const toPos = battlefield.getCharacterPosition(to);
    if (!fromPos || !toPos) return false;

    if (config.perCharacterFovLos && !this.hasLOS(from, to, battlefield)) {
      return false;
    }

    const dist = Math.hypot(fromPos.x - toPos.x, fromPos.y - toPos.y);
    const weapons = this.getRangedWeapons(from);
    for (const weapon of weapons) {
      const weaponOr = parseWeaponOptimalRangeMu(from, weapon);
      const range = evaluateRangeWithVisibility(dist, weaponOr, {
        visibilityOrMu: config.visibilityOrMu,
        maxOrm: config.maxOrm,
        allowConcentrateRangeExtension: config.allowConcentrateRangeExtension,
      });
      if (range.inRange) return true;
    }
    return false;
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

  private evaluateRangedOpportunity(
    context: AIContext,
    target: Character
  ): { canAttack: boolean; requiresConcentrate: boolean; orm: number } {
    const attackerPos = context.battlefield.getCharacterPosition(context.character);
    const targetPos = context.battlefield.getCharacterPosition(target);
    if (!attackerPos || !targetPos) {
      return { canAttack: false, requiresConcentrate: false, orm: 0 };
    }
    if (context.config.perCharacterFovLos && !this.hasLOS(context.character, target, context.battlefield)) {
      return { canAttack: false, requiresConcentrate: false, orm: 0 };
    }

    const distance = Math.hypot(attackerPos.x - targetPos.x, attackerPos.y - targetPos.y);
    const weapons = this.getRangedWeapons(context.character);
    for (const weapon of weapons) {
      const weaponOr = parseWeaponOptimalRangeMu(context.character, weapon);
      const range = evaluateRangeWithVisibility(distance, weaponOr, {
        visibilityOrMu: context.config.visibilityOrMu,
        maxOrm: context.config.maxOrm,
        allowConcentrateRangeExtension: context.config.allowConcentrateRangeExtension,
      });
      if (!range.inRange) continue;
      if (range.requiresConcentrate && context.apRemaining < 2) continue;
      return {
        canAttack: true,
        requiresConcentrate: range.requiresConcentrate,
        orm: range.requiresConcentrate ? range.concentratedOrm : range.orm,
      };
    }

    return { canAttack: false, requiresConcentrate: false, orm: 0 };
  }

  private getRangedWeapons(character: Character) {
    const rawItems = (character.profile?.items?.length ? character.profile.items : character.profile?.equipment) ?? [];
    const items = rawItems.filter((item): item is Item => Boolean(item));
    return items.filter(item => this.isRangedWeapon(item));
  }

  private isRangedWeapon(item: Item): boolean {
    if (!item) return false;
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    if (
      classification.includes('bow') ||
      classification.includes('thrown') ||
      classification.includes('firearm') ||
      classification.includes('range') ||
      classification.includes('support')
    ) {
      return true;
    }
    return (
      (classification.includes('melee') || classification.includes('natural')) &&
      Array.isArray(item.traits) &&
      item.traits.some(t => t.toLowerCase().includes('throwable'))
    );
  }

  private sampleStrategicPositions(context: AIContext, characterPos: Position): Position[] {
    const mov = context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2;
    const movementAllowance = Math.max(1, mov + 2);
    const footprintDiameter = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? 3);
    const engine = new PathfindingEngine(context.battlefield);
    const strategic: Position[] = [];

    const candidateEnemies = context.enemies.filter(enemy => {
      if (!isAttackableEnemy(context.character, enemy, context.config)) return false;
      if (!context.config.perCharacterFovLos) return true;
      return this.hasLOS(context.character, enemy, context.battlefield);
    });

    for (const enemy of candidateEnemies) {
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const limited = engine.findPathWithMaxMu(
        characterPos,
        enemyPos,
        {
          footprintDiameter,
          movementMetric: 'length',
          useNavMesh: true,
          useHierarchical: true,
          optimizeWithLOS: true,
        },
        movementAllowance
      );
      const end = limited.points[limited.points.length - 1];
      if (!end) continue;
      strategic.push(this.snapToBoardCell(end, context.battlefield));
    }

    return strategic;
  }

  private snapToBoardCell(position: Position, battlefield: Battlefield): Position {
    const x = Math.max(0, Math.min(battlefield.width - 1, Math.round(position.x)));
    const y = Math.max(0, Math.min(battlefield.height - 1, Math.round(position.y)));
    return { x, y };
  }

  private dedupePositions(positions: Position[], battlefield: Battlefield): Position[] {
    const seen = new Set<string>();
    const unique: Position[] = [];
    for (const pos of positions) {
      const snapped = this.snapToBoardCell(pos, battlefield);
      const key = `${snapped.x},${snapped.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(snapped);
    }
    return unique;
  }

  private distanceToClosestAttackableEnemy(position: Position, context: AIContext): number {
    let nearest = Number.POSITIVE_INFINITY;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const distance = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
      if (distance < nearest) {
        nearest = distance;
      }
    }
    return nearest;
  }
}

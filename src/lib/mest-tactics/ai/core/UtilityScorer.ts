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
  objectiveAction?: 'acquire_marker' | 'share_marker' | 'transfer_marker' | 'destroy_marker';
  markerId?: string;
  markerTargetModelId?: string;
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
    threatRelief: number;
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

interface MissionBias {
  movePressure: number;
  waitPressure: number;
  objectiveActionPressure: number;
  attackPressure: number;
  centerTargetBias: number;
  vipTargetBias: number;
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
    const loadout = this.getLoadoutProfile(context.character);
    const doctrinePlanning = this.getDoctrinePlanning(context);
    const doctrineEngagement = this.getDoctrineEngagement(context, loadout);
    const missionBias = this.getMissionBias(context);

    // Evaluate attack actions first so move pressure can adapt when no legal attacks exist.
    const attackTargets = this.evaluateTargets(context);
    for (const target of attackTargets) {
      // Check if in melee range
      const inMelee = this.isInMeleeRange(context.character, target.target, context.battlefield);
      if (inMelee) {
        let score = target.score * 1.2;
        if (!loadout.hasMeleeWeapons && loadout.hasRangedWeapons) {
          // Ranged-only models generally should avoid base-contact fights.
          score *= 0.55;
        } else if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
          score *= 1.2;
        }
        if (doctrineEngagement === 'melee') {
          score *= 1.15;
        } else if (doctrineEngagement === 'ranged') {
          score *= 0.82;
        }
        if (doctrinePlanning === 'keys_to_victory') {
          score *= Math.max(0.72, 1 - missionBias.objectiveActionPressure * 0.22);
        } else if (doctrinePlanning === 'aggression') {
          score *= 1.08;
        }
        score *= missionBias.attackPressure;
        
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
        if (rangedOpportunity.leanOpportunity) {
          score += 1.2;
        }
        if (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons) {
          score *= 1.12;
        } else if (!loadout.hasRangedWeapons && loadout.hasMeleeWeapons) {
          score *= 0.75;
        }
        if (doctrineEngagement === 'ranged') {
          score *= 1.12;
        } else if (doctrineEngagement === 'melee') {
          score *= 0.86;
        }
        if (doctrinePlanning === 'keys_to_victory') {
          score *= Math.max(0.72, 1 - missionBias.objectiveActionPressure * 0.2);
        } else if (doctrinePlanning === 'aggression') {
          score *= 1.06;
        }
        score *= missionBias.attackPressure;

        attackActions.push({
          action: 'ranged_combat',
          target: target.target,
          score: score,
          factors: {
            ...target.factors,
            multipleWeapons: qualifiesForMultipleWeapons(context.character, false),
            requiresConcentrate: rangedOpportunity.requiresConcentrate ? 1 : 0,
            orm: rangedOpportunity.orm,
            leanOpportunity: rangedOpportunity.leanOpportunity ? 1 : 0,
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
    const currentExposure = characterPos ? this.countEnemySightLinesToPosition(characterPos, context) : 0;
    let moveMultiplier = attackActions.length > 0
      ? (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons ? 0.95 : 0.9)
      : (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons ? 1.95 : 1.5);
    if (doctrineEngagement === 'melee') {
      moveMultiplier += 0.2;
    } else if (doctrineEngagement === 'ranged') {
      moveMultiplier += currentExposure > 0 ? 0.15 : -0.08;
    }
    if (doctrinePlanning === 'keys_to_victory') {
      moveMultiplier += missionBias.objectiveActionPressure * 0.4;
    } else if (doctrinePlanning === 'aggression') {
      moveMultiplier += 0.08;
    }

    const advanceBonus = (nearestEnemyDistance > 10
      ? (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons ? 1.45 : 0.9)
      : 0) + missionBias.movePressure;
    const objectiveAdvanceWeight =
      missionBias.objectiveActionPressure *
      (doctrinePlanning === 'keys_to_victory' ? 4.2 : doctrinePlanning === 'balanced' ? 2.6 : 1.4);
    for (const pos of movePositions.slice(0, 3)) {
      const objectiveAdvance = this.evaluateObjectiveAdvance(pos.position, context);
      actions.push({
        action: 'move',
        position: pos.position,
        score:
          pos.score * moveMultiplier +
          advanceBonus +
          (missionBias.objectiveActionPressure * pos.factors.visibility * 0.35) +
          (objectiveAdvance * objectiveAdvanceWeight),
        factors: {
          ...pos.factors,
          moveMultiplier,
          advanceBonus,
          objectiveAdvance,
          objectiveAdvanceWeight,
          objectivePressure: missionBias.objectiveActionPressure,
        },
      });
    }
    actions.push(...attackActions);

    // Evaluate objective-marker interactions (OM system) when marker state is available.
    const objectiveActions = this.evaluateObjectiveMarkerActions(context, missionBias, doctrinePlanning);
    actions.push(...objectiveActions);

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

    const canConsiderWait =
      context.apRemaining >= 2 &&
      !context.character.state.isWaiting &&
      context.character.state.isAttentive &&
      context.character.state.isOrdered &&
      !context.character.state.isKOd &&
      !context.character.state.isEliminated &&
      !context.battlefield.isEngaged?.(context.character) &&
      loadout.hasRangedWeapons;
    if (canConsiderWait) {
      const currentPos = context.battlefield.getCharacterPosition(context.character);
      const exposure = currentPos ? this.countEnemySightLinesToPosition(currentPos, context) : 0;
      const hiddenRevealTargets = this.countWaitRevealTargets(context);
      const waitReactiveProfile = this.evaluateWaitReactiveProfile(context);
      const waitRefBonus =
        (waitReactiveProfile.refBreakpointCount * 0.72) +
        (waitReactiveProfile.potentialReactTargets * 0.18);
      const waitDelayAvoidance = waitReactiveProfile.delayAvoidanceScore;
      const hasAttackOption = attackActions.length > 0;
      const bestAttackScore = attackActions[0]?.score ?? 0;
      const waitMissionBias = missionBias.waitPressure + (doctrinePlanning === 'keys_to_victory' ? missionBias.objectiveActionPressure * 0.35 : 0);
      const waitScore =
        2.15 +
        (hasAttackOption ? 0 : 0.9) +
        (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons ? 0.55 : 0.2) +
        (context.config.caution * 1.9) +
        (exposure * 0.22) +
        (hiddenRevealTargets * 1.1) +
        waitRefBonus +
        waitDelayAvoidance +
        waitMissionBias;
      const threshold = (hiddenRevealTargets > 0 || waitRefBonus + waitDelayAvoidance >= 0.75) ? 0.64 : 0.78;
      if (!hasAttackOption || waitScore >= bestAttackScore * threshold) {
        actions.push({
          action: 'wait',
          score: waitScore,
          factors: {
            passiveReadiness: 1,
            caution: context.config.caution,
            exposure,
            hiddenRevealTargets,
            potentialReactTargets: waitReactiveProfile.potentialReactTargets,
            refBreakpointCount: waitReactiveProfile.refBreakpointCount,
            waitRefBonus,
            waitDelayAvoidance,
            objectivePressure: missionBias.objectiveActionPressure,
            waitMissionBias,
          },
        });
      }
    }

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
      const threatRelief = this.evaluateThreatRelief(pos, context);

      const score =
        cover * this.weights.coverValue +
        distanceScore * this.weights.distanceToTarget +
        threatRelief * (1.5 + this.weights.riskAvoidance) +
        visibility * 0.5 +
        cohesion * this.weights.cohesionValue;

      positions.push({
        position: pos,
        score,
        factors: { cover, distance: distanceScore, visibility, cohesion, threatRelief },
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
    const loadout = this.getLoadoutProfile(context.character);
    const coverPriority = loadout.hasRangedWeapons && !loadout.hasMeleeWeapons
      ? 1.2
      : loadout.hasMeleeWeapons && !loadout.hasRangedWeapons
        ? 0.9
        : 1.0;
    // Check for cover from nearest enemy
    let bestCover = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      // Simplified cover check - LOS from enemy to candidate position.
      const hasLOS = context.battlefield.hasLineOfSight(enemyPos, position);
      if (!hasLOS) {
        bestCover = Math.max(bestCover, 1.0); // Full cover if no LOS
      }
    }

    return Math.min(1.5, bestCover * coverPriority);
  }

  private evaluateThreatRelief(position: Position, context: AIContext): number {
    const currentPos = context.battlefield.getCharacterPosition(context.character);
    if (!currentPos) return 0;

    const currentExposure = this.countEnemySightLinesToPosition(currentPos, context);
    const nextExposure = this.countEnemySightLinesToPosition(position, context);
    if (currentExposure <= 0) return 0;

    const delta = (currentExposure - nextExposure) / currentExposure;
    return Math.max(-1, Math.min(1, delta));
  }

  private countEnemySightLinesToPosition(position: Position, context: AIContext): number {
    let count = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      if (context.battlefield.hasLineOfSight(enemyPos, position)) {
        count += 1;
      }
    }
    return count;
  }

  private countWaitRevealTargets(context: AIContext): number {
    const actorPos = context.battlefield.getCharacterPosition(context.character);
    if (!actorPos) return 0;

    const actorSiz = context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3;
    const actorModel = {
      id: context.character.id,
      position: actorPos,
      baseDiameter: getBaseDiameterFromSiz(actorSiz),
      siz: actorSiz,
    };
    const waitVisibility = Math.max(1, (context.config.visibilityOrMu ?? 16) * 2);

    let count = 0;
    for (const enemy of context.enemies) {
      if (!enemy.state.isHidden) continue;
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const enemySiz = enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3;
      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemySiz),
        siz: enemySiz,
      };
      if (!SpatialRules.hasLineOfSight(context.battlefield, actorModel, enemyModel)) {
        continue;
      }
      const edgeDistance = SpatialRules.distanceEdgeToEdge(actorModel, enemyModel);
      if (edgeDistance > waitVisibility) {
        continue;
      }
      const cover = SpatialRules.getCoverResult(context.battlefield, actorModel, enemyModel);
      const inCover = cover.hasDirectCover || cover.hasInterveningCover;
      if (!inCover) {
        count += 1;
      }
    }

    return count;
  }

  private getWaitVisibleEnemies(context: AIContext): Character[] {
    const actorPos = context.battlefield.getCharacterPosition(context.character);
    if (!actorPos) return [];

    const actorSiz = context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3;
    const actorModel = {
      id: context.character.id,
      position: actorPos,
      baseDiameter: getBaseDiameterFromSiz(actorSiz),
      siz: actorSiz,
    };
    const waitVisibility = Math.max(1, (context.config.visibilityOrMu ?? 16) * 2);

    const visibleEnemies: Character[] = [];
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const enemySiz = enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3;
      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemySiz),
        siz: enemySiz,
      };
      if (!SpatialRules.hasLineOfSight(context.battlefield, actorModel, enemyModel)) {
        continue;
      }
      const edgeDistance = SpatialRules.distanceEdgeToEdge(actorModel, enemyModel);
      if (edgeDistance <= waitVisibility) {
        visibleEnemies.push(enemy);
      }
    }

    return visibleEnemies;
  }

  private evaluateWaitReactiveProfile(context: AIContext): {
    potentialReactTargets: number;
    refBreakpointCount: number;
    delayAvoidanceScore: number;
  } {
    const visibleEnemies = this.getWaitVisibleEnemies(context);
    const potentialReactTargets = visibleEnemies.length;

    const reactorRef = context.character.finalAttributes.ref ?? context.character.attributes.ref ?? 0;
    let refBreakpointCount = 0;
    for (const enemy of visibleEnemies) {
      const enemyRef = enemy.finalAttributes.ref ?? enemy.attributes.ref ?? 0;
      const enemyMov = enemy.finalAttributes.mov ?? enemy.attributes.mov ?? 0;
      if (reactorRef < enemyRef && reactorRef + 1 >= enemyRef) {
        refBreakpointCount += 1;
      }
      if (reactorRef < enemyMov && reactorRef + 1 >= enemyMov) {
        refBreakpointCount += 1;
      }
    }

    const reactWindowPressure = Math.min(1.4, potentialReactTargets * 0.35);
    const existingDelay = Math.max(0, context.character.state.delayTokens ?? 0);
    const delayAvoidanceScore = potentialReactTargets > 0
      ? Math.min(1.6, 0.35 + reactWindowPressure + (existingDelay * 0.2))
      : 0;

    return {
      potentialReactTargets,
      refBreakpointCount,
      delayAvoidanceScore,
    };
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

    const loadout = this.getLoadoutProfile(context.character);
    const preferredDistance = loadout.hasRangedWeapons && !loadout.hasMeleeWeapons
      ? 10
      : loadout.hasMeleeWeapons && !loadout.hasRangedWeapons
        ? 1.5
        : 6;
    const spread = loadout.hasRangedWeapons && !loadout.hasMeleeWeapons
      ? 10
      : loadout.hasMeleeWeapons && !loadout.hasRangedWeapons
        ? 4
        : 8;
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
    const bias = this.getMissionBias(context);
    let priority = 1.0;

    const targetPos = context.battlefield.getCharacterPosition(target);
    if (targetPos && bias.centerTargetBias > 0) {
      const center = {
        x: context.battlefield.width / 2,
        y: context.battlefield.height / 2,
      };
      const maxCenterDistance = Math.hypot(context.battlefield.width / 2, context.battlefield.height / 2);
      const distanceToCenter = Math.hypot(targetPos.x - center.x, targetPos.y - center.y);
      const centerAffinity = 1 - Math.min(1, distanceToCenter / Math.max(1, maxCenterDistance));
      priority += centerAffinity * bias.centerTargetBias;
    }

    if (bias.vipTargetBias > 0) {
      const enemyBps = context.enemies.map(enemy => enemy.profile.totalBp ?? 0);
      const maxEnemyBp = enemyBps.length > 0 ? Math.max(...enemyBps) : (target.profile.totalBp ?? 0);
      const targetBp = target.profile.totalBp ?? 0;
      if (maxEnemyBp > 0) {
        const normalized = targetBp / maxEnemyBp;
        priority += normalized * bias.vipTargetBias;
      }
    }

    if ((context.config.missionRole ?? 'neutral') === 'defender') {
      priority += 0.1 * bias.centerTargetBias;
    }

    return Math.max(0.25, Math.min(3, priority));
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
  ): { canAttack: boolean; requiresConcentrate: boolean; orm: number; leanOpportunity: boolean } {
    const attackerPos = context.battlefield.getCharacterPosition(context.character);
    const targetPos = context.battlefield.getCharacterPosition(target);
    if (!attackerPos || !targetPos) {
      return { canAttack: false, requiresConcentrate: false, orm: 0, leanOpportunity: false };
    }
    if (context.config.perCharacterFovLos && !this.hasLOS(context.character, target, context.battlefield)) {
      return { canAttack: false, requiresConcentrate: false, orm: 0, leanOpportunity: false };
    }

    const distance = Math.hypot(attackerPos.x - targetPos.x, attackerPos.y - targetPos.y);
    const weapons = this.getRangedWeapons(context.character);
    const leanOpportunity = this.canLeanFromCover(context.character, target, context.battlefield);
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
        leanOpportunity,
      };
    }

    return { canAttack: false, requiresConcentrate: false, orm: 0, leanOpportunity: false };
  }

  private canLeanFromCover(attacker: Character, target: Character, battlefield: Battlefield): boolean {
    const attackerPos = battlefield.getCharacterPosition(attacker);
    const targetPos = battlefield.getCharacterPosition(target);
    if (!attackerPos || !targetPos) return false;

    const attackerModel = {
      id: attacker.id,
      position: attackerPos,
      baseDiameter: getBaseDiameterFromSiz(attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3),
      siz: attacker.finalAttributes.siz ?? attacker.attributes.siz ?? 3,
    };
    const targetModel = {
      id: target.id,
      position: targetPos,
      baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
      siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
    };
    const coverFromTarget = SpatialRules.getCoverResult(battlefield, targetModel, attackerModel);
    return coverFromTarget.hasLOS && (coverFromTarget.hasDirectCover || coverFromTarget.hasInterveningCover);
  }

  private getRangedWeapons(character: Character) {
    const rawItems = [
      ...(character.profile?.items ?? []),
      ...(character.profile?.equipment ?? []),
      ...(character.profile?.inHandItems ?? []),
      ...(character.profile?.stowedItems ?? []),
    ];
    const items = rawItems.filter((item): item is Item => Boolean(item));
    return items.filter(item => this.isRangedWeapon(item));
  }

  private getMeleeWeapons(character: Character) {
    const rawItems = [
      ...(character.profile?.items ?? []),
      ...(character.profile?.equipment ?? []),
      ...(character.profile?.inHandItems ?? []),
      ...(character.profile?.stowedItems ?? []),
    ];
    const items = rawItems.filter((item): item is Item => Boolean(item));
    return items.filter(item => this.isMeleeWeapon(item));
  }

  private getLoadoutProfile(character: Character): { hasMeleeWeapons: boolean; hasRangedWeapons: boolean } {
    const hasRangedWeapons = this.getRangedWeapons(character).length > 0;
    const hasMeleeWeapons = this.getMeleeWeapons(character).length > 0;
    return { hasMeleeWeapons, hasRangedWeapons };
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

  private isMeleeWeapon(item: Item): boolean {
    if (!item) return false;
    const classification = String(item.classification ?? item.class ?? '').toLowerCase();
    return classification.includes('melee') || classification.includes('natural');
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

    const objectiveMarkers = this.getInteractableObjectiveMarkers(context)
      .filter(marker => marker.position)
      .sort((a, b) => {
        const posA = a.position as Position;
        const posB = b.position as Position;
        const distA = Math.hypot(characterPos.x - posA.x, characterPos.y - posA.y);
        const distB = Math.hypot(characterPos.x - posB.x, characterPos.y - posB.y);
        return distA - distB;
      })
      .slice(0, 3);

    for (const marker of objectiveMarkers) {
      const markerPos = marker.position as Position;
      const limited = engine.findPathWithMaxMu(
        characterPos,
        markerPos,
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

  private evaluateObjectiveMarkerActions(
    context: AIContext,
    missionBias: MissionBias,
    doctrinePlanning: 'aggression' | 'keys_to_victory' | 'balanced'
  ): ScoredAction[] {
    const markers = this.getInteractableObjectiveMarkers(context);
    if (markers.length === 0) {
      return [];
    }
    const actorPos = context.battlefield.getCharacterPosition(context.character);
    if (!actorPos) {
      return [];
    }

    const actions: ScoredAction[] = [];
    const sideId = context.sideId;
    const objectivePriorityBoost = doctrinePlanning === 'keys_to_victory'
      ? 0.9
      : doctrinePlanning === 'aggression'
        ? -0.35
        : 0;

    for (const marker of markers) {
      const isSwitchOrLock = marker.omTypes.includes('Switch') || marker.omTypes.includes('Lock');
      const isIdea = marker.omTypes.includes('Idea');
      const isPhysical = marker.omTypes.some(type => type === 'Tiny' || type === 'Small' || type === 'Large' || type === 'Bulky');
      const markerPosition = marker.position;
      const distanceToMarker = markerPosition
        ? Math.hypot(actorPos.x - markerPosition.x, actorPos.y - markerPosition.y)
        : Number.POSITIVE_INFINITY;
      const isAdjacent = distanceToMarker <= 1.25;
      const isCarriedByActor = marker.carriedBy === context.character.id;
      const markerIsAvailable = marker.state === 'Available' || marker.state === 'Dropped';

      if (isAdjacent && (markerIsAvailable || isSwitchOrLock)) {
        let score =
          2.2 +
          (missionBias.objectiveActionPressure * 2.1) +
          objectivePriorityBoost;
        if (marker.missionSource === 'assault') {
          score += 2.4;
        } else if (marker.missionSource === 'breach') {
          score += 1.2;
        }
        if (isSwitchOrLock) score += 0.6;
        if (isIdea) score += 0.4;
        if (isPhysical) score += 0.3;
        if (sideId && marker.scoringSideId && marker.scoringSideId !== sideId) {
          score += 0.7;
        }

        actions.push({
          action: 'fiddle',
          objectiveAction: 'acquire_marker',
          markerId: marker.id,
          score,
          factors: {
            objectivePressure: missionBias.objectiveActionPressure,
            adjacent: 1,
            switchOrLock: isSwitchOrLock ? 1 : 0,
            idea: isIdea ? 1 : 0,
            physical: isPhysical ? 1 : 0,
          },
        });
      }

      if (isCarriedByActor && sideId) {
        const nearbyAllies = context.allies
          .filter(ally => !ally.state.isEliminated && !ally.state.isKOd)
          .map(ally => {
            const allyPos = context.battlefield.getCharacterPosition(ally);
            return allyPos
              ? { ally, distance: Math.hypot(actorPos.x - allyPos.x, actorPos.y - allyPos.y) }
              : null;
          })
          .filter((entry): entry is { ally: Character; distance: number } => Boolean(entry))
          .sort((a, b) => a.distance - b.distance);

        if (isIdea) {
          const shareTarget = nearbyAllies.find(entry => entry.distance <= 2);
          if (shareTarget) {
            const shareScore =
              1.8 +
              (missionBias.objectiveActionPressure * 1.7) +
              objectivePriorityBoost +
              (2 - Math.min(2, shareTarget.distance)) * 0.25;
            actions.push({
              action: 'fiddle',
              objectiveAction: 'share_marker',
              markerId: marker.id,
              markerTargetModelId: shareTarget.ally.id,
              score: shareScore,
              factors: {
                objectivePressure: missionBias.objectiveActionPressure,
                allyDistance: shareTarget.distance,
                idea: 1,
              },
            });
          }
        }

        if (isPhysical && (context.character.state.wounds > 0 || context.character.state.delayTokens > 0)) {
          const transferTarget = nearbyAllies.find(entry => entry.distance <= 1.25);
          if (transferTarget) {
            const transferScore =
              1.55 +
              (missionBias.objectiveActionPressure * 1.45) +
              objectivePriorityBoost +
              (context.character.state.wounds > 0 ? 0.4 : 0);
            actions.push({
              action: 'fiddle',
              objectiveAction: 'transfer_marker',
              markerId: marker.id,
              markerTargetModelId: transferTarget.ally.id,
              score: transferScore,
              factors: {
                objectivePressure: missionBias.objectiveActionPressure,
                allyDistance: transferTarget.distance,
                woundedCarrier: context.character.state.wounds > 0 ? 1 : 0,
              },
            });
          }
        }
      }

      if (
        isAdjacent &&
        marker.state !== 'Destroyed' &&
        marker.state !== 'Scored' &&
        sideId &&
        marker.scoringSideId &&
        marker.scoringSideId !== sideId &&
        !isSwitchOrLock
      ) {
        const destroyScore =
          1.35 +
          (missionBias.objectiveActionPressure * 1.2) +
          (doctrinePlanning === 'aggression' ? 0.2 : 0);
        actions.push({
          action: 'fiddle',
          objectiveAction: 'destroy_marker',
          markerId: marker.id,
          score: destroyScore,
          factors: {
            objectivePressure: missionBias.objectiveActionPressure,
            enemyControlled: 1,
          },
        });
      }
    }

    return actions;
  }

  private getInteractableObjectiveMarkers(context: AIContext): NonNullable<AIContext['objectiveMarkers']> {
    const markers = context.objectiveMarkers ?? [];
    return markers.filter(marker =>
      marker.interactable !== false &&
      marker.state !== 'Destroyed' &&
      marker.state !== 'Scored'
    );
  }

  private evaluateObjectiveAdvance(position: Position, context: AIContext): number {
    const actorPos = context.battlefield.getCharacterPosition(context.character);
    if (!actorPos) {
      return 0;
    }
    const markers = this.getInteractableObjectiveMarkers(context)
      .filter(marker => marker.position);
    if (markers.length === 0) {
      return 0;
    }

    let bestAdvance = 0;
    for (const marker of markers) {
      const markerPos = marker.position as Position;
      const currentDistance = Math.hypot(actorPos.x - markerPos.x, actorPos.y - markerPos.y);
      if (currentDistance <= 1.25) {
        continue;
      }
      const nextDistance = Math.hypot(position.x - markerPos.x, position.y - markerPos.y);
      if (nextDistance >= currentDistance) {
        continue;
      }
      const normalizedGain = (currentDistance - nextDistance) / Math.max(1, currentDistance);
      const adjacencyBonus = nextDistance <= 1.25 ? 0.45 : 0;
      bestAdvance = Math.max(bestAdvance, normalizedGain + adjacencyBonus);
    }
    return bestAdvance;
  }

  private getDoctrinePlanning(context: AIContext): 'aggression' | 'keys_to_victory' | 'balanced' {
    return context.config.doctrinePlanning ?? 'balanced';
  }

  private getDoctrineEngagement(
    context: AIContext,
    loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean }
  ): 'melee' | 'ranged' | 'balanced' {
    if (context.config.doctrineEngagement) {
      return context.config.doctrineEngagement;
    }
    if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) return 'melee';
    if (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons) return 'ranged';
    return 'balanced';
  }

  private getMissionBias(context: AIContext): MissionBias {
    const missionId = context.config.missionId ?? 'QAI_11';
    const planning = this.getDoctrinePlanning(context);

    const base: MissionBias = (() => {
      switch (missionId) {
        case 'QAI_12':
          return { movePressure: 0.55, waitPressure: 0.15, objectiveActionPressure: 0.6, attackPressure: 0.95, centerTargetBias: 0.45, vipTargetBias: 0 };
        case 'QAI_13':
          return { movePressure: 0.75, waitPressure: 0.2, objectiveActionPressure: 0.8, attackPressure: 0.9, centerTargetBias: 0.3, vipTargetBias: 0 };
        case 'QAI_14':
          return { movePressure: 0.45, waitPressure: 0.5, objectiveActionPressure: 0.65, attackPressure: 0.95, centerTargetBias: 0.55, vipTargetBias: 0 };
        case 'QAI_15':
          return { movePressure: 0.7, waitPressure: 0.45, objectiveActionPressure: 0.85, attackPressure: 0.88, centerTargetBias: 0.2, vipTargetBias: 0.6 };
        case 'QAI_16':
          return { movePressure: 0.8, waitPressure: 0.35, objectiveActionPressure: 0.9, attackPressure: 0.86, centerTargetBias: 0.2, vipTargetBias: 0.7 };
        case 'QAI_17':
          return { movePressure: 0.6, waitPressure: 0.2, objectiveActionPressure: 0.75, attackPressure: 0.94, centerTargetBias: 0.5, vipTargetBias: 0 };
        case 'QAI_18':
          return { movePressure: 0.68, waitPressure: 0.48, objectiveActionPressure: 0.82, attackPressure: 0.9, centerTargetBias: 0.3, vipTargetBias: 0.55 };
        case 'QAI_19':
          return { movePressure: 0.58, waitPressure: 0.55, objectiveActionPressure: 0.72, attackPressure: 0.92, centerTargetBias: 0.45, vipTargetBias: 0.55 };
        case 'QAI_20':
          return { movePressure: 0.78, waitPressure: 0.25, objectiveActionPressure: 0.85, attackPressure: 0.9, centerTargetBias: 0.42, vipTargetBias: 0 };
        case 'QAI_11':
        default:
          return { movePressure: 0.15, waitPressure: 0.1, objectiveActionPressure: 0.1, attackPressure: 1.08, centerTargetBias: 0, vipTargetBias: 0 };
      }
    })();

    if (planning === 'keys_to_victory') {
      return {
        ...base,
        movePressure: base.movePressure + 0.2,
        waitPressure: base.waitPressure + 0.15,
        objectiveActionPressure: base.objectiveActionPressure + 0.25,
        attackPressure: base.attackPressure * 0.94,
      };
    }
    if (planning === 'aggression') {
      return {
        ...base,
        movePressure: base.movePressure + 0.08,
        waitPressure: Math.max(0, base.waitPressure - 0.18),
        objectiveActionPressure: Math.max(0, base.objectiveActionPressure - 0.2),
        attackPressure: base.attackPressure * 1.08,
      };
    }
    return base;
  }
}

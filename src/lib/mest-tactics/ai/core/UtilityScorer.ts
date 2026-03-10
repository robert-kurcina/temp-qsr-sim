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
import {
  createMultiGoalPathfinding,
  type MultiGoalPathOptions,
} from '../../battlefield/pathfinding/MultiGoalPathfinding';
import { evaluateRangeWithVisibility, parseWeaponOptimalRangeMu } from '../../utils/visibility';
import { forecastWaitReact, rolloutWaitReactBranches } from '../tactical/GOAP';
import { calculateStratagemModifiers, TacticalDoctrine } from '../stratagems/AIStratagems';
import { buildScoringContext, calculateScoringModifiers, combineModifiers } from '../stratagems/PredictedScoringIntegration';
import { applyCombinedModifiersToActions } from '../stratagems/StratagemIntegration';
import {
  // ROF/Suppression scoring
  scoreROFPlacement,
  scoreSuppressionZone,
  scoreFirelaneFOF,
  scorePositionSafety,
  type ROFMarker,
  type SuppressionMarker,
} from './ROFScoring';
import { calculateAgility, resolveFallingTest } from '../../actions/agility';
import { getLeapAgilityBonus, getEffectiveMovement, getThreatRange, getSprintMovementBonus } from '../../traits/combat-traits';
import {
  calculateVPUrgency,
  getUrgencyMultiplier,
  getPassiveActionPenalty,
  type VPUrgencyState,
} from './VPUrgencyCalculator';
import {
  getActionVPInfo,
  filterActionsByVP,
  applyVPurgencyBonus,
  scoreActionByVP,
} from './ActionVPFilter';
import { VPPredictionCache, globalVPCache } from './VPPredictionCache';
import {
  getTacticallyRelevantEnemies,
  findMyScrumGroup,
  getCohesionAwareEnemies,
  evaluateThreatImmediacy,
  shouldSkipTargetEvaluation,
} from './TacticalHeuristics';
import { TERRAIN_HEIGHTS } from '../../battlefield/terrain/TerrainElement';
import { detectGapAlongLine, canJumpGap, getGapTacticalValue } from '../../battlefield/GapDetector';
import { assessBestMeleeLegality } from '../shared/MeleeLegality';
import { calculateSuddenDeathTimePressure, estimateExpectedTurnsRemaining } from './TurnHorizon';
import { aiTuning } from '../config/AITuningConfig';

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
  ...aiTuning.utilityScorer.defaultWeights,
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
    // R3: Cover-seeking quality factors
    leanOpportunity: number;
    exposureRisk: number;
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
    focusFire?: number;
    targetCommitment?: number;
    scrumContinuity?: number;
    lanePressure?: number;
    outOfPlayPressure?: number;
    selfOutOfPlayRisk?: number;
    finishOff?: number;
    vpPressure?: number;
    vpPotential?: number;
    vpDenial?: number;
    rpPotential?: number;
    rpDenial?: number;
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

interface EvaluationSession {
  positionExposureCache: Map<string, number>;
  coverCache: Map<string, number>;
  visibilityCache: Map<string, number>;
  objectiveAdvanceCache: Map<string, number>;
  nearestEnemyDistanceCache: Map<string, number>;
  losPairCache: Map<string, boolean>;
  pathEngine: PathfindingEngine;
  strategicPathQueries: number;
  strategicPathQueryBudget: number;
  strategicEnemyLimit: number;
  strategicObjectiveLimit: number;
  strategicRefineTopK: number;
  strategicCoarseResolution: number;
  strategicDefaultResolution: number;
  localSampleCount: number;
  pathBudgetExceeded: boolean;
}

interface ActionLegalityMask {
  canMove: boolean;
  canEvaluateTargets: boolean;
  canCloseCombat: boolean;
  canRangedCombat: boolean;
  canDisengage: boolean;
  canSupport: boolean;
  canWeaponSwap: boolean;
  canWait: boolean;
  canPushing: boolean;
  canRefresh: boolean;
  candidateEnemyIds: string[];
}

interface FractionalScoringPotential {
  sideVP: number;
  opponentVP: number;
  sideRP: number;
  opponentRP: number;
  vpDeficit: number;
  rpDeficit: number;
  myFractionalVpPotential: number;
  opponentFractionalVpPotential: number;
  vpPotentialDelta: number;
  myRpVpPotential: number;
  opponentRpVpPotential: number;
  urgencyScalar: number;
}

interface TargetVPRPPressureBreakdown {
  vpPotential: number;
  vpDenial: number;
  rpPotential: number;
  rpDenial: number;
  total: number;
}

interface ActionFractionalScoringBreakdown {
  vpPotential: number;
  vpDenial: number;
  rpPotential: number;
  rpDenial: number;
  total: number;
}

/**
 * Utility Scorer class
 */
export class UtilityScorer {
  weights: UtilityWeights;
  private activeEvaluationSession: EvaluationSession | null = null;
  private actionMaskCache = new Map<string, ActionLegalityMask>();
  private actionMaskCacheHits = 0;
  private actionMaskCacheMisses = 0;
  private actionMaskCacheBypasses = 0;
  private readonly actionMaskCacheMaxSize = aiTuning.utilityScorer.actionMask.cacheMaxSize;
  private static globalActionMaskCacheHits = 0;
  private static globalActionMaskCacheMisses = 0;
  private static globalActionMaskCacheBypasses = 0;

  constructor(weights: Partial<UtilityWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Update weights
   */
  setWeights(weights: Partial<UtilityWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  getActionMaskCacheStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    bypasses: number;
    hitRate: number;
  } {
    const total = this.actionMaskCacheHits + this.actionMaskCacheMisses;
    return {
      size: this.actionMaskCache.size,
      maxSize: this.actionMaskCacheMaxSize,
      hits: this.actionMaskCacheHits,
      misses: this.actionMaskCacheMisses,
      bypasses: this.actionMaskCacheBypasses,
      hitRate: total > 0 ? this.actionMaskCacheHits / total : 0,
    };
  }

  static getGlobalActionMaskCacheStats(): {
    hits: number;
    misses: number;
    bypasses: number;
    hitRate: number;
  } {
    const total = UtilityScorer.globalActionMaskCacheHits + UtilityScorer.globalActionMaskCacheMisses;
    return {
      hits: UtilityScorer.globalActionMaskCacheHits,
      misses: UtilityScorer.globalActionMaskCacheMisses,
      bypasses: UtilityScorer.globalActionMaskCacheBypasses,
      hitRate: total > 0 ? UtilityScorer.globalActionMaskCacheHits / total : 0,
    };
  }

  static resetGlobalActionMaskCacheStats(): void {
    UtilityScorer.globalActionMaskCacheHits = 0;
    UtilityScorer.globalActionMaskCacheMisses = 0;
    UtilityScorer.globalActionMaskCacheBypasses = 0;
  }

  clearActionMaskCache(): void {
    this.actionMaskCache.clear();
    this.actionMaskCacheHits = 0;
    this.actionMaskCacheMisses = 0;
    this.actionMaskCacheBypasses = 0;
  }

  private getActionLegalityMask(
    context: AIContext,
    loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean },
    characterPos: Position | undefined
  ): ActionLegalityMask {
    if (process.env.AI_DISABLE_ACTION_MASK_CACHE === '1') {
      this.actionMaskCacheBypasses += 1;
      UtilityScorer.globalActionMaskCacheBypasses += 1;
      return this.computeActionLegalityMask(context, loadout);
    }

    const key = this.buildActionMaskCacheKey(context, loadout, characterPos);
    const cached = this.actionMaskCache.get(key);
    if (cached) {
      this.actionMaskCacheHits += 1;
      UtilityScorer.globalActionMaskCacheHits += 1;
      // Refresh insertion order to keep this key hot.
      this.actionMaskCache.delete(key);
      this.actionMaskCache.set(key, cached);
      return cached;
    }

    this.actionMaskCacheMisses += 1;
    UtilityScorer.globalActionMaskCacheMisses += 1;
    const computed = this.computeActionLegalityMask(context, loadout);
    this.actionMaskCache.set(key, computed);
    if (this.actionMaskCache.size > this.actionMaskCacheMaxSize) {
      const oldestKey = this.actionMaskCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.actionMaskCache.delete(oldestKey);
      }
    }
    return computed;
  }

  private buildActionMaskCacheKey(
    context: AIContext,
    loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean },
    characterPos: Position | undefined
  ): string {
    const terrainVersion = context.battlefield.getTerrainVersion?.() ?? 0;
    const actorState = context.character.state;
    const actorStateKey = [
      context.apRemaining,
      actorState.isKOd ? 1 : 0,
      actorState.isEliminated ? 1 : 0,
      actorState.isAttentive ? 1 : 0,
      actorState.isOrdered ? 1 : 0,
      actorState.isWaiting ? 1 : 0,
      actorState.isHidden ? 1 : 0,
      actorState.wounds ?? 0,
      actorState.delayTokens ?? 0,
      actorState.fearTokens ?? 0,
      (actorState as any).hasPushedThisInitiative ? 1 : 0,
    ].join(':');

    const positionKey = characterPos
      ? `${characterPos.x.toFixed(1)},${characterPos.y.toFixed(1)}`
      : 'no-pos';
    const engagementKey = context.battlefield.isEngaged?.(context.character) ? 'engaged' : 'free';
    const enemyKey = this.buildEnemyActionMaskSignature(context, characterPos);
    const allySupportKey = `${context.allies.length}:` +
      `${context.allies.filter(ally => ally.state.isKOd).length}:` +
      `${context.allies.filter(ally => (ally.state.fearTokens ?? 0) > 0).length}`;

    return [
      context.character.id,
      context.currentTurn ?? 0,
      terrainVersion,
      actorStateKey,
      `${loadout.hasMeleeWeapons ? 1 : 0}${loadout.hasRangedWeapons ? 1 : 0}`,
      positionKey,
      engagementKey,
      enemyKey,
      allySupportKey,
    ].join('|');
  }

  private buildEnemyActionMaskSignature(context: AIContext, characterPos: Position | undefined): string {
    if (!characterPos) {
      return `no-pos:${context.enemies.length}`;
    }

    const candidates = context.enemies
      .filter(enemy => isAttackableEnemy(context.character, enemy, context.config))
      .map(enemy => {
        const pos = context.battlefield.getCharacterPosition(enemy);
        if (!pos) return null;
        const dist = Math.hypot(pos.x - characterPos.x, pos.y - characterPos.y);
        return { enemy, pos, dist };
      })
      .filter((entry): entry is { enemy: Character; pos: Position; dist: number } => Boolean(entry))
      .sort((a, b) => (a.dist === b.dist ? a.enemy.id.localeCompare(b.enemy.id) : a.dist - b.dist))
      .slice(0, 6)
      .map(({ enemy, pos }) =>
        `${enemy.id}@${pos.x.toFixed(1)},${pos.y.toFixed(1)}:${enemy.state.isHidden ? 1 : 0}${enemy.state.isKOd ? 1 : 0}${enemy.state.isEliminated ? 1 : 0}`
      )
      .join(';');

    return `${context.enemies.length}:${candidates}`;
  }

  private computeActionLegalityMask(
    context: AIContext,
    loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean }
  ): ActionLegalityMask {
    const canAct =
      !context.character.state.isKOd &&
      !context.character.state.isEliminated;
    const hasAp = context.apRemaining > 0;
    const isEngaged = context.battlefield.isEngaged?.(context.character) ?? false;
    const candidateEnemies = context.enemies.filter(enemy =>
      isAttackableEnemy(context.character, enemy, context.config)
    );
    const engagedEnemyIds = isEngaged
      ? candidateEnemies
          .filter(enemy => this.isInMeleeRange(context.character, enemy, context.battlefield))
          .map(enemy => enemy.id)
      : [];
    const candidateEnemyIds = engagedEnemyIds.length > 0
      ? engagedEnemyIds
      : candidateEnemies.map(enemy => enemy.id);

    const canCloseCombat =
      canAct &&
      context.apRemaining >= 1 &&
      loadout.hasMeleeWeapons &&
      candidateEnemyIds.length > 0;
    const canRangedCombat =
      canAct &&
      context.apRemaining >= 1 &&
      loadout.hasRangedWeapons &&
      candidateEnemies.length > 0;

    const stowedCount = context.character.profile?.stowedItems?.length ?? 0;
    const initiativePoints = context.side?.state?.initiativePoints ?? 0;
    const hasSupportTarget = context.allies.some(ally => ally.state.isKOd || (ally.state.fearTokens ?? 0) > 0);

    return {
      canMove: canAct && hasAp && context.apRemaining >= 1,
      canEvaluateTargets: canCloseCombat || canRangedCombat,
      canCloseCombat,
      canRangedCombat,
      canDisengage: canAct && hasAp && context.apRemaining >= 1 && isEngaged,
      canSupport: canAct && hasAp && context.apRemaining >= 1 && hasSupportTarget,
      canWeaponSwap: canAct && hasAp && context.apRemaining >= 1 && stowedCount > 0,
      canWait:
        canAct &&
        hasAp &&
        (context.config.allowWaitAction ?? true) &&
        context.apRemaining >= 2 &&
        !context.character.state.isWaiting &&
        context.character.state.isAttentive &&
        context.character.state.isOrdered &&
        !isEngaged &&
        loadout.hasRangedWeapons,
      canPushing:
        canAct &&
        context.apRemaining === 0 &&
        context.character.state.isAttentive &&
        !(context.character.state as any).hasPushedThisInitiative &&
        (context.character.state.delayTokens ?? 0) === 0,
      canRefresh:
        canAct &&
        hasAp &&
        (context.character.state.delayTokens ?? 0) > 0 &&
        initiativePoints >= 1,
      candidateEnemyIds,
    };
  }

  private createEvaluationSession(context: AIContext): EvaluationSession {
    const boardArea = context.battlefield.width * context.battlefield.height;
    const gameSize = String(context.config.gameSize ?? '').toUpperCase();
    const missionId = String(context.config.missionId ?? '').toUpperCase();
    const isEliminationPressureMission =
      missionId === 'ELIMINATION' ||
      missionId === 'QAI_11' ||
      missionId === 'QAI_17' ||
      missionId === 'QAI_18';
    const attackableEnemyCount = context.enemies.filter(enemy =>
      isAttackableEnemy(context.character, enemy, context.config)
    ).length;

    let strategicPathQueryBudget = 24;
    let strategicEnemyLimit = 12;
    let strategicObjectiveLimit = 3;
    let strategicRefineTopK = 4;
    let strategicCoarseResolution = 1.0;
    let strategicDefaultResolution = 0.5;
    let localSampleCount = 16;

    if (boardArea >= 3000) {
      strategicPathQueryBudget = 10;
      strategicEnemyLimit = 4;
      strategicObjectiveLimit = 2;
      strategicRefineTopK = 2;
      localSampleCount = 10;
    } else if (boardArea >= 1600) {
      strategicPathQueryBudget = 14;
      strategicEnemyLimit = 6;
      strategicObjectiveLimit = 3;
      strategicRefineTopK = 3;
      localSampleCount = 12;
    } else if (boardArea >= 900) {
      strategicPathQueryBudget = 18;
      strategicEnemyLimit = 8;
      strategicObjectiveLimit = 3;
      strategicRefineTopK = 3;
      localSampleCount = 14;
    }
    if (gameSize === 'VERY_SMALL' || gameSize === 'SMALL') {
      // Small boards do not need heavy strategic path probing each decision.
      strategicPathQueryBudget = Math.min(strategicPathQueryBudget, 4);
      strategicEnemyLimit = Math.min(strategicEnemyLimit, 3);
      strategicObjectiveLimit = Math.min(strategicObjectiveLimit, 2);
      strategicRefineTopK = Math.min(strategicRefineTopK, 1);
      strategicDefaultResolution = 0.75;
      localSampleCount = Math.min(localSampleCount, 10);
    }
    if (gameSize === 'VERY_SMALL') {
      if (isEliminationPressureMission) {
        // Keep a tiny strategic probe budget for elimination-heavy missions so melee units
        // can consistently select long-lane advance endpoints on very small boards.
        strategicPathQueryBudget = Math.max(1, Math.min(strategicPathQueryBudget, 2));
        strategicEnemyLimit = Math.max(2, Math.min(strategicEnemyLimit, 3));
        strategicObjectiveLimit = Math.min(strategicObjectiveLimit, 1);
        strategicRefineTopK = 1;
      } else {
        // Hard guard: remove strategic path probes in VERY_SMALL to avoid pathological stalls.
        strategicPathQueryBudget = 0;
        strategicEnemyLimit = 0;
        strategicObjectiveLimit = 0;
        strategicRefineTopK = 0;
      }
    }

    strategicEnemyLimit = strategicPathQueryBudget > 0
      ? Math.max(2, Math.min(strategicEnemyLimit, Math.max(2, attackableEnemyCount)))
      : 0;

    return {
      positionExposureCache: new Map(),
      coverCache: new Map(),
      visibilityCache: new Map(),
      objectiveAdvanceCache: new Map(),
      nearestEnemyDistanceCache: new Map(),
      losPairCache: new Map(),
      pathEngine: new PathfindingEngine(context.battlefield),
      strategicPathQueries: 0,
      strategicPathQueryBudget,
      strategicEnemyLimit,
      strategicObjectiveLimit,
      strategicRefineTopK,
      strategicCoarseResolution,
      strategicDefaultResolution,
      localSampleCount,
      pathBudgetExceeded: false,
    };
  }

  private getEvaluationSession(context: AIContext): EvaluationSession {
    return this.activeEvaluationSession ?? this.createEvaluationSession(context);
  }

  private positionKey(position: Position): string {
    return `${position.x.toFixed(2)},${position.y.toFixed(2)}`;
  }

  private losPositionKey(a: Position, b: Position): string {
    const keyA = this.positionKey(a);
    const keyB = this.positionKey(b);
    return keyA <= keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
  }

  private tryConsumeStrategicPathBudget(session: EvaluationSession): boolean {
    if (session.strategicPathQueries >= session.strategicPathQueryBudget) {
      session.pathBudgetExceeded = true;
      return false;
    }
    session.strategicPathQueries += 1;
    return true;
  }

  /**
   * Score all possible actions and return the best
   */
  evaluateActions(context: AIContext): ScoredAction[] {
    const previousSession = this.activeEvaluationSession;
    const session = this.createEvaluationSession(context);
    this.activeEvaluationSession = session;

    try {
      const actions: ScoredAction[] = [];
      const attackActions: ScoredAction[] = [];
      const loadout = this.getLoadoutProfile(context.character);
      const doctrinePlanning = this.getDoctrinePlanning(context);
      const doctrineEngagement = this.getDoctrineEngagement(context, loadout);
      const missionBias = this.getMissionBias(context);
      const characterPos = context.battlefield.getCharacterPosition(context.character);
      const actionMask = this.getActionLegalityMask(context, loadout, characterPos);
      const candidateEnemyIds = new Set(actionMask.candidateEnemyIds);
      const targetContext: AIContext =
        actionMask.canEvaluateTargets &&
        candidateEnemyIds.size > 0 &&
        candidateEnemyIds.size < context.enemies.length
          ? {
              ...context,
              enemies: context.enemies.filter(enemy => candidateEnemyIds.has(enemy.id)),
            }
          : context;

      // Evaluate attack actions first so move pressure can adapt when no legal attacks exist.
      const attackTargets = actionMask.canEvaluateTargets
        ? this.evaluateTargets(targetContext)
        : [];
      const hasChargeTraitMeleeWeapon = this.hasChargeTraitMeleeWeapon(context.character);
      const engagedMeleeAttackApCost = this.estimateMeleeAttackApCost(context.character, true);
      const canAffordImmediateMeleeAttack = context.apRemaining >= engagedMeleeAttackApCost;
      const canAffordImmediateChargeAttack = context.apRemaining >= (1 + engagedMeleeAttackApCost);
      const isFreeAtStart = !(context.battlefield.isEngaged?.(context.character) ?? false);
      for (const target of attackTargets) {
        if (actionMask.canCloseCombat) {
          const meleeLegality = assessBestMeleeLegality(context.character, target.target, context.battlefield, {
            weapons: this.getMeleeWeapons(context.character),
            isFirstAction: true,
            isFreeAtStart,
          });
          if (meleeLegality.canAttack) {
            if (!canAffordImmediateMeleeAttack) {
              continue;
            }
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
            if (meleeLegality.requiresOverreach) {
              // Overreach trades legality for risk (-1 REF / -1 hit modifier).
              score *= 0.9;
            } else if (meleeLegality.requiresReach) {
              score *= 1.02;
            }
            score *= missionBias.attackPressure;

            // Multiple Weapons bonus consideration for melee
            if (qualifiesForMultipleWeapons(context.character, true)) {
              const bonus = getMultipleWeaponsBonus(context.character, 0, true);
              score += bonus * 0.3;
            }

            // Priority 1: Bonus Action potential (Push-back, Pull-back, Reversal)
            // Evaluate after we know we have a valid melee target
            const attackerPosition = context.battlefield.getCharacterPosition(context.character);
            const bonusActionEval = this.evaluateBonusActions(context, target.target, 2, attackerPosition);
            if (bonusActionEval.score > 0) {
              score += bonusActionEval.score * 0.5; // Weight bonus actions moderately
            }

            attackActions.push({
              action: 'close_combat',
              target: target.target,
              score: score,
              factors: {
                ...target.factors,
                multipleWeapons: qualifiesForMultipleWeapons(context.character, true) ? 1 : 0,
                meleeAttackApCost: engagedMeleeAttackApCost,
                meleeRequiresReach: meleeLegality.requiresReach ? 1 : 0,
                meleeRequiresOverreach: meleeLegality.requiresOverreach ? 1 : 0,
              },
            });
          } else if (actionMask.canMove) {
            // Charge = move into base contact + immediate close combat pressure.
            const chargeOpportunity = this.evaluateChargeOpportunity(context, target.target);
            if (chargeOpportunity.canCharge && chargeOpportunity.destination && canAffordImmediateChargeAttack) {
              let score = target.score * 1.16;
              if (loadout.hasMeleeWeapons && !loadout.hasRangedWeapons) {
                score *= 1.1;
              }
              if (doctrineEngagement === 'melee') {
                score *= 1.12;
              } else if (doctrineEngagement === 'ranged') {
                score *= 0.9;
              }
              if (doctrinePlanning === 'aggression') {
                score *= 1.08;
              }
              score *= missionBias.attackPressure;
              if (hasChargeTraitMeleeWeapon) {
                score *= 1.08;
              }

              attackActions.push({
                action: 'charge',
                target: target.target,
                position: chargeOpportunity.destination,
                score,
                factors: {
                  ...target.factors,
                  chargeDistance: chargeOpportunity.travelDistance,
                  chargeRemainingGap: chargeOpportunity.remainingGap,
                  chargeApproachValue: chargeOpportunity.travelDistance > 0 ? 1 : 0,
                  chargeTraitWeapon: hasChargeTraitMeleeWeapon ? 1 : 0,
                  chargeAttackApCost: engagedMeleeAttackApCost,
                },
              });
            }
          }
        }

        if (actionMask.canRangedCombat) {
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
            if (rangedOpportunity.requiresConcentrate && characterPos) {
              // Priority 3: Prefer Concentrate + Attack when Outnumbered
              // Concentrate removes +1 Wild die from Opposing Outnumber bonus
              const friendsNearby = this.countFriendlyInMeleeRange(context, characterPos, 1.5);
              const enemiesNearby = this.countEnemyInMeleeRange(context, characterPos, 1.5);
              const isOutnumbered = enemiesNearby > friendsNearby;
              
              if (isOutnumbered) {
                // Strongly prefer Concentrate when outnumbered - removes enemy outnumber bonus
                score *= 1.4;
              } else {
                // Keep this viable, but less preferred than immediate fire
                score *= 0.8;
              }
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
                multipleWeapons: qualifiesForMultipleWeapons(context.character, false) ? 1 : 0,
                requiresConcentrate: rangedOpportunity.requiresConcentrate ? 1 : 0,
                orm: rangedOpportunity.orm,
                leanOpportunity: rangedOpportunity.leanOpportunity ? 1 : 0,
              },
            });
          }
        }
      }

      const survivalFactor = this.computeConditionalSurvivalFactor(context);

      // Evaluate movement actions
      const movePositions = actionMask.canMove ? this.evaluatePositions(context, survivalFactor) : [];
      const nearestEnemyDistance = actionMask.canMove && characterPos
        ? this.distanceToClosestAttackableEnemy(characterPos, context)
        : Number.POSITIVE_INFINITY;
      const currentExposure = actionMask.canMove && characterPos
        ? this.countEnemySightLinesToPosition(characterPos, context)
        : 0;
      const movementAllowance = Math.max(
        1,
        (context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2) + 2
      );
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
      if (actionMask.canMove) {
        for (const pos of movePositions.slice(0, 3)) {
          const objectiveAdvance = this.evaluateObjectiveAdvance(pos.position, context);
          const approachProgress = characterPos
            ? this.evaluateApproachProgress(characterPos, pos.position, context)
            : { deltaMu: 0, normalizedDelta: 0 };
          const approachWeight = attackActions.length > 0 ? 0.7 : 2.1;
          const objectiveApproachScalar = 1 + (missionBias.objectiveActionPressure * 0.35);
          const approachBonus =
            ((Math.max(0, approachProgress.deltaMu) * approachWeight) +
            (Math.max(0, approachProgress.normalizedDelta) * 0.9)) *
            objectiveApproachScalar;
          const approachPenalty = approachProgress.deltaMu < 0
            ? Math.abs(approachProgress.deltaMu) * (attackActions.length > 0 ? 1.4 : 2.8)
            : 0;
          const displacementMu = characterPos
            ? Math.hypot(pos.position.x - characterPos.x, pos.position.y - characterPos.y)
            : 0;
          const movementUtilization = this.clamp(displacementMu / Math.max(1, movementAllowance), 0, 1);
          const longApproachPhase =
            Number.isFinite(nearestEnemyDistance) &&
            nearestEnemyDistance > movementAllowance + 0.75;
          const nearEngagementEnvelope =
            Number.isFinite(nearestEnemyDistance) && nearestEnemyDistance <= 2.75;
          const objectiveMicroPositioning = objectiveAdvance >= 0.3;
          const shouldAllowMicroReposition =
            objectiveMicroPositioning ||
            attackActions.length > 0 ||
            Boolean(context.battlefield.isEngaged?.(context.character));
          const lowUtilizationPenalty =
            context.apRemaining >= 2 &&
            longApproachPhase &&
            !shouldAllowMicroReposition &&
            movementUtilization < 0.55
              ? 0.7 + ((0.55 - movementUtilization) * 1.6)
              : 0;
          const movementUtilizationBonus = shouldAllowMicroReposition
            ? movementUtilization * 0.18
            : movementUtilization * (longApproachPhase ? 0.85 : 0.45);
          const isClosingMove = approachProgress.deltaMu > 0.05;
          const canUseMoreAllowance =
            displacementMu + 0.1 < movementAllowance &&
            Number.isFinite(nearestEnemyDistance) &&
            nearestEnemyDistance > 1.25;
          const approachUtilizationTarget = longApproachPhase ? 0.92 : 0.78;
          const approachUtilizationGap = isClosingMove && canUseMoreAllowance
            ? Math.max(0, approachUtilizationTarget - movementUtilization)
            : 0;
          const closeApproachBonus = isClosingMove
            ? movementUtilization * (longApproachPhase ? 1.2 : 0.65)
            : 0;
          const closeApproachPenalty =
            isClosingMove &&
            canUseMoreAllowance &&
            !nearEngagementEnvelope &&
            !objectiveMicroPositioning &&
            movementUtilization < approachUtilizationTarget
              ? 1.2 + (approachUtilizationGap * (longApproachPhase ? 7.2 : 5.2))
              : 0;
          const moveWaitForecast = loadout.hasRangedWeapons
            ? forecastWaitReact(context, pos.position)
            : null;
          const exposureReduction = moveWaitForecast
            ? Math.max(0, currentExposure - moveWaitForecast.exposureCount)
            : 0;
          const goapFutureWaitValue = moveWaitForecast
            ? (moveWaitForecast.expectedReactValue * 0.55) +
              (moveWaitForecast.hiddenRevealTargets * 0.8) +
              (moveWaitForecast.refGatePassCount * 0.22) +
              (exposureReduction * 0.2)
            : 0;
          const goapFutureWaitWeight = context.apRemaining >= 2 ? 0.45 : 0.25;
          const meleeSetupValue =
            loadout.hasMeleeWeapons && !canAffordImmediateChargeAttack
              ? this.evaluateMeleeSetupValue(context, pos.position)
              : 0;
          const meleeSetupWeight = loadout.hasMeleeWeapons ? 0.85 : 0;
          actions.push({
            action: 'move',
            position: pos.position,
            score:
              pos.score * moveMultiplier +
              advanceBonus +
              (missionBias.objectiveActionPressure * pos.factors.visibility * 0.35) +
              (objectiveAdvance * objectiveAdvanceWeight) +
              approachBonus -
              approachPenalty +
              movementUtilizationBonus -
              closeApproachPenalty +
              closeApproachBonus -
              lowUtilizationPenalty +
              (meleeSetupValue * meleeSetupWeight) +
              (goapFutureWaitValue * goapFutureWaitWeight),
            factors: {
              ...pos.factors,
              moveMultiplier,
              advanceBonus,
              objectiveAdvance,
              objectiveAdvanceWeight,
              approachDeltaMu: approachProgress.deltaMu,
              approachNormalizedDelta: approachProgress.normalizedDelta,
              approachBonus,
              approachPenalty: -approachPenalty,
              moveDisplacementMu: displacementMu,
              moveUtilization: movementUtilization,
              moveUtilizationBonus: movementUtilizationBonus,
              moveCloseApproachBonus: closeApproachBonus,
              moveCloseApproachPenalty: -closeApproachPenalty,
              moveClosingIntent: isClosingMove ? 1 : 0,
              moveCanUseMoreAllowance: canUseMoreAllowance ? 1 : 0,
              moveApproachUtilizationTarget: approachUtilizationTarget,
              moveApproachUtilizationGap: approachUtilizationGap,
              moveLowUtilizationPenalty: -lowUtilizationPenalty,
              moveLongApproachPhase: longApproachPhase ? 1 : 0,
              moveAllowMicroReposition: shouldAllowMicroReposition ? 1 : 0,
              survivalFactor,
              goapFutureWaitValue,
              goapFutureWaitWeight,
              goapExposureReduction: exposureReduction,
              meleeSetupValue,
              meleeSetupWeight,
              strategicPathBudgetExceeded: session.pathBudgetExceeded ? 1 : 0,
              objectivePressure: missionBias.objectiveActionPressure,
            },
          });
        }
      }
      actions.push(...attackActions);

      // Evaluate objective-marker interactions (OM system) when marker state is available.
      const objectiveActions = this.evaluateObjectiveMarkerActions(context, missionBias, doctrinePlanning);
      actions.push(...objectiveActions);

      // Evaluate disengage if engaged
      if (actionMask.canDisengage && context.battlefield.isEngaged?.(context.character)) {
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
      if (actionMask.canSupport) {
        const supportActions = this.evaluateSupportActions(context);
        actions.push(...supportActions);
      }

      // Phase 2.5: Evaluate weapon swap actions (stow/unstow items)
      if (actionMask.canWeaponSwap) {
        const weaponSwapActions = this.evaluateWeaponSwap(context);
        actions.push(...weaponSwapActions);
      }

      const canConsiderWait = actionMask.canWait;
      if (canConsiderWait) {
        const waitForecast = forecastWaitReact(context);
        const exposure = waitForecast.exposureCount;
        const potentialReactTargets = waitForecast.potentialReactTargets;
        const refBreakpointCount = waitForecast.refGatePassCount;
        
        // Cap react-related bonuses to prevent runaway Wait scores
        // Caps scale with game size - more models = more valid react opportunities
        // But we cap to prevent 64-model battles from generating 40+ Wait scores
        const gameSize = context.config.gameSize || 'SMALL';
        const sizeMultiplier = {
          'VERY_SMALL': 0.5,
          'SMALL': 1.0,
          'MEDIUM': 1.5,
          'LARGE': 2.0,
          'VERY_LARGE': 2.5,
        }[gameSize] || 1.0;
        
        const cappedRefBreakpoints = Math.min(refBreakpointCount, Math.round(3 * sizeMultiplier));
        const cappedReactTargets = Math.min(potentialReactTargets, Math.round(4 * sizeMultiplier));

        const waitRefBonus =
          (cappedRefBreakpoints * 0.78) +
          (Math.max(0, cappedReactTargets - cappedRefBreakpoints) * 0.2);
        const existingDelay = Math.max(0, context.character.state.delayTokens ?? 0);
        const waitDelayAvoidance = waitForecast.potentialReactTargets > 0
          ? Math.min(1.8, 0.3 + (waitForecast.expectedTriggerCount * 0.5) + (existingDelay * 0.25))
          : 0;

        // Phase 3.4: Wait/React Coordination - bonus for coordinated defense
        // If allies are already on Wait, add bonus for area denial coverage
        const alliesOnWait = context.allies.filter(ally => 
          ally.state.isWaiting && 
          ally.state.isAttentive && 
          ally.state.isOrdered &&
          !ally.state.isKOd &&
          !ally.state.isEliminated
        ).length;
        const waitCoordinationBonus = alliesOnWait > 0 ? alliesOnWait * 0.5 : 0; // +0.5 per ally on Wait

        // R2: Tactical Condition Weighting for Wait Uptake
        // Add multipliers when specific tactical conditions favor Wait
        let waitTacticalBonus = this.evaluateWaitTacticalConditions(context, waitForecast, attackActions) + waitCoordinationBonus;

        // R2.1: Elimination Mission Wait Penalty
        // Reduce Wait baseline for Elimination mission to encourage combat
        const missionId = context.config.missionId;
        const currentTurn = context.currentTurn ?? 1;
        const eliminationWaitPenalty = missionId === 'QAI_11' ? 1.5 : 0;
        
        // R2.2: ZERO VP DESPERATION - Strong penalty for zero VP as turns progress
        // This directly reduces waitBaseline to force action in Elimination missions
        const sideVP = context.side?.state.victoryPoints ?? 0;
        const sideRP = context.side?.state.resourcePoints ?? 0;

        // Priority 4: Always pursue VP/RP - calculate VP deficit vs opponent
        // Use vpBySide/rpBySide instead of non-existent enemySides
        const vpBySide = context.vpBySide ?? {};
        const rpBySide = context.rpBySide ?? {};
        const opponentVP = Object.entries(vpBySide)
          .filter(([sideId]) => sideId !== context.sideId)
          .reduce((max, [, vp]) => Math.max(max, vp), 0);
        const opponentRP = Object.entries(rpBySide)
          .filter(([sideId]) => sideId !== context.sideId)
          .reduce((max, [, rp]) => Math.max(max, rp), 0);
        const vpDeficit = Math.max(0, opponentVP - sideVP);
        const rpDeficit = Math.max(0, opponentRP - sideRP);

        // VP ASPIRATION: AI should always want more VP than opponent
        // If behind on VP, apply strong penalty to Wait to encourage action
        if (vpDeficit > 0) {
          // Base penalty: -3 per VP behind
          const vpPursuitPenalty = vpDeficit * 3;
          waitTacticalBonus = Math.max(-10, waitTacticalBonus - vpPursuitPenalty);
        }
        
        // If tied on VP but opponent has more RP, still encourage action
        if (vpDeficit === 0 && rpDeficit > 0) {
          const rpPursuitPenalty = rpDeficit * 1.5;
          waitTacticalBonus = Math.max(-5, waitTacticalBonus - rpPursuitPenalty);
        }

        // If ahead on VP, allow more defensive play but still encourage securing lead
        if (sideVP > opponentVP) {
          const vpLead = sideVP - opponentVP;
          // Small lead (1-2 VP): slight bonus to Wait (play safer)
          if (vpLead <= 2) {
            waitTacticalBonus += vpLead * 0.5;
          }
          // Comfortable lead (3+ VP): bigger bonus to Wait (run down clock)
          else {
            waitTacticalBonus += 1 + (vpLead - 2) * 0.3;
          }
        }

        let zeroVpDesperation = 0;
        if (missionId === 'QAI_11' && sideVP === 0 && sideRP === 0 && currentTurn >= 4) {
          // Turn 4-5: -8 Wait score (must start acting)
          // Turn 6-7: -12 Wait score (desperate)
          // Turn 8+: -20 Wait score (ALL IN - attack or lose!)
          if (currentTurn >= 8) zeroVpDesperation = 20;
          else if (currentTurn >= 6) zeroVpDesperation = 12;
          else zeroVpDesperation = 8;
        }

        const hasAttackOption = attackActions.length > 0;
        const bestAttackScore = attackActions[0]?.score ?? 0;
        const bestMoveScore = actions
          .filter(candidate => candidate.action === 'move')
          .reduce((best, candidate) => Math.max(best, candidate.score), 0);
        const waitMissionBias = missionBias.waitPressure + (
          doctrinePlanning === 'keys_to_victory'
            ? missionBias.objectiveActionPressure * 0.35
            : 0
        );
        const waitBaseline =
          2.15 +
          (hasAttackOption ? 0 : 0.9) +
          (loadout.hasRangedWeapons && !loadout.hasMeleeWeapons ? 0.55 : 0.2) +
          (context.config.caution * 1.9) +
          (exposure * 0.22) +
          waitRefBonus +
          waitDelayAvoidance +
          waitMissionBias +
          waitTacticalBonus -
          eliminationWaitPenalty -
          zeroVpDesperation;
        const immediateScore = hasAttackOption ? bestAttackScore : Math.max(0.5, bestMoveScore * 0.85);
        const waitRollout = rolloutWaitReactBranches(context, {
          immediateScore,
          waitBaseline,
          moveCandidates: movePositions.slice(0, 3).map(candidate => candidate.position),
          maxMoveCandidates: 3,
        });
        const immediateBranchScore =
          waitRollout.branches.find(branch => branch.id === 'immediate_action')?.score ??
          immediateScore;
        const moveThenWaitBranchScore =
          waitRollout.branches.find(branch => branch.id === 'move_then_wait')?.score ??
          bestMoveScore;
        const waitBranch =
          waitRollout.branches.find(branch => branch.id === 'wait_now');
        const waitBranchScore = waitBranch?.score ?? waitBaseline;
        const waitBranchForecast = waitBranch?.forecast ?? waitForecast;
        const hiddenRevealTargets = waitBranchForecast.hiddenRevealTargets;
        const waitTriggerForecast = waitBranchForecast.expectedTriggerCount;
        const waitExpectedReactValue = waitBranchForecast.expectedReactValue;
        const waitGoapBranchScore = Math.max(0, waitBranchScore - waitBaseline);
        const preferredBranch = waitRollout.preferred.id;
        const preferredBranchScore = waitRollout.preferred.score;
        const threshold = (
          hiddenRevealTargets > 0 ||
          waitRefBonus + waitDelayAvoidance + waitGoapBranchScore >= 1.15
        ) ? 0.62 : 0.76;
        const beatsImmediate = !hasAttackOption || waitBranchScore >= immediateBranchScore * threshold;
        const branchTolerance = preferredBranch === 'wait_now' ? 1 : 0.95;
        const closeToBestBranch = waitBranchScore >= preferredBranchScore * branchTolerance;
        if (beatsImmediate && closeToBestBranch) {
          actions.push({
            action: 'wait',
            score: waitBranchScore,
            factors: {
              passiveReadiness: 1,
              caution: context.config.caution,
              exposure,
              hiddenRevealTargets,
              potentialReactTargets,
              refBreakpointCount,
              waitRefBonus,
              waitDelayAvoidance,
              waitExpectedTriggerCount: waitTriggerForecast,
              waitExpectedReactValue,
              waitBaselineScore: waitBaseline,
              waitGoapBranchScore,
              immediateBranchScore,
              moveThenWaitBranchScore,
              waitBranchScore,
              rolloutPreferredScore: preferredBranchScore,
              preferredBranchWaitNow: preferredBranch === 'wait_now' ? 1 : 0,
              preferredBranchMoveThenWait: preferredBranch === 'move_then_wait' ? 1 : 0,
              preferredBranchImmediateAction: preferredBranch === 'immediate_action' ? 1 : 0,
              objectivePressure: missionBias.objectiveActionPressure,
              waitMissionBias,
            },
          });
        }
      }

      const missionId = String(context.config.missionId ?? '').toUpperCase();
      const isEliminationPressureMission =
        missionId === 'ELIMINATION' ||
        missionId === 'QAI_11' ||
        missionId === 'QAI_17' ||
        missionId === 'QAI_18';
      if (
        isEliminationPressureMission &&
        attackActions.length === 0 &&
        Number.isFinite(nearestEnemyDistance) &&
        nearestEnemyDistance > 2.5
      ) {
        const movePressureBonus = 1.15 + Math.min(1.4, Math.max(0, nearestEnemyDistance - 2.5) * 0.08);
        for (const action of actions) {
          if (action.action === 'move') {
            const approachDeltaMu = Number(action.factors?.approachDeltaMu ?? 0);
            const approachNormalizedDelta = Number(action.factors?.approachNormalizedDelta ?? 0);
            const approachPressureBonus =
              (Math.max(0, approachDeltaMu) * 1.25) +
              (Math.max(0, approachNormalizedDelta) * 0.9);
            const approachRetreatPenalty = approachDeltaMu < 0
              ? Math.abs(approachDeltaMu) * 2.4
              : 0;
            action.score += movePressureBonus + approachPressureBonus - approachRetreatPenalty;
            action.factors = {
              ...action.factors,
              eliminationApproachPressure: movePressureBonus,
              eliminationApproachDeltaMu: approachDeltaMu,
              eliminationApproachBonus: approachPressureBonus,
              eliminationApproachRetreatPenalty: -approachRetreatPenalty,
            };
            continue;
          }
          if (
            action.action === 'wait' ||
            action.action === 'hide' ||
            action.action === 'detect' ||
            action.action === 'hold' ||
            action.action === 'fiddle'
          ) {
            action.score -= 1.35;
            action.factors = {
              ...action.factors,
              eliminationApproachPenalty: -1.35,
            };
          }
        }
      }

      // Sort by score
      actions.sort((a, b) => b.score - a.score);

      // Apply stratagem + predicted scoring modifiers
      const doctrine = context.config.tacticalDoctrine ?? TacticalDoctrine.Operative;
      const stratagemModifiers = calculateStratagemModifiers(doctrine);
      
      let finalActions = actions;

      // Apply scoring modifiers if scoring context is available
      if (context.scoringContext) {
        const scoringContext = buildScoringContext(
          context.scoringContext.myKeyScores,
          context.scoringContext.opponentKeyScores,
          { 
            totalVPPool: 5, 
            hasRPToVPConversion: false,
            currentTurn: context.currentTurn ?? 1,
            maxTurns: context.maxTurns ?? 6,
            endGameTurn: context.endGameTurn ?? context.scoringContext.predictorEndGameTurn,
          }
        );
        const scoringModifiers = calculateScoringModifiers(scoringContext);
        finalActions = applyCombinedModifiersToActions(actions, stratagemModifiers, scoringModifiers);
      } else {
        // Apply stratagem modifiers only (legacy behavior)
        finalActions = applyCombinedModifiersToActions(actions, stratagemModifiers, {
          aggressionMultiplier: 1.0,
          defenseMultiplier: 1.0,
          objectiveMultiplier: 1.0,
          riskMultiplier: 1.0,
          waitBonus: 0,
          playForTime: false,
          desperateMode: false,
        });
      }

      // Re-sort after applying modifiers
      finalActions.sort((a, b) => b.score - a.score);

      // Evaluate Pushing action (QSR p.789-791)
      // Pushing allows character to gain +1 AP once per Initiative, but adds a Delay token
      // Evaluate BEFORE finalizing action list so Pushing can enable other actions
      const canPush = actionMask.canPushing;
      
      if (canPush) {
        // Pushing is valuable when character can use extra AP effectively:
        // 1. Has multiple valuable actions (move + attack, attack + attack, etc.)
        // 2. Could use Concentrate for important attack
        // 3. Needs extra movement to reach objective/enemy
        // 4. Could use extra AP to Hide (become Hidden near enemy)
        // 5. Side has IP available (can Refresh to remove Delay token)
        // 6. Is in good position (not vulnerable after gaining Delay)
        
        const actionCount = finalActions.filter(a =>
          ['move', 'close_combat', 'ranged_combat'].includes(a.action) && a.score > 0.3
        ).length;
        
        const topActionScore = finalActions[0]?.score ?? 0;
        const secondActionScore = finalActions[1]?.score ?? 0;

        // Check if character could benefit from Concentrate
        const hasImportantTarget = finalActions.some(a =>
          (a.action === 'close_combat' || a.action === 'ranged_combat') &&
          a.score > 0.7 &&
          a.target &&
          ((a.target.profile?.archetype as any) === 'Elite' ||
           (a.target.profile?.archetype as any) === 'Veteran' ||
           a.factors?.isOutnumbered)
        );
        
        // Check if extra movement would be valuable
        const needsMovement = finalActions.some(a =>
          a.action === 'move' && a.score > 0.5
        );
        
        // Check if character could benefit from Hiding
        // Hiding is valuable when:
        // - Character is in/near cover or terrain that blocks LOS
        // - Enemy models are nearby (within LOS/FOV range)
        // - Character would benefit from being Hidden (ranged model, low defense, etc.)
        const couldHide = !context.character.state.isHidden &&
          (context.character.profile?.items?.some(i => 
            (i.classification || i.class || '').toLowerCase().includes('range') ||
            (i.classification || i.class || '').toLowerCase().includes('bow')
          ) ?? false);
        
        let enemiesNearby = 0;
        let isInCover = false;
        
        if (characterPos) {
          enemiesNearby = context.enemies.filter(e => {
            const enemyPos = context.battlefield.getCharacterPosition(e);
            if (!enemyPos) return false;
            const dist = Math.hypot(
              characterPos.x - enemyPos.x,
              characterPos.y - enemyPos.y
            );
            return dist <= 16; // Within typical visibility range
          }).length;
          
          isInCover = this.evaluateCover(characterPos, context) > 0;
        }
        
        const couldBenefitFromHiding = couldHide && enemiesNearby > 0 && isInCover;
        
        // Check if Side has IP available (can Refresh to remove Delay token)
        // Having IP reduces the risk/cost of Pushing
        const sideHasIP = (context.side?.state.initiativePoints ?? 0) >= 1;
        const ipAggressionBonus = sideHasIP ? 0.3 : 0; // Bonus for having IP available

        // Check Tactical Doctrine - Aggressive doctrines encourage Pushing
        const doctrine = context.config.tacticalDoctrine ?? TacticalDoctrine.Operative;
        const stratagemModifiers = calculateStratagemModifiers(doctrine);
        const doctrinePushBonus = stratagemModifiers.pushAdvantage ? 0.3 : 0;

        // Check if character is in good position (not vulnerable)
        const isInGoodPosition = !context.battlefield.isEngaged?.(context.character) ||
          (characterPos && this.countEnemyInMeleeRange(context, characterPos, 1.5) <=
          this.countFriendlyInMeleeRange(context, characterPos, 1.5));
        
        // Calculate Pushing score
        let pushScore = 0;

        // At 0 AP, Pushing is the only way to continue the Initiative.
        if (context.apRemaining === 0) {
          const hasImmediateOpportunity =
            actionMask.candidateEnemyIds.length > 0 ||
            this.getInteractableObjectiveMarkers(context).length > 0;
          pushScore += hasImmediateOpportunity ? 0.65 : 0.35;
          if (context.scoringContext && !context.scoringContext.amILeading) {
            pushScore += 0.25;
          }
        }
        
        // Base score from enabling multiple actions
        if (actionCount >= 2) {
          pushScore += (topActionScore + secondActionScore) * 0.6;
        } else if (actionCount === 1) {
          pushScore += topActionScore * 0.4;
        }
        
        // Bonus for Concentrate on important target
        if (hasImportantTarget) {
          pushScore += 0.5;
        }
        
        // Bonus for extra movement
        if (needsMovement) {
          pushScore += 0.3;
        }
        
        // Bonus for Hiding (significant tactical benefit)
        if (couldBenefitFromHiding) {
          // Hiding is very valuable - enemies can't target you easily
          pushScore += 0.6;
          
          // Extra bonus if multiple enemies nearby
          if (enemiesNearby >= 2) {
            pushScore += 0.2;
          }
        }
        
        // Bonus if Side has IP (can Refresh to remove Delay token)
        // This encourages aggressive Pushing when resources are available
        if (sideHasIP) {
          pushScore += ipAggressionBonus;
        }

        // Bonus if Tactical Doctrine encourages pushing (Aggressive doctrines)
        if (doctrinePushBonus > 0) {
          pushScore += doctrinePushBonus;
        }

        // Avoid push->charge->attack loops when delay cancels charge modifier.
        // Exception: charge-trait weapons still gain wild die + impact.
        let pushingChargePenalty = 0;
        let pushingChargeBonus = 0;
        let pushingEnablesCharge = false;
        if (context.apRemaining === 1 && loadout.hasMeleeWeapons && !context.battlefield.isEngaged?.(context.character)) {
          pushingEnablesCharge = context.enemies.some(enemy =>
            isAttackableEnemy(context.character, enemy, context.config) &&
            this.evaluateChargeOpportunity(context, enemy).canCharge
          );
          if (pushingEnablesCharge) {
            if (hasChargeTraitMeleeWeapon) {
              pushingChargeBonus = 0.22;
            } else {
              pushingChargePenalty = -0.65;
            }
          }
        }
        pushScore += pushingChargePenalty + pushingChargeBonus;

        // Penalty if vulnerable (gaining Delay token is risky)
        if (!isInGoodPosition) {
          pushScore *= 0.5;
        }
        
        // Penalty for Delay token cost (reduced if Side has IP)
        const delayTokenCost = sideHasIP ? -0.1 : -0.2; // Less penalty if can Refresh
        pushScore += delayTokenCost;
        
        // Only recommend Pushing if net benefit is positive
        const minPushThreshold = context.apRemaining === 0 ? 0.05 : 0.2;
        if (pushScore > minPushThreshold) {
          finalActions.push({
            action: 'pushing',
            score: pushScore,
            factors: {
              actionCount,
              hasImportantTarget: hasImportantTarget ? 1 : 0,
              needsMovement: needsMovement ? 1 : 0,
              couldBenefitFromHiding: couldBenefitFromHiding ? 1 : 0,
              sideHasIP: sideHasIP ? 1 : 0,
              enemiesNearby,
              isInCover: isInCover ? 1 : 0,
              isInGoodPosition: isInGoodPosition ? 1 : 0,
              concentrateBenefit: hasImportantTarget ? 0.5 : 0,
              hideBenefit: couldBenefitFromHiding ? 0.6 : 0,
              ipAggressionBonus: ipAggressionBonus,
              doctrinePushBonus: doctrinePushBonus,
              pushingEnablesCharge: pushingEnablesCharge ? 1 : 0,
              pushingChargePenalty,
              pushingChargeBonus,
              hasChargeTraitMeleeWeapon: hasChargeTraitMeleeWeapon ? 1 : 0,
              delayTokenCost,
            },
          });
        }
      }

      // Evaluate Refresh action (QSR p.784)
      // Spend 1 IP from Side to remove 1 Delay token from character
      // Only valuable if character has Delay tokens and IP is available
      const hasDelayTokens = (context.character.state.delayTokens ?? 0) > 0;
      const sideHasIP = (context.side?.state.initiativePoints ?? 0) >= 1;

      if (actionMask.canRefresh && hasDelayTokens && sideHasIP) {
        // Refresh is valuable when:
        // 1. Character has multiple Delay tokens (can act again sooner)
        // 2. Character is in a valuable position (engaged with enemy, near objective)
        // 3. Side has excess IP (more than 2)
        // 4. Character could benefit from acting sooner (ranged model, etc.)
        // 5. Tactical Doctrine encourages IP spending (Aggressive) or hoarding (Commander)

        const delayTokenCount = context.character.state.delayTokens ?? 0;
        const isEngaged = context.battlefield.isEngaged?.(context.character) ?? false;
        const hasExcessIP = (context.side?.state.initiativePoints ?? 0) > 2;

        // Check if character would benefit from acting sooner
        const isRanged = context.character.profile?.items?.some(i =>
          (i.classification || i.class || '').toLowerCase().includes('range') ||
          (i.classification || i.class || '').toLowerCase().includes('bow')
        ) ?? false;
        const couldBenefitFromActingSooner = isRanged || isEngaged;

        // Check Tactical Doctrine - affects IP spending behavior
        const doctrine = context.config.tacticalDoctrine ?? TacticalDoctrine.Operative;
        const stratagemModifiers = calculateStratagemModifiers(doctrine);
        
        // Aggressive doctrines spend IP more freely
        // Defensive/Commander doctrines hoard IP for Force Initiative
        let doctrineIPModifier = 0;
        if (stratagemModifiers.pushAdvantage) {
          doctrineIPModifier = 0.2; // Aggressive: spend IP freely
        } else if (doctrine === TacticalDoctrine.Commander || 
                   doctrine === TacticalDoctrine.Defender) {
          doctrineIPModifier = -0.3; // Commander/Defender: hoard IP
        }

        let refreshScore = 0;

        // Base score from removing Delay tokens (more tokens = more valuable)
        refreshScore += delayTokenCount * 0.5;

        // Bonus if engaged (can attack sooner)
        if (isEngaged) {
          refreshScore += 0.5;
        }

        // Bonus if ranged model (can shoot sooner)
        if (isRanged && !isEngaged) {
          refreshScore += 0.4;
        }

        // Bonus if side has excess IP
        if (hasExcessIP) {
          refreshScore += 0.3;
        }

        // Bonus if character could benefit from acting sooner
        if (couldBenefitFromActingSooner) {
          refreshScore += 0.2;
        }

        // Apply doctrine modifier
        refreshScore += doctrineIPModifier;

        // Lower threshold - Refresh is often valuable when IP is available
        if (refreshScore > 0.2) {
          finalActions.push({
            action: 'refresh',
            score: refreshScore,
            factors: {
              delayTokenCount,
              isEngaged: isEngaged ? 1 : 0,
              isRanged: isRanged ? 1 : 0,
              hasExcessIP: hasExcessIP ? 1 : 0,
              couldBenefitFromActingSooner: couldBenefitFromActingSooner ? 1 : 0,
              doctrineIPModifier,
              ipCost: -0.1, // Small penalty for spending IP
            },
          });
        }
      }

      // Fallback: If no valid actions, add a hold action
      if (finalActions.length === 0) {
        finalActions.push({
          action: 'hold',
          score: 0.1, // Low score but better than nothing
          factors: {},
        });
      }

      // === VP URGENCY INTEGRATION (VP_PLANNING_FAILURE_ANALYSIS.md) ===
      // Calculate VP urgency and apply to action scoring
      const myVP = context.vpBySide?.[context.sideId ?? ''] ?? 0;
      const enemyVP = Object.entries(context.vpBySide ?? {})
        .filter(([sid]) => sid !== context.sideId)
        .reduce((max, [, vp]) => Math.max(max, vp), 0);
      const currentTurn = context.currentTurn ?? 1;
      const maxTurns = context.maxTurns ?? 6;
      const endGameTurn = Number.isFinite(context.endGameTurn)
        ? Number(context.endGameTurn)
        : Number.isFinite(context.scoringContext?.predictorEndGameTurn)
          ? Number(context.scoringContext?.predictorEndGameTurn)
          : undefined;
      const expectedTurnsRemaining = estimateExpectedTurnsRemaining(currentTurn, maxTurns, endGameTurn);
      const effectiveMaxTurns = Math.max(currentTurn, Math.round((currentTurn - 1) + expectedTurnsRemaining));

      const vpUrgency = calculateVPUrgency(myVP, enemyVP, currentTurn, effectiveMaxTurns);

      // Filter actions based on VP urgency (desperate/high urgency only)
      if (vpUrgency.urgencyLevel === 'desperate' || vpUrgency.urgencyLevel === 'high') {
        finalActions = filterActionsByVP(finalActions, vpUrgency, 0.0);
      }

      // Apply VP urgency bonus/penalty to action scores
      for (const action of finalActions) {
        // Get VP info for this action
        const vpInfo = getActionVPInfo(
          action.action,
          action.target !== undefined,
          true // Assume in range for scoring
        );

        // Add VP contribution score
        const vpScore = scoreActionByVP(action, vpUrgency);

        // Apply passive action penalty when VP=0
        if (vpInfo.isPassiveAction && myVP === 0 && currentTurn >= 3) {
          const passivePenalty = getPassiveActionPenalty(vpUrgency.urgencyLevel, currentTurn, myVP);
          action.score = Math.max(0, action.score + passivePenalty);
        }

        // Add VP score to action
        action.score += vpScore;

        // Store VP urgency info in factors for debugging
        action.factors = {
          ...action.factors,
          vpUrgencyLevel: vpUrgency.urgencyLevel === 'high' ? 3 : vpUrgency.urgencyLevel === 'medium' ? 2 : 1,
          vpDeficit: vpUrgency.vpDeficit,
          vpScore,
          myVP,
          enemyVP,
        };
      }

      // Fractional VP/RP potential and denial pressure:
      // converts current + predicted score state into a continuous utility signal.
      const fractionalPotential = this.computeFractionalScoringPotential(context);
      for (const action of finalActions) {
        const fractional = this.evaluateActionFractionalScoring(action, fractionalPotential);
        action.score += fractional.total;
        action.factors = {
          ...action.factors,
          fractionalVpPotential: fractional.vpPotential,
          fractionalVpDenial: fractional.vpDenial,
          fractionalRpPotential: fractional.rpPotential,
          fractionalRpDenial: fractional.rpDenial,
          scoringUrgencyScalar: fractionalPotential.urgencyScalar,
          scoringPotentialDelta: fractionalPotential.vpPotentialDelta,
        };
      }

      // Re-sort after VP adjustments
      finalActions.sort((a, b) => b.score - a.score);
      // === END VP URGENCY INTEGRATION ===

      return finalActions;
    } finally {
      this.activeEvaluationSession = previousSession;
    }
  }

  /**
   * Evaluate positions for movement
   */
  evaluatePositions(context: AIContext, survivalFactor: number = this.computeConditionalSurvivalFactor(context)): ScoredPosition[] {
    const positions: ScoredPosition[] = [];
    const session = this.getEvaluationSession(context);
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) return positions;
    const movementAllowance = Math.max(
      1,
      (context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2) + 2
    );
    const actorBaseDiameter = getBaseDiameterFromSiz(
      context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3
    );
    const nearestEnemyDistanceFromCurrent = this.distanceToClosestAttackableEnemy(characterPos, context);
    const longApproachPhase =
      Number.isFinite(nearestEnemyDistanceFromCurrent) &&
      nearestEnemyDistanceFromCurrent > movementAllowance + 0.75;
    const isCurrentlyEngaged = Boolean(context.battlefield.isEngaged?.(context.character));

    // Local + strategic sampling:
    // - local ring to retain tactical nuance
    // - board-aware path endpoints to avoid short-horizon stagnation
    // Strategic samples are already pathfinding-validated, so we trust them
    const sampleRadius = Math.max(
      1,
      (context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2) + 2
    );
    const localSamples = this.samplePositions(characterPos, sampleRadius, session.localSampleCount);
    const strategicSamples = this.sampleStrategicPositions(context, characterPos);
    const samples = this.dedupePositions([...localSamples, ...strategicSamples], context.battlefield);

    // R3: Get loadout for doctrine-aware scoring
    const loadout = this.getLoadoutProfile(context.character);
    const isRanged = loadout.hasRangedWeapons && !loadout.hasMeleeWeapons;
    const isMelee = loadout.hasMeleeWeapons && !loadout.hasRangedWeapons;
    const gameSize = String(context.config.gameSize ?? '').toUpperCase();
    const fastMeleeScoring = gameSize === 'VERY_SMALL' && isMelee;

    for (const pos of samples) {
      if (pos.x === characterPos.x && pos.y === characterPos.y) continue;
      
      // Check if position is occupied by another model
      const occupant = context.battlefield.getCharacterAt(pos);
      if (occupant && occupant.id !== context.character.id) continue;
      if (!context.battlefield.canOccupy(pos, actorBaseDiameter, context.character.id)) continue;

      // For local samples, check straight-line distance
      // For strategic samples, trust pathfinding (already validated)
      const isLocalSample = localSamples.some(s => s.x === pos.x && s.y === pos.y);
      const displacementMu = Math.hypot(pos.x - characterPos.x, pos.y - characterPos.y);
      if (isLocalSample) {
        if (displacementMu > movementAllowance + 1e-6) continue;
        // In long-approach phases, prune low-commitment local shuffles.
        if (longApproachPhase && !isCurrentlyEngaged && displacementMu < (movementAllowance * 0.55)) {
          continue;
        }
      }
      // Strategic samples are pathfinding-validated, so we accept them regardless of straight-line distance

      const cover = fastMeleeScoring ? 0 : this.evaluateCover(pos, context);
      const distanceScore = this.evaluateDistance(pos, context);
      const visibility = fastMeleeScoring ? 1 : this.evaluateVisibility(pos, context);
      const cohesion = this.evaluateCohesion(pos, context);
      const threatRelief = fastMeleeScoring ? 0 : this.evaluateThreatRelief(pos, context);

      // R3: Add lean opportunity and exposure risk evaluation
      const leanOpportunity = (isRanged && !fastMeleeScoring) ? this.evaluateLeanOpportunity(pos, context) : 0;
      const exposureRisk = fastMeleeScoring ? 0 : this.evaluateExposureRisk(pos, context);

      // Priority 2: Outnumber-aware positioning
      // Score positions that create local outnumbering advantage
      const outnumberScore = this.evaluateOutnumberAdvantage(pos, context);

      // R2.5: ROF/Suppression safety scoring
      const positionSafety = fastMeleeScoring ? 0 : this.evaluatePositionSafety(context.character, pos, context);
      const suppressionZoneControl = fastMeleeScoring ? 0 : this.evaluateSuppressionZoneControl(pos, context);

      // Phase 2.4: Gap crossing evaluation
      const gapCrossingResult = this.evaluateGapCrossing(context, characterPos, pos);
      const gapCrossingBonus = gapCrossingResult.canCross ? gapCrossingResult.score : 0;

      // Phase 3.2: Flanking Maneuvers - score positions that provide flanking advantage
      const flankingScore = this.evaluateFlankingPosition(pos, context);

      // R3: Doctrine-aware scoring weights
      const coverWeight = this.weights.coverValue * (isRanged ? 1.3 : 1.0);
      const leanWeight = isRanged ? 1.5 : 0; // Only ranged models benefit from lean
      const exposurePenalty = isRanged ? 1.8 : 1.2; // Ranged models more exposed = bad
      const safetyWeight = isRanged ? 2.0 : 1.5; // Ranged models should avoid suppression more

      const score =
        cover * coverWeight +
        distanceScore * this.weights.distanceToTarget +
        (threatRelief * (1.5 + this.weights.riskAvoidance) * survivalFactor) +
        visibility * 0.5 +
        cohesion * this.weights.cohesionValue +
        (leanOpportunity * leanWeight) -
        ((exposureRisk * exposurePenalty) * survivalFactor) +
        (outnumberScore * 2.0) + // Strong weight for outnumber advantage
        ((positionSafety * safetyWeight) * survivalFactor) + // R2.5: Safety from ROF/suppression
        (suppressionZoneControl * 1.5) + // R2.5: Area denial value
        gapCrossingBonus + // Phase 2.4: Gap crossing bonus
        (flankingScore * 2.0); // Phase 3.2: Flanking maneuvers

      positions.push({
        position: pos,
        score,
        factors: {
          cover,
          distance: distanceScore,
          visibility,
          cohesion,
          threatRelief,
          leanOpportunity,
          exposureRisk,
          outnumberScore,
          positionSafety,
          suppressionZoneControl,
          flankingScore,
          gapCrossing: gapCrossingBonus,
          survivalFactor,
        } as any,
      });
    }

    positions.sort((a, b) => b.score - a.score);
    return positions;
  }

  /**
   * Evaluate targets for attack
   * 
   * R9: Tactical Heuristics - Only evaluate tactically relevant enemies
   * Uses engagement state filtering, cohesion-based prioritization,
   * and early-out pruning to reduce O(n²) to O(n × k).
   */
  evaluateTargets(context: AIContext): ScoredTarget[] {
    const targets: ScoredTarget[] = [];
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) return targets;

    // R9: Get tactically relevant enemies (engagement filtering)
    const relevantEnemies = getTacticallyRelevantEnemies(context as any);

    // R9: Categorize by cohesion (high vs low priority)
    const cohesionAware = getCohesionAwareEnemies(context as any, characterPos);

    // Get ROF level from character's weapon
    const rofLevel = this.getCharacterROFLevel(context.character);
    const survivalFactor = this.computeConditionalSurvivalFactor(context);
    const selfOutOfPlayRiskPenalty = this.evaluateSelfOutOfPlayRiskPenalty(context, characterPos) * survivalFactor;
    const scoringPotential = this.computeFractionalScoringPotential(context);

    // Phase 3.1: Focus Fire Coordination - track which enemies allies are targeting
    const allyTargetCounts = new Map<string, number>();
    for (const ally of context.allies) {
      if (ally.state.isAttentive && ally.state.isOrdered && !ally.state.isKOd && !ally.state.isEliminated) {
        const allyPos = context.battlefield.getCharacterPosition(ally);
        if (!allyPos) continue;

        // Find closest enemy to this ally
        let closestEnemy: Character | null = null;
        let closestDist = Infinity;
        for (const enemy of relevantEnemies) {
          const enemyPos = context.battlefield.getCharacterPosition(enemy);
          if (!enemyPos) continue;
          const dist = Math.hypot(enemyPos.x - allyPos.x, enemyPos.y - allyPos.y);
          if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
          }
        }
        if (closestEnemy) {
          const count = allyTargetCounts.get(closestEnemy.id) || 0;
          allyTargetCounts.set(closestEnemy.id, count + 1);
        }
      }
    }

    // R9: Evaluate within-cohesion enemies first (high priority)
    let currentBestScore = 0;
    for (const enemy of cohesionAware.withinCohesion) {
      // R9: Early-out pruning
      if (shouldSkipTargetEvaluation(enemy, context as any, currentBestScore)) continue;

      const target = this.evaluateSingleTarget(
        enemy,
        context as any,
        characterPos,
        rofLevel,
        allyTargetCounts,
        currentBestScore,
        selfOutOfPlayRiskPenalty,
        scoringPotential
      );
      if (target) {
        targets.push(target);
        currentBestScore = Math.max(currentBestScore, target.score);
      }
    }

    // R9: Then evaluate outside-cohesion enemies (low priority, more aggressive pruning)
    for (const enemy of cohesionAware.outsideCohesion) {
      // R9: More aggressive pruning for outside-cohesion targets
      if (shouldSkipTargetEvaluation(enemy, context as any, currentBestScore * 0.7)) continue;

      const target = this.evaluateSingleTarget(
        enemy,
        context as any,
        characterPos,
        rofLevel,
        allyTargetCounts,
        currentBestScore,
        selfOutOfPlayRiskPenalty,
        scoringPotential
      );
      if (target) {
        targets.push(target);
        currentBestScore = Math.max(currentBestScore, target.score);
      }
    }

    targets.sort((a, b) => b.score - a.score);
    return targets;
  }

  /**
   * Evaluate a single target with all scoring factors
   * R9: Extracted for clarity and reuse
   */
  private evaluateSingleTarget(
    enemy: Character,
    context: AIContext,
    characterPos: Position,
    rofLevel: number,
    allyTargetCounts: Map<string, number>,
    currentBestScore: number,
    selfOutOfPlayRiskPenalty: number,
    scoringPotential: FractionalScoringPotential
  ): ScoredTarget | null {
    if (!isAttackableEnemy(context.character, enemy, context.config)) return null;

    const enemyPos = context.battlefield.getCharacterPosition(enemy);
    if (!enemyPos) return null;

    const health = this.evaluateTargetHealth(enemy);
    const threat = this.evaluateTargetThreat(enemy, context);
    const distance = this.evaluateTargetDistance(characterPos, enemyPos);
    const visibility = context.config.perCharacterFovLos
      ? (this.hasLOS(context.character, enemy, context.battlefield) ? 1.0 : 0.0)
      : 1.0;
    const missionPriority = this.evaluateMissionPriority(enemy, context);

    // R2.5: ROF Target Scoring
    const rofTargetScore = rofLevel > 0
      ? this.evaluateROFTargetValue(context.character, enemy, context, rofLevel)
      : 0;

    // Phase 2.3: Falling Tactics - Jump Down Attack scoring
    const jumpDownResult = this.evaluateJumpDownAttack(
      context,
      context.character,
      enemy,
      characterPos,
      enemyPos
    );
    const jumpDownBonus = jumpDownResult.canJump ? jumpDownResult.score * 0.5 : 0;

    // Phase 3.1: Focus Fire Coordination
    const allyTargetCount = allyTargetCounts.get(enemy.id) || 0;
    const allyFocusFireBonus = allyTargetCount > 0 ? allyTargetCount * 1.5 : 0;
    const targetCommitment = context.targetCommitments?.[enemy.id] ?? 0;
    const targetCommitmentBonus = targetCommitment > 0
      ? Math.min(6, targetCommitment * 1.25)
      : 0;
    const scrumContinuity = context.scrumContinuity?.[enemy.id] ?? 0;
    const lanePressure = context.lanePressure?.[enemy.id] ?? 0;
    const scrumContinuityBonus = scrumContinuity > 0 ? Math.min(4.5, scrumContinuity * 1.1) : 0;
    const lanePressureBonus = lanePressure > 0 ? Math.min(4, lanePressure * 0.95) : 0;
    const focusFireBonus = allyFocusFireBonus + targetCommitmentBonus + scrumContinuityBonus + lanePressureBonus;

    // Phase 3.1: Finish weakened targets
    const enemySiz = enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3;
    const enemyWounds = enemy.state.wounds;
    const finishOffBonus = enemyWounds >= enemySiz - 1 ? 5.0 : 0;
    const outOfPlayPressureBonus = this.evaluateEnemyOutOfPlayPressure(enemy);

    const vpPressureBreakdown = this.evaluateTargetVPRPPressure(enemy, context, scoringPotential);
    const vpPressureBonus = vpPressureBreakdown.total;

    // R9: Threat immediacy bonus
    const threatImmediacy = evaluateThreatImmediacy(enemy, characterPos, context as any);
    const threatImmediacyBonus = threatImmediacy.totalScore * 1.5;

    const score =
      health * this.weights.targetHealth +
      threat * this.weights.targetThreat +
      distance * this.weights.distanceToTarget +
      visibility * 2.0 +
      missionPriority * this.weights.victoryConditionValue +
      rofTargetScore * 1.5 +
      jumpDownBonus +
      focusFireBonus +
      outOfPlayPressureBonus +
      finishOffBonus +
      vpPressureBonus +  // === NEW: VP/RP pressure ===
      threatImmediacyBonus -
      selfOutOfPlayRiskPenalty;

    return {
      target: enemy,
      score,
      factors: {
        health,
        threat,
        distance,
        visibility,
        missionPriority,
        rofTargetScore: rofTargetScore as any,
        jumpDown: jumpDownBonus,
        focusFire: focusFireBonus,
        targetCommitment: targetCommitmentBonus,
        scrumContinuity: scrumContinuityBonus,
        lanePressure: lanePressureBonus,
        outOfPlayPressure: outOfPlayPressureBonus,
        selfOutOfPlayRisk: selfOutOfPlayRiskPenalty,
        finishOff: finishOffBonus,
        vpPressure: vpPressureBonus,
        vpPotential: vpPressureBreakdown.vpPotential,
        vpDenial: vpPressureBreakdown.vpDenial,
        rpPotential: vpPressureBreakdown.rpPotential,
        rpDenial: vpPressureBreakdown.rpDenial,
        threatImmediacy: threatImmediacyBonus,
      } as any,
    };
  }

  private evaluateEnemyOutOfPlayPressure(enemy: Character): number {
    const enemyBp = this.getModelBPValue(enemy);
    if (enemyBp <= 0) return 0;

    const enemySiz = Math.max(1, enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3);
    const enemyWounds = Math.max(0, enemy.state.wounds ?? 0);
    const woundProgress = Math.min(1, enemyWounds / enemySiz);
    const nearOutOfPlay = enemyWounds >= enemySiz - 1 ? 1 : 0;

    // Fractional pressure: increases as enemy approaches out-of-play.
    return (enemyBp * woundProgress * 0.16) + (enemyBp * nearOutOfPlay * 0.08);
  }

  private evaluateTargetVPRPPressure(
    enemy: Character,
    context: AIContext,
    scoringPotential: FractionalScoringPotential
  ): TargetVPRPPressureBreakdown {
    const enemyBp = this.getModelBPValue(enemy);
    const maxEnemyBp = Math.max(
      enemyBp,
      ...context.enemies.map(candidate => this.getModelBPValue(candidate))
    );
    const enemyBpShare = maxEnemyBp > 0
      ? this.clamp(enemyBp / maxEnemyBp, 0.2, 1)
      : 0.5;

    const enemySiz = Math.max(1, enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3);
    const enemyWounds = Math.max(0, enemy.state.wounds ?? 0);
    const woundProgress = this.clamp01(enemyWounds / enemySiz);
    const nearOutOfPlay = enemyWounds >= enemySiz - 1 ? 1 : 0;
    const outOfPlayProgress = this.clamp((woundProgress * 0.7) + (nearOutOfPlay * 0.3), 0, 1);

    const vpNeedScale =
      0.45 +
      (scoringPotential.vpDeficit * 0.28) +
      (Math.max(0, -scoringPotential.vpPotentialDelta) * 0.22);
    const vpPotential =
      outOfPlayProgress *
      enemyBpShare *
      vpNeedScale *
      scoringPotential.urgencyScalar *
      2.1;

    const vpDenial =
      outOfPlayProgress *
      enemyBpShare *
      Math.max(0, scoringPotential.opponentFractionalVpPotential) *
      0.9;

    const rpNeedScale = scoringPotential.rpDeficit > 0
      ? 0.3 + Math.min(1.4, scoringPotential.rpDeficit * 0.2)
      : 0.18;
    const rpPotential =
      outOfPlayProgress *
      enemyBpShare *
      rpNeedScale *
      (1 + Math.max(0, 1 - (scoringPotential.myRpVpPotential * 0.45)));

    const rpDenial =
      outOfPlayProgress *
      enemyBpShare *
      scoringPotential.opponentRpVpPotential *
      0.35;

    const total = vpPotential + vpDenial + rpPotential + rpDenial;
    return { vpPotential, vpDenial, rpPotential, rpDenial, total };
  }

  private evaluateActionFractionalScoring(
    action: ScoredAction,
    scoringPotential: FractionalScoringPotential
  ): ActionFractionalScoringBreakdown {
    const vpInfo = getActionVPInfo(
      action.action,
      action.target !== undefined,
      true
    );

    const directnessWeight = vpInfo.isDirectVPAction
      ? 1.0
      : vpInfo.isVPEnablingAction
        ? 0.65
        : vpInfo.isSupportAction
          ? 0.45
          : vpInfo.isMovementAction
            ? 0.4
            : 0.15;

    const vpNeedScale =
      1 +
      (scoringPotential.vpDeficit * 0.35) +
      (Math.max(0, -scoringPotential.vpPotentialDelta) * 0.2);
    let vpPotential =
      vpInfo.estimatedVPContribution *
      directnessWeight *
      scoringPotential.urgencyScalar *
      vpNeedScale *
      1.8;

    let vpDenial =
      (vpInfo.isDirectVPAction ? 1 : vpInfo.isVPEnablingAction ? 0.55 : 0.2) *
      Math.max(0, scoringPotential.opponentFractionalVpPotential) *
      0.22 *
      scoringPotential.urgencyScalar;

    const rpCatchupNeed =
      1 +
      (scoringPotential.rpDeficit * 0.18) +
      (Math.max(0, scoringPotential.opponentRpVpPotential - scoringPotential.myRpVpPotential) * 0.15);
    let rpPotential =
      (vpInfo.isDirectVPAction ? 0.35 : vpInfo.isVPEnablingAction ? 0.2 : 0.08) *
      rpCatchupNeed *
      Math.max(0.4, 1 - (scoringPotential.myRpVpPotential * 0.2));

    let rpDenial =
      (vpInfo.isDirectVPAction ? 0.28 : vpInfo.isVPEnablingAction ? 0.16 : 0.06) *
      scoringPotential.opponentRpVpPotential;

    if (vpInfo.isPassiveAction) {
      const passivePenalty =
        (scoringPotential.vpDeficit * 0.55) +
        (scoringPotential.rpDeficit * 0.2) +
        (Math.max(0, -scoringPotential.vpPotentialDelta) * 0.3);
      vpPotential -= passivePenalty;
      rpPotential -= scoringPotential.rpDeficit > 0
        ? 0.2 + (scoringPotential.rpDeficit * 0.1)
        : 0;
      vpDenial *= 0.35;
      rpDenial *= 0.35;
    }

    const total = vpPotential + vpDenial + rpPotential + rpDenial;
    return { vpPotential, vpDenial, rpPotential, rpDenial, total };
  }

  private computeFractionalScoringPotential(context: AIContext): FractionalScoringPotential {
    const sideVP = this.resolveSideScore(
      context.vpBySide,
      context.sideId,
      Number(context.side?.state?.victoryPoints ?? 0)
    );
    const opponentVP = this.resolveOpponentScore(
      context.vpBySide,
      context.sideId
    );
    const sideRP = this.resolveSideScore(
      context.rpBySide,
      context.sideId,
      Number(context.side?.state?.resourcePoints ?? 0)
    );
    const opponentRP = this.resolveOpponentScore(
      context.rpBySide,
      context.sideId
    );

    const vpDeficit = Math.max(0, opponentVP - sideVP);
    const rpDeficit = Math.max(0, opponentRP - sideRP);
    const ledger = context.scoringContext?.fractionalPotentialLedger;
    const myFractionalVpPotential = ledger && Number.isFinite(ledger.myTotalPotential)
      ? Math.max(0, ledger.myTotalPotential)
      : this.estimateFractionalKeyPotential(context.scoringContext?.myKeyScores);
    const opponentFractionalVpPotential = ledger && Number.isFinite(ledger.opponentTotalPotential)
      ? Math.max(0, ledger.opponentTotalPotential)
      : this.estimateFractionalKeyPotential(context.scoringContext?.opponentKeyScores);
    const myDeniedPotential = ledger && Number.isFinite(ledger.myDeniedPotential)
      ? Math.max(0, ledger.myDeniedPotential)
      : 0;
    const opponentDeniedPotential = ledger && Number.isFinite(ledger.opponentDeniedPotential)
      ? Math.max(0, ledger.opponentDeniedPotential)
      : 0;
    const denialDelta = myDeniedPotential - opponentDeniedPotential;
    const vpPotentialDelta =
      (myFractionalVpPotential - opponentFractionalVpPotential) +
      (denialDelta * 0.4);

    const myRpVpPotential = this.estimateRpVictoryPotential(sideRP, opponentRP);
    const opponentRpVpPotential = this.estimateRpVictoryPotential(opponentRP, sideRP);

    const currentTurn = Math.max(1, Number(context.currentTurn ?? 1));
    const maxTurns = Math.max(currentTurn, Number(context.maxTurns ?? 6));
    const endGameTurn = Number.isFinite(context.endGameTurn)
      ? Number(context.endGameTurn)
      : Number.isFinite(context.scoringContext?.predictorEndGameTurn)
        ? Number(context.scoringContext?.predictorEndGameTurn)
        : undefined;
    const timePressure = calculateSuddenDeathTimePressure(currentTurn, maxTurns, endGameTurn);
    const potentialGapPressure = Math.max(
      0,
      (opponentFractionalVpPotential + (opponentDeniedPotential * 0.35)) -
      (myFractionalVpPotential + (myDeniedPotential * 0.35))
    );
    const urgencyScalar = this.clamp(
      1 +
      (vpDeficit * 0.35) +
      (rpDeficit * 0.12) +
      (potentialGapPressure * 0.28) +
      (Math.max(0, -denialDelta) * 0.18) +
      (timePressure * 0.25),
      0.65,
      3.4
    );

    return {
      sideVP,
      opponentVP,
      sideRP,
      opponentRP,
      vpDeficit,
      rpDeficit,
      myFractionalVpPotential,
      opponentFractionalVpPotential,
      vpPotentialDelta,
      myRpVpPotential,
      opponentRpVpPotential,
      urgencyScalar,
    };
  }

  private estimateFractionalKeyPotential(
    keyScores: Record<string, { current: number; predicted: number; confidence: number; leadMargin: number }> | undefined
  ): number {
    if (!keyScores) return 0;
    let total = 0;

    for (const score of Object.values(keyScores)) {
      const current = Number.isFinite(score.current) ? score.current : 0;
      const predicted = Number.isFinite(score.predicted) ? score.predicted : current;
      const confidence = this.clamp01(Number.isFinite(score.confidence) ? score.confidence : 0.5);
      const gain = Math.max(0, predicted - current);
      const contestedBoost = score.leadMargin < 0 ? 1.1 : 1;
      total += gain * (0.35 + (confidence * 0.65)) * contestedBoost;
    }

    return total;
  }

  private estimateRpVictoryPotential(myRp: number, opponentRp: number): number {
    if (!(myRp > opponentRp)) {
      return 0;
    }
    const leadMargin = Math.max(0, myRp - opponentRp);
    const plusOnePotential = this.clamp01(leadMargin);
    const doubleProgress = opponentRp <= 0
      ? (myRp > 0 ? 1 : 0)
      : myRp / (opponentRp * 2);
    const plusTwoProgress = this.clamp01(Math.min(doubleProgress, leadMargin / 3));
    return this.clamp(Math.max(plusOnePotential, plusTwoProgress * 2), 0, 2);
  }

  private resolveSideScore(
    scoreBySide: Record<string, number> | undefined,
    sideId: string | undefined,
    fallback: number
  ): number {
    if (scoreBySide && sideId) {
      const raw = scoreBySide[sideId];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, raw);
      }
    }
    return Number.isFinite(fallback) ? Math.max(0, fallback) : 0;
  }

  private resolveOpponentScore(
    scoreBySide: Record<string, number> | undefined,
    sideId: string | undefined
  ): number {
    if (!scoreBySide) {
      return 0;
    }
    return Object.entries(scoreBySide)
      .filter(([candidateSideId]) => candidateSideId !== sideId)
      .reduce((max, [, score]) => {
        if (typeof score !== 'number' || !Number.isFinite(score)) {
          return max;
        }
        return Math.max(max, score);
      }, 0);
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  private clamp01(value: number): number {
    return this.clamp(value, 0, 1);
  }

  private evaluateSelfOutOfPlayRiskPenalty(context: AIContext, characterPos: Position): number {
    const selfBp = this.getModelBPValue(context.character);
    if (selfBp <= 0) return 0;

    const selfSiz = Math.max(1, context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
    const selfWounds = Math.max(0, context.character.state.wounds ?? 0);
    const woundPressure = Math.min(1, selfWounds / selfSiz);
    const exposureCount = this.countEnemySightLinesToPosition(characterPos, context);
    const exposurePressure = context.enemies.length > 0
      ? Math.min(1, exposureCount / context.enemies.length)
      : 0;
    const engagementPressure = context.battlefield.isEngaged?.(context.character) ? 0.25 : 0;

    const riskScore = Math.min(1, (woundPressure * 0.6) + (exposurePressure * 0.3) + engagementPressure);
    let penalty = selfBp * riskScore * 0.1;

    // If losing elimination pressure, preserve some aggression.
    if (!context.scoringContext?.amILeading &&
        context.scoringContext?.losingKeys?.includes('elimination')) {
      penalty *= 0.75;
    }

    return penalty;
  }

  private computeConditionalSurvivalFactor(context: AIContext): number {
    let factor = 1;
    const wounds = Math.max(0, Number(context.character.state.wounds ?? 0));

    // Human-like risk appetite:
    // - healthier models can spend risk to gain tempo
    // - wounded models still keep a reduced survival weighting
    factor *= wounds > 0 ? 0.5 : 0.25;

    // In favorable scrums (local outnumber), survival pressure is reduced further
    // so the model can commit to finishing pressure.
    if (this.hasOutnumberingScrumCondition(context)) {
      factor *= 0.5;
    }

    return this.clamp(factor, 0.05, 1);
  }

  private hasOutnumberingScrumCondition(context: AIContext): boolean {
    const scrum = findMyScrumGroup(context.character, context as any);
    if (scrum && scrum.members.length >= 2 && scrum.localOutnumber > 0 && scrum.engagedEnemies.length > 0) {
      return true;
    }

    const actorPos = context.battlefield.getCharacterPosition(context.character);
    if (!actorPos) {
      return false;
    }

    const scrumRange = 1.75;
    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const actorDistance = Math.hypot(enemyPos.x - actorPos.x, enemyPos.y - actorPos.y);
      if (actorDistance > scrumRange) continue;

      let friendlyCount = 1;
      for (const ally of context.allies) {
        if (ally.state.isEliminated || ally.state.isKOd) continue;
        const allyPos = context.battlefield.getCharacterPosition(ally);
        if (!allyPos) continue;
        const allyDistance = Math.hypot(enemyPos.x - allyPos.x, enemyPos.y - allyPos.y);
        if (allyDistance <= scrumRange) {
          friendlyCount += 1;
        }
      }

      let enemyCount = 0;
      for (const opponent of context.enemies) {
        if (opponent.state.isEliminated || opponent.state.isKOd) continue;
        const opponentPos = context.battlefield.getCharacterPosition(opponent);
        if (!opponentPos) continue;
        const opponentDistance = Math.hypot(enemyPos.x - opponentPos.x, enemyPos.y - opponentPos.y);
        if (opponentDistance <= scrumRange) {
          enemyCount += 1;
        }
      }

      if (friendlyCount > enemyCount) {
        return true;
      }
    }

    return false;
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

  /**
   * Evaluate weapon swap actions (stow/unstow items)
   * QSR Lines 270-271: Use Fiddle action to switch out stowed items
   */
  evaluateWeaponSwap(context: AIContext): ScoredAction[] {
    const actions: ScoredAction[] = [];
    const character = context.character;
    const inHand = character.profile?.inHandItems ?? [];
    const stowed = character.profile?.stowedItems ?? [];
    
    if (stowed.length === 0) return actions; // Nothing to swap to
    
    // Calculate average enemy distance
    const avgDistance = this.getAverageEnemyDistance(context.enemies, context);
    
    // Check current weapon type
    const currentWeapon = inHand.find(item => this.isWeapon(item));
    const hasRanged = currentWeapon ? this.isRangedWeapon(currentWeapon) : false;
    const hasMelee = currentWeapon ? this.isMeleeWeapon(currentWeapon) : false;
    
    // Swap to ranged if enemies far and currently melee
    if (avgDistance > 12 && !hasRanged) {
      const rangedWeapon = stowed.find(item => this.isRangedWeapon(item));
      if (rangedWeapon) {
        const handsRequired = this.getItemHandRequirement(rangedWeapon);
        const handsAvailable = this.getAvailableHands(character);
        
        if (handsAvailable >= handsRequired) {
          const score = 4.0 + (avgDistance / 24) * 2; // Higher score for longer distance
          actions.push({
            action: 'fiddle',
            subAction: 'unstow',
            itemName: rangedWeapon.name,
            score,
            factors: { distance: avgDistance, weaponType: 1 },
            reason: 'Draw ranged weapon for distance',
          } as any);
        }
      }
    }

    // Swap to melee if enemies close and currently ranged
    if (avgDistance < 4 && hasRanged && !hasMelee) {
      const meleeWeapon = stowed.find(item => this.isMeleeWeapon(item));
      if (meleeWeapon) {
        const score = 5.0 + (4 - avgDistance); // Higher score for closer enemies
        actions.push({
          action: 'fiddle',
          subAction: 'unstow',
          itemName: meleeWeapon.name,
          score,
          factors: { distance: avgDistance, weaponType: 2 },
          reason: 'Draw melee weapon for close combat',
        } as any);
      }
    }

    // Swap to shield if under fire and no shield
    const hasShield = inHand.some(item => this.isShield(item));
    if (!hasShield && context.enemies.length > 0) {
      const shield = stowed.find(item => this.isShield(item));
      if (shield) {
        const handsRequired = this.getItemHandRequirement(shield);
        const handsAvailable = this.getAvailableHands(character);

        if (handsAvailable >= handsRequired) {
          const score = 3.5; // Defensive value
          actions.push({
            action: 'fiddle',
            subAction: 'unstow',
            itemName: shield.name,
            score,
            factors: { defensive: 1 },
            reason: 'Draw shield for defense',
          } as any);
        }
      }
    }

    return actions;
  }

  // ============================================================================
  // Evaluation Helpers
  // ============================================================================

  /**
   * Check if item is a weapon
   */
  private isWeapon(item: Item): boolean {
    const classifications = ['Melee', 'Firearm', 'Bow', 'Range', 'Thrown', 'Support', 'Ordnance'];
    return item.classification ? classifications.includes(item.classification) : false;
  }

  /**
   * Check if item is a shield
   */
  private isShield(item: Item): boolean {
    return item.classification === 'Shield' || item.class?.includes('Shield');
  }

  /**
   * Get hand requirement for item
   */
  private getItemHandRequirement(item: Item): number {
    if (item.traits?.includes('[2H]') || item.traits?.includes('2H')) return 2;
    if (item.traits?.includes('[1H]') || item.traits?.includes('1H')) return 1;
    return 0;
  }

  /**
   * Get available hands for character
   */
  private getAvailableHands(character: Character): number {
    const totalHands = character.profile?.totalHands ?? 2;
    const inHand = character.profile?.inHandItems ?? [];
    let committed = 0;
    for (const item of inHand) {
      committed += this.getItemHandRequirement(item);
    }
    return Math.max(0, totalHands - committed);
  }

  /**
   * Get average distance to enemies
   */
  private getAverageEnemyDistance(enemies: Character[], context: AIContext): number {
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos || enemies.length === 0) return 999;
    
    let totalDistance = 0;
    let count = 0;
    for (const enemy of enemies) {
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (enemyPos) {
        totalDistance += Math.hypot(enemyPos.x - characterPos.x, enemyPos.y - characterPos.y);
        count++;
      }
    }
    return count > 0 ? totalDistance / count : 999;
  }

  private getModelBPValue(model: Character): number {
    const adjusted = model.profile?.adjustedBp;
    if (typeof adjusted === 'number' && Number.isFinite(adjusted)) {
      return Math.max(0, adjusted);
    }
    const total = model.profile?.totalBp;
    if (typeof total === 'number' && Number.isFinite(total)) {
      return Math.max(0, total);
    }
    return 0;
  }

  private evaluateCover(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    const cacheKey = this.positionKey(position);
    const cached = session.coverCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

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
      const hasLOS = this.hasLineOfSightBetweenPositions(enemyPos, position, context);
      if (!hasLOS) {
        bestCover = Math.max(bestCover, 1.0); // Full cover if no LOS
      }
    }

    const result = Math.min(1.5, bestCover * coverPriority);
    session.coverCache.set(cacheKey, result);
    return result;
  }

  /**
   * R3: Evaluate lean opportunity at position
   * Returns score for positions with partial cover that allow shooting
   */
  private evaluateLeanOpportunity(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    const cacheKey = `lean:${this.positionKey(position)}`;
    const cached = session.coverCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const loadout = this.getLoadoutProfile(context.character);
    // Only ranged models benefit from lean
    if (!loadout.hasRangedWeapons) {
      session.coverCache.set(cacheKey, 0);
      return 0;
    }

    // Check for lean opportunities: position has LOS to enemies but is near cover
    let leanScore = 0;
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) {
      session.coverCache.set(cacheKey, 0);
      return 0;
    }

    // Count enemies visible from this position
    let visibleEnemies = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      if (this.hasLineOfSightBetweenPositions(position, enemyPos, context)) {
        visibleEnemies++;
      }
    }

    // Check if position is near cover (within 1 MU of cover edge)
    const nearCover = this.isNearCoverEdge(position, context);

    // Lean opportunity: can see enemies AND is near cover
    if (visibleEnemies > 0 && nearCover) {
      leanScore = 0.5 + (visibleEnemies * 0.15); // Base 0.5 + 0.15 per visible enemy
    }

    const result = Math.min(1.0, leanScore);
    session.coverCache.set(cacheKey, result);
    return result;
  }

  /**
   * R3: Check if position is near cover edge (within 1 MU)
   */
  private isNearCoverEdge(position: Position, context: AIContext): boolean {
    // Sample points around position to check for cover transitions
    const sampleRadius = 1.0;
    const sampleCount = 8;
    let hasCoverNearby = false;
    let hasExposedNearby = false;

    for (let i = 0; i < sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      const samplePos = {
        x: position.x + Math.cos(angle) * sampleRadius,
        y: position.y + Math.sin(angle) * sampleRadius,
      };

      // Check if sample is in cover (no LOS from any enemy)
      let isInCover = true;
      for (const enemy of context.enemies) {
        if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
        const enemyPos = context.battlefield.getCharacterPosition(enemy);
        if (!enemyPos) continue;
        if (!this.hasLineOfSightBetweenPositions(enemyPos, samplePos, context)) {
          isInCover = false;
          break;
        }
      }

      if (isInCover) {
        hasCoverNearby = true;
      } else {
        hasExposedNearby = true;
      }

      // If we have both, position is near cover edge
      if (hasCoverNearby && hasExposedNearby) {
        return true;
      }
    }

    return false;
  }

  /**
   * R3: Evaluate exposure risk at position
   * Returns score based on how many enemies can see this position
   */
  private evaluateExposureRisk(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    const cacheKey = `exposure:${this.positionKey(position)}`;
    const cached = session.coverCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const enemyCount = context.enemies.filter(e =>
      isAttackableEnemy(context.character, e, context.config)
    ).length;

    if (enemyCount === 0) {
      session.coverCache.set(cacheKey, 0);
      return 0;
    }

    // Count sight lines from enemies to this position
    let sightLines = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      if (this.hasLineOfSightBetweenPositions(enemyPos, position, context)) {
        sightLines++;
      }
    }

    // Exposure risk: ratio of visible enemies
    const result = sightLines / enemyCount;
    session.coverCache.set(cacheKey, result);
    return result;
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

  private evaluateApproachProgress(
    from: Position,
    to: Position,
    context: AIContext
  ): { deltaMu: number; normalizedDelta: number } {
    const currentNearest = this.distanceToClosestAttackableEnemy(from, context);
    const nextNearest = this.distanceToClosestAttackableEnemy(to, context);
    if (!Number.isFinite(currentNearest) || !Number.isFinite(nextNearest)) {
      return { deltaMu: 0, normalizedDelta: 0 };
    }

    const deltaMu = currentNearest - nextNearest;
    const normalizedDelta = deltaMu / Math.max(1, currentNearest);
    return {
      deltaMu: this.clamp(deltaMu, -6, 6),
      normalizedDelta: this.clamp(normalizedDelta, -1, 1),
    };
  }

  private countEnemySightLinesToPosition(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    const cacheKey = this.positionKey(position);
    const cached = session.positionExposureCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let count = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      if (this.hasLineOfSightBetweenPositions(enemyPos, position, context)) {
        count += 1;
      }
    }
    session.positionExposureCache.set(cacheKey, count);
    return count;
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
    const session = this.getEvaluationSession(context);
    const cacheKey = this.positionKey(position);
    const cached = session.visibilityCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    if (!context.config.perCharacterFovLos) {
      const result = context.enemies.length > 0 ? 1.0 : 0.0;
      session.visibilityCache.set(cacheKey, result);
      return result;
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
    const result = visibleEnemies / Math.max(1, context.enemies.length);
    session.visibilityCache.set(cacheKey, result);
    return result;
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

  // ============================================================================
  // R2.5: ROF/Suppression/Firelane Scoring Integration
  // ============================================================================

  /**
   * Get ROF level from character's equipped weapon
   */
  private getCharacterROFLevel(character: Character): number {
    const equipment = character.profile?.equipment || character.profile?.items || [];
    for (const item of equipment) {
      for (const trait of item.traits || []) {
        const match = trait.match(/ROF\s*(\d+)/i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
    return 0;
  }

  /**
   * Evaluate target value for ROF attacks
   * Higher score for targets that are:
   * - Near other enemies (multi-target potential)
   * - In open ground (no cover)
   * - Within optimal ROF range
   */
  private evaluateROFTargetValue(
    attacker: Character,
    primaryTarget: Character,
    context: AIContext,
    rofLevel: number
  ): number {
    const attackerPos = context.battlefield.getCharacterPosition(attacker);
    const primaryTargetPos = context.battlefield.getCharacterPosition(primaryTarget);
    if (!attackerPos || !primaryTargetPos) return 0;

    // Score ROF placement for this target
    const allCharacters = [attacker, primaryTarget, ...context.allies, ...context.enemies];
    const rofScore = scoreROFPlacement(
      attacker,
      context.battlefield,
      primaryTarget,
      rofLevel,
      allCharacters
    );

    let score = 0;

    // Bonus for multiple targets in ROF range
    score += rofScore.targetsInRange * 2;

    // Bonus for good ROF dice bonus
    score += rofScore.rofDiceBonus * 0.5;

    // Penalty for Friendly fire risk
    if (!rofScore.avoidsFriendlyFire) {
      score -= 5; // Strong penalty for Friendly fire risk
    }

    return Math.max(0, score);
  }

  /**
   * Evaluate position safety from ROF/Suppression
   * Lower score for positions in suppression zones or ROF kill zones
   */
  private evaluatePositionSafety(
    character: Character,
    position: Position,
    context: AIContext
  ): number {
    // Get suppression markers from battlefield state
    // TODO: Integrate with battlefield suppression marker tracking
    const suppressionMarkers: SuppressionMarker[] = [];
    const rofMarkers: ROFMarker[] = [];

    const safety = scorePositionSafety(
      character,
      context.battlefield,
      position,
      suppressionMarkers,
      rofMarkers
    );

    // Return safety score (higher = safer)
    return safety.score / 10; // Normalize to 0-1 range
  }

  /**
   * Evaluate suppression zone control for area denial
   * Higher score for zones that trap enemies
   */
  private evaluateSuppressionZoneControl(
    position: Position,
    context: AIContext
  ): number {
    // Get suppression markers from battlefield state
    // TODO: Integrate with battlefield suppression marker tracking
    const suppressionMarkers: SuppressionMarker[] = [];
    const allCharacters = [context.character, ...context.allies, ...context.enemies];

    const zoneScore = scoreSuppressionZone(
      context.battlefield,
      suppressionMarkers,
      position,
      allCharacters
    );

    // Score based on enemies trapped minus friendlies at risk
    return zoneScore.enemiesInZone * 2 - zoneScore.friendliesInZone * 3;
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

  private evaluateChargeOpportunity(
    context: AIContext,
    target: Character
  ): {
    canCharge: boolean;
    destination?: Position;
    travelDistance: number;
    remainingGap: number;
  } {
    const actorPos = context.battlefield.getCharacterPosition(context.character);
    const targetPos = context.battlefield.getCharacterPosition(target);
    if (!actorPos || !targetPos) {
      return { canCharge: false, travelDistance: 0, remainingGap: Number.POSITIVE_INFINITY };
    }
    if (context.battlefield.isEngaged?.(context.character)) {
      return { canCharge: false, travelDistance: 0, remainingGap: Number.POSITIVE_INFINITY };
    }

    const actorBase = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
    const targetBase = getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3);
    const dx = targetPos.x - actorPos.x;
    const dy = targetPos.y - actorPos.y;
    const centerDistance = Math.hypot(dx, dy);
    if (!Number.isFinite(centerDistance) || centerDistance <= 1e-6) {
      return { canCharge: false, travelDistance: 0, remainingGap: Number.POSITIVE_INFINITY };
    }

    const desiredCenterDistance = (actorBase + targetBase) / 2;
    const travelDistance = Math.max(0, centerDistance - desiredCenterDistance);
    if (travelDistance <= 0.05) {
      return { canCharge: false, travelDistance: 0, remainingGap: 0 };
    }

    const movementAllowance = this.estimateChargeMovementAllowance(context);
    if (travelDistance > movementAllowance + 0.25) {
      return {
        canCharge: false,
        travelDistance,
        remainingGap: Math.max(0, travelDistance - movementAllowance),
      };
    }

    const invDistance = 1 / centerDistance;
    const destination: Position = {
      x: targetPos.x - (dx * invDistance * desiredCenterDistance),
      y: targetPos.y - (dy * invDistance * desiredCenterDistance),
    };
    if (context.battlefield.isWithinBounds && !context.battlefield.isWithinBounds(destination, actorBase)) {
      return {
        canCharge: false,
        travelDistance,
        remainingGap: Math.max(0, travelDistance - movementAllowance),
      };
    }
    for (const model of [...context.allies, ...context.enemies]) {
      if (
        model.id === context.character.id ||
        model.id === target.id ||
        model.state.isKOd ||
        model.state.isEliminated
      ) {
        continue;
      }
      const modelPos = context.battlefield.getCharacterPosition(model);
      if (!modelPos) continue;
      const modelBase = getBaseDiameterFromSiz(model.finalAttributes.siz ?? model.attributes.siz ?? 3);
      const separation = Math.hypot(destination.x - modelPos.x, destination.y - modelPos.y);
      const minSeparation = ((actorBase + modelBase) / 2) - 1e-6;
      if (separation < minSeparation) {
        return {
          canCharge: false,
          travelDistance,
          remainingGap: Math.max(0, travelDistance - movementAllowance),
        };
      }
    }

    return { canCharge: true, destination, travelDistance, remainingGap: 0 };
  }

  private estimateChargeMovementAllowance(context: AIContext): number {
    const character = context.character;
    const baseMov = character.finalAttributes.mov ?? character.attributes.mov ?? 2;
    const sprintBonus = getSprintMovementBonus(
      character,
      true,
      Boolean(character.state.isAttentive),
      !Boolean(context.battlefield.isEngaged?.(character))
    );
    const leapBonus = getLeapAgilityBonus(character);
    return Math.max(0, baseMov + 2 + sprintBonus + leapBonus);
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

    const session = this.activeEvaluationSession;
    if (session) {
      const key = this.losPositionKey(fromPos, toPos);
      const cached = session.losPairCache.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const result = SpatialRules.hasLineOfSight(battlefield, fromModel, toModel);
      session.losPairCache.set(key, result);
      return result;
    }

    return SpatialRules.hasLineOfSight(battlefield, fromModel, toModel);
  }

  private hasLineOfSightBetweenPositions(from: Position, to: Position, context: AIContext): boolean {
    const session = this.getEvaluationSession(context);
    const key = this.losPositionKey(from, to);
    const cached = session.losPairCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = context.battlefield.hasLineOfSight(from, to);
    session.losPairCache.set(key, result);
    return result;
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

  private normalizeTraitName(trait: string): string {
    return String(trait).toLowerCase().replace(/\[|\]/g, '').trim();
  }

  private itemHasTrait(item: Item | undefined, traitName: string): boolean {
    if (!item || !Array.isArray(item.traits)) {
      return false;
    }
    const normalizedNeedle = this.normalizeTraitName(traitName);
    return item.traits.some(trait => this.normalizeTraitName(trait).includes(normalizedNeedle));
  }

  private hasChargeTraitMeleeWeapon(character: Character): boolean {
    return this.getMeleeWeapons(character).some(weapon => this.itemHasTrait(weapon, 'charge'));
  }

  private estimateMeleeAttackApCost(character: Character, engaged: boolean): number {
    const weapon = this.getMeleeWeapons(character)[0];
    if (!weapon) {
      return 1;
    }
    if (engaged && this.itemHasTrait(weapon, 'awkward')) {
      return 2;
    }
    return 1;
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

  private evaluateMeleeSetupValue(context: AIContext, candidatePosition: Position): number {
    const actorBase = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
    const currentPos = context.battlefield.getCharacterPosition(context.character);
    if (!currentPos) {
      return 0;
    }

    let bestValue = 0;
    for (const enemy of context.enemies) {
      if (!isAttackableEnemy(context.character, enemy, context.config)) {
        continue;
      }
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) {
        continue;
      }
      const enemyBase = getBaseDiameterFromSiz(enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3);
      const desiredDistance = (actorBase + enemyBase) / 2;
      const currentDistance = Math.hypot(currentPos.x - enemyPos.x, currentPos.y - enemyPos.y);
      const projectedDistance = Math.hypot(candidatePosition.x - enemyPos.x, candidatePosition.y - enemyPos.y);
      const currentGap = Math.max(0, currentDistance - desiredDistance);
      const projectedGap = Math.max(0, projectedDistance - desiredDistance);
      const gapReduction = Math.max(0, currentGap - projectedGap);

      let value = 0;
      if (projectedGap <= 0.15) {
        value = 1.15 + (gapReduction * 0.2);
      } else if (projectedGap <= 1) {
        value = (1 - projectedGap) * 0.7 + (gapReduction * 0.18);
      }
      if (value > bestValue) {
        bestValue = value;
      }
    }

    return Math.max(0, Math.min(1.6, bestValue));
  }

  private sampleStrategicPositions(context: AIContext, characterPos: Position): Position[] {
    const session = this.getEvaluationSession(context);
    if (session.strategicPathQueryBudget <= 0) {
      return [];
    }
    const gameSize = String(context.config.gameSize ?? '').toUpperCase();
    const fastStrategicPathing = gameSize === 'VERY_SMALL' || gameSize === 'SMALL';
    const mov = context.character.finalAttributes.mov ?? context.character.attributes.mov ?? 2;
    const movementAllowance = Math.max(1, mov + 2);
    const footprintDiameter = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? 3);
    const engine = session.pathEngine;
    type StrategicTarget = {
      source: 'enemy' | 'objective';
      index: number;
      position: Position;
      distance: number;
      sourcePriority: number;
    };
    type StrategicProbe = {
      source: 'enemy' | 'objective';
      index: number;
      targetPosition: Position;
      endpoint: Position;
      score: number;
      needsFineResolution: boolean;
      distanceToTarget: number;
    };

    const candidates: StrategicTarget[] = [];

    const candidateEnemies = context.enemies
      .map(enemy => {
        if (!isAttackableEnemy(context.character, enemy, context.config)) return null;
        // Keep strategic approach probes even without immediate LOS so dense boards
        // still produce directed advance toward known enemy positions.
        const enemyPos = context.battlefield.getCharacterPosition(enemy);
        if (!enemyPos) return null;
        return {
          position: enemyPos,
          distance: Math.hypot(characterPos.x - enemyPos.x, characterPos.y - enemyPos.y),
        };
      })
      .filter((entry): entry is { position: Position; distance: number } => Boolean(entry))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, session.strategicEnemyLimit);

    for (const enemy of candidateEnemies) {
      candidates.push({
        source: 'enemy',
        index: candidates.length,
        position: enemy.position,
        distance: enemy.distance,
        sourcePriority: 1.0,
      });
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
      .slice(0, session.strategicObjectiveLimit);

    for (const marker of objectiveMarkers) {
      const markerPos = marker.position as Position;
      const markerDistance = Math.hypot(characterPos.x - markerPos.x, characterPos.y - markerPos.y);
      candidates.push({
        source: 'objective',
        index: candidates.length,
        position: markerPos,
        distance: markerDistance,
        sourcePriority: 1.12,
      });
    }

    if (candidates.length === 0) {
      return [];
    }

    const reserveForRefinement = Math.min(session.strategicRefineTopK, session.strategicPathQueryBudget);
    const maxCoarseProbes = Math.max(1, session.strategicPathQueryBudget - reserveForRefinement);
    const coarseProbes: StrategicProbe[] = [];

    // R8: Use multi-goal pathfinding for 10+ candidates (shared search tree optimization)
    // For fewer candidates, individual queries are faster due to lower overhead
    const useMultiGoal = candidates.length >= 10;
    
    if (useMultiGoal) {
      // R8: Batch path query with shared search tree
      const multiGoalEngine = createMultiGoalPathfinding(context.battlefield);
      const candidatePositions = candidates.slice(0, maxCoarseProbes).map(c => c.position);
      
      const multiGoalOptions: MultiGoalPathOptions = {
        footprintDiameter,
        movementMetric: 'length',
        useNavMesh: !fastStrategicPathing,
        useHierarchical: !fastStrategicPathing,
        optimizeWithLOS: false,
        useTheta: false,
        turnPenalty: 0,
        portalNarrowPenalty: 0.08,
        portalNarrowThresholdFactor: 1.25,
        gridResolution: fastStrategicPathing ? 1.0 : session.strategicCoarseResolution,
        maxMu: movementAllowance,
        maxDestinations: maxCoarseProbes,
      };

      const multiResult = multiGoalEngine.findPathsToMultipleGoals(
        characterPos,
        candidatePositions,
        multiGoalOptions
      );

      // Convert multi-goal results to strategic probes
      for (let i = 0; i < candidatePositions.length && i < candidates.length; i++) {
        if (!this.tryConsumeStrategicPathBudget(session)) break;
        
        const candidate = candidates[i];
        const path = multiResult.destinations.get(
          `${candidate.position.x.toFixed(2)},${candidate.position.y.toFixed(2)}`
        );
        
        if (!path || path.points.length === 0) continue;
        
        const coarseEnd = path.points[path.points.length - 1];
        const distanceToTarget = Math.hypot(coarseEnd.x - candidate.position.x, coarseEnd.y - candidate.position.y);
        const progress = Math.max(0, candidate.distance - distanceToTarget) / Math.max(1, candidate.distance);
        const coarseTravelBase = Math.max(0.25, Math.min(candidate.distance, movementAllowance));
        const detourRatio = path.totalLength / coarseTravelBase;
        const needsFineResolution =
          detourRatio >= 1.35 ||
          (!path.reachedEnd && distanceToTarget > 1.25) ||
          (footprintDiameter <= 1.0 && detourRatio >= 1.18);
        const score =
          (progress * 1.8) +
          (candidate.sourcePriority * 0.6) +
          (path.reachedEnd ? 0.35 : 0) -
          (Math.max(0, detourRatio - 1.15) * 0.2);

        coarseProbes.push({
          source: candidate.source,
          index: candidate.index,
          targetPosition: candidate.position,
          endpoint: this.snapToBoardCell(coarseEnd, context.battlefield),
          score,
          needsFineResolution,
          distanceToTarget,
        });
      }
    } else {
      // Legacy: Individual path queries for 1-2 candidates
      for (let i = 0; i < candidates.length && i < maxCoarseProbes; i++) {
        const candidate = candidates[i];
        if (!this.tryConsumeStrategicPathBudget(session)) break;
        const coarse = engine.findPathWithMaxMu(
          characterPos,
          candidate.position,
          {
            footprintDiameter,
            movementMetric: 'length',
            useNavMesh: !fastStrategicPathing,
            useHierarchical: !fastStrategicPathing,
            optimizeWithLOS: false,
            useTheta: false,
            turnPenalty: 0,
            portalNarrowPenalty: 0.08,
            portalNarrowThresholdFactor: 1.25,
            gridResolution: fastStrategicPathing ? 1.0 : session.strategicCoarseResolution,
          },
          movementAllowance
        );
        const coarseEnd = coarse.points[coarse.points.length - 1];
        if (!coarseEnd) continue;

        const distanceToTarget = Math.hypot(coarseEnd.x - candidate.position.x, coarseEnd.y - candidate.position.y);
        const progress = Math.max(0, candidate.distance - distanceToTarget) / Math.max(1, candidate.distance);
        const coarseTravelBase = Math.max(0.25, Math.min(candidate.distance, movementAllowance));
        const detourRatio = coarse.totalLength / coarseTravelBase;
        const needsFineResolution =
          detourRatio >= 1.35 ||
          (!coarse.reachedEnd && distanceToTarget > 1.25) ||
          (footprintDiameter <= 1.0 && detourRatio >= 1.18);
        const score =
          (progress * 1.8) +
          (candidate.sourcePriority * 0.6) +
          (coarse.reachedEnd ? 0.35 : 0) -
          (Math.max(0, detourRatio - 1.15) * 0.2);

        coarseProbes.push({
          source: candidate.source,
          index: candidate.index,
          targetPosition: candidate.position,
          endpoint: this.snapToBoardCell(coarseEnd, context.battlefield),
          score,
          needsFineResolution,
          distanceToTarget,
        });
      }
    }

    if (coarseProbes.length === 0) {
      return [];
    }

    // Adaptive granularity:
    // - use coarse probes for broad ranking,
    // - refine only top-K trajectories with 0.5 MU default,
    // - escalate to 0.25 MU when coarse probe indicates chokepoint/clearance contention.
    const topForRefinement = coarseProbes
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.distanceToTarget !== b.distanceToTarget) return a.distanceToTarget - b.distanceToTarget;
        return a.index - b.index;
      });
    const probesForRefinement = fastStrategicPathing
      ? topForRefinement.slice(0, Math.min(1, session.strategicRefineTopK))
      : topForRefinement.slice(0, session.strategicRefineTopK);
    const refinedByIndex = new Map<number, Position>();

    for (const probe of probesForRefinement) {
      if (!this.tryConsumeStrategicPathBudget(session)) break;
      const refined = engine.findPathWithMaxMu(
        characterPos,
        probe.targetPosition,
        {
          footprintDiameter,
          movementMetric: 'length',
          useNavMesh: !fastStrategicPathing,
          useHierarchical: !fastStrategicPathing,
          optimizeWithLOS: !fastStrategicPathing,
          useTheta: !fastStrategicPathing,
          turnPenalty: fastStrategicPathing ? 0 : 0.1,
          portalNarrowPenalty: fastStrategicPathing ? 0.08 : 0.18,
          portalNarrowThresholdFactor: 1.35,
          gridResolution: fastStrategicPathing
            ? 0.75
            : (probe.needsFineResolution ? 0.25 : session.strategicDefaultResolution),
        },
        movementAllowance
      );
      const refinedEnd = refined.points[refined.points.length - 1];
      if (!refinedEnd) continue;
      refinedByIndex.set(probe.index, this.snapToBoardCell(refinedEnd, context.battlefield));
    }

    const refinedFirst = coarseProbes
      .slice()
      .sort((a, b) => a.index - b.index)
      .map(probe => refinedByIndex.get(probe.index) ?? probe.endpoint);
    return refinedFirst;
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
    const session = this.getEvaluationSession(context);
    const cacheKey = this.positionKey(position);
    const cached = session.nearestEnemyDistanceCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

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
    session.nearestEnemyDistanceCache.set(cacheKey, nearest);
    return nearest;
  }

  // ============================================================================
  // BONUS ACTION EVALUATION (Priority 1)
  // ============================================================================

  /**
   * Evaluate bonus action opportunities after a successful hit
   * Push-back, Pull-back, Rotate, Reversal for:
   * - Reducing outnumbering against self
   * - Increasing outnumbering against enemy
   * - Causing Delay tokens (push into walls/impassable)
   */
  private evaluateBonusActions(
    context: AIContext,
    target: Character,
    hitCascades: number,
    attackerPos?: Position
  ): { score: number; reason: string; bonusType?: string } {
    const battlefield = context.battlefield;
    const attacker = context.character;
    const attackerPosition = attackerPos ?? battlefield.getCharacterPosition(attacker);
    const targetPosition = battlefield.getCharacterPosition(target);

    if (!attackerPosition || !targetPosition) {
      return { score: 0, reason: 'No position data' };
    }

    // Count cascades available for bonus actions
    const availableCascades = hitCascades;
    if (availableCascades < 1) {
      return { score: 0, reason: 'No cascades available' };
    }

    let bestScore = 0;
    let bestReason = '';
    let bestBonusType = '';

    // 1. PUSH-BACK: Check if pushing target creates advantage
    const pushBackScore = this.evaluatePushBack(context, attacker, target, attackerPosition, targetPosition, availableCascades);
    if (pushBackScore.score > bestScore) {
      bestScore = pushBackScore.score;
      bestReason = pushBackScore.reason;
      bestBonusType = 'push-back';
    }

    // 2. PULL-BACK: Check if pulling target creates advantage
    const pullBackScore = this.evaluatePullBack(context, attacker, target, attackerPosition, targetPosition, availableCascades);
    if (pullBackScore.score > bestScore) {
      bestScore = pullBackScore.score;
      bestReason = pullBackScore.reason;
      bestBonusType = 'pull-back';
    }

    // 3. REVERSAL: Check if swapping positions creates advantage
    const reversalScore = this.evaluateReversal(context, attacker, target, attackerPosition, targetPosition, availableCascades);
    if (reversalScore.score > bestScore) {
      bestScore = reversalScore.score;
      bestReason = reversalScore.reason;
      bestBonusType = 'reversal';
    }

    return {
      score: bestScore,
      reason: bestReason,
      bonusType: bestBonusType || undefined,
    };
  }

  private evaluatePushBack(
    context: AIContext,
    attacker: Character,
    target: Character,
    attackerPos: Position,
    targetPos: Position,
    cascades: number
  ): { score: number; reason: string } {
    const battlefield = context.battlefield;
    const pushDistance = Math.floor(cascades / 2); // 1" per 2 cascades
    if (pushDistance < 1) {
      return { score: 0, reason: 'Not enough cascades' };
    }

    // Calculate push direction (away from attacker)
    const dx = targetPos.x - attackerPos.x;
    const dy = targetPos.y - attackerPos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const pushDir = { x: dx / dist, y: dy / dist };

    // Check where target would be pushed
    const newPos = {
      x: targetPos.x + pushDir.x * pushDistance,
      y: targetPos.y + pushDir.y * pushDistance,
    };

    let score = 0;
    const reasons: string[] = [];

    // 1. Check for Delay token (push into wall/impassable/precipice)
    const terrainAtNewPos = battlefield.getTerrainAt(newPos);
    if (terrainAtNewPos?.movement === 'Impassable' || terrainAtNewPos?.movement === 'Blocking') {
      score += 8; // High value for causing Delay
      reasons.push('Delay token (wall)');
    }

    // 2. Check if push reduces outnumbering against attacker
    const friendsBefore = this.countFriendlyInMeleeRange(context, attackerPos, 1.5);
    const enemiesBefore = this.countEnemyInMeleeRange(context, attackerPos, 1.5);
    const outnumberedBefore = enemiesBefore > friendsBefore;

    // After push, target is no longer in melee range
    const enemiesAfter = enemiesBefore - 1;
    const outnumberedAfter = enemiesAfter > friendsBefore;

    if (outnumberedBefore && !outnumberedAfter) {
      score += 6; // Good value for escaping outnumber
      reasons.push('Escape outnumber');
    }

    // 3. Check if push creates outnumbering against target
    const friendsNearNewPos = this.countFriendlyInMeleeRange(context, newPos, 1.5);
    const enemiesNearNewPos = this.countEnemyInMeleeRange(context, newPos, 1.5);
    const createsOutnumber = friendsNearNewPos > enemiesNearNewPos && enemiesNearNewPos > 0;

    if (createsOutnumber) {
      score += 5; // Good value for creating local advantage
      reasons.push('Create outnumber');
    }

    // 4. Check if push breaks engagement with other enemies
    const engagedBefore = battlefield.isEngaged?.(attacker) ?? false;
    // After push, target is no longer engaged with attacker
    if (engagedBefore && enemiesBefore === 1) {
      score += 3; // Moderate value for breaking engagement
      reasons.push('Break engagement');
    }

    return {
      score,
      reason: reasons.join(', ') || 'Push-back',
    };
  }

  private evaluatePullBack(
    context: AIContext,
    attacker: Character,
    target: Character,
    attackerPos: Position,
    targetPos: Position,
    cascades: number
  ): { score: number; reason: string } {
    const pullDistance = Math.floor(cascades / 2);
    if (pullDistance < 1) {
      return { score: 0, reason: 'Not enough cascades' };
    }

    // Pull toward attacker
    const dx = attackerPos.x - targetPos.x;
    const dy = attackerPos.y - targetPos.y;
    const dist = Math.hypot(dx, dy) || 1;
    const pullDir = { x: dx / dist, y: dy / dist };

    const newPos = {
      x: targetPos.x + pullDir.x * pullDistance,
      y: targetPos.y + pullDir.y * pullDistance,
    };

    let score = 0;
    const reasons: string[] = [];

    // Pull-back is valuable when it:
    // 1. Pulls enemy into our outnumbering zone
    const friendsNearNewPos = this.countFriendlyInMeleeRange(context, newPos, 1.5);
    const enemiesNearNewPos = this.countEnemyInMeleeRange(context, newPos, 1.5);
    const createsOutnumber = friendsNearNewPos > enemiesNearNewPos && enemiesNearNewPos > 0;

    if (createsOutnumber) {
      score += 6;
      reasons.push('Pull into outnumber');
    }

    // 2. Pulls enemy away from their support
    const friendsNearOldPos = this.countFriendlyInMeleeRange(context, targetPos, 1.5);
    if (friendsNearOldPos > friendsNearNewPos) {
      score += 3;
      reasons.push('Isolate from support');
    }

    return {
      score,
      reason: reasons.join(', ') || 'Pull-back',
    };
  }

  /**
   * Evaluate jump down attack opportunity
   * QSR: Jump down onto enemy to cause Falling Collision
   * - Falling character ignores one miss
   * - Target must make Falling Test (potential Stun damage)
   */
  private evaluateJumpDownAttack(
    context: AIContext,
    attacker: Character,
    target: Character,
    attackerPos: Position,
    targetPos: Position
  ): { score: number; reason: string; canJump: boolean } {
    const battlefield = context.battlefield;
    
    // Get terrain heights
    const attackerTerrain = battlefield.getTerrainAt(attackerPos);
    const targetTerrain = battlefield.getTerrainAt(targetPos);
    
    const attackerHeight = this.getTerrainHeight(attackerTerrain);
    const targetHeight = this.getTerrainHeight(targetTerrain);
    
    // Calculate fall distance
    const fallDistance = attackerHeight - targetHeight;
    
    // Can only jump down if attacker is higher
    if (fallDistance <= 0) {
      return { score: 0, reason: 'Not elevated', canJump: false };
    }
    
    // Calculate max jump range
    const maxJumpRange = this.calculateMaxJumpRange(attacker, false);
    
    // Check horizontal distance
    const horizontalDistance = Math.hypot(
      attackerPos.x - targetPos.x,
      attackerPos.y - targetPos.y
    );
    
    // For every 1 MU down, allow +0.5 MU across
    const maxAcrossFromFall = fallDistance * 0.5;
    const effectiveMaxJump = maxJumpRange + maxAcrossFromFall;
    
    // Check if jump is possible
    if (horizontalDistance > effectiveMaxJump) {
      return { score: 0, reason: 'Too far', canJump: false };
    }
    
    // Calculate expected damage to target
    const targetAgi = calculateAgility(target);
    const fallingResult = resolveFallingTest(target, fallDistance, targetAgi);
    const expectedStun = fallingResult.delayTokens;
    const expectedWound = fallingResult.woundAdded;
    
    // Calculate risk to self (also takes Falling Test, but ignores one miss)
    const attackerAgi = calculateAgility(attacker);
    const attackerFallingResult = resolveFallingTest(attacker, fallDistance, attackerAgi);
    const attackerRisk = Math.max(0, attackerFallingResult.delayTokens - 1); // Ignores one miss
    
    // Score calculation
    let score = 0;
    const reasons: string[] = [];
    
    // High value for eliminating weakened enemy
    const targetSiz = target.finalAttributes?.siz ?? target.attributes?.siz ?? 3;
    const targetWounds = target.state.wounds;
    if (expectedWound && targetWounds >= targetSiz - 1) {
      score += 15; // Very high value for potential elimination
      reasons.push('Eliminate weakened');
    } else if (expectedStun >= 2) {
      score += 8; // High value for significant Stun
      reasons.push(`${expectedStun} Stun`);
    } else if (expectedStun >= 1) {
      score += 4; // Moderate value for Stun
      reasons.push(`${expectedStun} Stun`);
    }
    
    // Subtract risk to self
    if (attackerRisk >= 2) {
      score -= 6; // High risk
      reasons.push(`High risk (${attackerRisk} Stun)`);
    } else if (attackerRisk >= 1) {
      score -= 3; // Moderate risk
      reasons.push(`Risk (${attackerRisk} Stun)`);
    }
    
    // Bonus for height advantage (tactical positioning)
    if (fallDistance >= 2) {
      score += 2;
      reasons.push('Height advantage');
    }
    
    return {
      score: Math.max(0, score),
      reason: reasons.join(', ') || 'Jump down',
      canJump: true,
    };
  }

  /**
   * Evaluate push off ledge opportunity
   * QSR: Push enemy off ledge to cause falling damage
   * - Target receives Delay token if resists falling
   * - Target makes Falling Test (potential Stun/Wounds)
   */
  private evaluatePushOffLedge(
    context: AIContext,
    attacker: Character,
    target: Character,
    attackerPos: Position,
    targetPos: Position,
    pushDirection: { x: number; y: number }
  ): { score: number; reason: string; canPush: boolean } {
    const battlefield = context.battlefield;
    
    // Calculate push destination
    const pushDistance = attacker.finalAttributes?.siz ?? 3; // Base push = SIZ
    const destPos = {
      x: targetPos.x + pushDirection.x * pushDistance,
      y: targetPos.y + pushDirection.y * pushDistance,
    };
    
    // Check if destination is off battlefield (Elimination!)
    if (this.isOffBattlefield(destPos, battlefield)) {
      return {
        score: 20, // Very high value for elimination
        reason: 'Push off battlefield (Elimination)',
        canPush: true,
      };
    }
    
    // Get terrain heights
    const targetTerrain = battlefield.getTerrainAt(targetPos);
    const destTerrain = battlefield.getTerrainAt(destPos);
    
    const targetHeight = this.getTerrainHeight(targetTerrain);
    const destHeight = this.getTerrainHeight(destTerrain);
    
    // Check if there's a height difference (ledge)
    const fallDistance = targetHeight - destHeight;
    
    if (fallDistance < 1.0) {
      return { score: 0, reason: 'No ledge', canPush: false };
    }
    
    // Calculate expected falling damage
    const targetAgi = calculateAgility(target);
    const fallingResult = resolveFallingTest(target, fallDistance, targetAgi);
    const expectedStun = fallingResult.delayTokens;
    const expectedWound = fallingResult.woundAdded;
    
    // Score calculation
    let score = 0;
    const reasons: string[] = [];
    
    // Delay token for falling (QSR: resists being pushed across ledge)
    score += 5;
    reasons.push('Delay token');
    
    // High value for eliminating weakened enemy
    const targetSiz = target.finalAttributes?.siz ?? target.attributes?.siz ?? 3;
    const targetWounds = target.state.wounds;
    if (expectedWound && targetWounds >= targetSiz - 1) {
      score += 15; // Very high value for potential elimination
      reasons.push('Eliminate weakened');
    } else if (expectedStun >= 2) {
      score += 8; // High value for significant Stun
      reasons.push(`${expectedStun} Stun`);
    } else if (expectedStun >= 1) {
      score += 4; // Moderate value for Stun
      reasons.push(`${expectedStun} Stun`);
    }
    
    // Bonus for significant fall
    if (fallDistance >= 3) {
      score += 3;
      reasons.push(`${fallDistance.toFixed(1)} MU fall`);
    }
    
    return {
      score: Math.max(0, score),
      reason: reasons.join(', ') || 'Push off ledge',
      canPush: true,
    };
  }

  /**
   * Calculate maximum jump range for a character
   * QSR: Jump range = Agility + Leap X bonus + Running bonus (if applicable)
   */
  private calculateMaxJumpRange(character: Character, hasRunningStart: boolean = false): number {
    const agility = calculateAgility(character);
    const leapBonus = getLeapAgilityBonus(character);
    
    // Running start bonus: +1 MU per 4 MU run (simplified: +2 MU if has running start)
    const runningBonus = hasRunningStart ? 2 : 0;
    
    return agility + leapBonus + runningBonus;
  }

  /**
   * Get terrain height from TerrainElement per OVR-003
   */
  private getTerrainHeight(terrain: any): number {
    if (!terrain || !terrain.name) return 0;
    const heightData = TERRAIN_HEIGHTS[terrain.name.toLowerCase()];
    return heightData?.height ?? 0;
  }

  /**
   * Check if position is off the battlefield
   */
  private isOffBattlefield(position: Position, battlefield: Battlefield): boolean {
    return position.x < 0 || position.x > battlefield.width ||
           position.y < 0 || position.y > battlefield.height;
  }

  /**
   * Evaluate gap crossing opportunity
   * QSR: Jump across gaps using Agility + Leap + Running bonus
   * - For every 1 MU down, +0.5 MU across
   * - Wall-to-wall jumps provide tactical advantage
   */
  private evaluateGapCrossing(
    context: AIContext,
    fromPos: Position,
    toPos: Position
  ): { score: number; reason: string; canCross: boolean } {
    const battlefield = context.battlefield;
    const character = context.character;
    
    // Detect gap between positions
    const gap = detectGapAlongLine(battlefield, fromPos, toPos);
    
    if (!gap || gap.width < 0.5) {
      return { score: 0, reason: 'No gap', canCross: false };
    }
    
    // Calculate jump capability
    const agility = calculateAgility(character);
    const leapBonus = getLeapAgilityBonus(character);
    
    // Downward jump bonus
    const fallDistance = gap.startHeight - gap.endHeight;
    const downwardBonus = fallDistance > 0 ? fallDistance * 0.5 : 0;
    
    const maxJumpRange = agility + leapBonus + downwardBonus;
    
    // Check if gap is crossable
    const canCross = gap.width <= maxJumpRange;
    
    if (!canCross) {
      return { score: 0, reason: `Gap too wide (${gap.width.toFixed(1)} MU)`, canCross: false };
    }
    
    // Score calculation
    let score = 0;
    const reasons: string[] = [];
    
    // Base value for crossing gap (tactical mobility)
    score += 3;
    reasons.push('Cross gap');
    
    // Wall-to-wall jump is tactically valuable (chokepoint control)
    if (gap.isWallToWall) {
      score += 4;
      reasons.push('Wall-to-wall');
    }
    
    // Height advantage bonus
    if (fallDistance >= 1) {
      score += 2;
      reasons.push(`${fallDistance.toFixed(1)} MU height`);
    }
    
    // Gap tactical value
    const tacticalValue = getGapTacticalValue(gap);
    score += tacticalValue;
    
    // Risk assessment (falling if failed)
    if (fallDistance >= 2) {
      score -= 2; // Risk penalty
      reasons.push('Risk');
    }
    
    return {
      score: Math.max(0, score),
      reason: reasons.join(', ') || 'Gap crossing',
      canCross: true,
    };
  }

  private evaluateReversal(
    context: AIContext,
    attacker: Character,
    target: Character,
    attackerPos: Position,
    targetPos: Position,
    cascades: number
  ): { score: number; reason: string } {
    // Reversal costs 2 cascades
    if (cascades < 2) {
      return { score: 0, reason: 'Need 2+ cascades' };
    }

    let score = 0;
    const reasons: string[] = [];

    // Reversal is valuable when it:
    // 1. Moves attacker out of enemy outnumbering
    const friendsAtOld = this.countFriendlyInMeleeRange(context, attackerPos, 1.5);
    const enemiesAtOld = this.countEnemyInMeleeRange(context, attackerPos, 1.5);
    const outnumberedAtOld = enemiesAtOld > friendsAtOld;

    const friendsAtNew = this.countFriendlyInMeleeRange(context, targetPos, 1.5);
    const enemiesAtNew = this.countEnemyInMeleeRange(context, targetPos, 1.5);
    const outnumberedAtNew = enemiesAtNew > friendsAtNew;

    if (outnumberedAtOld && !outnumberedAtNew) {
      score += 7;
      reasons.push('Escape outnumber');
    }

    // 2. Moves attacker into better position (cover, objective, etc.)
    const coverAtOld = this.evaluateCover(attackerPos, context);
    const coverAtNew = this.evaluateCover(targetPos, context);
    if (coverAtNew > coverAtOld) {
      score += 3;
      reasons.push('Better cover');
    }

    return {
      score,
      reason: reasons.join(', ') || 'Reversal',
    };
  }

  private countFriendlyInMeleeRange(context: AIContext, position: Position, range: number): number {
    const battlefield = context.battlefield;
    const mySideId = context.sideId;
    let count = 0;

    // Count allies in melee range
    for (const ally of context.allies) {
      if (ally.state.isEliminated || ally.state.isKOd) continue;
      const allyPos = battlefield.getCharacterPosition(ally);
      if (!allyPos) continue;
      const dist = Math.hypot(position.x - allyPos.x, position.y - allyPos.y);
      if (dist <= range) {
        count++;
      }
    }

    return count;
  }

  private countEnemyInMeleeRange(context: AIContext, position: Position, range: number): number {
    const battlefield = context.battlefield;
    const mySideId = context.sideId;
    let count = 0;

    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const dist = Math.hypot(position.x - enemyPos.x, position.y - enemyPos.y);
      if (dist <= range) {
        count++;
      }
    }

    return count;
  }

  /**
   * Priority 2: Evaluate outnumber advantage at a position
   * Returns positive score if position creates local outnumbering
   * Returns negative score if position puts model at disadvantage
   */
  private evaluateOutnumberAdvantage(position: Position, context: AIContext): number {
    const friends = this.countFriendlyInMeleeRange(context, position, 1.5);
    const enemies = this.countEnemyInMeleeRange(context, position, 1.5);

    // Calculate local ratio
    if (enemies === 0) {
      return 0; // No enemies nearby, no advantage
    }

    const ratio = friends / Math.max(1, enemies);

    if (ratio >= 2) {
      return 3; // Strong 2:1+ advantage
    } else if (ratio >= 1.5) {
      return 2; // Good advantage
    } else if (ratio >= 1) {
      return 1; // Slight advantage or equal
    } else if (ratio >= 0.5) {
      return -1; // Slightly outnumbered
    } else {
      return -3; // Badly outnumbered (1:2+ disadvantage)
    }
  }

  /**
   * Phase 3.2: Evaluate flanking position
   * Returns positive score if position provides flanking advantage
   * Flanking = position is on opposite side of enemy from allies
   */
  private evaluateFlankingPosition(position: Position, context: AIContext): number {
    let flankingScore = 0;

    // Find enemies within range of this position
    const enemiesInRange: Character[] = [];
    for (const enemy of context.enemies) {
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;
      const dist = Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y);
      if (dist <= 6) { // Within 6 MU
        enemiesInRange.push(enemy);
      }
    }

    if (enemiesInRange.length === 0) {
      return 0; // No enemies to flank
    }

    // For each enemy, check if this position provides flanking
    for (const enemy of enemiesInRange) {
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      // Find allies already engaging this enemy
      const alliesEngaging: Position[] = [];
      for (const ally of context.allies) {
        if (ally.id === context.character.id) continue; // Skip self
        if (ally.state.isKOd || ally.state.isEliminated) continue;
        
        const allyPos = context.battlefield.getCharacterPosition(ally);
        if (!allyPos) continue;
        
        const allyDist = Math.hypot(allyPos.x - enemyPos.x, allyPos.y - enemyPos.y);
        if (allyDist <= 1.5) { // Ally is in melee range
          alliesEngaging.push(allyPos);
        }
      }

      if (alliesEngaging.length > 0) {
        // Check if this position is on opposite side from allies
        for (const allyPos of alliesEngaging) {
          // Calculate angle from enemy to ally and from enemy to this position
          const allyAngle = Math.atan2(allyPos.y - enemyPos.y, allyPos.x - enemyPos.x);
          const thisAngle = Math.atan2(position.y - enemyPos.y, position.x - enemyPos.x);
          
          // Normalize angles to 0-2π
          const normalizeAngle = (angle: number) => angle < 0 ? angle + 2 * Math.PI : angle;
          const normalizedAllyAngle = normalizeAngle(allyAngle);
          const normalizedThisAngle = normalizeAngle(thisAngle);
          
          // Calculate angle difference
          let angleDiff = Math.abs(normalizedThisAngle - normalizedAllyAngle);
          if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
          }
          
          // If angle difference is > 90 degrees (π/2), it's a flanking position
          if (angleDiff > Math.PI / 2) {
            flankingScore += 2; // Good flanking position
          }
        }
      }
    }

    return Math.min(flankingScore, 6); // Cap at 6
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
    const session = this.getEvaluationSession(context);
    const cacheKey = this.positionKey(position);
    const cached = session.objectiveAdvanceCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

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
    session.objectiveAdvanceCache.set(cacheKey, bestAdvance);
    return bestAdvance;
  }

  /**
   * R2: Evaluate tactical conditions that favor Wait action
   * Returns bonus score to add to waitBaseline
   */
  private evaluateWaitTacticalConditions(
    context: AIContext,
    waitForecast: any,
    attackActions: ScoredAction[]
  ): number {
    let tacticalBonus = 0;

    // Condition 1: Enemy in LOS with low REF (high react success probability)
    // REF breakpoint is at 4+, so REF <= 2 means high success chance
    const lowRefEnemies = context.enemies.filter(enemy => {
      if (enemy.state.isEliminated || enemy.state.isKOd) return false;
      const enemyRef = enemy.finalAttributes.ref ?? enemy.attributes.ref ?? 2;
      return enemyRef <= 2;
    }).length;
    if (lowRefEnemies > 0) {
      tacticalBonus += lowRefEnemies * 0.6; // +0.6 per low-REF enemy
    }

    // Condition 2: Multiple enemies approaching (multi-trigger potential)
    // If expected trigger count is 2+, add bonus
    const expectedTriggers = waitForecast.expectedTriggerCount ?? 0;
    if (expectedTriggers >= 2) {
      tacticalBonus += (expectedTriggers - 1) * 0.4; // +0.4 for each trigger beyond first
    }

    // Condition 3: Holding chokepoint/zone (defensive value)
    // Check if character is near mission objective markers or zones
    const markers = this.getInteractableObjectiveMarkers(context);
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (characterPos) {
      const nearMarker = markers.some(marker => {
        if (!marker.position) return false;
        const dist = Math.hypot(
          characterPos.x - marker.position.x,
          characterPos.y - marker.position.y
        );
        return dist <= 4; // Within 4 MU of marker
      });
      if (nearMarker) {
        tacticalBonus += 0.8; // Defensive position bonus
      }
    }

    // Condition 4: Low AP remaining (Wait preserves future options)
    // If character has 0-1 AP, Wait is more valuable
    const apRemaining = context.apRemaining ?? 2;
    if (apRemaining <= 1) {
      tacticalBonus += (1 - apRemaining) * 0.5; // +0.5 at 0 AP, +0 at 2 AP
    }

    // Condition 5: Scoring context - leading and playing for time
    if (context.scoringContext?.amILeading && context.scoringContext.vpMargin >= 2) {
      tacticalBonus += 0.5; // Leading by 2+ VP, play defensively
    }

    // Condition 6: Scoring context - losing and need react opportunities
    if (!context.scoringContext?.amILeading &&
        context.scoringContext?.losingKeys?.includes('elimination')) {
      tacticalBonus += 0.4; // Behind on eliminations, need reactive opportunities
    }

    // R2.1: ZERO VP PENALTY - DISABLED (requires vpBySide in context, which causes hanging)
    // R2.2: HIDE ACTION PENALTY - REMOVED
    // Hide is a valid tactical choice; positional advantage comes from movement scoring

    // Cap total tactical bonus to prevent runaway scores
    // But allow negative values for zero VP penalty
    const maxBonus = 3.0;
    const minBonus = -2.0; // Allow penalty to go negative
    return Math.max(minBonus, Math.min(tacticalBonus, maxBonus));
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

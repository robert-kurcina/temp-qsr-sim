/**
 * Utility Scoring System
 *
 * Evaluates actions, positions, and targets using weighted factors.
 * Allows fine-tuning AI behavior without code changes.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { AIContext, AIControllerConfig, ActionDecision, ActionType } from './AIController';
import { isAttackableEnemy } from './ai-utils';
import { getMultipleWeaponsBonus, qualifiesForMultipleWeapons } from '../../traits/combat-traits';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { applyCombinedModifiersToActions } from '../stratagems/StratagemIntegration';
import { getEffectiveMovement, getThreatRange } from '../../traits/combat-traits';
import { VPPredictionCache, globalVPCache } from './VPPredictionCache';
import {
  getTacticallyRelevantEnemies,
  getCohesionAwareEnemies,
  evaluateThreatImmediacy,
  shouldSkipTargetEvaluation,
} from './TacticalHeuristics';
import { assessBestMeleeLegality } from '../shared/MeleeLegality';
import {
  getThreatLoadoutProfile,
} from '../shared/ThreatProfileSupport';
import {
  buildActionMaskCacheKey,
  computeActionLegalityMask,
  createEvaluationSession,
  hasCharacterLineOfSight,
  hasPositionLineOfSight,
  losPositionKey,
  positionKey,
  tryConsumeStrategicPathBudget,
  type ActionLegalityMask,
  type EvaluationSession,
} from './UtilityScorerSessionSupport';
import {
  evaluateActionFractionalScoring as evaluateActionFractionalScoringSupport,
  evaluateEnemyOutOfPlayPressure as evaluateEnemyOutOfPlayPressureSupport,
  computeConditionalSurvivalFactor as computeConditionalSurvivalFactorSupport,
  computeFractionalScoringPotential as computeFractionalScoringPotentialSupport,
  evaluateTargetVPRPPressure as evaluateTargetVPRPPressureSupport,
  evaluateSelfOutOfPlayRiskPenalty as evaluateSelfOutOfPlayRiskPenaltySupport,
  type ActionFractionalScoringBreakdown,
  type FractionalScoringPotential,
  type TargetVPRPPressureBreakdown,
} from './UtilityScorerPressureSupport';
import {
  countEnemySightLinesToPosition as countEnemySightLinesToPositionSupport,
  evaluateCoverAtPosition as evaluateCoverAtPositionSupport,
  evaluateExposureRiskAtPosition as evaluateExposureRiskAtPositionSupport,
  evaluateLeanOpportunityAtPosition as evaluateLeanOpportunityAtPositionSupport,
  evaluatePositionSafetyFromROF as evaluatePositionSafetyFromROFSupport,
  evaluateSuppressionZoneControlAtPosition as evaluateSuppressionZoneControlAtPositionSupport,
  evaluateThreatReliefAtPosition as evaluateThreatReliefAtPositionSupport,
  isNearCoverEdge as isNearCoverEdgeSupport,
} from './UtilityScorerPositionSupport';
import {
  appendAuxiliaryActions,
  applyModifiersAndAppendTempoActions,
  applyEliminationApproachPressure,
  buildAttackActions,
  buildMoveActions,
  buildWaitAction,
  evaluateSupportActionCandidates,
  evaluateWeaponSwapActionCandidates,
  finalizeActionScores,
} from './UtilityScorerActionSupport';
import {
  buildAllyTargetCounts,
  evaluateJumpDownBonusScore,
  evaluateMissionPriorityScore,
  evaluatePrioritizedTargets,
  evaluateROFTargetValueScore,
  evaluateSingleTargetScore,
  evaluateTargetDistanceScore,
  evaluateTargetHealthScore,
  evaluateTargetThreatScore,
  resolveSingleTargetPosition,
} from './UtilityScorerTargetSupport';
import {
  isRangedTargetInRange as isRangedTargetInRangeSupport,
  evaluateChargeOpportunity as evaluateChargeOpportunitySupport,
  evaluateRangedOpportunity as evaluateRangedOpportunitySupport,
} from './UtilityScorerCombatSupport';
import {
  countEnemyInMeleeRange as countEnemyInMeleeRangeSupport,
  countFriendlyInMeleeRange as countFriendlyInMeleeRangeSupport,
  evaluateFlankingPosition as evaluateFlankingPositionSupport,
  evaluateOutnumberAdvantage as evaluateOutnumberAdvantageSupport,
  estimateMeleeAttackApCost as estimateMeleeAttackApCostSupport,
  getMeleeWeapons as getMeleeWeaponsSupport,
  hasChargeTraitMeleeWeapon as hasChargeTraitMeleeWeaponSupport,
} from './UtilityScorerMeleeSupport';
import {
  evaluateBonusActions as evaluateBonusActionsSupport,
  evaluateGapCrossing as evaluateGapCrossingSupport,
  evaluateJumpDownAttack as evaluateJumpDownAttackSupport,
  evaluatePushOffLedge as evaluatePushOffLedgeSupport,
} from './UtilityScorerBonusActionSupport';
import {
  evaluateObjectiveAdvance as evaluateObjectiveAdvanceSupport,
  evaluateObjectiveMarkerActions as evaluateObjectiveMarkerActionsSupport,
  getInteractableObjectiveMarkers as getInteractableObjectiveMarkersSupport,
} from './UtilityScorerObjectiveSupport';
import {
  dedupePositions as dedupePositionsSupport,
  sampleStrategicPositions as sampleStrategicPositionsSupport,
  snapToBoardCell as snapToBoardCellSupport,
} from './UtilityScorerStrategicPathSupport';
import {
  getDoctrineEngagement as getDoctrineEngagementSupport,
  getDoctrinePlanning as getDoctrinePlanningSupport,
  getMissionBias as getMissionBiasSupport,
  type MissionBias,
} from './UtilityScorerDoctrineSupport';
import { evaluateWaitTacticalConditions as evaluateWaitTacticalConditionsSupport } from './UtilityScorerWaitSupport';
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
    return buildActionMaskCacheKey(context, loadout, characterPos);
  }

  private computeActionLegalityMask(
    context: AIContext,
    loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean }
  ): ActionLegalityMask {
    return computeActionLegalityMask(
      context,
      loadout,
      (from, to) => this.isInMeleeRange(from, to, context.battlefield)
    );
  }

  private createEvaluationSession(context: AIContext): EvaluationSession {
    return createEvaluationSession(context);
  }

  private getEvaluationSession(context: AIContext): EvaluationSession {
    return this.activeEvaluationSession ?? this.createEvaluationSession(context);
  }

  private positionKey(position: Position): string {
    return positionKey(position);
  }

  private losPositionKey(a: Position, b: Position): string {
    return losPositionKey(a, b);
  }

  private tryConsumeStrategicPathBudget(session: EvaluationSession): boolean {
    return tryConsumeStrategicPathBudget(session);
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
      const meleeWeapons = this.getMeleeWeapons(context.character);
      attackActions.push(
        ...buildAttackActions({
          context,
          attackTargets,
          canCloseCombat: actionMask.canCloseCombat,
          canMove: actionMask.canMove,
          canRangedCombat: actionMask.canRangedCombat,
          loadout,
          doctrinePlanning,
          doctrineEngagement,
          objectiveActionPressure: missionBias.objectiveActionPressure,
          attackPressure: missionBias.attackPressure,
          characterPos,
          isFreeAtStart,
          canAffordImmediateMeleeAttack,
          canAffordImmediateChargeAttack,
          engagedMeleeAttackApCost,
          hasChargeTraitMeleeWeapon,
          assessMeleeLegality: (target, isFreeAtStartValue) =>
            assessBestMeleeLegality(context.character, target, context.battlefield, {
              weapons: meleeWeapons,
              isFirstAction: true,
              isFreeAtStart: isFreeAtStartValue,
            }),
          evaluateBonusActions: (target, attackerPosition) =>
            this.evaluateBonusActions(context, target, 2, attackerPosition),
          evaluateChargeOpportunity: target => this.evaluateChargeOpportunity(context, target),
          evaluateRangedOpportunity: target => this.evaluateRangedOpportunity(context, target),
          countFriendlyInMeleeRange: (position, range) =>
            this.countFriendlyInMeleeRange(context, position, range),
          countEnemyInMeleeRange: (position, range) =>
            this.countEnemyInMeleeRange(context, position, range),
          qualifiesForMultipleWeapons: isMelee =>
            qualifiesForMultipleWeapons(context.character, isMelee),
          getMultipleWeaponsBonus: isMelee =>
            getMultipleWeaponsBonus(context.character, 0, isMelee),
        })
      );

      const survivalFactor = this.computeConditionalSurvivalFactor(context);

      // Evaluate movement actions
      const movePositions = actionMask.canMove ? this.evaluatePositions(context, survivalFactor) : [];
      const moveBuild = buildMoveActions({
        context,
        canMove: actionMask.canMove,
        movePositions,
        attackActions,
        loadout,
        doctrinePlanning,
        doctrineEngagement,
        movePressure: missionBias.movePressure,
        objectiveActionPressure: missionBias.objectiveActionPressure,
        characterPos,
        canAffordImmediateChargeAttack,
        survivalFactor,
        strategicPathBudgetExceeded: session.pathBudgetExceeded,
        isCharacterEngaged: () => Boolean(context.battlefield.isEngaged?.(context.character)),
        evaluateObjectiveAdvance: position => this.evaluateObjectiveAdvance(position, context),
        evaluateApproachProgress: (from, to) => this.evaluateApproachProgress(from, to, context),
        evaluateMeleeSetupValue: position => this.evaluateMeleeSetupValue(context, position),
        distanceToClosestAttackableEnemy: position =>
          this.distanceToClosestAttackableEnemy(position, context),
        countEnemySightLinesToPosition: position =>
          this.countEnemySightLinesToPosition(position, context),
      });
      const nearestEnemyDistance = moveBuild.nearestEnemyDistance;
      actions.push(...moveBuild.moveActions);
      actions.push(...attackActions);
      appendAuxiliaryActions({
        actions,
        canDisengage: actionMask.canDisengage,
        canSupport: actionMask.canSupport,
        canWeaponSwap: actionMask.canWeaponSwap,
        isCharacterEngaged: () => Boolean(context.battlefield.isEngaged?.(context.character)),
        evaluateObjectiveActions: () =>
          this.evaluateObjectiveMarkerActions(context, missionBias, doctrinePlanning),
        shouldDisengage: () => this.shouldDisengage(context),
        getEngagedEnemies: () => this.getEngagedEnemies(context.character, context.battlefield),
        createDisengageAction: enemy => ({
          action: 'disengage',
          target: enemy,
          score: 3.0 + context.config.aggression,
          factors: { survival: 3.0 },
        }),
        evaluateSupportActions: () => this.evaluateSupportActions(context),
        evaluateWeaponSwapActions: () => this.evaluateWeaponSwap(context),
      });

      const waitAction = buildWaitAction({
        context,
        canWait: actionMask.canWait,
        attackActions,
        moveActions: actions.filter(candidate => candidate.action === 'move'),
        moveCandidatePositions: movePositions.slice(0, 3).map(candidate => candidate.position),
        loadout,
        doctrinePlanning,
        waitPressure: missionBias.waitPressure,
        objectiveActionPressure: missionBias.objectiveActionPressure,
        evaluateWaitTacticalConditions: (waitForecast, scoredAttackActions) =>
          this.evaluateWaitTacticalConditions(context, waitForecast, scoredAttackActions),
      });
      if (waitAction) {
        actions.push(waitAction);
      }

      applyEliminationApproachPressure(
        actions,
        attackActions.length,
        nearestEnemyDistance,
        context.config.missionId
      );

      // Sort by score
      actions.sort((a, b) => b.score - a.score);

      let finalActions = applyModifiersAndAppendTempoActions({
        actions,
        context,
        canPush: actionMask.canPushing,
        canRefresh: actionMask.canRefresh,
        loadout,
        hasChargeTraitMeleeWeapon,
        candidateEnemyCount: actionMask.candidateEnemyIds.length,
        characterPos,
        applyCombinedModifiers: (candidateActions, stratagemModifiers, scoringModifiers) =>
          applyCombinedModifiersToActions(candidateActions, stratagemModifiers, scoringModifiers),
        evaluateCoverAtPosition: position => this.evaluateCover(position, context),
        countEnemyInMeleeRange: (position, range) => this.countEnemyInMeleeRange(context, position, range),
        countFriendlyInMeleeRange: (position, range) => this.countFriendlyInMeleeRange(context, position, range),
        getInteractableObjectiveMarkerCount: () => this.getInteractableObjectiveMarkers(context).length,
        canChargeAnyEnemy: () => context.enemies.some(enemy =>
          isAttackableEnemy(context.character, enemy, context.config) &&
          this.evaluateChargeOpportunity(context, enemy).canCharge
        ),
      });

      finalActions = finalizeActionScores({
        actions: finalActions,
        context,
        fractionalPotential: this.computeFractionalScoringPotential(context),
        evaluateActionFractionalScoring: (action, scoringPotential) =>
          this.evaluateActionFractionalScoring(action, scoringPotential),
      });

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
    const characterPos = context.battlefield.getCharacterPosition(context.character);
    if (!characterPos) return [];

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
    const allyTargetCounts = buildAllyTargetCounts({
      context,
      relevantEnemies,
      getCharacterPosition: character => context.battlefield.getCharacterPosition(character),
    });
    return evaluatePrioritizedTargets({
      context,
      cohesionAware,
      shouldSkipTargetEvaluation: (enemy, scopedContext, threshold) =>
        shouldSkipTargetEvaluation(enemy, scopedContext as any, threshold),
      evaluateSingleTarget: (enemy, currentBestScore) =>
        this.evaluateSingleTarget(
          enemy,
          context as any,
          characterPos,
          rofLevel,
          allyTargetCounts,
          currentBestScore,
          selfOutOfPlayRiskPenalty,
          scoringPotential
        ),
    });
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
    const enemyPos = resolveSingleTargetPosition({
      attacker: context.character,
      enemy,
      context,
      isAttackableEnemy,
      getCharacterPosition: target => context.battlefield.getCharacterPosition(target),
    });
    if (!enemyPos) return null;

    const evaluation = evaluateSingleTargetScore({
      enemy,
      context,
      characterPos,
      enemyPos,
      rofLevel,
      allyTargetCounts,
      selfOutOfPlayRiskPenalty,
      scoringPotential,
      weights: {
        targetHealth: this.weights.targetHealth,
        targetThreat: this.weights.targetThreat,
        distanceToTarget: this.weights.distanceToTarget,
        victoryConditionValue: this.weights.victoryConditionValue,
      },
      evaluateTargetHealth: target => evaluateTargetHealthScore(target),
      evaluateTargetThreat: target => evaluateTargetThreatScore(target),
      evaluateTargetDistance: (from, to) => evaluateTargetDistanceScore(from, to),
      hasLOS: target => this.hasLOS(context.character, target, context.battlefield),
      evaluateMissionPriority: (target, scopedContext) =>
        evaluateMissionPriorityScore(target, scopedContext, this.getMissionBias(scopedContext)),
      evaluateROFTargetValue: (target, scopedContext, scopedRofLevel) =>
        evaluateROFTargetValueScore(scopedContext.character, target, scopedContext, scopedRofLevel),
      evaluateJumpDownBonus: (target, fromPos, toPos, scopedContext) =>
        evaluateJumpDownBonusScore(this.evaluateJumpDownAttack(
          scopedContext,
          scopedContext.character,
          target,
          fromPos,
          toPos
        )),
      evaluateEnemyOutOfPlayPressure: target => this.evaluateEnemyOutOfPlayPressure(target),
      evaluateTargetVPRPPressure: (target, scopedContext, scopedScoringPotential) =>
        this.evaluateTargetVPRPPressure(target, scopedContext, scopedScoringPotential),
      evaluateThreatImmediacy: (target, fromPos, scopedContext) =>
        evaluateThreatImmediacy(target, fromPos, scopedContext as any),
    });

    return {
      target: enemy,
      score: evaluation.score,
      factors: evaluation.factors as any,
    };
  }

  private evaluateEnemyOutOfPlayPressure(enemy: Character): number {
    const enemyBp = this.getModelBPValue(enemy);
    return evaluateEnemyOutOfPlayPressureSupport(enemy, enemyBp);
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
    return evaluateTargetVPRPPressureSupport(enemy, enemyBp, maxEnemyBp, scoringPotential);
  }

  private evaluateActionFractionalScoring(
    action: ScoredAction,
    scoringPotential: FractionalScoringPotential
  ): ActionFractionalScoringBreakdown {
    return evaluateActionFractionalScoringSupport(action, scoringPotential);
  }

  private computeFractionalScoringPotential(context: AIContext): FractionalScoringPotential {
    return computeFractionalScoringPotentialSupport(context);
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  private evaluateSelfOutOfPlayRiskPenalty(context: AIContext, characterPos: Position): number {
    const selfBp = this.getModelBPValue(context.character);
    const exposureCount = this.countEnemySightLinesToPosition(characterPos, context);
    return evaluateSelfOutOfPlayRiskPenaltySupport(context, selfBp, exposureCount);
  }

  private computeConditionalSurvivalFactor(context: AIContext): number {
    return computeConditionalSurvivalFactorSupport(context);
  }

  /**
   * Evaluate support actions (rally, revive, etc.)
   */
  evaluateSupportActions(context: AIContext): ScoredAction[] {
    return evaluateSupportActionCandidates({ context });
  }

  /**
   * Evaluate weapon swap actions (stow/unstow items)
   * QSR Lines 270-271: Use Fiddle action to switch out stowed items
   */
  evaluateWeaponSwap(context: AIContext): ScoredAction[] {
    return evaluateWeaponSwapActionCandidates({ context });
  }

  // ============================================================================
  // Evaluation Helpers
  // ============================================================================

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
    return evaluateCoverAtPositionSupport({
      context,
      position,
      session,
      positionKey: candidate => this.positionKey(candidate),
      hasLineOfSightBetweenPositions: (from, to) => this.hasLineOfSightBetweenPositions(from, to, context),
      getLoadoutProfile: character => this.getLoadoutProfile(character),
    });
  }

  /**
   * R3: Evaluate lean opportunity at position
   * Returns score for positions with partial cover that allow shooting
   */
  private evaluateLeanOpportunity(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    return evaluateLeanOpportunityAtPositionSupport({
      context,
      position,
      session,
      positionKey: candidate => this.positionKey(candidate),
      hasLineOfSightBetweenPositions: (from, to) => this.hasLineOfSightBetweenPositions(from, to, context),
      getLoadoutProfile: character => this.getLoadoutProfile(character),
      isNearCoverEdge: (candidate, scopedContext) => this.isNearCoverEdge(candidate, scopedContext),
    });
  }

  /**
   * R3: Check if position is near cover edge (within 1 MU)
   */
  private isNearCoverEdge(position: Position, context: AIContext): boolean {
    return isNearCoverEdgeSupport(
      position,
      context,
      (from, to) => this.hasLineOfSightBetweenPositions(from, to, context)
    );
  }

  /**
   * R3: Evaluate exposure risk at position
   * Returns score based on how many enemies can see this position
   */
  private evaluateExposureRisk(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    return evaluateExposureRiskAtPositionSupport({
      context,
      position,
      session,
      positionKey: candidate => this.positionKey(candidate),
      hasLineOfSightBetweenPositions: (from, to) => this.hasLineOfSightBetweenPositions(from, to, context),
    });
  }

  private evaluateThreatRelief(position: Position, context: AIContext): number {
    const currentPos = context.battlefield.getCharacterPosition(context.character);
    if (!currentPos) return 0;
    return evaluateThreatReliefAtPositionSupport(
      position,
      currentPos,
      candidate => this.countEnemySightLinesToPosition(candidate, context)
    );
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
    return countEnemySightLinesToPositionSupport({
      context,
      position,
      session,
      positionKey: candidate => this.positionKey(candidate),
      hasLineOfSightBetweenPositions: (from, to) => this.hasLineOfSightBetweenPositions(from, to, context),
    });
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
   * Evaluate position safety from ROF/Suppression
   * Lower score for positions in suppression zones or ROF kill zones
   */
  private evaluatePositionSafety(
    character: Character,
    position: Position,
    context: AIContext
  ): number {
    return evaluatePositionSafetyFromROFSupport({
      character,
      position,
      context,
    });
  }

  /**
   * Evaluate suppression zone control for area denial
   * Higher score for zones that trap enemies
   */
  private evaluateSuppressionZoneControl(
    position: Position,
    context: AIContext
  ): number {
    return evaluateSuppressionZoneControlAtPositionSupport(position, context);
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
    return evaluateChargeOpportunitySupport(context, target);
  }

  private isInRange(
    from: Character,
    to: Character,
    battlefield: Battlefield,
    config: AIControllerConfig = { aggression: 0.5, caution: 0.5, accuracyModifier: 0, godMode: true }
  ): boolean {
    return isRangedTargetInRangeSupport(
      from,
      to,
      battlefield,
      config,
      (fromModel, toModel, scopedBattlefield) => this.hasLOS(fromModel, toModel, scopedBattlefield)
    );
  }

  private hasLOS(from: Character, to: Character, battlefield: Battlefield): boolean {
    return hasCharacterLineOfSight(
      from,
      to,
      battlefield,
      this.activeEvaluationSession,
      (a, b) => this.losPositionKey(a, b)
    );
  }

  private hasLineOfSightBetweenPositions(from: Position, to: Position, context: AIContext): boolean {
    const session = this.getEvaluationSession(context);
    return hasPositionLineOfSight(
      from,
      to,
      context.battlefield,
      session,
      (a, b) => this.losPositionKey(a, b)
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
    return evaluateRangedOpportunitySupport(
      context,
      target,
      (from, to, battlefield) => this.hasLOS(from, to, battlefield)
    );
  }

  private getMeleeWeapons(character: Character) {
    return getMeleeWeaponsSupport(character);
  }

  private hasChargeTraitMeleeWeapon(character: Character): boolean {
    return hasChargeTraitMeleeWeaponSupport(character);
  }

  private estimateMeleeAttackApCost(character: Character, engaged: boolean): number {
    return estimateMeleeAttackApCostSupport(character, engaged);
  }

  private getLoadoutProfile(character: Character): { hasMeleeWeapons: boolean; hasRangedWeapons: boolean } {
    return getThreatLoadoutProfile(character);
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
    return sampleStrategicPositionsSupport(
      context,
      characterPos,
      this.getEvaluationSession(context),
      scopedContext => this.getInteractableObjectiveMarkers(scopedContext),
      session => this.tryConsumeStrategicPathBudget(session)
    );
  }

  private snapToBoardCell(position: Position, battlefield: Battlefield): Position {
    return snapToBoardCellSupport(position, battlefield);
  }

  private dedupePositions(positions: Position[], battlefield: Battlefield): Position[] {
    return dedupePositionsSupport(positions, battlefield);
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
    return evaluateBonusActionsSupport(
      context,
      target,
      hitCascades,
      attackerPos,
      {
        countFriendlyInMeleeRange: (position, range) =>
          this.countFriendlyInMeleeRange(context, position, range),
        countEnemyInMeleeRange: (position, range) =>
          this.countEnemyInMeleeRange(context, position, range),
        evaluateCover: position => this.evaluateCover(position, context),
      }
    );
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
    return evaluateJumpDownAttackSupport(context, attacker, target, attackerPos, targetPos);
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
    return evaluatePushOffLedgeSupport(
      context,
      attacker,
      target,
      attackerPos,
      targetPos,
      pushDirection
    );
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
    return evaluateGapCrossingSupport(context, fromPos, toPos);
  }

  private countFriendlyInMeleeRange(context: AIContext, position: Position, range: number): number {
    return countFriendlyInMeleeRangeSupport(context, position, range);
  }

  private countEnemyInMeleeRange(context: AIContext, position: Position, range: number): number {
    return countEnemyInMeleeRangeSupport(context, position, range);
  }

  /**
   * Priority 2: Evaluate outnumber advantage at a position
   * Returns positive score if position creates local outnumbering
   * Returns negative score if position puts model at disadvantage
   */
  private evaluateOutnumberAdvantage(position: Position, context: AIContext): number {
    return evaluateOutnumberAdvantageSupport(position, context);
  }

  /**
   * Phase 3.2: Evaluate flanking position
   * Returns positive score if position provides flanking advantage
   * Flanking = position is on opposite side of enemy from allies
   */
  private evaluateFlankingPosition(position: Position, context: AIContext): number {
    return evaluateFlankingPositionSupport(position, context);
  }

  private evaluateObjectiveMarkerActions(
    context: AIContext,
    missionBias: MissionBias,
    doctrinePlanning: 'aggression' | 'keys_to_victory' | 'balanced'
  ): ScoredAction[] {
    return evaluateObjectiveMarkerActionsSupport(context, missionBias, doctrinePlanning);
  }

  private getInteractableObjectiveMarkers(context: AIContext): NonNullable<AIContext['objectiveMarkers']> {
    return getInteractableObjectiveMarkersSupport(context);
  }

  private evaluateObjectiveAdvance(position: Position, context: AIContext): number {
    const session = this.getEvaluationSession(context);
    return evaluateObjectiveAdvanceSupport(
      position,
      context,
      session.objectiveAdvanceCache,
      scopedPosition => this.positionKey(scopedPosition)
    );
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
    void attackActions;
    return evaluateWaitTacticalConditionsSupport(
      context,
      waitForecast,
      this.getInteractableObjectiveMarkers(context)
    );
  }

  private getDoctrinePlanning(context: AIContext): 'aggression' | 'keys_to_victory' | 'balanced' {
    return getDoctrinePlanningSupport(context);
  }

  private getDoctrineEngagement(
    context: AIContext,
    loadout: { hasMeleeWeapons: boolean; hasRangedWeapons: boolean }
  ): 'melee' | 'ranged' | 'balanced' {
    return getDoctrineEngagementSupport(context, loadout);
  }

  private getMissionBias(context: AIContext): MissionBias {
    return getMissionBiasSupport(context);
  }
}

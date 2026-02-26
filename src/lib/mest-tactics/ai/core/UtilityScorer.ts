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
import { forecastWaitReact, rolloutWaitReactBranches } from '../tactical/GOAP';
import { calculateStratagemModifiers, TacticalDoctrine } from '../stratagems/AIStratagems';
import { buildScoringContext, calculateScoringModifiers, combineModifiers } from '../stratagems/PredictedScoringIntegration';
import { applyCombinedModifiersToActions } from '../stratagems/StratagemIntegration';

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

/**
 * Utility Scorer class
 */
export class UtilityScorer {
  weights: UtilityWeights;
  private activeEvaluationSession: EvaluationSession | null = null;

  constructor(weights: Partial<UtilityWeights> = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Update weights
   */
  setWeights(weights: Partial<UtilityWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  private createEvaluationSession(context: AIContext): EvaluationSession {
    const boardArea = context.battlefield.width * context.battlefield.height;
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

    strategicEnemyLimit = Math.max(2, Math.min(strategicEnemyLimit, Math.max(2, attackableEnemyCount)));

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
        actions.push({
          action: 'move',
          position: pos.position,
          score:
            pos.score * moveMultiplier +
            advanceBonus +
            (missionBias.objectiveActionPressure * pos.factors.visibility * 0.35) +
            (objectiveAdvance * objectiveAdvanceWeight) +
            (goapFutureWaitValue * goapFutureWaitWeight),
          factors: {
            ...pos.factors,
            moveMultiplier,
            advanceBonus,
            objectiveAdvance,
            objectiveAdvanceWeight,
            goapFutureWaitValue,
            goapFutureWaitWeight,
            goapExposureReduction: exposureReduction,
            strategicPathBudgetExceeded: session.pathBudgetExceeded ? 1 : 0,
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

        // R2: Tactical Condition Weighting for Wait Uptake
        // Add multipliers when specific tactical conditions favor Wait
        const waitTacticalBonus = this.evaluateWaitTacticalConditions(context, waitForecast, attackActions);

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
        const opponentVP = context.enemySides?.reduce((max, side) => 
          Math.max(max, side.state?.victoryPoints ?? 0), 0) ?? 0;
        const vpDeficit = Math.max(0, opponentVP - sideVP);
        const rpDeficit = Math.max(0, (context.enemySides?.reduce((max, side) => 
          Math.max(max, side.state?.resourcePoints ?? 0), 0) ?? 0) - sideRP);
        
        // If behind on VP/RP, reduce Wait preference to encourage action
        if (vpDeficit > 0 || rpDeficit > 0) {
          const pursuitPenalty = (vpDeficit + rpDeficit) * 2; // -2 per VP/RP behind
          waitTacticalBonus = Math.max(-5, waitTacticalBonus - pursuitPenalty);
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
          context.scoringContext.opponentKeyScores
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

      return finalActions;
    } finally {
      this.activeEvaluationSession = previousSession;
    }
  }

  /**
   * Evaluate positions for movement
   */
  evaluatePositions(context: AIContext): ScoredPosition[] {
    const positions: ScoredPosition[] = [];
    const session = this.getEvaluationSession(context);
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
    const localSamples = this.samplePositions(characterPos, sampleRadius, session.localSampleCount);
    const strategicSamples = this.sampleStrategicPositions(context, characterPos);
    const samples = this.dedupePositions([...localSamples, ...strategicSamples], context.battlefield);

    // R3: Get loadout for doctrine-aware scoring
    const loadout = this.getLoadoutProfile(context.character);
    const isRanged = loadout.hasRangedWeapons && !loadout.hasMeleeWeapons;
    const isMelee = loadout.hasMeleeWeapons && !loadout.hasRangedWeapons;

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

      // R3: Add lean opportunity and exposure risk evaluation
      const leanOpportunity = isRanged ? this.evaluateLeanOpportunity(pos, context) : 0;
      const exposureRisk = this.evaluateExposureRisk(pos, context);

      // Priority 2: Outnumber-aware positioning
      // Score positions that create local outnumbering advantage
      const outnumberScore = this.evaluateOutnumberAdvantage(pos, context);

      // R3: Doctrine-aware scoring weights
      const coverWeight = this.weights.coverValue * (isRanged ? 1.3 : 1.0);
      const leanWeight = isRanged ? 1.5 : 0; // Only ranged models benefit from lean
      const exposurePenalty = isRanged ? 1.8 : 1.2; // Ranged models more exposed = bad

      const score =
        cover * coverWeight +
        distanceScore * this.weights.distanceToTarget +
        threatRelief * (1.5 + this.weights.riskAvoidance) +
        visibility * 0.5 +
        cohesion * this.weights.cohesionValue +
        (leanOpportunity * leanWeight) -
        (exposureRisk * exposurePenalty) +
        (outnumberScore * 2.0); // Strong weight for outnumber advantage

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
        },
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
    const session = this.getEvaluationSession(context);
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
        if (context.config.perCharacterFovLos && !this.hasLOS(context.character, enemy, context.battlefield)) {
          return null;
        }
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

    for (let i = 0; i < candidates.length && i < maxCoarseProbes; i++) {
      const candidate = candidates[i];
      if (!this.tryConsumeStrategicPathBudget(session)) break;
      const coarse = engine.findPathWithMaxMu(
        characterPos,
        candidate.position,
        {
          footprintDiameter,
          movementMetric: 'length',
          useNavMesh: true,
          useHierarchical: true,
          optimizeWithLOS: false,
          useTheta: false,
          turnPenalty: 0,
          portalNarrowPenalty: 0.08,
          portalNarrowThresholdFactor: 1.25,
          gridResolution: session.strategicCoarseResolution,
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
      })
      .slice(0, session.strategicRefineTopK);
    const refinedByIndex = new Map<number, Position>();

    for (const probe of topForRefinement) {
      if (!this.tryConsumeStrategicPathBudget(session)) break;
      const refined = engine.findPathWithMaxMu(
        characterPos,
        probe.targetPosition,
        {
          footprintDiameter,
          movementMetric: 'length',
          useNavMesh: true,
          useHierarchical: true,
          optimizeWithLOS: true,
          useTheta: true,
          turnPenalty: 0.1,
          portalNarrowPenalty: 0.18,
          portalNarrowThresholdFactor: 1.35,
          gridResolution: probe.needsFineResolution ? 0.25 : session.strategicDefaultResolution,
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

    for (const side of context.allSides || []) {
      if (side.id !== mySideId) continue;
      for (const member of side.members) {
        if (member.character.state.isEliminated || member.character.state.isKOd) continue;
        const memberPos = battlefield.getCharacterPosition(member.character);
        if (!memberPos) continue;
        const dist = Math.hypot(position.x - memberPos.x, position.y - memberPos.y);
        if (dist <= range) {
          count++;
        }
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

    // R2.1: ZERO VP PENALTY - Discourage excessive Wait in Elimination mission
    // As turns progress with 0 VP, reduce Wait bonus to encourage action
    const missionId = context.config.missionId;
    const currentTurn = context.currentTurn ?? 1;
    const sideVP = context.side?.state.victoryPoints ?? 0;
    const sideRP = context.side?.state.resourcePoints ?? 0;

    if (missionId === 'QAI_11' && (sideVP === 0 && sideRP === 0) && currentTurn >= 3) {
      // Turn 3+: -0.5 per turn with zero VP
      // Turn 5+: -1.0 per turn with zero VP (desperation mode)
      const zeroVpPenalty = currentTurn >= 5 ? 1.0 : 0.5;
      const turnsAtZero = currentTurn - 2; // Starts counting at turn 3
      tacticalBonus -= zeroVpPenalty * turnsAtZero;
    }

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

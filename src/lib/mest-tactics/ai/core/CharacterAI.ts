/**
 * Character AI - Base Implementation
 *
 * Combines Behavior Tree, HFSM, Utility Scoring, and Knowledge Base
 * to create a complete character-level AI controller.
 *
 * Phase 2 Additions:
 * - Tactical Patterns for coordinated squad behavior
 * - GOAP for multi-turn planning
 */

import {
  IAIController,
  AIContext,
  AIResult,
  ActionDecision,
  CharacterKnowledge,
  AIControllerConfig,
  DEFAULT_AI_CONFIG,
  validateAIConfig,
  ActionType,
} from './AIController';
import { isAttackableEnemy } from './ai-utils';
import { BehaviorTree, SelectorNode, SequenceNode, ConditionNode, ActionNode, NodeStatus } from './BehaviorTree';
import { FSM, createCharacterFSM, StateStatus } from './HierarchicalFSM';
import { UtilityScorer, ScoredAction } from './UtilityScorer';
import { KnowledgeBase, KnowledgeConfig } from './KnowledgeBase';
import { Character } from '../../core/Character';
import type { Item } from '../../core/Item';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import {
  PatternRecognizer,
  PatternRegistry,
  createDefaultPatternRegistry,
  PatternMatch,
} from '../tactical/TacticalPatterns';
import {
  GOAPPlanner,
  createDefaultGOAPPlanner,
  GOAPGoal,
  ActionPlan,
  StandardGoals,
} from '../tactical/GOAP';
import {
  BonusActionEvaluator,
  StealthEvaluator,
} from '../tactical/ReactsAndBonusActions';
import { evaluateRangeWithVisibility, parseWeaponOptimalRangeMu } from '../../utils/visibility';
import {
  ReactEvaluator as ReactEvaluatorQSR,
  ReactConfig,
  DEFAULT_REACT_CONFIG,
} from '../tactical/ReactsQSR';
import type { ReactOpportunity, ReactResult } from '../tactical/ReactsQSR';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { getSprintMovementBonus, getLeapAgilityBonus } from '../../traits/combat-traits';
import { calculateSuddenDeathTimePressure } from './TurnHorizon';
import {
  buildMinimaxHeuristicCacheKey,
  buildMinimaxTranspositionKey,
  type MinimaxCacheKeyDeps,
} from './MinimaxCacheKey';
import {
  getCharacterThreatItems,
  getRangedThreatWeapons,
  hasMeleeThreatProfile as hasSharedMeleeThreatProfile,
  hasRangedThreatProfile as hasSharedRangedThreatProfile,
} from '../shared/ThreatProfileSupport';

/**
 * Character AI configuration
 */
export interface CharacterAIConfig {
  ai: AIControllerConfig;
  knowledge: KnowledgeConfig;
  /** Enable tactical patterns */
  enablePatterns: boolean;
  /** Enable GOAP planning */
  enableGOAP: boolean;
  /** GOAP planning depth */
  goapDepth: number;
}

/**
 * Default Character AI configuration
 */
export const DEFAULT_CHARACTER_AI_CONFIG: CharacterAIConfig = {
  ai: DEFAULT_AI_CONFIG,
  knowledge: {
    godMode: true,
    memoryDuration: 3,
    visionRange: 1.0,
  },
  enablePatterns: true, // Re-enable patterns - issue is elsewhere
  enableGOAP: false, // Disabled by default - can cause infinite recursion in edge cases
  goapDepth: 4,
};

interface MinimaxLiteNodeEvaluation {
  nodeValue: number;
  opponentReplyPressure: number;
  followUpPotential: number;
  patchControlDelta: number;
  simulatedStateDelta: number;
  currentPatch: TacticalPatchCategory;
  projectedPatch: TacticalPatchCategory;
  cacheHit: boolean;
}

interface MinimaxLiteCacheEntry {
  nodeValue: number;
  opponentReplyPressure: number;
  followUpPotential: number;
  patchControlDelta: number;
  simulatedStateDelta: number;
}

interface MinimaxLiteCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  nodeEvaluations: number;
  patchTransitions: Record<string, number>;
  patchGraph: {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    neighborhoodGraphSize: number;
    neighborhoodGraphMaxSize: number;
    neighborhoodGraphHits: number;
    neighborhoodGraphMisses: number;
    neighborhoodGraphHitRate: number;
    neighborhoodGraphEvictions: number;
  };
}

type AttackOpportunityGrade = NonNullable<
  NonNullable<AIResult['debug']>['decisionTelemetry']
>['attackOpportunityGrade'];

type CoordinatorDirectiveSnapshot = NonNullable<
  NonNullable<AIResult['debug']>['decisionTelemetry']
>['coordinatorDirective'];

type DecisionTelemetrySnapshot = NonNullable<
  NonNullable<AIResult['debug']>['decisionTelemetry']
>;

interface AttackGateDecision {
  shouldApply: boolean;
  reason?: string;
}

type TacticalPatchCategory =
  | 'friendly_dominant'
  | 'enemy_dominant'
  | 'contested'
  | 'scrum'
  | 'objective'
  | 'lane_dominant'
  | 'solo';

interface TacticalPatchSnapshot {
  category: TacticalPatchCategory;
  friendlyBp: number;
  enemyBp: number;
  objectiveDistance: number;
  lanePressure: number;
  supportBalance: number;
  adjacencyControl: number;
  laneThreatScore: number;
  scrumPressure: number;
  objectiveProgress: number;
}

interface PatchGraphModelEntry {
  side: 'friendly' | 'enemy';
  position: Position;
  bp: number;
  hasRanged: boolean;
}

interface PatchGraphBucket {
  key: string;
  bucketX: number;
  bucketY: number;
  entries: PatchGraphModelEntry[];
  neighborKeys: string[];
}

interface TacticalPatchNeighborhoodGraph {
  bucketSize: number;
  buckets: Map<string, PatchGraphBucket>;
  objectivePoints: Position[];
}

interface MinimaxSimulationModel {
  id: string;
  side: 'friendly' | 'enemy';
  position: Position | null;
  wounds: number;
  mov: number;
  siz: number;
  bp: number;
  isKOd: boolean;
  isEliminated: boolean;
  isHidden: boolean;
  hasMelee: boolean;
  hasRanged: boolean;
}

interface MinimaxSimulationState {
  actorId: string;
  actorPosition: Position;
  models: Map<string, MinimaxSimulationModel>;
  outOfPlayBpDelta: number;
  woundBpDelta: number;
  vpDelta: number;
  rpDelta: number;
}

/**
 * Character AI Controller
 *
 * Main AI controller for individual characters.
 */
export class CharacterAI implements IAIController {
  config: AIControllerConfig;
  private utilityScorer: UtilityScorer;
  private knowledgeBase: KnowledgeBase;
  private behaviorTree?: BehaviorTree;
  private fsm?: FSM;
  
  // Phase 2: Tactical layer
  private patternRegistry: PatternRegistry;
  private patternRecognizer: PatternRecognizer;
  private goapPlanner: GOAPPlanner;
  private enablePatterns: boolean;
  private enableGOAP: boolean;
  
  // Reacts, Bonus Actions, Stealth
  private reactEvaluator: ReactEvaluatorQSR;
  private bonusActionEvaluator: BonusActionEvaluator;
  private stealthEvaluator: StealthEvaluator;
  private readonly minimaxLiteCache = new Map<string, MinimaxLiteCacheEntry>();
  private readonly minimaxLiteHeuristicCache = new Map<string, MinimaxLiteCacheEntry>();
  private minimaxLiteCacheHits = 0;
  private minimaxLiteCacheMisses = 0;
  private minimaxLiteNodeEvaluations = 0;
  private minimaxLitePatchTransitions = new Map<string, number>();
  private readonly minimaxLiteCacheMaxSize = 2048;
  private readonly minimaxLiteHeuristicCacheMaxSize = 1024;
  private readonly patchGraphCache = new Map<string, TacticalPatchSnapshot>();
  private patchGraphCacheHits = 0;
  private patchGraphCacheMisses = 0;
  private patchGraphCacheEvictions = 0;
  private readonly patchGraphCacheMaxSize = 4096;
  private readonly patchNeighborhoodGraphCache = new Map<string, TacticalPatchNeighborhoodGraph>();
  private patchNeighborhoodGraphCacheHits = 0;
  private patchNeighborhoodGraphCacheMisses = 0;
  private patchNeighborhoodGraphCacheEvictions = 0;
  private readonly patchNeighborhoodGraphCacheMaxSize = 256;
  private readonly patchGraphStateKeyByContext = new WeakMap<object, string>();
  private readonly minimaxCacheKeyDeps: MinimaxCacheKeyDeps = {
    hasMeleeThreatProfile: (character: Character) => this.hasMeleeThreatProfile(character),
    hasRangedThreatProfile: (character: Character) => this.hasRangedThreatProfile(character),
    hashCompactState: (raw: string) => this.hashCompactState(raw),
  };

  constructor(config: Partial<CharacterAIConfig> = {}) {
    const fullConfig = {
      ...DEFAULT_CHARACTER_AI_CONFIG,
      ...config,
      ai: { ...DEFAULT_AI_CONFIG, ...config.ai },
      knowledge: { ...DEFAULT_CHARACTER_AI_CONFIG.knowledge, ...config.knowledge },
    };

    this.config = validateAIConfig(fullConfig.ai);
    this.enablePatterns = fullConfig.enablePatterns;
    this.enableGOAP = fullConfig.enableGOAP;
    
    this.utilityScorer = new UtilityScorer({
      aggression: this.config.aggression,
      riskAvoidance: this.config.caution,
    });
    this.knowledgeBase = new KnowledgeBase(fullConfig.knowledge);
    
    // Initialize tactical layer
    this.patternRegistry = createDefaultPatternRegistry();
    this.patternRecognizer = new PatternRecognizer(this.patternRegistry);
    this.goapPlanner = createDefaultGOAPPlanner(fullConfig.goapDepth);
    
    // Initialize reacts, bonus actions, stealth
    const reactConfig: ReactConfig = {
      ...DEFAULT_REACT_CONFIG,
      aggression: this.config.aggression,
      caution: this.config.caution,
    };
    this.reactEvaluator = new ReactEvaluatorQSR(reactConfig);
    this.bonusActionEvaluator = new BonusActionEvaluator();
    this.stealthEvaluator = new StealthEvaluator();

    this.initializeBehaviorTree();
    this.fsm = createCharacterFSM();
  }

  /**
   * Initialize the behavior tree
   */
  private initializeBehaviorTree(): void {
    // Create behavior tree for decision making
    const root = new SelectorNode('Root', [
      // Emergency behaviors (highest priority)
      new SequenceNode('Emergency', [
        new ConditionNode('IsDisordered', (ctx) => ctx.character.state.fearTokens >= 2),
        new ActionNode('CompulsoryAction', (ctx) => this.decideCompulsoryAction(ctx)),
      ]),

      // Combat behaviors
      new SequenceNode('Combat', [
        new ConditionNode('HasVisibleEnemy', (ctx) => this.hasVisibleEnemy(ctx)),
        new SelectorNode('CombatChoice', [
          // Disengage if engaged and disadvantaged
          new SequenceNode('Disengage', [
            new ConditionNode('IsEngaged', (ctx) => ctx.battlefield.isEngaged?.(ctx.character)),
            new ConditionNode('ShouldDisengage', (ctx) => this.shouldDisengage(ctx)),
            new ActionNode('Disengage', (ctx) => this.decideDisengage(ctx)),
          ]),
          // Melee attack if in range
          new SequenceNode('Melee', [
            new ConditionNode('InMeleeRange', (ctx) => this.isInMeleeRange(ctx)),
            new ActionNode('Attack', (ctx) => this.decideMeleeAttack(ctx)),
          ]),
          // Ranged attack if in range
          new SequenceNode('Ranged', [
            new ConditionNode('InRange', (ctx) => this.isInRange(ctx)),
            new ActionNode('Attack', (ctx) => this.decideRangedAttack(ctx)),
          ]),
          // Otherwise move toward enemy
          new ActionNode('Advance', (ctx) => this.decideAdvance(ctx)),
        ]),
      ]),

      // Support behaviors
      new SequenceNode('Support', [
        new ConditionNode('NeedsSupport', (ctx) => this.needsSupport(ctx)),
        new ActionNode('Support', (ctx) => this.decideSupport(ctx)),
      ]),

      // Default behavior
      new ActionNode('Hold', (ctx) => this.decideHold(ctx)),
    ]);

    this.behaviorTree = new BehaviorTree(root);
  }

  /**
   * Decide the best action for this character
   * 
   * Decision hierarchy:
   * 1. Tactical Patterns (if enabled) - coordinated squad behavior
   * 2. GOAP Planning (if enabled) - multi-turn planning for goals
   * 3. Utility Scoring - tactical evaluation
   * 4. Behavior Tree - fallback decision making
   */
  decideAction(context: AIContext): AIResult {
    // Reuse pre-updated knowledge for this turn when provided by the caller.
    const existingKnowledge = context.knowledge;
    const knowledge = existingKnowledge && existingKnowledge.lastUpdated === context.currentTurn
      ? existingKnowledge
      : this.knowledgeBase.updateKnowledge(
        context.character,
        context.allies,
        context.enemies,
        context.battlefield,
        context.currentTurn
      );
    context.knowledge = knowledge;

    // Phase 2: Try tactical patterns first (coordinated behavior)
    if (this.enablePatterns) {
      const patternMatch = this.patternRecognizer.getBestMatch(context);
      if (patternMatch && patternMatch.actions.length > 0) {
        const action = patternMatch.actions[0];
        if (this.isActionTypeAllowed(context, action.type)) {
          return {
            decision: {
              ...action,
              planning: {
                source: 'pattern',
              },
            },
            debug: {
              consideredActions: [patternMatch.pattern.name],
              scores: { [patternMatch.pattern.name]: patternMatch.confidence },
              actionAvailability: { [action.type]: 1 },
              reasoning: `Tactical pattern: ${patternMatch.pattern.name} (confidence: ${patternMatch.confidence.toFixed(2)})`,
            },
          };
        }
      }
    }

    // Phase 2: Try GOAP planning for goal-oriented behavior
    if (this.enableGOAP) {
      const plan = this.planWithGOAP(context);
      if (plan && plan.actions.length > 0) {
        const action = this.goapActionToDecision(plan.actions[0], context);
        if (this.isActionTypeAllowed(context, action.type)) {
          return {
            decision: action,
            debug: {
              consideredActions: plan.actions.map(a => a.name),
              scores: { plan: plan.successProbability },
              actionAvailability: { [action.type]: 1 },
              reasoning: `GOAP plan: ${plan.actions.length} actions (success: ${(plan.successProbability * 100).toFixed(0)}%)`,
            },
          };
        }
      }
    }

    // Evaluate utility once, then optionally re-rank with bounded minimax-lite lookahead.
    const utilityActions = this.utilityScorer.evaluateActions(context);
    const rerankedActions = this.config.enableMinimaxLite
      ? this.applyMinimaxLiteRerank(context, utilityActions)
      : utilityActions;
    const scoredActions = this.filterLegallyExecutableScoredActions(context, rerankedActions);
    const bestAction = scoredActions[0];

    const visibleEnemies = context.enemies.filter(e => !e.state.isHidden);
    const allEnemiesHidden = visibleEnemies.length === 0 && context.enemies.length > 0;
    const bestCombatAction = scoredActions.find(action =>
      action.action === 'close_combat' || action.action === 'ranged_combat' || action.action === 'charge'
    );
    const bestPassiveAction = scoredActions.find(action => this.isPassiveActionType(action.action));
    const coordinatorDirective = this.extractCoordinatorDirective(context);
    const attackOpportunityGrade = this.classifyAttackOpportunity(scoredActions, visibleEnemies);
    const attackGateDecision = this.shouldApplyAttackGate(
      attackOpportunityGrade,
      coordinatorDirective,
      bestCombatAction,
      bestPassiveAction
    );
    const buildDecisionTelemetry = (
      selectedAction: ActionType,
      selectedScore: number
    ): DecisionTelemetrySnapshot => ({
      attackOpportunityGrade,
      coordinatorDirective,
      selectedAction,
      selectedScore: Number.isFinite(selectedScore) ? selectedScore : 0,
      bestAttackAction: bestCombatAction?.action,
      bestAttackScore: bestCombatAction?.score,
      bestPassiveAction: bestPassiveAction?.action,
      bestPassiveScore: bestPassiveAction?.score,
      attackGateApplied: attackGateDecision.shouldApply,
      attackGateReason: attackGateDecision.reason,
    });
    const bestScore = bestAction?.score ?? 0;
    const bestCombatScore = bestCombatAction?.score ?? 0;
    const utilityCombatPriority =
      Boolean(bestCombatAction)
      && visibleEnemies.length > 0
      && bestCombatScore >= 1.8
      && (
        bestAction?.action === 'close_combat'
        || bestAction?.action === 'ranged_combat'
        || bestAction?.action === 'charge'
        || bestCombatScore >= bestScore * 0.72
      );
    const shouldPrioritizeCombat = utilityCombatPriority || attackGateDecision.shouldApply;

    // Phase 2: Check stealth opportunities only when no enemies are currently visible.
    if (!shouldPrioritizeCombat && !attackGateDecision.shouldApply && visibleEnemies.length === 0 && (context.config.allowHideAction ?? true)) {
      const hideDecision = this.evaluateHide(context);
      if (hideDecision.shouldHide) {
        return {
          decision: {
            type: 'hide',
            reason: hideDecision.reason,
            planning: {
              source: 'utility',
            },
            priority: hideDecision.priority ?? 3.0,
            requiresAP: true,
          },
          debug: {
            consideredActions: ['hide'],
            scores: { hide: hideDecision.priority ?? 3.0 },
            actionAvailability: { hide: 1 },
            reasoning: hideDecision.reason,
            decisionTelemetry: buildDecisionTelemetry('hide', hideDecision.priority ?? 3.0),
          },
        };
      }

      const detectDecision = this.evaluateDetect(context);
      if (detectDecision.shouldDetect) {
        return {
          decision: {
            type: 'detect',
            target: detectDecision.targets[0],
            reason: detectDecision.reason ?? 'Detect hidden enemies',
            planning: {
              source: 'utility',
            },
            priority: detectDecision.priority ?? 2.5,
            requiresAP: true,
          },
          debug: {
            consideredActions: ['detect'],
            scores: { detect: detectDecision.priority ?? 2.5 },
            actionAvailability: { detect: 1 },
            reasoning: detectDecision.reason ?? 'Detect hidden enemies',
            decisionTelemetry: buildDecisionTelemetry('detect', detectDecision.priority ?? 2.5),
          },
        };
      }
    }

    // === FORCE MOVEMENT WHEN NO VISIBLE ENEMIES ===
    // When all enemies are Hidden, force movement toward enemy zone

    if (allEnemiesHidden) {
      const charPos = context.battlefield.getCharacterPosition(context.character);
      if (charPos) {
        const battlefieldWidth = context.battlefield.width ?? 24;
        const battlefieldHeight = context.battlefield.height ?? 24;
        const isLeftDeployment = charPos.x < battlefieldWidth / 2;
        const enemyZoneX = isLeftDeployment ? battlefieldWidth - 2 : 2;

        const dx = enemyZoneX - charPos.x;
        const dy = (battlefieldHeight / 2) - charPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.0) {
          const moveDist = Math.min(2, dist);
          const targetX = charPos.x + (dx / dist) * moveDist;
          const targetY = charPos.y + (dy / dist) * moveDist;

          return {
            decision: {
              type: 'move',
              position: { x: targetX, y: targetY },
              reason: 'Move toward enemy zone (all enemies Hidden)',
              planning: { source: 'tactical' },
              priority: 3.5,
              requiresAP: true,
            },
            debug: {
              consideredActions: ['move'],
              scores: { move: 3.5 },
              actionAvailability: { move: 1 },
              reasoning: 'Forced movement: all enemies Hidden',
              decisionTelemetry: buildDecisionTelemetry('move', 3.5),
            },
          };
        }
      }
    }
    // === END FORCE MOVEMENT ===

    const selectedAction = (shouldPrioritizeCombat && bestCombatAction) ? bestCombatAction : bestAction;

    if (!selectedAction || selectedAction.score <= 0) {
      return {
        decision: {
          type: 'hold',
          reason: 'No valid actions',
          priority: 0,
          requiresAP: false,
        },
        debug: {
          consideredActions: [],
          scores: {},
          actionAvailability: {},
          reasoning: 'No valid actions available',
          decisionTelemetry: buildDecisionTelemetry('hold', 0),
        },
      };
    }

    const decisionReason = attackGateDecision.shouldApply
      ? `Attack gate (${attackGateDecision.reason ?? 'directive_attack_window'}): ${this.formatDecisionReason(selectedAction)}`
      : utilityCombatPriority
        ? `Combat priority: ${this.formatDecisionReason(selectedAction)}`
        : this.formatDecisionReason(selectedAction);

    const decision: ActionDecision = {
      type: selectedAction.action,
      target: selectedAction.target,
      position: selectedAction.position,
      objectiveAction: selectedAction.objectiveAction,
      markerId: selectedAction.markerId,
      markerTargetModelId: selectedAction.markerTargetModelId,
      reason: decisionReason,
      planning: this.inferPlanningMetadata(selectedAction),
      priority: selectedAction.score,
      requiresAP: this.actionRequiresAP(selectedAction.action),
    };

    return {
      decision,
      debug: {
        consideredActions: scoredActions.slice(0, 5).map(a => a.action),
        scores: Object.fromEntries(
          scoredActions.slice(0, 5).map(a => [a.action, a.score])
        ),
        actionAvailability: scoredActions.reduce<Record<string, number>>((availability, action) => {
          availability[action.action] = (availability[action.action] ?? 0) + 1;
          return availability;
        }, {}),
        reasoning: decision.reason,
        decisionTelemetry: buildDecisionTelemetry(decision.type, selectedAction.score),
      },
    };
  }

  /**
   * Evaluate react opportunities (QSR p.1115-1119)
   */
  evaluateReact(
    context: AIContext,
    opportunity: import('./AIController').ReactOpportunity
  ): import('./AIController').ReactResult {
    // Use QSR-compliant ReactEvaluator
    return this.reactEvaluator.evaluateReacts(
      context.character,
      opportunity as any,
      context,
      false // isReactingToReact
    ) as any;
  }

  /**
   * Start new initiative (resets react state)
   */
  startNewInitiative(initiativeNumber: number): void {
    this.reactEvaluator.startNewInitiative(initiativeNumber);
  }

  /**
   * Start new action (resets side react tracking)
   */
  startNewAction(): void {
    this.reactEvaluator.startNewAction();
  }

  /**
   * Mark character as having reacted
   */
  markReacted(character: Character, context: AIContext): void {
    this.reactEvaluator.markReacted(character, context);
  }

  /**
   * Evaluate bonus actions after successful attack
   */
  evaluateBonusActions(
    character: Character,
    target: Character,
    cascades: number,
    context: AIContext
  ): import('../tactical/ReactsAndBonusActions').BonusActionDecision {
    return this.bonusActionEvaluator.evaluateBonusActions(
      character,
      target,
      cascades,
      context
    );
  }

  /**
   * Evaluate whether to Hide
   */
  evaluateHide(context: AIContext): import('../tactical/ReactsAndBonusActions').HideDecision {
    return this.stealthEvaluator.evaluateHide(context);
  }

  /**
   * Evaluate whether to Detect
   */
  evaluateDetect(context: AIContext): import('../tactical/ReactsAndBonusActions').DetectDecision {
    return this.stealthEvaluator.evaluateDetect(context);
  }

  /**
   * Update character knowledge
   */
  updateKnowledge(context: AIContext): CharacterKnowledge {
    return this.knowledgeBase.updateKnowledge(
      context.character,
      context.allies,
      context.enemies,
      context.battlefield,
      context.currentTurn
    );
  }

  // ============================================================================
  // Phase 2: GOAP Integration
  // ============================================================================

  /**
   * Plan actions using GOAP
   */
  private planWithGOAP(context: AIContext): ActionPlan | null {
    // Determine current goal based on situation
    const goal = this.determineGOAPGoal(context);
    if (!goal) return null;

    return this.goapPlanner.plan(goal, context);
  }

  /**
   * Determine current GOAP goal based on situation
   */
  private determineGOAPGoal(context: AIContext): GOAPGoal | null {
    // Priority-based goal selection

    // Urgent: Survive if low health
    if (context.character.state.wounds >= (context.character.finalAttributes.siz ?? 3) - 1) {
      return StandardGoals.Survive;
    }

    // Urgent: Disengage if engaged and disadvantaged
    if (context.battlefield.isEngaged?.(context.character) && this.shouldDisengage(context)) {
      return StandardGoals.DisengageCombat;
    }

    // Important: Protect allies
    if (context.allies.some(a => a.state.isKOd || a.state.wounds > 0)) {
      return StandardGoals.ProtectAlly;
    }

    // Default: Eliminate enemies
    if (context.enemies.some(e => isAttackableEnemy(context.character, e, context.config))) {
      return StandardGoals.EliminateEnemies;
    }

    return null;
  }

  /**
   * Convert GOAP action to ActionDecision
   */
  private goapActionToDecision(goapAction: any, context: AIContext): ActionDecision {
    return {
      type: goapAction.type,
      reason: `GOAP: ${goapAction.name}`,
      planning: {
        source: 'goap_plan',
      },
      priority: 3.0,
      requiresAP: goapAction.cost > 0,
    };
  }

  private applyMinimaxLiteRerank(context: AIContext, scoredActions: ScoredAction[]): ScoredAction[] {
    const legalInput = this.filterLegallyExecutableScoredActions(context, scoredActions);
    if (legalInput.length <= 1) {
      return legalInput;
    }

    const beamWidth = this.resolveMinimaxBeamWidth(context);
    const depth = Math.max(1, Math.min(2, this.config.minimaxLiteDepth ?? 2));
    const candidateCount = Math.min(beamWidth, legalInput.length);
    const topCandidates = legalInput.slice(0, candidateCount);
    const remainder = legalInput.slice(candidateCount);
    const adjusted: ScoredAction[] = [];

    for (const candidate of topCandidates) {
      const node = this.evaluateMinimaxLiteNode(context, candidate, depth);
      const blendedScore = (candidate.score * 0.65) + (node.nodeValue * 0.35);
      adjusted.push({
        ...candidate,
        score: blendedScore,
        factors: {
          ...candidate.factors,
          minimaxLiteNodeValue: node.nodeValue,
          minimaxLiteOpponentReplyPressure: node.opponentReplyPressure,
          minimaxLiteFollowUpPotential: node.followUpPotential,
          minimaxLitePatchControlDelta: node.patchControlDelta,
          minimaxLiteSimulatedStateDelta: node.simulatedStateDelta,
          minimaxLiteCurrentPatch: this.encodePatchCategory(node.currentPatch),
          minimaxLiteProjectedPatch: this.encodePatchCategory(node.projectedPatch),
          minimaxLiteCacheHit: node.cacheHit ? 1 : 0,
          minimaxLiteDepth: depth,
          minimaxLiteBeamWidth: beamWidth,
        },
      });
    }

    const reranked = [...adjusted, ...remainder].sort((a, b) => b.score - a.score);
    return this.filterLegallyExecutableScoredActions(context, reranked);
  }

  private evaluateMinimaxLiteNode(
    context: AIContext,
    action: ScoredAction,
    depth: number
  ): MinimaxLiteNodeEvaluation {
    const actorPosition = this.estimateActionResultPosition(context, action);
    const currentPosition = context.battlefield.getCharacterPosition(context.character) ?? actorPosition;
    const currentPatch = this.classifyTacticalPatch(context, currentPosition);
    const projectedPatch = this.classifyTacticalPatch(context, actorPosition);
    this.minimaxLiteNodeEvaluations += 1;
    this.recordPatchTransition(currentPatch.category, projectedPatch.category);
    const opponentSamples = this.resolveMinimaxOpponentSamples(context);
    const cacheKey = this.buildMinimaxTranspositionKey(
      context,
      action,
      actorPosition,
      depth,
      opponentSamples,
      currentPatch,
      projectedPatch
    );
    const heuristicCacheKey = this.buildMinimaxHeuristicCacheKey(
      context,
      action,
      actorPosition,
      depth,
      opponentSamples,
      currentPatch
    );
    const cached = this.minimaxLiteCache.get(cacheKey);
    if (cached) {
      this.minimaxLiteCacheHits += 1;
      this.minimaxLiteCache.delete(cacheKey);
      this.minimaxLiteCache.set(cacheKey, cached);
      const nodeValue =
        action.score +
        (cached.simulatedStateDelta * 0.8) +
        cached.followUpPotential +
        cached.patchControlDelta -
        cached.opponentReplyPressure;
      return {
        nodeValue,
        opponentReplyPressure: cached.opponentReplyPressure,
        followUpPotential: cached.followUpPotential,
        patchControlDelta: cached.patchControlDelta,
        simulatedStateDelta: cached.simulatedStateDelta,
        currentPatch: currentPatch.category,
        projectedPatch: projectedPatch.category,
        cacheHit: true,
      };
    }

    const heuristicCached = this.minimaxLiteHeuristicCache.get(heuristicCacheKey);
    if (heuristicCached) {
      this.minimaxLiteCacheHits += 1;
      this.minimaxLiteHeuristicCache.delete(heuristicCacheKey);
      this.minimaxLiteHeuristicCache.set(heuristicCacheKey, heuristicCached);
      this.minimaxLiteCache.set(cacheKey, heuristicCached);
      this.trimMinimaxLiteCache();
      const nodeValue =
        action.score +
        (heuristicCached.simulatedStateDelta * 0.8) +
        heuristicCached.followUpPotential +
        heuristicCached.patchControlDelta -
        heuristicCached.opponentReplyPressure;
      return {
        nodeValue,
        opponentReplyPressure: heuristicCached.opponentReplyPressure,
        followUpPotential: heuristicCached.followUpPotential,
        patchControlDelta: heuristicCached.patchControlDelta,
        simulatedStateDelta: heuristicCached.simulatedStateDelta,
        currentPatch: currentPatch.category,
        projectedPatch: projectedPatch.category,
        cacheHit: true,
      };
    }

    this.minimaxLiteCacheMisses += 1;
    const simulation = this.buildMinimaxSimulationState(context, currentPosition);
    this.simulatePrimaryActionTransition(context, simulation, action, actorPosition);
    const simulatedStateDelta = this.evaluateSimulationStateDelta(simulation);
    const simulatedReplyPressure = this.simulateOpponentReplyPressure(context, simulation, opponentSamples);
    const heuristicReplyPressure = this.estimateOpponentReplyPressure(context, actorPosition, opponentSamples);
    const opponentReplyPressure = this.clampNumber(
      (simulatedReplyPressure * 0.72) + (heuristicReplyPressure * 0.28),
      0,
      14
    );
    const simulatedFollowUp = depth > 1
      ? this.simulateOwnFollowUpPotential(context, simulation, action)
      : 0;
    const heuristicFollowUp = depth > 1
      ? this.estimateOwnFollowUpPotential(context, action)
      : 0;
    const followUpPotential = this.clampNumber(
      (simulatedFollowUp * 0.78) + (heuristicFollowUp * 0.22),
      -2.5,
      10
    );
    const patchControlDelta = this.evaluatePatchControlDelta(context, currentPatch, projectedPatch, action);
    const nodeValue = action.score + (simulatedStateDelta * 0.8) + followUpPotential + patchControlDelta - opponentReplyPressure;

    this.minimaxLiteCache.set(cacheKey, {
      nodeValue,
      opponentReplyPressure,
      followUpPotential,
      patchControlDelta,
      simulatedStateDelta,
    });
    this.minimaxLiteHeuristicCache.set(heuristicCacheKey, {
      nodeValue,
      opponentReplyPressure,
      followUpPotential,
      patchControlDelta,
      simulatedStateDelta,
    });
    this.trimMinimaxLiteCache();
    this.trimMinimaxLiteHeuristicCache();

    return {
      nodeValue,
      opponentReplyPressure,
      followUpPotential,
      patchControlDelta,
      simulatedStateDelta,
      currentPatch: currentPatch.category,
      projectedPatch: projectedPatch.category,
      cacheHit: false,
    };
  }

  private estimateOpponentReplyPressure(
    context: AIContext,
    actorPosition: Position,
    opponentSamples: number
  ): number {
    const enemyPressures: number[] = [];
    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const distance = Math.hypot(enemyPos.x - actorPosition.x, enemyPos.y - actorPosition.y);
      const enemyBp = enemy.profile.adjustedBp ?? enemy.profile.totalBp ?? 30;
      const bpScalar = Math.max(0.4, Math.min(1.6, enemyBp / 35));
      const healthScalar = 1 - Math.min(0.6, (enemy.state.wounds ?? 0) / Math.max(1, (enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3)));

      const meleeThreat = this.hasMeleeThreatProfile(enemy)
        ? Math.max(0, 1.6 - (distance * 0.75))
        : 0;
      const rangedThreat = this.hasRangedThreatProfile(enemy)
        ? this.estimateRangedThreat(enemy, distance, context)
        : 0;
      const visibilityPenalty = enemy.state.isHidden ? 0.35 : 1;

      const pressure = Math.max(0, ((meleeThreat * 1.25) + rangedThreat) * bpScalar * healthScalar * visibilityPenalty);
      if (pressure > 0) {
        enemyPressures.push(pressure);
      }
    }

    if (enemyPressures.length === 0) {
      return 0;
    }

    enemyPressures.sort((a, b) => b - a);
    const sampled = enemyPressures.slice(0, Math.max(1, opponentSamples));
    const maxPressure = sampled[0];
    const secondary = sampled.slice(1).reduce((sum, value) => sum + value, 0) * 0.35;
    return maxPressure + secondary;
  }

  private estimateOwnFollowUpPotential(context: AIContext, action: ScoredAction): number {
    const vpPressure = Number(action.factors?.['vpPressure'] ?? 0);
    const outOfPlay = Number(action.factors?.['outOfPlayPressure'] ?? 0);
    const objectiveAdvance = Number(action.factors?.['objectiveAdvance'] ?? 0);
    const waitReact = Number(action.factors?.['waitExpectedReactValue'] ?? 0);
    const threatRelief = Number(action.factors?.['threatRelief'] ?? 0);
    const moveBonus = action.action === 'move' ? 0.2 : 0;
    const actionTypeBias =
      action.action === 'close_combat' || action.action === 'ranged_combat' || action.action === 'charge'
        ? 0.25
        : action.action === 'wait'
          ? 0.1
          : 0;

    const scoringUrgency = Number(action.factors?.['scoringUrgencyScalar'] ?? 1);
    const urgencyScalar = Math.max(0.75, Math.min(1.65, scoringUrgency * 0.75));
    const endGameTurn = Number.isFinite(context.endGameTurn)
      ? Number(context.endGameTurn)
      : Number.isFinite(context.scoringContext?.predictorEndGameTurn)
        ? Number(context.scoringContext?.predictorEndGameTurn)
        : undefined;
    const timePressure = calculateSuddenDeathTimePressure(context.currentTurn, context.maxTurns ?? 6, endGameTurn);
    const phaseScalar = timePressure >= 0.72 ? 1.1 : 1;

    return (
      (vpPressure * 0.16) +
      (outOfPlay * 0.12) +
      (objectiveAdvance * 0.85) +
      (waitReact * 0.45) +
      (threatRelief * 0.35) +
      moveBonus +
      actionTypeBias
    ) * urgencyScalar * phaseScalar;
  }

  private buildMinimaxSimulationState(
    context: AIContext,
    actorPosition: Position
  ): MinimaxSimulationState {
    const models = new Map<string, MinimaxSimulationModel>();
    const addModel = (character: Character, side: 'friendly' | 'enemy', forcedPosition?: Position) => {
      const position = forcedPosition ?? context.battlefield.getCharacterPosition(character) ?? null;
      const siz = Math.max(1, character.finalAttributes.siz ?? character.attributes.siz ?? 3);
      const mov = Math.max(0, character.finalAttributes.mov ?? character.attributes.mov ?? 2);
      models.set(character.id, {
        id: character.id,
        side,
        position,
        wounds: Math.max(0, Number(character.state.wounds ?? 0)),
        mov,
        siz,
        bp: this.getModelBp(character),
        isKOd: Boolean(character.state.isKOd),
        isEliminated: Boolean(character.state.isEliminated),
        isHidden: Boolean(character.state.isHidden),
        hasMelee: this.hasMeleeThreatProfile(character),
        hasRanged: this.hasRangedThreatProfile(character),
      });
    };

    addModel(context.character, 'friendly', actorPosition);
    for (const ally of context.allies) {
      addModel(ally, 'friendly');
    }
    for (const enemy of context.enemies) {
      addModel(enemy, 'enemy');
    }

    return {
      actorId: context.character.id,
      actorPosition,
      models,
      outOfPlayBpDelta: 0,
      woundBpDelta: 0,
      vpDelta: 0,
      rpDelta: 0,
    };
  }

  private simulatePrimaryActionTransition(
    context: AIContext,
    simulation: MinimaxSimulationState,
    action: ScoredAction,
    projectedActorPosition: Position
  ): void {
    const actor = simulation.models.get(simulation.actorId);
    if (!actor || actor.isKOd || actor.isEliminated) {
      return;
    }

    actor.position = projectedActorPosition;
    simulation.actorPosition = projectedActorPosition;

    // Propagate direct fractional mission pressure from utility factors into simulated state.
    const vpPotential = Number(action.factors?.['vpPotential'] ?? 0);
    const vpDenial = Number(action.factors?.['vpDenial'] ?? 0);
    const rpPotential = Number(action.factors?.['rpPotential'] ?? 0);
    const rpDenial = Number(action.factors?.['rpDenial'] ?? 0);
    simulation.vpDelta += (vpPotential + vpDenial) * 0.08;
    simulation.rpDelta += (rpPotential + rpDenial) * 0.06;

    if (action.action === 'move') {
      const objectiveAdvance = Number(action.factors?.['objectiveAdvance'] ?? 0);
      if (objectiveAdvance > 0) {
        simulation.vpDelta += objectiveAdvance * 0.12;
      }
    }

    if (!action.target) {
      return;
    }

    if (
      action.action !== 'close_combat' &&
      action.action !== 'ranged_combat' &&
      action.action !== 'charge'
    ) {
      return;
    }

    const target = simulation.models.get(action.target.id);
    if (!target || target.isKOd || target.isEliminated || !target.position || !actor.position) {
      return;
    }

    const attackType: ActionType =
      action.action === 'charge'
        ? 'close_combat'
        : action.action;
    const distance = Math.hypot(actor.position.x - target.position.x, actor.position.y - target.position.y);
    const expectedWounds = this.estimateSimulatedExpectedWounds(
      context,
      actor,
      target,
      attackType,
      distance,
      action,
      false
    );
    this.applySimulatedDamageToModel(simulation, target.id, expectedWounds);
  }

  private simulateOpponentReplyPressure(
    context: AIContext,
    simulation: MinimaxSimulationState,
    opponentSamples: number
  ): number {
    const enemyAttackers = Array.from(simulation.models.values())
      .filter(model => model.side === 'enemy' && !model.isKOd && !model.isEliminated && !!model.position);
    const friendlyTargets = Array.from(simulation.models.values())
      .filter(model => model.side === 'friendly' && !model.isKOd && !model.isEliminated && !!model.position);

    if (enemyAttackers.length === 0 || friendlyTargets.length === 0) {
      return 0;
    }

    const replyCandidates: Array<{
      attackerId: string;
      targetId: string;
      attackType: ActionType;
      threat: number;
      distance: number;
      replyMoveDistance: number;
    }> = [];

    for (const attacker of enemyAttackers) {
      let best: {
        targetId: string;
        attackType: ActionType;
        threat: number;
        distance: number;
        replyMoveDistance: number;
      } | null = null;
      for (const target of friendlyTargets) {
        if (!attacker.position || !target.position) continue;
        const rawDistance = Math.hypot(attacker.position.x - target.position.x, attacker.position.y - target.position.y);
        const replyMoveBudget = this.estimateSimulatedMoveAllowance(attacker, true);
        const projectedDistance = Math.max(0, rawDistance - replyMoveBudget);
        const projectedReplyPosition = this.projectSimulatedPositionToward(attacker.position, target.position, replyMoveBudget);
        const replyMoveDistance = Math.hypot(
          projectedReplyPosition.x - attacker.position.x,
          projectedReplyPosition.y - attacker.position.y
        );
        const meleeThreat = attacker.hasMelee
          ? Math.max(0, 1.75 - (projectedDistance * 0.8))
          : 0;
        const losNow = context.battlefield.hasLineOfSight(attacker.position, target.position);
        const losAfterMove = context.battlefield.hasLineOfSight(projectedReplyPosition, target.position);
        const los = losNow || losAfterMove;
        const rangedThreat = attacker.hasRanged
          ? Math.max(0, 1.15 - (Math.max(0, projectedDistance - 4) * 0.07)) * (los ? 1 : 0.55)
          : 0;
        const attackType: ActionType = meleeThreat >= rangedThreat ? 'close_combat' : 'ranged_combat';
        const baseThreat = Math.max(meleeThreat, rangedThreat);
        if (baseThreat <= 0) continue;
        const moveExposurePenalty = replyMoveDistance > 0
          ? this.clampNumber(1 - (replyMoveDistance * 0.025), 0.8, 1)
          : 1;
        const targetPriority = target.id === simulation.actorId ? 1.15 : 1;
        const threat = baseThreat
          * targetPriority
          * this.clampNumber(target.bp / 30, 0.7, 1.45)
          * moveExposurePenalty;
        if (!best || threat > best.threat) {
          best = {
            targetId: target.id,
            attackType,
            threat,
            distance: projectedDistance,
            replyMoveDistance,
          };
        }
      }
      if (best) {
        replyCandidates.push({
          attackerId: attacker.id,
          targetId: best.targetId,
          attackType: best.attackType,
          threat: best.threat,
          distance: best.distance,
          replyMoveDistance: best.replyMoveDistance,
        });
      }
    }

    if (replyCandidates.length === 0) {
      return 0;
    }

    replyCandidates.sort((a, b) => b.threat - a.threat);
    const sampledReplies = replyCandidates.slice(0, Math.max(1, opponentSamples));
    let pressure = 0;

    for (const reply of sampledReplies) {
      const attacker = simulation.models.get(reply.attackerId);
      const target = simulation.models.get(reply.targetId);
      if (!attacker || !target || target.isKOd || target.isEliminated || !attacker.position || !target.position) {
        continue;
      }
      const expectedWounds = this.estimateSimulatedExpectedWounds(
        context,
        attacker,
        target,
        reply.attackType,
        reply.distance,
        undefined,
        true
      );
      const beforeOut = target.isKOd || target.isEliminated;
      const beforeWounds = target.wounds;
      this.applySimulatedDamageToModel(simulation, target.id, expectedWounds);
      const woundFraction = this.clampNumber((target.wounds - beforeWounds) / Math.max(1, target.siz), 0, 1.25);
      const woundPressure = target.bp * woundFraction * 0.6;
      const outOfPlayPressure = (!beforeOut && (target.isKOd || target.isEliminated)) ? target.bp * 0.85 : 0;
      const movementCommitmentScalar = reply.replyMoveDistance > 0
        ? this.clampNumber(1 - (reply.replyMoveDistance * 0.02), 0.82, 1)
        : 1;
      let contribution = (woundPressure + outOfPlayPressure) * movementCommitmentScalar;
      if (target.id === simulation.actorId) {
        contribution *= 1.08;
      }
      pressure += contribution;
    }

    return this.clampNumber(pressure, 0, 18);
  }

  private estimateSimulatedMoveAllowance(model: MinimaxSimulationModel, isReply: boolean): number {
    const base = Math.max(0, model.mov + 2);
    return this.clampNumber(base * (isReply ? 0.95 : 1), 0, 11);
  }

  private projectSimulatedPositionToward(from: Position, to: Position, maxDistance: number): Position {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001 || maxDistance <= 0) {
      return { x: from.x, y: from.y };
    }
    const step = Math.min(distance, maxDistance);
    return {
      x: from.x + ((dx / distance) * step),
      y: from.y + ((dy / distance) * step),
    };
  }

  private simulateOwnFollowUpPotential(
    context: AIContext,
    simulation: MinimaxSimulationState,
    action: ScoredAction
  ): number {
    const actor = simulation.models.get(simulation.actorId);
    if (!actor || actor.isKOd || actor.isEliminated || !actor.position) {
      return 0;
    }

    const enemyTargets = Array.from(simulation.models.values())
      .filter(model => model.side === 'enemy' && !model.isKOd && !model.isEliminated && !!model.position);
    let bestFollowUp = 0;

    for (const target of enemyTargets) {
      if (!target.position) continue;
      const distance = Math.hypot(actor.position.x - target.position.x, actor.position.y - target.position.y);
      const candidateAttackTypes: ActionType[] = [];
      if (actor.hasMelee && distance <= 2.25) {
        candidateAttackTypes.push('close_combat');
      }
      const hasLos = context.battlefield.hasLineOfSight(actor.position, target.position);
      if (actor.hasRanged && distance <= 14 && hasLos) {
        candidateAttackTypes.push('ranged_combat');
      }

      for (const attackType of candidateAttackTypes) {
        const expectedWounds = this.estimateSimulatedExpectedWounds(
          context,
          actor,
          target,
          attackType,
          distance,
          action,
          false
        );
        const woundFraction = this.clampNumber(expectedWounds / Math.max(1, target.siz), 0, 1.25);
        const woundValue = target.bp * woundFraction * 0.55;
        const outOfPlayValue = (target.wounds + expectedWounds >= target.siz) ? target.bp * 0.7 : 0;
        const coordinationBonus =
          Number(context.targetCommitments?.[target.id] ?? 0) * 0.14 +
          Number(context.scrumContinuity?.[target.id] ?? 0) * 0.1 +
          Number(context.lanePressure?.[target.id] ?? 0) * 0.08;
        bestFollowUp = Math.max(bestFollowUp, woundValue + outOfPlayValue + coordinationBonus);
      }
    }

    if (bestFollowUp <= 0) {
      let nearestObjective = Number.POSITIVE_INFINITY;
      for (const marker of context.objectiveMarkers ?? []) {
        if (!marker.position || marker.interactable === false) continue;
        const distance = Math.hypot(marker.position.x - actor.position.x, marker.position.y - actor.position.y);
        nearestObjective = Math.min(nearestObjective, distance);
      }
      if (Number.isFinite(nearestObjective)) {
        bestFollowUp = Math.max(0, (10 - nearestObjective) * 0.18);
      }
    }

    return this.clampNumber(bestFollowUp, 0, 10);
  }

  private estimateSimulatedExpectedWounds(
    context: AIContext,
    attacker: MinimaxSimulationModel,
    target: MinimaxSimulationModel,
    attackType: ActionType,
    distance: number,
    action?: ScoredAction,
    isReply: boolean = false
  ): number {
    let baseChance = attackType === 'close_combat' ? 0.62 : 0.5;
    if (attackType === 'close_combat') {
      if (distance > 2.5) {
        baseChance *= 0.2;
      } else {
        baseChance *= this.clampNumber(1.2 - (distance * 0.25), 0.65, 1.22);
      }
      if (!attacker.hasMelee) {
        baseChance *= 0.5;
      }
    } else {
      if (distance > 16) {
        baseChance *= 0.25;
      } else if (distance > 10) {
        baseChance *= 0.72;
      } else if (distance <= 4) {
        baseChance *= 1.12;
      }
      if (!attacker.hasRanged) {
        baseChance *= 0.56;
      }
      if (attacker.position && target.position && !context.battlefield.hasLineOfSight(attacker.position, target.position)) {
        baseChance *= 0.6;
      }
    }

    if (target.isHidden && attackType === 'ranged_combat') {
      baseChance *= 0.72;
    }

    const finisherScalar = target.wounds >= target.siz - 1 ? 1.2 : 1;
    const pressureScalar = action
      ? this.clampNumber(
          1 +
          (Number(action.factors?.['outOfPlayPressure'] ?? 0) * 0.08) +
          (Number(action.factors?.['vpPressure'] ?? 0) * 0.02) +
          (Number(action.factors?.['finishOff'] ?? 0) * 0.01),
          0.7,
          1.7
        )
      : 1;
    const bpScalar = this.clampNumber(attacker.bp / 34, 0.7, 1.45);
    const urgencyScalar = context.scoringContext && !context.scoringContext.amILeading ? 1.06 : 1;
    const replyScalar = isReply ? 0.92 : 1;
    const expected = baseChance * finisherScalar * pressureScalar * bpScalar * urgencyScalar * replyScalar;
    return this.clampNumber(expected, 0.05, 1.35);
  }

  private applySimulatedDamageToModel(
    simulation: MinimaxSimulationState,
    targetId: string,
    expectedWounds: number
  ): void {
    if (!Number.isFinite(expectedWounds) || expectedWounds <= 0) {
      return;
    }
    const target = simulation.models.get(targetId);
    if (!target || target.isKOd || target.isEliminated) {
      return;
    }

    const wasOutOfPlay = target.isKOd || target.isEliminated;
    const woundIncrease = this.clampNumber(expectedWounds, 0, 2);
    const woundFraction = this.clampNumber(woundIncrease / Math.max(1, target.siz), 0, 1.25);
    target.wounds += woundIncrease;

    const woundBpImpact = target.bp * woundFraction * 0.62;
    if (target.side === 'enemy') {
      simulation.woundBpDelta += woundBpImpact;
    } else {
      simulation.woundBpDelta -= woundBpImpact;
    }

    if (!wasOutOfPlay && target.wounds >= target.siz) {
      target.isKOd = true;
      const outOfPlayBp = target.bp;
      if (target.side === 'enemy') {
        simulation.outOfPlayBpDelta += outOfPlayBp;
      } else {
        simulation.outOfPlayBpDelta -= outOfPlayBp;
      }
    }
  }

  private evaluateSimulationStateDelta(simulation: MinimaxSimulationState): number {
    const bpSwing = simulation.outOfPlayBpDelta * 0.24;
    const woundSwing = simulation.woundBpDelta * 0.15;
    const vpSwing = simulation.vpDelta * 3.1;
    const rpSwing = simulation.rpDelta * 1.7;
    return this.clampNumber(bpSwing + woundSwing + vpSwing + rpSwing, -14, 14);
  }

  private classifyTacticalPatch(context: AIContext, position: Position): TacticalPatchSnapshot {
    const cacheKey = this.buildPatchGraphCacheKey(context, position);
    const cached = this.patchGraphCache.get(cacheKey);
    if (cached) {
      this.patchGraphCacheHits += 1;
      return cached;
    }

    this.patchGraphCacheMisses += 1;
    const snapshot = this.classifyTacticalPatchUncached(context, position);
    this.patchGraphCache.set(cacheKey, snapshot);
    this.trimPatchGraphCache();
    return snapshot;
  }

  private classifyTacticalPatchUncached(context: AIContext, position: Position): TacticalPatchSnapshot {
    const patchRadius = 6;
    const scrumRadius = 1.75;
    const supportRadius = 4;
    const laneRadius = 12;
    const graph = this.getPatchNeighborhoodGraph(context);
    const originBucketX = Math.floor(position.x / graph.bucketSize);
    const originBucketY = Math.floor(position.y / graph.bucketSize);
    const patchSteps = Math.max(1, Math.ceil(patchRadius / graph.bucketSize) + 1);
    const laneSteps = Math.max(patchSteps, Math.ceil(laneRadius / graph.bucketSize) + 1);
    const patchKeys = this.collectPatchNeighborhoodKeys(graph, originBucketX, originBucketY, patchSteps);
    const laneKeys = laneSteps > patchSteps
      ? this.collectPatchNeighborhoodKeys(graph, originBucketX, originBucketY, laneSteps)
      : patchKeys;

    let friendlyBp = 0;
    let enemyBp = 0;
    let friendlySupportBp = 0;
    let enemySupportBp = 0;
    let friendlyScrumBp = 0;
    let enemyScrumBp = 0;
    let scrumEnemyCount = 0;
    const friendlyBuckets = new Set<string>();
    const enemyBuckets = new Set<string>();
    for (const key of patchKeys) {
      const bucket = graph.buckets.get(key);
      if (!bucket) continue;
      for (const entry of bucket.entries) {
        const distance = Math.hypot(entry.position.x - position.x, entry.position.y - position.y);
        if (distance <= patchRadius) {
          if (entry.side === 'friendly') {
            friendlyBp += entry.bp;
            friendlyBuckets.add(key);
          } else {
            enemyBp += entry.bp;
            enemyBuckets.add(key);
          }
        }
        if (distance <= supportRadius) {
          if (entry.side === 'friendly') {
            friendlySupportBp += entry.bp;
          } else {
            enemySupportBp += entry.bp;
          }
        }
        if (distance <= scrumRadius) {
          if (entry.side === 'friendly') {
            friendlyScrumBp += entry.bp;
          } else {
            enemyScrumBp += entry.bp;
          }
        }
        if (entry.side === 'enemy' && distance <= scrumRadius) {
          scrumEnemyCount += 1;
        }
      }
    }

    let lanePressure = 0;
    let laneThreatAccumulator = 0;
    for (const key of laneKeys) {
      const bucket = graph.buckets.get(key);
      if (!bucket) continue;
      for (const entry of bucket.entries) {
        if (entry.side !== 'enemy' || !entry.hasRanged) continue;
        const distance = Math.hypot(entry.position.x - position.x, entry.position.y - position.y);
        if (distance <= laneRadius) {
          lanePressure += 1;
          const proximityScalar = this.clampNumber(1 - (distance / laneRadius), 0, 1);
          laneThreatAccumulator += entry.bp * (0.35 + (proximityScalar * 0.65));
        }
      }
    }

    let objectiveDistance = Number.POSITIVE_INFINITY;
    for (const objective of graph.objectivePoints) {
      const distance = Math.hypot(objective.x - position.x, objective.y - position.y);
      objectiveDistance = Math.min(objectiveDistance, distance);
    }

    const supportBalance = this.clampNumber(
      (friendlySupportBp - enemySupportBp) / Math.max(1, friendlySupportBp + enemySupportBp),
      -1,
      1
    );
    const adjacencyControl = this.clampNumber(
      (friendlyBuckets.size - enemyBuckets.size) / Math.max(1, friendlyBuckets.size + enemyBuckets.size),
      -1,
      1
    );
    const laneThreatScore = this.clampNumber(
      (laneThreatAccumulator / 120) + (lanePressure / 10),
      0,
      2.5
    );
    const scrumPressure = this.clampNumber(
      (enemyScrumBp - friendlyScrumBp) / Math.max(1, enemyScrumBp + friendlyScrumBp),
      -1,
      1
    );
    const objectiveProgress = Number.isFinite(objectiveDistance)
      ? this.clampNumber((10 - objectiveDistance) / 10, 0, 1.5)
      : 0;

    let category: TacticalPatchCategory = 'solo';
    if (scrumEnemyCount > 0) {
      category = 'scrum';
    } else if (objectiveDistance <= 3) {
      category = 'objective';
    } else if (friendlyBp > enemyBp * 1.25 && friendlyBp > 0) {
      category = 'friendly_dominant';
    } else if (enemyBp > friendlyBp * 1.25 && enemyBp > 0) {
      category = 'enemy_dominant';
    } else if (friendlyBp > 0 && enemyBp > 0) {
      category = 'contested';
    } else if (lanePressure >= 2) {
      category = 'lane_dominant';
    }

    return {
      category,
      friendlyBp,
      enemyBp,
      objectiveDistance: Number.isFinite(objectiveDistance) ? objectiveDistance : 99,
      lanePressure,
      supportBalance,
      adjacencyControl,
      laneThreatScore,
      scrumPressure,
      objectiveProgress,
    };
  }

  private buildPatchGraphCacheKey(context: AIContext, position: Position): string {
    const stateKey = this.getPatchGraphStateKey(context);
    const queryX = Math.round(position.x * 2);
    const queryY = Math.round(position.y * 2);
    return `${stateKey}|q:${queryX},${queryY}`;
  }

  private getPatchGraphStateKey(context: AIContext): string {
    const contextKey = context as unknown as object;
    const cached = this.patchGraphStateKeyByContext.get(contextKey);
    if (cached) {
      return cached;
    }
    const stateKey = this.buildPatchGraphStateKey(context);
    this.patchGraphStateKeyByContext.set(contextKey, stateKey);
    return stateKey;
  }

  private buildPatchGraphStateKey(context: AIContext): string {
    const terrainVersion = context.battlefield.getTerrainVersion?.() ?? 0;
    const visibilityOrMu = Number(context.config.visibilityOrMu ?? 16);
    const maxOrm = Number(context.config.maxOrm ?? 3);
    const allowConcentrate = context.config.allowConcentrateRangeExtension === false ? 0 : 1;
    const perCharacterLos = context.config.perCharacterFovLos ? 1 : 0;
    const occupancyHash = this.buildPatchOccupancyHash(context);
    const objectiveHash = this.buildPatchObjectiveHash(context);
    return [
      terrainVersion,
      `vis:${visibilityOrMu}:${maxOrm}:${allowConcentrate}:${perCharacterLos}`,
      `occ:${occupancyHash}`,
      `obj:${objectiveHash}`,
    ].join('|');
  }

  private getPatchNeighborhoodGraph(context: AIContext): TacticalPatchNeighborhoodGraph {
    const stateKey = this.getPatchGraphStateKey(context);
    const cached = this.patchNeighborhoodGraphCache.get(stateKey);
    if (cached) {
      this.patchNeighborhoodGraphCacheHits += 1;
      return cached;
    }

    this.patchNeighborhoodGraphCacheMisses += 1;
    const graph = this.buildPatchNeighborhoodGraph(context);
    this.patchNeighborhoodGraphCache.set(stateKey, graph);
    this.trimPatchNeighborhoodGraphCache();
    return graph;
  }

  private buildPatchNeighborhoodGraph(context: AIContext): TacticalPatchNeighborhoodGraph {
    const bucketSize = 2;
    const buckets = new Map<string, PatchGraphBucket>();
    const upsertBucket = (bucketX: number, bucketY: number): PatchGraphBucket => {
      const key = this.makePatchBucketKey(bucketX, bucketY);
      const existing = buckets.get(key);
      if (existing) {
        return existing;
      }
      const created: PatchGraphBucket = {
        key,
        bucketX,
        bucketY,
        entries: [],
        neighborKeys: [],
      };
      buckets.set(key, created);
      return created;
    };
    const addModel = (model: Character, side: 'friendly' | 'enemy') => {
      if (model.state.isKOd || model.state.isEliminated) return;
      const position = context.battlefield.getCharacterPosition(model);
      if (!position) return;
      const bucketX = Math.floor(position.x / bucketSize);
      const bucketY = Math.floor(position.y / bucketSize);
      const bucket = upsertBucket(bucketX, bucketY);
      bucket.entries.push({
        side,
        position,
        bp: this.getModelBp(model),
        hasRanged: this.hasRangedThreatProfile(model),
      });
    };

    addModel(context.character, 'friendly');
    for (const ally of context.allies) {
      addModel(ally, 'friendly');
    }
    for (const enemy of context.enemies) {
      addModel(enemy, 'enemy');
    }

    for (const bucket of buckets.values()) {
      const neighbors: string[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const neighborKey = this.makePatchBucketKey(bucket.bucketX + dx, bucket.bucketY + dy);
          if (buckets.has(neighborKey)) {
            neighbors.push(neighborKey);
          }
        }
      }
      bucket.neighborKeys = neighbors;
    }

    const objectivePoints: Position[] = [];
    for (const marker of context.objectiveMarkers ?? []) {
      if (!marker.position || marker.interactable === false) continue;
      objectivePoints.push(marker.position);
    }

    return {
      bucketSize,
      buckets,
      objectivePoints,
    };
  }

  private collectPatchNeighborhoodKeys(
    graph: TacticalPatchNeighborhoodGraph,
    originBucketX: number,
    originBucketY: number,
    maxSteps: number
  ): string[] {
    if (maxSteps < 0 || graph.buckets.size === 0) {
      return [];
    }
    const keys: string[] = [];
    for (const bucket of graph.buckets.values()) {
      if (
        Math.abs(bucket.bucketX - originBucketX) <= maxSteps &&
        Math.abs(bucket.bucketY - originBucketY) <= maxSteps
      ) {
        keys.push(bucket.key);
      }
    }
    return keys;
  }

  private makePatchBucketKey(bucketX: number, bucketY: number): string {
    return `${bucketX},${bucketY}`;
  }

  private buildPatchOccupancyHash(context: AIContext): string {
    const bucketSize = 2;
    const buckets = new Map<string, { count: number; bp: number }>();

    const addModelToBucket = (model: Character, sideCode: 'F' | 'E') => {
      if (model.state.isKOd || model.state.isEliminated) return;
      const pos = context.battlefield.getCharacterPosition(model);
      if (!pos) return;
      const bucketX = Math.floor(pos.x / bucketSize);
      const bucketY = Math.floor(pos.y / bucketSize);
      const key = `${sideCode}:${bucketX},${bucketY}`;
      const current = buckets.get(key);
      if (current) {
        current.count += 1;
        current.bp += this.getModelBp(model);
      } else {
        buckets.set(key, { count: 1, bp: this.getModelBp(model) });
      }
    };

    addModelToBucket(context.character, 'F');
    for (const ally of context.allies) {
      addModelToBucket(ally, 'F');
    }
    for (const enemy of context.enemies) {
      addModelToBucket(enemy, 'E');
    }

    const serialized = Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => `${key}:${value.count}:${Math.round(value.bp / 5)}`)
      .join('|');
    return this.hashCompactState(serialized);
  }

  private buildPatchObjectiveHash(context: AIContext): string {
    const serialized = (context.objectiveMarkers ?? [])
      .filter(marker => marker.position && marker.interactable !== false)
      .map(marker => {
        const pos = marker.position;
        if (!pos) return '';
        return `${Math.round(pos.x * 2)},${Math.round(pos.y * 2)}`;
      })
      .filter(value => value.length > 0)
      .sort()
      .join('|');
    return this.hashCompactState(serialized);
  }

  private trimPatchGraphCache(): void {
    this.trimLruCache(this.patchGraphCache, this.patchGraphCacheMaxSize, () => {
      this.patchGraphCacheEvictions += 1;
    });
  }

  private trimPatchNeighborhoodGraphCache(): void {
    this.trimLruCache(this.patchNeighborhoodGraphCache, this.patchNeighborhoodGraphCacheMaxSize, () => {
      this.patchNeighborhoodGraphCacheEvictions += 1;
    });
  }

  private evaluatePatchControlDelta(
    context: AIContext,
    currentPatch: TacticalPatchSnapshot,
    projectedPatch: TacticalPatchSnapshot,
    action: ScoredAction
  ): number {
    const currentScore = this.getPatchCategoryScore(context, currentPatch.category, action.action);
    const projectedScore = this.getPatchCategoryScore(context, projectedPatch.category, action.action);
    let delta = projectedScore - currentScore;

    const currentControl = (currentPatch.friendlyBp - currentPatch.enemyBp) / Math.max(1, currentPatch.friendlyBp + currentPatch.enemyBp);
    const projectedControl = (projectedPatch.friendlyBp - projectedPatch.enemyBp) / Math.max(1, projectedPatch.friendlyBp + projectedPatch.enemyBp);
    delta += (projectedControl - currentControl) * 0.9;
    delta += (projectedPatch.supportBalance - currentPatch.supportBalance) * 0.55;
    delta += (projectedPatch.adjacencyControl - currentPatch.adjacencyControl) * 0.4;

    const laneThreatDelta = projectedPatch.laneThreatScore - currentPatch.laneThreatScore;
    if (action.action === 'move' || action.action === 'wait') {
      delta -= laneThreatDelta * 0.32;
    } else if (action.action === 'ranged_combat') {
      delta -= laneThreatDelta * 0.18;
    } else {
      delta -= laneThreatDelta * 0.22;
    }

    const scrumPressureDelta = projectedPatch.scrumPressure - currentPatch.scrumPressure;
    if (action.action === 'close_combat' || action.action === 'charge') {
      const trailing = context.scoringContext ? !context.scoringContext.amILeading : false;
      delta -= scrumPressureDelta * (trailing ? 0.14 : 0.24);
    } else {
      delta -= scrumPressureDelta * 0.26;
    }

    const objectiveProgressDelta = projectedPatch.objectiveProgress - currentPatch.objectiveProgress;
    if (action.action === 'move') {
      delta += objectiveProgressDelta * 0.4;
    } else if (action.action === 'wait') {
      delta += objectiveProgressDelta * 0.15;
    } else {
      delta += objectiveProgressDelta * 0.22;
    }

    if (action.action === 'move' && Number.isFinite(currentPatch.objectiveDistance) && Number.isFinite(projectedPatch.objectiveDistance)) {
      const objectiveGain = currentPatch.objectiveDistance - projectedPatch.objectiveDistance;
      if (objectiveGain > 0) {
        const urgency = context.scoringContext?.amILeading ? 0.25 : 0.45;
        delta += Math.min(0.75, (objectiveGain / 6) * urgency);
      }
    }

    if ((action.action === 'close_combat' || action.action === 'ranged_combat') && projectedPatch.category === 'enemy_dominant') {
      delta += 0.2; // attacking from pressure zones can still be correct when trading up
    }
    if (action.action === 'wait' && projectedPatch.category === 'enemy_dominant') {
      delta -= 0.4;
    }

    return this.clampNumber(delta, -2.5, 2.5);
  }

  private getPatchCategoryScore(
    context: AIContext,
    category: TacticalPatchCategory,
    actionType: ActionType
  ): number {
    const trailing = context.scoringContext ? !context.scoringContext.amILeading : false;
    switch (category) {
      case 'friendly_dominant':
        return trailing ? 0.35 : 0.7;
      case 'enemy_dominant':
        return trailing && (actionType === 'close_combat' || actionType === 'ranged_combat' || actionType === 'charge') ? -0.2 : -0.85;
      case 'contested':
        return trailing ? 0.55 : 0.2;
      case 'scrum':
        return actionType === 'close_combat' || actionType === 'charge' ? 0.65 : -0.1;
      case 'objective':
        return trailing ? 0.95 : 0.45;
      case 'lane_dominant':
        return actionType === 'ranged_combat' || actionType === 'move' ? 0.5 : 0.15;
      case 'solo':
      default:
        return 0;
    }
  }

  private encodePatchCategory(category: TacticalPatchCategory): number {
    switch (category) {
      case 'friendly_dominant':
        return 1;
      case 'enemy_dominant':
        return 2;
      case 'contested':
        return 3;
      case 'scrum':
        return 4;
      case 'objective':
        return 5;
      case 'lane_dominant':
        return 6;
      case 'solo':
      default:
        return 0;
    }
  }

  private recordPatchTransition(from: TacticalPatchCategory, to: TacticalPatchCategory): void {
    const key = `${from}->${to}`;
    const count = this.minimaxLitePatchTransitions.get(key) ?? 0;
    this.minimaxLitePatchTransitions.set(key, count + 1);
  }

  private getModelBp(model: Character): number {
    const adjusted = model.profile.adjustedBp;
    if (typeof adjusted === 'number' && Number.isFinite(adjusted)) {
      return Math.max(0, adjusted);
    }
    const total = model.profile.totalBp;
    if (typeof total === 'number' && Number.isFinite(total)) {
      return Math.max(0, total);
    }
    return 30;
  }

  private clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  private resolveMinimaxBeamWidth(context: AIContext): number {
    const configured = this.config.minimaxLiteBeamWidth;
    if (typeof configured === 'number' && Number.isFinite(configured)) {
      return Math.max(1, Math.min(6, Math.floor(configured)));
    }
    const gameSize = String(context.config.gameSize ?? 'SMALL').toUpperCase();
    if (gameSize === 'VERY_SMALL') return 2;
    if (gameSize === 'SMALL') return 3;
    if (gameSize === 'MEDIUM') return 4;
    return 5;
  }

  private resolveMinimaxOpponentSamples(context: AIContext): number {
    const configured = this.config.minimaxLiteOpponentSamples;
    if (typeof configured === 'number' && Number.isFinite(configured)) {
      return Math.max(1, Math.min(4, Math.floor(configured)));
    }
    return context.enemies.length >= 8 ? 3 : 2;
  }

  private estimateActionResultPosition(context: AIContext, action: ScoredAction): Position {
    if ((action.action === 'move' || action.action === 'charge') && action.position) {
      return action.position;
    }
    const current = context.battlefield.getCharacterPosition(context.character);
    if (current) {
      return current;
    }
    return { x: 0, y: 0 };
  }

  private filterLegallyExecutableScoredActions(context: AIContext, actions: ScoredAction[]): ScoredAction[] {
    return actions.filter(action => this.isScoredActionLegallyExecutable(context, action));
  }

  private isScoredActionLegallyExecutable(context: AIContext, action: ScoredAction): boolean {
    if (!Number.isFinite(action.score)) {
      return false;
    }

    switch (action.action) {
      case 'move':
        return this.isMoveActionLegallyExecutable(context, action);
      case 'wait':
        return context.config.allowWaitAction ?? true;
      case 'hide':
        return context.config.allowHideAction ?? true;
      case 'close_combat':
        return this.isCloseCombatActionLegallyExecutable(context, action);
      case 'charge':
        return this.isChargeActionLegallyExecutable(context, action);
      case 'ranged_combat':
        return this.isRangedActionLegallyExecutable(context, action);
      case 'disengage':
        return Boolean(context.battlefield.isEngaged?.(context.character));
      default:
        return true;
    }
  }

  private isMoveActionLegallyExecutable(context: AIContext, action: ScoredAction): boolean {
    if (!action.position) return false;
    const start = context.battlefield.getCharacterPosition(context.character);
    if (!start) return false;
    if (context.battlefield.isEngaged?.(context.character)) {
      return false;
    }

    const baseDiameter = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
    if (context.battlefield.isWithinBounds && !context.battlefield.isWithinBounds(action.position, baseDiameter)) {
      return false;
    }

    const dx = action.position.x - start.x;
    const dy = action.position.y - start.y;
    const straightLineDistance = Math.hypot(dx, dy);
    const movementAllowance = this.estimateMaxImmediateMovementAllowance(context);
    return straightLineDistance <= movementAllowance + 0.25;
  }

  private estimateMaxImmediateMovementAllowance(context: AIContext): number {
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

  private estimateMeleeAttackApCost(character: Character, engaged: boolean): number {
    const meleeWeapon = this.getCharacterItems(character).find(item => {
      const classification = String(item.classification ?? item.class ?? '').toLowerCase();
      return classification.includes('melee') || classification.includes('natural');
    });
    if (!meleeWeapon || !engaged) {
      return 1;
    }
    const traits = Array.isArray(meleeWeapon.traits) ? meleeWeapon.traits : [];
    const awkward = traits.some((trait: string) => String(trait).toLowerCase().includes('awkward'));
    return awkward ? 2 : 1;
  }

  private isCloseCombatActionLegallyExecutable(context: AIContext, action: ScoredAction): boolean {
    const target = action.target;
    if (!target) return false;
    if (!this.isTargetEnemyAndActive(context, target)) return false;
    if (context.apRemaining < this.estimateMeleeAttackApCost(context.character, true)) return false;
    const actorPos = context.battlefield.getCharacterPosition(context.character);
    const targetPos = context.battlefield.getCharacterPosition(target);
    if (!actorPos || !targetPos) return false;

    const actorModel = {
      id: context.character.id,
      position: actorPos,
      baseDiameter: getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3),
      siz: context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3,
    };
    const targetModel = {
      id: target.id,
      position: targetPos,
      baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
      siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
    };
    return SpatialRules.isEngaged(actorModel, targetModel);
  }

  private isChargeActionLegallyExecutable(context: AIContext, action: ScoredAction): boolean {
    const target = action.target;
    if (!target) return false;
    if (!this.isTargetEnemyAndActive(context, target)) return false;
    if (context.battlefield.isEngaged?.(context.character)) return false;
    if (!this.hasMeleeThreatProfile(context.character)) return false;
    if (!action.position) return false;
    const attackCost = this.estimateMeleeAttackApCost(context.character, true);
    if (context.apRemaining < 1 + attackCost) return false;

    const actorPos = context.battlefield.getCharacterPosition(context.character);
    const targetPos = context.battlefield.getCharacterPosition(target);
    if (!actorPos || !targetPos) return false;

    const actorBaseDiameter = getBaseDiameterFromSiz(context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3);
    if (context.battlefield.isWithinBounds && !context.battlefield.isWithinBounds(action.position, actorBaseDiameter)) {
      return false;
    }

    const movementAllowance = this.estimateMaxImmediateMovementAllowance(context);
    const moveDistance = Math.hypot(action.position.x - actorPos.x, action.position.y - actorPos.y);
    if (moveDistance > movementAllowance + 0.25) {
      return false;
    }

    const chargedActorModel = {
      id: context.character.id,
      position: action.position,
      baseDiameter: actorBaseDiameter,
      siz: context.character.finalAttributes.siz ?? context.character.attributes.siz ?? 3,
    };
    const targetModel = {
      id: target.id,
      position: targetPos,
      baseDiameter: getBaseDiameterFromSiz(target.finalAttributes.siz ?? target.attributes.siz ?? 3),
      siz: target.finalAttributes.siz ?? target.attributes.siz ?? 3,
    };
    return SpatialRules.isEngaged(chargedActorModel, targetModel);
  }

  private isRangedActionLegallyExecutable(context: AIContext, action: ScoredAction): boolean {
    const target = action.target;
    if (!target) return false;
    if (!this.isTargetEnemyAndActive(context, target)) return false;
    if (context.battlefield.isEngaged?.(context.character)) return false;
    if (!this.hasRangedThreatProfile(context.character)) return false;

    const attackerPos = context.battlefield.getCharacterPosition(context.character);
    const targetPos = context.battlefield.getCharacterPosition(target);
    if (!attackerPos || !targetPos) return false;
    const distance = Math.hypot(attackerPos.x - targetPos.x, attackerPos.y - targetPos.y);

    if (context.config.perCharacterFovLos && !context.battlefield.hasLineOfSight(attackerPos, targetPos)) {
      return false;
    }

    const rangedWeapons = getRangedThreatWeapons(context.character);
    if (rangedWeapons.length === 0) {
      return false;
    }

    return rangedWeapons.some(weapon => {
      const weaponOr = parseWeaponOptimalRangeMu(context.character, weapon);
      const range = evaluateRangeWithVisibility(distance, weaponOr, {
        visibilityOrMu: context.config.visibilityOrMu,
        maxOrm: context.config.maxOrm,
        allowConcentrateRangeExtension: context.config.allowConcentrateRangeExtension,
      });
      return range.inRange;
    });
  }

  private isTargetEnemyAndActive(context: AIContext, target: Character): boolean {
    if (target.state.isKOd || target.state.isEliminated) {
      return false;
    }
    return context.enemies.some(enemy => enemy.id === target.id && !enemy.state.isKOd && !enemy.state.isEliminated);
  }

  private buildMinimaxTranspositionKey(
    context: AIContext,
    action: ScoredAction,
    actorPosition: Position,
    depth: number,
    opponentSamples: number,
    currentPatch: TacticalPatchSnapshot,
    projectedPatch: TacticalPatchSnapshot
  ): string {
    return buildMinimaxTranspositionKey(
      context,
      action,
      actorPosition,
      depth,
      opponentSamples,
      currentPatch,
      projectedPatch,
      this.minimaxCacheKeyDeps
    );
  }

  private buildMinimaxHeuristicCacheKey(
    context: AIContext,
    action: ScoredAction,
    actorPosition: Position,
    depth: number,
    opponentSamples: number,
    currentPatch: TacticalPatchSnapshot
  ): string {
    return buildMinimaxHeuristicCacheKey(
      context,
      action,
      actorPosition,
      depth,
      opponentSamples,
      currentPatch,
      this.minimaxCacheKeyDeps
    );
  }

  private hashCompactState(raw: string): string {
    let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  private trimMinimaxLiteCache(): void {
    this.trimLruCache(this.minimaxLiteCache, this.minimaxLiteCacheMaxSize);
  }

  private trimMinimaxLiteHeuristicCache(): void {
    this.trimLruCache(this.minimaxLiteHeuristicCache, this.minimaxLiteHeuristicCacheMaxSize);
  }

  private trimLruCache<K, V>(cache: Map<K, V>, maxSize: number, onEvict?: () => void): void {
    while (cache.size > maxSize) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
      onEvict?.();
    }
  }

  private getCharacterItems(character: Character): Item[] {
    return getCharacterThreatItems(character);
  }

  private hasMeleeThreatProfile(character: Character): boolean {
    return hasSharedMeleeThreatProfile(character, { defaultWhenNoItems: true });
  }

  private hasRangedThreatProfile(character: Character): boolean {
    return hasSharedRangedThreatProfile(character);
  }

  private estimateRangedThreat(enemy: Character, distance: number, context: AIContext): number {
    const rangedWeapons = getRangedThreatWeapons(enemy);
    if (rangedWeapons.length === 0) {
      return 0;
    }

    let bestThreat = 0;
    for (const weapon of rangedWeapons) {
      const weaponOr = parseWeaponOptimalRangeMu(enemy, weapon);
      const range = evaluateRangeWithVisibility(distance, weaponOr, {
        visibilityOrMu: context.config.visibilityOrMu,
        maxOrm: context.config.maxOrm,
        allowConcentrateRangeExtension: context.config.allowConcentrateRangeExtension,
      });
      if (!range.inRange) continue;
      const threat = Math.max(0.2, 1 - (range.orm * 0.22));
      bestThreat = Math.max(bestThreat, threat);
    }
    return bestThreat;
  }

  getMinimaxLiteCacheStats(): MinimaxLiteCacheStats {
    const total = this.minimaxLiteCacheHits + this.minimaxLiteCacheMisses;
    const patchTotal = this.patchGraphCacheHits + this.patchGraphCacheMisses;
    const patchNeighborhoodTotal = this.patchNeighborhoodGraphCacheHits + this.patchNeighborhoodGraphCacheMisses;
    return {
      size: this.minimaxLiteCache.size,
      maxSize: this.minimaxLiteCacheMaxSize,
      hits: this.minimaxLiteCacheHits,
      misses: this.minimaxLiteCacheMisses,
      hitRate: total > 0 ? this.minimaxLiteCacheHits / total : 0,
      nodeEvaluations: this.minimaxLiteNodeEvaluations,
      patchTransitions: Object.fromEntries(this.minimaxLitePatchTransitions.entries()),
      patchGraph: {
        size: this.patchGraphCache.size,
        maxSize: this.patchGraphCacheMaxSize,
        hits: this.patchGraphCacheHits,
        misses: this.patchGraphCacheMisses,
        hitRate: patchTotal > 0 ? this.patchGraphCacheHits / patchTotal : 0,
        evictions: this.patchGraphCacheEvictions,
        neighborhoodGraphSize: this.patchNeighborhoodGraphCache.size,
        neighborhoodGraphMaxSize: this.patchNeighborhoodGraphCacheMaxSize,
        neighborhoodGraphHits: this.patchNeighborhoodGraphCacheHits,
        neighborhoodGraphMisses: this.patchNeighborhoodGraphCacheMisses,
        neighborhoodGraphHitRate: patchNeighborhoodTotal > 0
          ? this.patchNeighborhoodGraphCacheHits / patchNeighborhoodTotal
          : 0,
        neighborhoodGraphEvictions: this.patchNeighborhoodGraphCacheEvictions,
      },
    };
  }

  clearMinimaxLiteCache(): void {
    this.minimaxLiteCache.clear();
    this.minimaxLiteHeuristicCache.clear();
    this.minimaxLiteCacheHits = 0;
    this.minimaxLiteCacheMisses = 0;
    this.minimaxLiteNodeEvaluations = 0;
    this.minimaxLitePatchTransitions.clear();
    this.patchGraphCache.clear();
    this.patchGraphCacheHits = 0;
    this.patchGraphCacheMisses = 0;
    this.patchGraphCacheEvictions = 0;
    this.patchNeighborhoodGraphCache.clear();
    this.patchNeighborhoodGraphCacheHits = 0;
    this.patchNeighborhoodGraphCacheMisses = 0;
    this.patchNeighborhoodGraphCacheEvictions = 0;
  }

  private inferPlanningMetadata(action: ScoredAction): ActionDecision['planning'] {
    const expectedTriggerCount = Number(action.factors?.['waitExpectedTriggerCount'] ?? 0);
    const expectedReactValue = Number(action.factors?.['waitExpectedReactValue'] ?? 0);
    const waitGoapBranchScore = Number(action.factors?.['waitGoapBranchScore'] ?? 0);
    const rolloutPreferredScore = Number(action.factors?.['rolloutPreferredScore'] ?? 0);
    const preferredWaitNow = Number(action.factors?.['preferredBranchWaitNow'] ?? 0) > 0;
    const preferredMoveThenWait = Number(action.factors?.['preferredBranchMoveThenWait'] ?? 0) > 0;
    const preferredImmediate = Number(action.factors?.['preferredBranchImmediateAction'] ?? 0) > 0;
    const waitPreferredBranch = preferredWaitNow
      ? 'wait_now'
      : preferredMoveThenWait
        ? 'move_then_wait'
        : preferredImmediate
          ? 'immediate_action'
          : undefined;
    const hasWaitForecastSignal =
      Number.isFinite(expectedTriggerCount) &&
      Number.isFinite(expectedReactValue) &&
      Number.isFinite(waitGoapBranchScore) &&
      (expectedTriggerCount > 0 || expectedReactValue > 0 || waitGoapBranchScore > 0);

    if (hasWaitForecastSignal) {
      return {
        source: 'goap_forecast',
        waitExpectedTriggerCount: expectedTriggerCount,
        waitExpectedReactValue: expectedReactValue,
        waitGoapBranchScore,
        waitPreferredBranch,
        waitRolloutPreferredScore: Number.isFinite(rolloutPreferredScore) ? rolloutPreferredScore : undefined,
      };
    }

    return {
      source: 'utility',
    };
  }

  private formatDecisionReason(action: ScoredAction): string {
    const factors = Object.entries(action.factors ?? {})
      .filter(([, value]) => Number.isFinite(value) && Math.abs(value) >= 0.05)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([name, value]) => `${name}=${value.toFixed(2)}`);
    if (factors.length === 0) {
      return `Best action (score: ${action.score.toFixed(2)})`;
    }
    return `Best action (score: ${action.score.toFixed(2)}; ${factors.join(', ')})`;
  }

  private extractCoordinatorDirective(context: AIContext): CoordinatorDirectiveSnapshot {
    const scoringContext = context.scoringContext;
    const urgency = Number(scoringContext?.coordinatorUrgency ?? 0);
    return {
      priority: typeof scoringContext?.coordinatorPriority === 'string'
        ? scoringContext.coordinatorPriority
        : 'neutral',
      potentialDirective: typeof scoringContext?.coordinatorPotentialDirective === 'string'
        ? scoringContext.coordinatorPotentialDirective
        : undefined,
      pressureDirective: typeof scoringContext?.coordinatorPressureDirective === 'string'
        ? scoringContext.coordinatorPressureDirective
        : undefined,
      urgency: Number.isFinite(urgency) ? urgency : 0,
    };
  }

  private classifyAttackOpportunity(
    scoredActions: ScoredAction[],
    visibleEnemies: Character[]
  ): AttackOpportunityGrade {
    if (visibleEnemies.length === 0 || scoredActions.length === 0) {
      return 'none';
    }

    const bestAttack = scoredActions.find(action => this.isAttackActionType(action.action));
    if (!bestAttack) {
      return 'none';
    }

    const bestScore = scoredActions[0]?.score ?? 0;
    const ratio = bestScore > 0 ? bestAttack.score / bestScore : 0;
    if (bestAttack.score >= 2.5 && ratio >= 0.68) {
      return 'immediate-high';
    }
    if (bestAttack.score >= 1.8 && ratio >= 0.48) {
      return 'immediate-low';
    }
    if (bestAttack.score >= 1.0) {
      return 'setup';
    }
    return 'none';
  }

  private shouldApplyAttackGate(
    attackOpportunityGrade: AttackOpportunityGrade,
    coordinatorDirective: CoordinatorDirectiveSnapshot,
    bestCombatAction?: ScoredAction,
    bestPassiveAction?: ScoredAction
  ): AttackGateDecision {
    if (!bestCombatAction || !bestPassiveAction) {
      return { shouldApply: false };
    }
    if (!this.isPassiveActionType(bestPassiveAction.action)) {
      return { shouldApply: false };
    }
    if (attackOpportunityGrade !== 'immediate-high' && attackOpportunityGrade !== 'immediate-low') {
      return { shouldApply: false };
    }

    const passiveScore = Math.max(0.01, bestPassiveAction.score);
    const relativeAttackScore = bestCombatAction.score / passiveScore;
    if (attackOpportunityGrade === 'immediate-high' && relativeAttackScore < 0.55) {
      return { shouldApply: false };
    }
    if (attackOpportunityGrade === 'immediate-low' && relativeAttackScore < 0.7) {
      return { shouldApply: false };
    }

    const aggressivePriority =
      coordinatorDirective.priority === 'press_advantage'
      || coordinatorDirective.priority === 'recover_deficit'
      || coordinatorDirective.priority === 'contest_keys';
    const aggressivePotential =
      coordinatorDirective.potentialDirective === 'expand_potential'
      || coordinatorDirective.potentialDirective === 'deny_opponent_potential';
    const aggressivePressure =
      coordinatorDirective.pressureDirective === 'maintain_scrum_pressure'
      || coordinatorDirective.pressureDirective === 'maintain_lane_pressure'
      || coordinatorDirective.pressureDirective === 'mixed_pressure';
    const urgency = coordinatorDirective.urgency;

    if (
      attackOpportunityGrade === 'immediate-high'
      && (aggressivePriority || aggressivePotential || aggressivePressure || urgency >= 1.12)
    ) {
      return { shouldApply: true, reason: 'immediate_high_window' };
    }
    if (
      attackOpportunityGrade === 'immediate-low'
      && (
        coordinatorDirective.priority === 'recover_deficit'
        || coordinatorDirective.priority === 'contest_keys'
        || aggressivePotential
        || (aggressivePressure && urgency >= 1.08)
        || urgency >= 1.28
      )
    ) {
      return { shouldApply: true, reason: 'directive_attack_window' };
    }

    return { shouldApply: false };
  }

  private isAttackActionType(actionType: ActionType): boolean {
    return (
      actionType === 'close_combat'
      || actionType === 'ranged_combat'
      || actionType === 'charge'
      || actionType === 'combined'
    );
  }

  /**
   * Get AI configuration
   */
  getConfig(): AIControllerConfig {
    return { ...this.config };
  }

  /**
   * Set AI configuration
   */
  setConfig(config: Partial<AIControllerConfig>): void {
    this.config = validateAIConfig({ ...this.config, ...config });
    this.utilityScorer.setWeights({
      aggression: this.config.aggression,
      riskAvoidance: this.config.caution,
    });
  }

  // ============================================================================
  // Decision Helpers
  // ============================================================================

  private decideCompulsoryAction(ctx: AIContext): NodeStatus {
    // Compulsory actions for disordered/panicked characters
    return NodeStatus.SUCCESS;
  }

  private decideDisengage(ctx: AIContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }

  private decideMeleeAttack(ctx: AIContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }

  private decideRangedAttack(ctx: AIContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }

  private decideAdvance(ctx: AIContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }

  private decideSupport(ctx: AIContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }

  private decideHold(ctx: AIContext): NodeStatus {
    return NodeStatus.SUCCESS;
  }

  private hasVisibleEnemy(ctx: AIContext): boolean {
    return ctx.enemies.some(e => isAttackableEnemy(ctx.character, e, ctx.config));
  }

  private shouldDisengage(ctx: AIContext): boolean {
    const character = ctx.character;
    const cca = character.finalAttributes.cca ?? character.attributes.cca ?? 2;
    const wounds = character.state.wounds;
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;

    // Disengage if low on health
    if (wounds >= siz - 1) return true;

    // Disengage if CCA is too low
    if (cca < 2) return true;

    return false;
  }

  private isInMeleeRange(ctx: AIContext): boolean {
    // Simplified melee range check
    return ctx.enemies.some(e => {
      if (!isAttackableEnemy(ctx.character, e, ctx.config)) return false;
      const pos = ctx.battlefield.getCharacterPosition(e);
      const myPos = ctx.battlefield.getCharacterPosition(ctx.character);
      if (!pos || !myPos) return false;
      const dist = Math.sqrt(Math.pow(pos.x - myPos.x, 2) + Math.pow(pos.y - myPos.y, 2));
      return dist <= 1;
    });
  }

  private isInRange(ctx: AIContext): boolean {
    const items = ((ctx.character.profile?.items?.length ? ctx.character.profile.items : ctx.character.profile?.equipment) ?? [])
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const rangedWeapons = items.filter(item => {
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
    });
    if (rangedWeapons.length === 0) return false;

    return ctx.enemies.some(e => {
      if (!isAttackableEnemy(ctx.character, e, ctx.config)) return false;
      const pos = ctx.battlefield.getCharacterPosition(e);
      const myPos = ctx.battlefield.getCharacterPosition(ctx.character);
      if (!pos || !myPos) return false;
      const dist = Math.hypot(pos.x - myPos.x, pos.y - myPos.y);
      return rangedWeapons.some(weapon => {
        const weaponOr = parseWeaponOptimalRangeMu(ctx.character, weapon);
        const range = evaluateRangeWithVisibility(dist, weaponOr, {
          visibilityOrMu: ctx.config.visibilityOrMu,
          maxOrm: ctx.config.maxOrm,
          allowConcentrateRangeExtension: ctx.config.allowConcentrateRangeExtension,
        });
        return range.inRange;
      });
    });
  }

  private needsSupport(ctx: AIContext): boolean {
    // Check if any ally needs rally or revive
    return ctx.allies.some(a =>
      a.state.fearTokens > 0 || a.state.isKOd
    );
  }

  private isPassiveActionType(actionType: ActionType): boolean {
    if (this.isAttackActionType(actionType)) {
      return false;
    }
    switch (actionType) {
      case 'wait':
      case 'hide':
      case 'detect':
      case 'hold':
      case 'move':
      case 'disengage':
      case 'fiddle':
      case 'rally':
      case 'revive':
      case 'reload':
      case 'none':
        return true;
      default:
        return false;
    }
  }

  private isActionTypeAllowed(context: AIContext, actionType: ActionType): boolean {
    if (actionType === 'wait' && context.config.allowWaitAction === false) {
      return false;
    }
    if (actionType === 'hide' && context.config.allowHideAction === false) {
      return false;
    }
    return true;
  }

  private actionRequiresAP(action: ActionType): boolean {
    switch (action) {
      case 'move':
      case 'charge':
      case 'close_combat':
      case 'ranged_combat':
      case 'disengage':
      case 'rally':
      case 'revive':
      case 'wait':
      case 'fiddle':
      case 'combined':
        return true;
      case 'hold':
      case 'reload':
      case 'hide':
      case 'detect':
        return true;
      case 'none':
      default:
        return false;
    }
  }
}

/**
 * Create AI controllers for all characters on a side
 */
export function createSideAI(
  characters: Character[],
  config: Partial<CharacterAIConfig> = {}
): Map<string, CharacterAI> {
  const controllers = new Map<string, CharacterAI>();
  for (const character of characters) {
    controllers.set(character.id, new CharacterAI(config));
  }
  return controllers;
}

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
  ReactOpportunity,
  ReactResult,
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
import { Battlefield } from '../../battlefield/Battlefield';
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
  ReactOpportunity,
  ReactResult,
  ReactConfig,
  DEFAULT_REACT_CONFIG,
} from '../tactical/ReactsQSR';

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
    // Update knowledge
    const knowledge = this.knowledgeBase.updateKnowledge(
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

    // Phase 2: Try GOAP planning for goal-oriented behavior
    if (this.enableGOAP) {
      const plan = this.planWithGOAP(context);
      if (plan && plan.actions.length > 0) {
        const action = this.goapActionToDecision(plan.actions[0], context);
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

    // Phase 2: Check for stealth opportunities (Hide/Detect)
    // StealthEvaluator uses Keys to Victory cost-benefit analysis
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
        },
      };
    }

    // === FORCE MOVEMENT WHEN NO VISIBLE ENEMIES ===
    // When all enemies are Hidden, force movement toward enemy zone
    const visibleEnemies = context.enemies.filter(e => !e.state.isHidden);
    const allEnemiesHidden = visibleEnemies.length === 0 && context.enemies.length > 0;

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
            },
          };
        }
      }
    }
    // === END FORCE MOVEMENT ===

    // Fallback: Use utility scoring for tactical decisions
    const scoredActions = this.utilityScorer.evaluateActions(context);
    const bestAction = scoredActions[0];

    if (!bestAction || bestAction.score <= 0) {
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
        },
      };
    }

    const decision: ActionDecision = {
      type: bestAction.action,
      target: bestAction.target,
      position: bestAction.position,
      objectiveAction: bestAction.objectiveAction,
      markerId: bestAction.markerId,
      markerTargetModelId: bestAction.markerTargetModelId,
      reason: this.formatDecisionReason(bestAction),
      planning: this.inferPlanningMetadata(bestAction),
      priority: bestAction.score,
      requiresAP: this.actionRequiresAP(bestAction.action),
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
      },
    };
  }

  /**
   * Evaluate react opportunities (QSR p.1115-1119)
   */
  evaluateReact(
    context: AIContext,
    opportunity: ReactOpportunity
  ): ReactResult {
    // Use QSR-compliant ReactEvaluator
    return this.reactEvaluator.evaluateReacts(
      context.character,
      opportunity,
      context,
      false // isReactingToReact
    );
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

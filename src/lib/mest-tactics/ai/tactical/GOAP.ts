/**
 * Goal-Oriented Action Planning (GOAP)
 * 
 * Plans multi-turn action sequences by backward chaining from goals.
 * Used for tactical decisions that require coordination over time.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { ActionDecision, AIContext, ActionType } from '../core/AIController';

/**
 * World state representation
 */
export interface WorldState {
  /** Character positions */
  positions: Map<string, Position>;
  /** Character health (wounds) */
  wounds: Map<string, number>;
  /** Character status (KO'd, eliminated, etc.) */
  status: Map<string, CharacterStatus>;
  /** Engagement status */
  engaged: Set<string>;
  /** Turn number */
  turn: number;
}

export type CharacterStatus = 'active' | 'ko' | 'eliminated' | 'waiting';

/**
 * Action definition for GOAP
 */
export interface GOAPAction {
  /** Action name */
  name: string;
  /** Action type */
  type: ActionType;
  /** Preconditions that must be true */
  preconditions: WorldStateCondition[];
  /** Effects this action has on world state */
  effects: WorldStateEffect[];
  /** Cost to execute this action (AP cost) */
  cost: number;
  /** Whether this action targets a character */
  targetsCharacter: boolean;
  /** Whether this action targets a position */
  targetsPosition: boolean;
}

/**
 * World state condition
 */
export interface WorldStateCondition {
  /** Property to check */
  property: string;
  /** Expected value */
  value: any;
  /** Comparison type */
  comparison: 'equals' | 'not_equals' | 'less_than' | 'greater_than' | 'exists';
}

/**
 * World state effect
 */
export interface WorldStateEffect {
  /** Property to modify */
  property: string;
  /** New value or delta */
  value: any;
  /** Effect type */
  effectType: 'set' | 'add' | 'remove' | 'delete';
}

/**
 * Goal definition
 */
export interface GOAPGoal {
  /** Goal name */
  name: string;
  /** Conditions that satisfy this goal */
  conditions: WorldStateCondition[];
  /** Priority (higher = more important) */
  priority: number;
  /** Whether this goal is urgent */
  isUrgent: boolean;
}

/**
 * Planned action sequence
 */
export interface ActionPlan {
  /** Actions to execute in order */
  actions: GOAPAction[];
  /** Expected outcome */
  expectedOutcome: WorldState;
  /** Total cost */
  totalCost: number;
  /** Success probability (0-1) */
  successProbability: number;
}

/**
 * GOAP Planner
 * 
 * Plans action sequences by backward chaining from goals.
 */
export class GOAPPlanner {
  private availableActions: GOAPAction[];
  private maxDepth: number;

  constructor(actions: GOAPAction[] = [], maxDepth: number = 5) {
    this.availableActions = actions;
    this.maxDepth = maxDepth;
  }

  /**
   * Plan actions to achieve a goal
   */
  plan(goal: GOAPGoal, context: AIContext): ActionPlan | null {
    const currentState = this.captureState(context);
    
    // Check if goal is already satisfied
    if (this.isGoalSatisfied(goal, currentState)) {
      return {
        actions: [],
        expectedOutcome: currentState,
        totalCost: 0,
        successProbability: 1.0,
      };
    }

    // Backward chain from goal
    const plan = this.backwardChain(goal, currentState, 0);
    
    if (plan) {
      return {
        actions: plan,
        expectedOutcome: this.simulateOutcome(currentState, plan),
        totalCost: plan.reduce((sum, action) => sum + action.cost, 0),
        successProbability: this.estimateSuccessProbability(plan, context),
      };
    }

    return null;
  }

  /**
   * Backward chain from goal to find action sequence
   */
  private backwardChain(
    goal: GOAPGoal,
    currentState: WorldState,
    depth: number
  ): GOAPAction[] | null {
    if (depth >= this.maxDepth) {
      return null;
    }

    // Find actions that achieve goal conditions
    const relevantActions = this.findRelevantActions(goal, currentState);

    for (const action of relevantActions) {
      // Check if preconditions are met
      if (this.arePreconditionsMet(action, currentState)) {
        return [action];
      }

      // Recursively find actions to achieve preconditions
      const preconditionGoal: GOAPGoal = {
        name: `Achieve ${action.name} preconditions`,
        conditions: action.preconditions,
        priority: goal.priority - 1,
        isUrgent: goal.isUrgent,
      };

      const subPlan = this.backwardChain(preconditionGoal, currentState, depth + 1);
      
      if (subPlan) {
        return [...subPlan, action];
      }
    }

    return null;
  }

  /**
   * Find actions that can achieve goal conditions
   */
  private findRelevantActions(goal: GOAPGoal, state: WorldState): GOAPAction[] {
    return this.availableActions.filter(action =>
      action.effects.some(effect =>
        goal.conditions.some(condition =>
          condition.property === effect.property
        )
      )
    );
  }

  /**
   * Check if action preconditions are met
   */
  private arePreconditionsMet(action: GOAPAction, state: WorldState): boolean {
    return action.preconditions.every(condition =>
      this.checkCondition(condition, state)
    );
  }

  /**
   * Check a single condition against world state
   */
  private checkCondition(condition: WorldStateCondition, state: WorldState): boolean {
    const value = this.getProperty(state, condition.property);

    switch (condition.comparison) {
      case 'equals':
        return value === condition.value;
      case 'not_equals':
        return value !== condition.value;
      case 'less_than':
        return typeof value === 'number' && value < condition.value;
      case 'greater_than':
        return typeof value === 'number' && value > condition.value;
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  /**
   * Get property from world state
   */
  private getProperty(state: WorldState, property: string): any {
    const parts = property.split('.');
    let current: any = state;

    for (const part of parts) {
      if (current instanceof Map) {
        current = current.get(part);
      } else if (current instanceof Set) {
        current = current.has(part);
      } else if (current && typeof current === 'object') {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Capture current world state from context
   */
  private captureState(context: AIContext): WorldState {
    const positions = new Map<string, Position>();
    const wounds = new Map<string, number>();
    const status = new Map<string, CharacterStatus>();
    const engaged = new Set<string>();

    // Capture character states
    const allCharacters = [...context.allies, ...context.enemies, context.character];
    for (const char of allCharacters) {
      const pos = context.battlefield.getCharacterPosition(char);
      if (pos) {
        positions.set(char.id, pos);
      }
      wounds.set(char.id, char.state.wounds);
      
      if (char.state.isEliminated) {
        status.set(char.id, 'eliminated');
      } else if (char.state.isKOd) {
        status.set(char.id, 'ko');
      } else if (char.state.isWaiting) {
        status.set(char.id, 'waiting');
      } else {
        status.set(char.id, 'active');
      }

      if (context.battlefield.isEngaged?.(char)) {
        engaged.add(char.id);
      }
    }

    return {
      positions,
      wounds,
      status,
      engaged,
      turn: context.currentTurn,
    };
  }

  /**
   * Check if goal is satisfied
   */
  private isGoalSatisfied(goal: GOAPGoal, state: WorldState): boolean {
    return goal.conditions.every(condition =>
      this.checkCondition(condition, state)
    );
  }

  /**
   * Simulate outcome of action sequence
   */
  private simulateOutcome(initialState: WorldState, actions: GOAPAction[]): WorldState {
    let state = { ...initialState };

    for (const action of actions) {
      state = this.applyEffects(state, action.effects);
    }

    return state;
  }

  /**
   * Apply effects to world state
   */
  private applyEffects(state: WorldState, effects: WorldStateEffect[]): WorldState {
    const newState = { ...state };

    for (const effect of effects) {
      switch (effect.effectType) {
        case 'set':
          this.setProperty(newState, effect.property, effect.value);
          break;
        case 'add':
          this.addProperty(newState, effect.property, effect.value);
          break;
        case 'remove':
          this.removeProperty(newState, effect.property, effect.value);
          break;
        case 'delete':
          this.deleteProperty(newState, effect.property);
          break;
      }
    }

    return newState;
  }

  /**
   * Set property in world state
   */
  private setProperty(state: WorldState, property: string, value: any): void {
    const parts = property.split('.');
    let current: any = state;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current instanceof Map) {
        if (!current.has(part)) {
          current.set(part, new Map());
        }
        current = current.get(part);
      } else {
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (current instanceof Map) {
      current.set(lastPart, value);
    } else {
      current[lastPart] = value;
    }
  }

  /**
   * Add to property (for numeric values)
   */
  private addProperty(state: WorldState, property: string, value: number): void {
    const currentValue = this.getProperty(state, property) || 0;
    this.setProperty(state, property, currentValue + value);
  }

  /**
   * Remove from property (for numeric values)
   */
  private removeProperty(state: WorldState, property: string, value: number): void {
    const currentValue = this.getProperty(state, property) || 0;
    this.setProperty(state, property, Math.max(0, currentValue - value));
  }

  /**
   * Delete property
   */
  private deleteProperty(state: WorldState, property: string): void {
    const parts = property.split('.');
    let current: any = state;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current instanceof Map) {
        current = current.get(part);
      } else {
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (current instanceof Map) {
      current.delete(lastPart);
    } else {
      delete current[lastPart];
    }
  }

  /**
   * Estimate success probability of a plan
   */
  private estimateSuccessProbability(plan: GOAPAction[], context: AIContext): number {
    if (plan.length === 0) return 1.0;

    // Base probability
    let probability = 0.9;

    // Reduce probability for longer plans
    probability -= plan.length * 0.05;

    // Reduce probability based on character health
    const healthRatio = 1 - (context.character.state.wounds / 
      (context.character.finalAttributes.siz ?? 3));
    probability *= healthRatio;

    // Reduce probability if outnumbered
    const friendlyCount = context.allies.filter(a => 
      !a.state.isEliminated && !a.state.isKOd
    ).length + 1;
    const enemyCount = context.enemies.filter(e => 
      !e.state.isEliminated && !e.state.isKOd
    ).length;
    
    if (enemyCount > friendlyCount) {
      probability *= 0.8;
    }

    return Math.max(0.1, Math.min(1.0, probability));
  }
}

// ============================================================================
// Standard GOAP Actions (QSR-Compliant)
// ============================================================================

/**
 * Create GOAP actions with QSR-compliant preconditions and effects
 */
export function createStandardActions(): GOAPAction[] {
  return [
    /**
     * Move Action (QSR p.1110)
     * - Costs 1 AP (or 2 AP for Combined action)
     * - Limited by MOV + terrain modifiers
     * - Triggers Opportunity Attacks when breaking engagement
     */
    {
      name: 'Move',
      type: 'move',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
      ],
      effects: [
        { property: 'position.self', value: null, effectType: 'set' },
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'hasMoved', value: true, effectType: 'set' },
      ],
      cost: 1,
      targetsCharacter: false,
      targetsPosition: true,
    },

    /**
     * Close Combat Attack (QSR p.1111)
     * - Requires engagement (base-to-base contact)
     * - Costs 1 AP
     * - Opposed CCA vs CCA Hit Test
     * - Followed by Damage Test if hit succeeds
     */
    {
      name: 'Close Combat',
      type: 'close_combat',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'engaged.self', value: true, comparison: 'equals' },
        { property: 'hasMeleeWeapon', value: true, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'wounds.target', value: 1, effectType: 'add' },
        { property: 'hasAttacked', value: true, effectType: 'set' },
        // May cause Delay token if not first attack (QSR p.1111)
        { property: 'delay.self', value: 1, effectType: 'add' },
      ],
      cost: 1,
      targetsCharacter: true,
      targetsPosition: false,
    },

    /**
     * Ranged Combat Attack (QSR p.1112)
     * - Requires LOS to target
     * - Requires ranged weapon with OR
     * - Costs 1 AP
     * - Opposed RCA vs REF Hit Test
     * - ORM penalty: -1m per OR multiple beyond first
     */
    {
      name: 'Ranged Combat',
      type: 'ranged_combat',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'hasLOS.target', value: true, comparison: 'equals' },
        { property: 'hasRangedWeapon', value: true, comparison: 'equals' },
        { property: 'engaged.self', value: false, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'wounds.target', value: 1, effectType: 'add' },
        { property: 'hasAttacked', value: true, effectType: 'set' },
        { property: 'delay.self', value: 1, effectType: 'add' },
      ],
      cost: 1,
      targetsCharacter: true,
      targetsPosition: false,
    },

    /**
     * Disengage Action (QSR p.1111)
     * - Required when engaged and wanting to move away
     * - Opposed REF vs CCA Test (disengager uses REF)
     * - Costs 1 AP
     * - On success: move MOV × 1" away
     */
    {
      name: 'Disengage',
      type: 'disengage',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'engaged.self', value: true, comparison: 'equals' },
        { property: 'wantsToMove', value: true, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'engaged.self', value: false, effectType: 'set' },
        { property: 'hasMoved', value: true, effectType: 'set' },
      ],
      cost: 1,
      targetsCharacter: true,
      targetsPosition: false,
    },

    /**
     * Rally Action (QSR p.1114, p.1136)
     * - Unopposed POW Test
     * - Removes 1 Fear token per cascade
     * - Can target self or ally in Cohesion
     * - Costs 1 AP
     */
    {
      name: 'Rally',
      type: 'rally',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'fear.target', value: 0, comparison: 'greater_than' },
        { property: 'inCohesion.target', value: true, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'fear.target', value: 1, effectType: 'remove' },
        { property: 'hasActed', value: true, effectType: 'set' },
      ],
      cost: 1,
      targetsCharacter: true,
      targetsPosition: false,
    },

    /**
     * Revive Action (QSR p.1114)
     * - Unopposed FOR Test
     * - Can target self or ally in base-contact
     * - On success: spend cascades to remove Delay (1 each) and Wounds (2 each)
     * - KO'd models: right them, assign Delay tokens = SIZ (min 2)
     * - Costs 1 AP
     */
    {
      name: 'Revive',
      type: 'revive',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'status.target', value: 'ko', comparison: 'equals' },
        { property: 'inBaseContact.target', value: true, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'status.target', value: 'active', effectType: 'set' },
        { property: 'wounds.target', value: 2, effectType: 'add' },
        { property: 'delay.target', value: 2, effectType: 'set' },
        { property: 'hasActed', value: true, effectType: 'set' },
      ],
      cost: 1,
      targetsCharacter: true,
      targetsPosition: false,
    },

    /**
     * Wait Action (QSR p.1113)
     * - Costs 2 AP (or 1 AP to maintain if already waiting)
     * - Allows Reacts even when Done
     * - Doubles Visibility OR
     * - Reveals Hidden models in LOS not in Cover
     */
    {
      name: 'Wait',
      type: 'wait',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 1, comparison: 'greater_than' },
        { property: 'isWaiting', value: false, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 2, effectType: 'remove' },
        { property: 'isWaiting', value: true, effectType: 'set' },
        { property: 'visibilityOR', value: 2, effectType: 'multiply' },
      ],
      cost: 2,
      targetsCharacter: false,
      targetsPosition: false,
    },

    /**
     * Hold Action (QSR p.1113)
     * - Zero AP cost
     * - Character remains in position
     * - Used when no better action available
     */
    {
      name: 'Hold',
      type: 'hold',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
      ],
      effects: [
        { property: 'hasActed', value: true, effectType: 'set' },
      ],
      cost: 0,
      targetsCharacter: false,
      targetsPosition: false,
    },

    /**
     * Concentrate Action (QSR p.1113)
     * - Costs 1 AP (combined with another action)
     * - Provides +1w to specified Test
     * - If for Hit Test: ignore Max ORM, double all ORs
     */
    {
      name: 'Concentrate',
      type: 'concentrate',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'hasActionToCombine', value: true, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'concentrateBonus', value: true, effectType: 'set' },
      ],
      cost: 1,
      targetsCharacter: false,
      targetsPosition: false,
    },

    /**
     * Hide Action (QSR p.1113)
     * - Costs 1 AP (0 AP if not in LOS)
     * - Requires Cover and LOS
     * - Marks model as Hidden
     * - Hidden: Visibility/Cohesion halved, terrain degraded
     */
    {
      name: 'Hide',
      type: 'hide',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'apRemaining', value: 0, comparison: 'greater_than' },
        { property: 'hasCover', value: true, comparison: 'equals' },
        { property: 'inLOS', value: true, comparison: 'equals' },
        { property: 'isHidden', value: false, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'isHidden', value: true, effectType: 'set' },
      ],
      cost: 1,
      targetsCharacter: false,
      targetsPosition: false,
    },

    /**
     * Detect Action (QSR p.1113)
     * - First Detect costs 0 AP, subsequent cost 1 AP
     * - Opposed REF Test vs Hidden target
     * - OR = Visibility
     * - On success: removes Hidden status
     */
    {
      name: 'Detect',
      type: 'detect',
      preconditions: [
        { property: 'status.self', value: 'active', comparison: 'equals' },
        { property: 'hasHiddenTarget', value: true, comparison: 'equals' },
        { property: 'inLOS.target', value: true, comparison: 'equals' },
      ],
      effects: [
        { property: 'apRemaining', value: 1, effectType: 'remove' },
        { property: 'isHidden.target', value: false, effectType: 'set' },
        { property: 'hasActed', value: true, effectType: 'set' },
      ],
      cost: 0,
      targetsCharacter: true,
      targetsPosition: false,
    },
  ];
}

/**
 * Standard GOAP Goals (QSR-Compliant)
 */
export const StandardGoals = {
  /**
   * Eliminate all enemies (QSR Mission 1: Elimination)
   * - All enemy models must be Eliminated
   * - Priority 5 (default offensive goal)
   */
  EliminateEnemies: {
    name: 'Eliminate Enemies',
    conditions: [
      { property: 'status.enemy', value: 'eliminated', comparison: 'equals' },
    ],
    priority: 5,
    isUrgent: false,
  },

  /**
   * Survive (don't be eliminated)
   * - Character must not be KO'd or Eliminated
   * - Priority 10 (highest - survival instinct)
   * - Urgent: triggers when wounds >= SIZ - 1
   */
  Survive: {
    name: 'Survive',
    conditions: [
      { property: 'status.self', value: 'eliminated', comparison: 'not_equals' },
      { property: 'status.self', value: 'ko', comparison: 'not_equals' },
    ],
    priority: 10,
    isUrgent: true,
  },

  /**
   * Protect ally
   * - Allied models must not be Eliminated
   * - Priority 7 (important but not critical)
   */
  ProtectAlly: {
    name: 'Protect Ally',
    conditions: [
      { property: 'status.ally', value: 'eliminated', comparison: 'not_equals' },
    ],
    priority: 7,
    isUrgent: false,
  },

  /**
   * Disengage from combat
   * - Character must not be engaged
   * - Priority 6 (urgent when disadvantaged)
   * - Urgent: triggers when engaged and wounds high or CCA low
   */
  DisengageCombat: {
    name: 'Disengage',
    conditions: [
      { property: 'engaged.self', value: false, comparison: 'equals' },
    ],
    priority: 6,
    isUrgent: true,
  },

  /**
   * Reach tactical position
   * - Character must be at specified position
   * - Priority 3 (positional goal)
   */
  ReachPosition: {
    name: 'Reach Position',
    conditions: [
      { property: 'position.self', value: null, comparison: 'exists' },
    ],
    priority: 3,
    isUrgent: false,
  },

  /**
   * Rally from fear
   * - Remove all Fear tokens
   * - Priority 8 (important for disordered characters)
   */
  RallyFromFear: {
    name: 'Rally',
    conditions: [
      { property: 'fear.self', value: 0, comparison: 'equals' },
    ],
    priority: 8,
    isUrgent: false,
  },

  /**
   * Revive fallen ally
   * - Ally status changed from KO to Active
   * - Priority 9 (high priority for saving allies)
   */
  ReviveAlly: {
    name: 'Revive Ally',
    conditions: [
      { property: 'status.ally', value: 'active', comparison: 'equals' },
    ],
    priority: 9,
    isUrgent: false,
  },
};

/**
 * Create default GOAP planner with QSR-compliant actions
 */
export function createDefaultGOAPPlanner(maxDepth: number = 5): GOAPPlanner {
  const actions = createStandardActions();
  return new GOAPPlanner(actions, maxDepth);
}

// ============================================================================
// GOAP Action Validator
// ============================================================================

/**
 * Validation result for GOAP action
 */
export interface ActionValidation {
  /** Whether action is valid */
  isValid: boolean;
  /** List of validation errors */
  errors: string[];
  /** List of validation warnings */
  warnings: string[];
}

/**
 * Validate GOAP action against current game state
 * 
 * This provides runtime verification that planned actions
 * are actually executable in the current game context.
 */
export function validateAction(
  action: GOAPAction,
  context: AIContext,
  target?: Character,
  position?: Position
): ActionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check character status
  if (context.character.state.isEliminated) {
    errors.push('Character is Eliminated and cannot act');
    return { isValid: false, errors, warnings };
  }

  if (context.character.state.isKOd) {
    errors.push('Character is KO\'d and cannot act');
    return { isValid: false, errors, warnings };
  }

  if (!context.character.state.isAttentive) {
    errors.push('Character is Distracted and cannot act');
    return { isValid: false, errors, warnings };
  }

  if (!context.character.state.isOrdered) {
    errors.push('Character is Disordered and must take compulsory actions');
    return { isValid: false, errors, warnings };
  }

  // Check AP availability
  const apCost = action.cost;
  if (context.apRemaining < apCost) {
    errors.push(`Insufficient AP: need ${apCost}, have ${context.apRemaining}`);
  }

  // Action-specific validation
  switch (action.type) {
    case 'move':
      validateMoveAction(context, position, errors, warnings);
      break;
    case 'close_combat':
      validateCloseCombatAction(context, target, errors, warnings);
      break;
    case 'ranged_combat':
      validateRangedCombatAction(context, target, errors, warnings);
      break;
    case 'disengage':
      validateDisengageAction(context, errors, warnings);
      break;
    case 'rally':
      validateRallyAction(context, target, errors, warnings);
      break;
    case 'revive':
      validateReviveAction(context, target, errors, warnings);
      break;
    case 'wait':
      validateWaitAction(context, errors, warnings);
      break;
    case 'hide':
      validateHideAction(context, errors, warnings);
      break;
    case 'detect':
      validateDetectAction(context, target, errors, warnings);
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateMoveAction(
  context: AIContext,
  position: Position | undefined,
  errors: string[],
  warnings: string[]
): void {
  if (!position) {
    errors.push('Move action requires target position');
    return;
  }

  const startPos = context.battlefield.getCharacterPosition(context.character);
  if (!startPos) {
    errors.push('Cannot determine character starting position');
    return;
  }

  const dx = position.x - startPos.x;
  const dy = position.y - startPos.y;
  const distance = Math.hypot(dx, dy);
  const mov = context.character.finalAttributes.mov ?? 2;

  if (distance > mov * 2) {
    errors.push(`Destination too far: ${distance.toFixed(1)} MU exceeds max movement (${mov * 2} MU)`);
  } else if (distance > mov) {
    warnings.push(`Destination requires Sprint or full movement (${distance.toFixed(1)} MU > ${mov} MOV)`);
  }

  // Check for engagement (should disengage first)
  if (context.battlefield.isEngaged?.(context.character)) {
    errors.push('Cannot move while engaged - must Disengage first');
  }
}

function validateCloseCombatAction(
  context: AIContext,
  target: Character | undefined,
  errors: string[],
  warnings: string[]
): void {
  if (!target) {
    errors.push('Close Combat requires target character');
    return;
  }

  if (!context.battlefield.isEngaged?.(context.character)) {
    errors.push('Not engaged with target - must move into base contact first');
  }

  // Check for melee weapon
  const hasMeleeWeapon = context.character.profile?.items?.some(item => {
    const classification = item.classification || item.class || '';
    return classification.toLowerCase().includes('melee') || 
           classification.toLowerCase().includes('natural');
  });

  if (!hasMeleeWeapon) {
    warnings.push('No melee weapon equipped - using Improvised Melee');
  }
}

function validateRangedCombatAction(
  context: AIContext,
  target: Character | undefined,
  errors: string[],
  warnings: string[]
): void {
  if (!target) {
    errors.push('Ranged Combat requires target character');
    return;
  }

  // Check LOS
  const attackerModel = buildSpatialModelForValidation(context.character, context.battlefield);
  const targetModel = buildSpatialModelForValidation(target, context.battlefield);
  
  if (!attackerModel || !targetModel) {
    errors.push('Cannot determine positions for LOS check');
    return;
  }

  // Check engagement (can't do ranged combat while engaged)
  if (context.battlefield.isEngaged?.(context.character)) {
    errors.push('Cannot perform ranged combat while engaged');
  }

  // Check for ranged weapon
  const hasRangedWeapon = context.character.profile?.items?.some(item => {
    const classification = item.classification || item.class || '';
    return classification.toLowerCase().includes('bow') || 
           classification.toLowerCase().includes('thrown') ||
           classification.toLowerCase().includes('firearm') ||
           classification.toLowerCase().includes('range');
  });

  if (!hasRangedWeapon) {
    errors.push('No ranged weapon equipped');
  }
}

function validateDisengageAction(
  context: AIContext,
  errors: string[],
  warnings: string[]
): void {
  if (!context.battlefield.isEngaged?.(context.character)) {
    errors.push('Not engaged - Disengage only valid when engaged');
  }
}

function validateRallyAction(
  context: AIContext,
  target: Character | undefined,
  errors: string[],
  warnings: string[]
): void {
  if (!target) {
    errors.push('Rally requires target character');
    return;
  }

  if (target.state.fearTokens <= 0) {
    errors.push('Target has no Fear tokens to remove');
  }

  // Check cohesion (simplified - should check actual cohesion distance)
  const myPos = context.battlefield.getCharacterPosition(context.character);
  const targetPos = context.battlefield.getCharacterPosition(target);
  
  if (myPos && targetPos) {
    const distance = Math.hypot(targetPos.x - myPos.x, targetPos.y - myPos.y);
    const cohesionRange = 8; // Simplified cohesion
    if (distance > cohesionRange) {
      errors.push(`Target out of Cohesion range (${distance.toFixed(1)} MU > ${cohesionRange} MU)`);
    }
  }
}

function validateReviveAction(
  context: AIContext,
  target: Character | undefined,
  errors: string[],
  warnings: string[]
): void {
  if (!target) {
    errors.push('Revive requires target character');
    return;
  }

  if (!target.state.isKOd) {
    errors.push('Target is not KO\'d - Revive only valid for KO\'d characters');
  }

  // Check base contact
  const myPos = context.battlefield.getCharacterPosition(context.character);
  const targetPos = context.battlefield.getCharacterPosition(target);
  
  if (myPos && targetPos) {
    const distance = Math.hypot(targetPos.x - myPos.x, targetPos.y - myPos.y);
    if (distance > 1) {
      errors.push(`Target not in base contact (${distance.toFixed(1)} MU > 1 MU)`);
    }
  }
}

function validateWaitAction(
  context: AIContext,
  errors: string[],
  warnings: string[]
): void {
  if (context.apRemaining < 2) {
    errors.push(`Wait requires 2 AP, have ${context.apRemaining}`);
  }

  if (context.character.state.isWaiting) {
    warnings.push('Character already in Wait status');
  }
}

function validateHideAction(
  context: AIContext,
  errors: string[],
  warnings: string[]
): void {
  if (context.character.state.isHidden) {
    errors.push('Character is already Hidden');
  }

  // Check for cover (simplified - should check actual terrain)
  const hasCover = true; // TODO: Check actual terrain
  if (!hasCover) {
    errors.push('No Cover available for Hide');
  }
}

function validateDetectAction(
  context: AIContext,
  target: Character | undefined,
  errors: string[],
  warnings: string[]
): void {
  if (!target) {
    errors.push('Detect requires target character');
    return;
  }

  if (!target.state.isHidden) {
    errors.push('Target is not Hidden - Detect only valid vs Hidden targets');
  }
}

function buildSpatialModelForValidation(character: Character, battlefield: any) {
  const position = battlefield.getCharacterPosition(character);
  if (!position) return null;
  const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
  return {
    id: character.id,
    position,
    baseDiameter: siz / 3, // Simplified
    siz,
  };
}

/**
 * Log GOAP plan execution for debugging
 */
export function logPlanExecution(
  plan: ActionPlan | null,
  goal: GOAPGoal,
  context: AIContext
): void {
  console.log(`[GOAP] Goal: ${goal.name} (priority: ${goal.priority})`);
  
  if (!plan) {
    console.log(`[GOAP] ❌ No plan found`);
    return;
  }

  console.log(`[GOAP] ✓ Plan found: ${plan.actions.length} actions, cost: ${plan.totalCost}`);
  console.log(`[GOAP] Success probability: ${(plan.successProbability * 100).toFixed(0)}%`);
  
  plan.actions.forEach((action, index) => {
    console.log(`[GOAP]   ${index + 1}. ${action.name} (cost: ${action.cost})`);
    if (action.preconditions.length > 0) {
      console.log(`[GOAP]      Preconditions: ${action.preconditions.map(p => p.property).join(', ')}`);
    }
    if (action.effects.length > 0) {
      console.log(`[GOAP]      Effects: ${action.effects.map(e => `${e.property} ${e.effectType} ${e.value}`).join(', ')}`);
    }
  });
}

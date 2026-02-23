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
// Standard GOAP Actions
// ============================================================================

export const StandardActions = {
  /** Move to position */
  Move: {
    name: 'Move',
    type: 'move' as ActionType,
    preconditions: [],
    effects: [
      { property: 'position', value: null, effectType: 'set' as const },
    ],
    cost: 1,
    targetsCharacter: false,
    targetsPosition: true,
  },

  /** Close combat attack */
  CloseCombat: {
    name: 'Close Combat',
    type: 'close_combat' as ActionType,
    preconditions: [
      { property: 'engaged', value: null, comparison: 'exists' as const },
    ],
    effects: [
      { property: 'wounds.enemy', value: 1, effectType: 'add' as const },
      { property: 'engaged', value: null, effectType: 'remove' as const },
    ],
    cost: 1,
    targetsCharacter: true,
    targetsPosition: false,
  },

  /** Ranged combat attack */
  RangedCombat: {
    name: 'Ranged Combat',
    type: 'ranged_combat' as ActionType,
    preconditions: [
      { property: 'hasLOS', value: true, comparison: 'equals' as const },
    ],
    effects: [
      { property: 'wounds.enemy', value: 1, effectType: 'add' as const },
    ],
    cost: 1,
    targetsCharacter: true,
    targetsPosition: false,
  },

  /** Disengage from melee */
  Disengage: {
    name: 'Disengage',
    type: 'disengage' as ActionType,
    preconditions: [
      { property: 'engaged', value: null, comparison: 'exists' as const },
    ],
    effects: [
      { property: 'engaged', value: null, effectType: 'delete' as const },
    ],
    cost: 1,
    targetsCharacter: true,
    targetsPosition: false,
  },

  /** Rally ally (remove fear) */
  Rally: {
    name: 'Rally',
    type: 'rally' as ActionType,
    preconditions: [
      { property: 'fear', value: 0, comparison: 'greater_than' as const },
    ],
    effects: [
      { property: 'fear', value: 1, effectType: 'remove' as const },
    ],
    cost: 1,
    targetsCharacter: true,
    targetsPosition: false,
  },

  /** Revive KO'd ally */
  Revive: {
    name: 'Revive',
    type: 'revive' as ActionType,
    preconditions: [
      { property: 'status', value: 'ko', comparison: 'equals' as const },
    ],
    effects: [
      { property: 'status', value: 'active', effectType: 'set' as const },
      { property: 'wounds', value: 2, effectType: 'add' as const },
    ],
    cost: 1,
    targetsCharacter: true,
    targetsPosition: false,
  },

  /** Wait for opportunity */
  Wait: {
    name: 'Wait',
    type: 'wait' as ActionType,
    preconditions: [],
    effects: [
      { property: 'status', value: 'waiting', effectType: 'set' as const },
    ],
    cost: 2,
    targetsCharacter: false,
    targetsPosition: false,
  },

  /** Hold position */
  Hold: {
    name: 'Hold',
    type: 'hold' as ActionType,
    preconditions: [],
    effects: [],
    cost: 0,
    targetsCharacter: false,
    targetsPosition: false,
  },
};

/**
 * Standard GOAP Goals
 */
export const StandardGoals = {
  /** Eliminate all enemies */
  EliminateEnemies: {
    name: 'Eliminate Enemies',
    conditions: [
      { property: 'status.enemy', value: 'eliminated', comparison: 'equals' as const },
    ],
    priority: 5,
    isUrgent: false,
  },

  /** Survive (don't be eliminated) */
  Survive: {
    name: 'Survive',
    conditions: [
      { property: 'status.self', value: 'eliminated', comparison: 'not_equals' as const },
    ],
    priority: 10,
    isUrgent: true,
  },

  /** Protect ally */
  ProtectAlly: {
    name: 'Protect Ally',
    conditions: [
      { property: 'status.ally', value: 'eliminated', comparison: 'not_equals' as const },
    ],
    priority: 7,
    isUrgent: false,
  },

  /** Disengage from combat */
  DisengageCombat: {
    name: 'Disengage',
    conditions: [
      { property: 'engaged.self', value: null, comparison: 'exists' as const },
    ],
    priority: 6,
    isUrgent: true,
  },

  /** Move to position */
  ReachPosition: {
    name: 'Reach Position',
    conditions: [
      { property: 'position', value: null, comparison: 'exists' as const },
    ],
    priority: 3,
    isUrgent: false,
  },
};

/**
 * Create default GOAP planner with standard actions
 */
export function createDefaultGOAPPlanner(maxDepth: number = 5): GOAPPlanner {
  const actions = [
    StandardActions.Move,
    StandardActions.CloseCombat,
    StandardActions.RangedCombat,
    StandardActions.Disengage,
    StandardActions.Rally,
    StandardActions.Revive,
    StandardActions.Wait,
    StandardActions.Hold,
  ];

  return new GOAPPlanner(actions, maxDepth);
}

/**
 * Hierarchical Finite State Machine (HFSM)
 * 
 * Manages action execution with clear state transitions.
 * Supports nested states for complex behavior.
 */

import { AIContext } from './AIController';
import { Character } from '../../core/Character';
import { isAttackableEnemy } from './ai-utils';

/**
 * State status
 */
export enum StateStatus {
  /** State is active and running */
  ACTIVE = 'ACTIVE',
  /** State has completed successfully */
  COMPLETE = 'COMPLETE',
  /** State was interrupted */
  INTERRUPTED = 'INTERRUPTED',
  /** State failed */
  FAILED = 'FAILED',
}

/**
 * Base state class
 */
export abstract class State {
  /** State name for debugging */
  name: string;
  /** Parent state (for hierarchical states) */
  parent?: HierarchicalState;
  /** Current status */
  status: StateStatus = StateStatus.ACTIVE;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Called when entering this state
   */
  onEnter?(context: AIContext): void;

  /**
   * Called each tick while in this state
   */
  abstract update(context: AIContext): StateStatus;

  /**
   * Called when exiting this state
   */
  onExit?(context: AIContext, status: StateStatus): void;

  /**
   * Called when an interrupt occurs
   */
  onInterrupt?(context: AIContext): void;
}

/**
 * Hierarchical state that can contain sub-states
 */
export class HierarchicalState extends State {
  subStates: Map<string, State> = new Map();
  currentState?: State;
  initialState?: string;

  constructor(name: string) {
    super(name);
  }

  /**
   * Add a sub-state
   */
  addState(state: State, isInitial: boolean = false): void {
    state.parent = this;
    this.subStates.set(state.name, state);
    if (isInitial || !this.initialState) {
      this.initialState = state.name;
    }
  }

  /**
   * Get a sub-state by name
   */
  getState(name: string): State | undefined {
    return this.subStates.get(name);
  }

  onEnter(context: AIContext): void {
    if (this.initialState && !this.currentState) {
      this.transitionTo(this.initialState, context);
    }
  }

  update(context: AIContext): StateStatus {
    if (!this.currentState) {
      if (this.initialState) {
        this.transitionTo(this.initialState, context);
      } else {
        return StateStatus.COMPLETE;
      }
    }

    const subStatus = this.currentState?.update(context);

    if (subStatus === StateStatus.COMPLETE) {
      this.currentState?.onExit?.(context, subStatus);
      this.currentState = undefined;
      // Transition to initial state again or complete
      if (this.initialState) {
        this.transitionTo(this.initialState, context);
      } else {
        return StateStatus.COMPLETE;
      }
    } else if (subStatus === StateStatus.INTERRUPTED || subStatus === StateStatus.FAILED) {
      this.currentState?.onExit?.(context, subStatus);
      this.currentState = undefined;
      return subStatus;
    }

    return StateStatus.ACTIVE;
  }

  onExit(context: AIContext, status: StateStatus): void {
    if (this.currentState) {
      this.currentState.onExit?.(context, status);
      this.currentState = undefined;
    }
  }

  onInterrupt(context: AIContext): void {
    if (this.currentState) {
      this.currentState.onInterrupt?.(context);
      this.currentState.onExit?.(context, StateStatus.INTERRUPTED);
      this.currentState = undefined;
    }
  }

  /**
   * Transition to a different sub-state
   */
  transitionTo(stateName: string, context: AIContext): boolean {
    const newState = this.subStates.get(stateName);
    if (!newState) {
      console.warn(`State "${stateName}" not found in "${this.name}"`);
      return false;
    }

    if (this.currentState) {
      this.currentState.onExit?.(context, StateStatus.COMPLETE);
    }

    this.currentState = newState;
    newState.onEnter?.(context);
    return true;
  }

  /**
   * Get the current active state (including nested)
   */
  getActiveState(): State | undefined {
    if (!this.currentState) return undefined;
    if (this.currentState instanceof HierarchicalState) {
      return this.currentState.getActiveState() || this.currentState;
    }
    return this.currentState;
  }
}

/**
 * FSM Manager
 * 
 * Manages the state machine lifecycle.
 */
export class FSM {
  /** Root state */
  root: HierarchicalState;
  /** Current state path (for debugging) */
  private statePath: string[] = [];

  constructor(root: HierarchicalState) {
    this.root = root;
    this.statePath = [root.name];
  }

  /**
   * Start the FSM
   */
  start(context: AIContext): void {
    this.root.onEnter?.(context);
    this.updateStatePath();
  }

  /**
   * Update the FSM
   */
  update(context: AIContext): StateStatus {
    const status = this.root.update(context);
    this.updateStatePath();
    return status;
  }

  /**
   * Stop the FSM
   */
  stop(context: AIContext): void {
    this.root.onExit?.(context, StateStatus.INTERRUPTED);
  }

  /**
   * Interrupt the current state
   */
  interrupt(context: AIContext): void {
    this.root.onInterrupt?.(context);
  }

  /**
   * Get the current active state
   */
  getCurrentState(): State | undefined {
    return this.root.getActiveState();
  }

  /**
   * Get the current state path (for debugging)
   */
  getStatePath(): string[] {
    return this.statePath;
  }

  /**
   * Check if in a specific state
   */
  isInState(stateName: string): boolean {
    return this.statePath.includes(stateName);
  }

  private updateStatePath(): void {
    this.statePath = [];
    let current: State | undefined = this.root;
    while (current) {
      this.statePath.push(current.name);
      if (current instanceof HierarchicalState) {
        current = current.currentState;
      } else {
        break;
      }
    }
  }
}

// ============================================================================
// Character Action States
// ============================================================================

/**
 * Idle state - evaluating options
 */
export class IdleState extends State {
  constructor(name?: string) {
    super(name || 'Idle');
  }

  update(context: AIContext): StateStatus {
    // Idle completes immediately - decision should be made elsewhere
    return StateStatus.COMPLETE;
  }
}

/**
 * Moving state - following a path
 */
export class MovingState extends State {
  targetPosition?: { x: number; y: number };
  path?: Array<{ x: number; y: number }>;
  currentWaypoint: number = 0;

  constructor(name?: string) {
    super(name || 'Moving');
  }

  onEnter(context: AIContext): void {
    this.currentWaypoint = 0;
  }

  update(context: AIContext): StateStatus {
    if (!this.targetPosition) {
      return StateStatus.COMPLETE;
    }

    const pos = context.battlefield.getCharacterPosition(context.character);
    if (!pos) {
      return StateStatus.FAILED;
    }

    // Check if arrived
    const dx = pos.x - this.targetPosition.x;
    const dy = pos.y - this.targetPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.5) {
      return StateStatus.COMPLETE;
    }

    // Movement is handled by GameManager, we just track progress
    return StateStatus.ACTIVE;
  }

  setTarget(position: { x: number; y: number }): void {
    this.targetPosition = position;
  }
}

/**
 * Attacking state - executing an attack
 */
export class AttackingState extends State {
  target?: Character;
  attackType: 'melee' | 'ranged' = 'melee';
  attackComplete: boolean = false;

  constructor(name?: string) {
    super(name || 'Attacking');
  }

  update(context: AIContext): StateStatus {
    if (!this.target || this.attackComplete) {
      return StateStatus.COMPLETE;
    }

    if (!isAttackableEnemy(context.character, this.target, context.config)) {
      return StateStatus.COMPLETE;
    }

    // Attack execution is handled by GameManager
    // We just mark as complete after one attempt
    this.attackComplete = true;
    return StateStatus.COMPLETE;
  }

  setTarget(target: Character, type: 'melee' | 'ranged'): void {
    this.target = target;
    this.attackType = type;
    this.attackComplete = false;
  }
}

/**
 * Disengaging state - breaking from melee
 */
export class DisengagingState extends State {
  target?: Character;
  complete: boolean = false;

  constructor(name?: string) {
    super(name || 'Disengaging');
  }

  update(context: AIContext): StateStatus {
    if (this.complete || !this.target) {
      return StateStatus.COMPLETE;
    }

    // Check if no longer engaged
    const engaged = context.battlefield.isEngaged?.(context.character);
    if (!engaged) {
      return StateStatus.COMPLETE;
    }

    this.complete = true;
    return StateStatus.COMPLETE;
  }

  setTarget(target: Character): void {
    this.target = target;
    this.complete = false;
  }
}

/**
 * Reacting state - responding to interrupt
 */
export class ReactingState extends State {
  reactType: 'standard_react' | 'counter_strike' | 'counter_fire' | 'counter_charge' = 'standard_react';
  target?: Character;
  complete: boolean = false;

  constructor(name?: string) {
    super(name || 'Reacting');
  }

  update(context: AIContext): StateStatus {
    if (this.complete) {
      return StateStatus.COMPLETE;
    }

    this.complete = true;
    return StateStatus.COMPLETE;
  }

  setReact(type: typeof this.reactType, target: Character): void {
    this.reactType = type;
    this.target = target;
    this.complete = false;
  }
}

/**
 * Compulsory state - fear/disorder actions
 */
export class CompulsoryState extends State {
  actionsRemaining: string[] = [];

  constructor(name?: string) {
    super(name || 'Compulsory');
  }

  onEnter(context: AIContext): void {
    // Build action list based on fear level
    const fearTokens = context.character.state.fearTokens;
    this.actionsRemaining = [];

    if (context.battlefield.isEngaged?.(context.character)) {
      this.actionsRemaining.push('disengage');
    }

    if (fearTokens >= 2) {
      this.actionsRemaining.push('move_to_safety');
    }

    if (fearTokens >= 3) {
      this.actionsRemaining.push('exit_battlefield');
    }
  }

  update(context: AIContext): StateStatus {
    if (this.actionsRemaining.length === 0) {
      return StateStatus.COMPLETE;
    }

    // Execute next compulsory action
    // (Actual execution handled by AI controller)
    this.actionsRemaining.shift();
    return StateStatus.ACTIVE;
  }
}

/**
 * Create the default character FSM
 */
export function createCharacterFSM(): FSM {
  const root = new HierarchicalState('Root');

  // Combat state (hierarchical)
  const combatState = new HierarchicalState('Combat');
  combatState.addState(new AttackingState('MeleeAttack'), true);
  combatState.addState(new AttackingState('RangedAttack'));
  combatState.addState(new DisengagingState('Disengage'));

  // Movement state
  const moveState = new MovingState();

  // React state
  const reactState = new ReactingState();

  // Compulsory state
  const compulsoryState = new CompulsoryState();

  // Add states to root
  root.addState(new IdleState('Idle'), true);
  root.addState(combatState);
  root.addState(moveState);
  root.addState(reactState);
  root.addState(compulsoryState);

  return new FSM(root);
}

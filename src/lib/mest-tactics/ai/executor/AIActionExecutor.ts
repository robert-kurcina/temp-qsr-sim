/**
 * AI Action Executor - Phase 4 Integration
 *
 * Bridges AI decisions (from SideAI → AssemblyAI → CharacterAI) to GameManager execution.
 * Handles action validation, execution, failure handling, and replanning.
 */

import { Character } from '../core/Character';
import { Battlefield } from '../battlefield/Battlefield';
import { Position } from '../battlefield/Position';
import { Item } from '../core/Item';
import { GameManager } from '../engine/GameManager';
import { ActionDecision, ActionType } from '../core/AIController';
import { validateAction, ActionValidation } from '../tactical/GOAP';
import { attemptHide, attemptDetect } from '../../status/concealment';

/**
 * Execution result for an AI action
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Action that was attempted */
  action: ActionDecision;
  /** Character that performed the action */
  character: Character;
  /** Validation result */
  validation?: ActionValidation;
  /** Error message if failed */
  error?: string;
  /** Whether replanning is recommended */
  replanningRecommended: boolean;
}

/**
 * AI Action Executor configuration
 */
export interface AIExecutorConfig {
  /** Whether to validate actions before execution */
  validateActions: boolean;
  /** Whether to attempt replanning on failure */
  enableReplanning: boolean;
  /** Maximum replan attempts per turn */
  maxReplanAttempts: number;
  /** Log execution details */
  verboseLogging: boolean;
}

/**
 * Default executor configuration
 */
export const DEFAULT_EXECUTOR_CONFIG: AIExecutorConfig = {
  validateActions: true,
  enableReplanning: true,
  maxReplanAttempts: 2,
  verboseLogging: false,
};

/**
 * Context for AI action execution
 */
export interface AIExecutionContext {
  /** Current turn number */
  currentTurn: number;
  /** Current round number */
  currentRound: number;
  /** AP remaining for character */
  apRemaining: number;
  /** All active allies */
  allies: Character[];
  /** All active enemies */
  enemies: Character[];
  /** Battlefield reference */
  battlefield: Battlefield;
}

/**
 * AI Action Executor
 * 
 * Executes AI decisions through the GameManager.
 */
export class AIActionExecutor {
  config: AIExecutorConfig;
  private manager: GameManager;
  private replanAttempts: Map<string, number> = new Map();

  constructor(manager: GameManager, config: Partial<AIExecutorConfig> = {}) {
    this.manager = manager;
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
  }

  /**
   * Execute an AI action decision
   */
  executeAction(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    // Track replan attempts
    const key = `${character.id}-${context.currentTurn}`;
    const attempts = this.replanAttempts.get(key) ?? 0;

    if (attempts >= this.config.maxReplanAttempts) {
      return {
        success: false,
        action: decision,
        character,
        error: `Max replan attempts (${this.config.maxReplanAttempts}) reached`,
        replanningRecommended: false,
      };
    }

    // Validate action if configured
    if (this.config.validateActions) {
      const validation = this.validateDecision(decision, character, context);
      if (!validation.isValid) {
        this.log(`Validation failed: ${validation.errors.join(', ')}`);
        
        if (this.config.enableReplanning) {
          this.replanAttempts.set(key, attempts + 1);
          return {
            success: false,
            action: decision,
            character,
            validation,
            error: validation.errors.join(', '),
            replanningRecommended: true,
          };
        }

        return {
          success: false,
          action: decision,
          character,
          validation,
          error: validation.errors.join(', '),
          replanningRecommended: false,
        };
      }
    }

    // Execute the action
    try {
      const result = this.executeDecision(decision, character, context);
      
      // Reset replan attempts on success
      if (result.success) {
        this.replanAttempts.delete(key);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Execution error: ${errorMessage}`);

      if (this.config.enableReplanning) {
        this.replanAttempts.set(key, attempts + 1);
        return {
          success: false,
          action: decision,
          character,
          error: errorMessage,
          replanningRecommended: true,
        };
      }

      return {
        success: false,
        action: decision,
        character,
        error: errorMessage,
        replanningRecommended: false,
      };
    }
  }

  /**
   * Validate an action decision
   */
  private validateDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ActionValidation {
    // Map AI action type to GOAP action type for validation
    const goapType = this.mapActionType(decision.type);
    
    // Create a pseudo-GOAP action for validation
    const pseudoAction = {
      name: decision.type,
      type: goapType,
      preconditions: [],
      effects: [],
      cost: decision.requiresAP ? 1 : 0,
      targetsCharacter: !!decision.target,
      targetsPosition: !!decision.position,
    };

    // Create AI context for validation
    const aiContext = {
      character,
      allies: context.allies,
      enemies: context.enemies,
      battlefield: context.battlefield,
      currentTurn: context.currentTurn,
      currentRound: context.currentRound,
      apRemaining: context.apRemaining,
      knowledge: {
        knownEnemies: new Map(),
        knownTerrain: new Map(),
        lastKnownPositions: new Map(),
        threatZones: [],
        safeZones: [],
        lastUpdated: context.currentTurn,
      },
      config: {
        aggression: 0.5,
        caution: 0.5,
        accuracyModifier: 0,
        godMode: true,
      },
    };

    return validateAction(
      pseudoAction,
      aiContext,
      decision.target,
      decision.position
    );
  }

  /**
   * Execute a validated decision
   */
  private executeDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    const { battlefield } = context;

    switch (decision.type) {
      case 'hold':
        return this.executeHold(character);

      case 'move':
        if (!decision.position) {
          return this.createFailure(decision, character, 'Move requires position');
        }
        return this.executeMove(character, decision.position, context);

      case 'close_combat':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Close combat requires target');
        }
        return this.executeCloseCombat(character, decision.target, decision.weapon, context);

      case 'ranged_combat':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Ranged combat requires target');
        }
        return this.executeRangedCombat(character, decision.target, decision.weapon, context);

      case 'disengage':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Disengage requires target');
        }
        return this.executeDisengage(character, decision.target, context);

      case 'rally':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Rally requires target');
        }
        return this.executeRally(character, decision.target, context);

      case 'revive':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Revive requires target');
        }
        return this.executeRevive(character, decision.target, context);

      case 'wait':
        return this.executeWait(character);

      case 'hide':
        return this.executeHide(character, context);

      case 'detect':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Detect requires target');
        }
        return this.executeDetect(character, decision.target, context);

      case 'none':
        return this.createSuccess(decision, character, 'No action taken');

      default:
        return this.createFailure(decision, character, `Unknown action type: ${decision.type}`);
    }
  }

  /**
   * Execute Hold action
   */
  private executeHold(character: Character): ExecutionResult {
    // Hold is a no-op - character does nothing
    return this.createSuccess(
      { type: 'hold', reason: 'Hold position', priority: 0, requiresAP: false },
      character,
      'Character holds position'
    );
  }

  /**
   * Execute Move action
   */
  private executeMove(
    character: Character,
    position: Position,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'move', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    // Find a weapon for opportunity attack check
    const weapon = this.findMeleeWeapon(character);
    const result = this.manager.executeMove(character, position, {
      opponents: context.enemies,
      allowOpportunityAttack: true,
      opportunityWeapon: weapon ?? undefined,
    });

    if (result.moved) {
      return this.createSuccess(
        { type: 'move', position, reason: 'Move to position', priority: 3, requiresAP: true },
        character,
        `Moved to (${position.x}, ${position.y})`
      );
    }

    return this.createFailure(
      { type: 'move', position, reason: 'Move to position', priority: 3, requiresAP: true },
      character,
      result.reason ?? 'Move failed'
    );
  }

  /**
   * Execute Close Combat action
   */
  private executeCloseCombat(
    character: Character,
    target: Character,
    weapon: Item | undefined,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'close_combat', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    const selectedWeapon = weapon ?? this.findMeleeWeapon(character);
    if (!selectedWeapon) {
      return this.createFailure(
        { type: 'close_combat', target, reason: 'Close combat', priority: 3, requiresAP: true },
        character,
        'No melee weapon available'
      );
    }

    try {
      const result = this.manager.executeCloseCombatAttack(
        character,
        target,
        selectedWeapon,
        {
          attacker: this.buildSpatialModel(character),
          target: this.buildSpatialModel(target),
          allowBonusActions: true,
        }
      );

      return this.createSuccess(
        { type: 'close_combat', target, weapon: selectedWeapon, reason: 'Close combat attack', priority: 3, requiresAP: true },
        character,
        'Close combat attack executed'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'close_combat', target, weapon: selectedWeapon, reason: 'Close combat', priority: 3, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Attack failed'
      );
    }
  }

  /**
   * Execute Ranged Combat action
   */
  private executeRangedCombat(
    character: Character,
    target: Character,
    weapon: Item | undefined,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'ranged_combat', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    const selectedWeapon = weapon ?? this.findRangedWeapon(character);
    if (!selectedWeapon) {
      return this.createFailure(
        { type: 'ranged_combat', target, reason: 'Ranged combat', priority: 3, requiresAP: true },
        character,
        'No ranged weapon available'
      );
    }

    try {
      // Calculate distance and ORM
      const attackerPos = this.manager.battlefield.getCharacterPosition(character);
      const targetPos = this.manager.battlefield.getCharacterPosition(target);
      
      if (!attackerPos || !targetPos) {
        return this.createFailure(
          { type: 'ranged_combat', target, weapon: selectedWeapon, reason: 'Ranged combat', priority: 3, requiresAP: true },
          character,
          'Missing positions'
        );
      }

      const distance = Math.sqrt(
        Math.pow(attackerPos.x - targetPos.x, 2) +
        Math.pow(attackerPos.y - targetPos.y, 2)
      );

      // Parse weapon OR (e.g., "STR+2", "STR-1", or "12")
      let optimalRange = 0;
      const orValue = selectedWeapon.or;
      if (typeof orValue === 'number') {
        optimalRange = orValue;
      } else if (typeof orValue === 'string') {
        // Parse "STR+2" or "STR-1" format
        const strMatch = orValue.match(/STR\s*([+\-])\s*(\d+)/i);
        if (strMatch) {
          const operator = strMatch[1];
          const strBonus = parseInt(strMatch[2], 10);
          const strAttr = character.finalAttributes?.str ?? character.attributes?.str ?? 2;
          optimalRange = operator === '+' ? strAttr + strBonus : strAttr - strBonus;
        } else {
          // Try parsing as plain number
          optimalRange = parseFloat(orValue) || 0;
        }
      }

      // Calculate ORM (Optimal Range Multiple)
      const orm = optimalRange > 0 ? Math.ceil(distance / optimalRange) - 1 : 0;

      const result = this.manager.executeRangedAttack(
        character,
        target,
        selectedWeapon,
        {
          allowTakeCover: false,
          orm: Math.max(0, orm),
        }
      );

      return this.createSuccess(
        { type: 'ranged_combat', target, weapon: selectedWeapon, reason: 'Ranged combat attack', priority: 3, requiresAP: true },
        character,
        'Ranged combat attack executed'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'ranged_combat', target, weapon: selectedWeapon, reason: 'Ranged combat', priority: 3, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Attack failed'
      );
    }
  }

  /**
   * Execute Disengage action
   */
  private executeDisengage(
    character: Character,
    target: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'disengage', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    const weapon = this.findMeleeWeapon(target);
    if (!weapon) {
      return this.createFailure(
        { type: 'disengage', target, reason: 'Disengage', priority: 3, requiresAP: true },
        character,
        'No weapon for disengage test'
      );
    }

    try {
      const result = this.manager.executeDisengageAction(
        character,
        target,
        weapon,
        {}
      );

      return this.createSuccess(
        { type: 'disengage', target, reason: 'Disengage from combat', priority: 3, requiresAP: true },
        character,
        result.pass ? 'Disengage successful' : 'Disengage failed'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'disengage', target, reason: 'Disengage', priority: 3, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Disengage failed'
      );
    }
  }

  /**
   * Execute Rally action
   */
  private executeRally(
    character: Character,
    target: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'rally', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    try {
      const result = this.manager.executeRally(character, target);

      return this.createSuccess(
        { type: 'rally', target, reason: 'Rally ally', priority: 3, requiresAP: true },
        character,
        result.success ? 'Rally successful' : 'Rally failed'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'rally', target, reason: 'Rally', priority: 3, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Rally failed'
      );
    }
  }

  /**
   * Execute Revive action
   */
  private executeRevive(
    character: Character,
    target: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'revive', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    try {
      const result = this.manager.executeRevive(character, target);

      return this.createSuccess(
        { type: 'revive', target, reason: 'Revive ally', priority: 3, requiresAP: true },
        character,
        result.success ? 'Revive successful' : 'Revive failed'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'revive', target, reason: 'Revive', priority: 3, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Revive failed'
      );
    }
  }

  /**
   * Execute Wait action
   */
  private executeWait(character: Character): ExecutionResult {
    try {
      const result = this.manager.executeWait(character, { spendAp: true });
      if (!result.success) {
        return this.createFailure(
          { type: 'wait', reason: 'Wait', priority: 2, requiresAP: true },
          character,
          result.reason ?? 'Wait failed'
        );
      }
      return this.createSuccess(
        { type: 'wait', reason: 'Wait for opportunity', priority: 2, requiresAP: true },
        character,
        'Character enters Wait status'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'wait', reason: 'Wait', priority: 2, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Wait failed'
      );
    }
  }

  /**
   * Execute Hide action
   */
  private executeHide(character: Character, context: AIExecutionContext): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'hide', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    try {
      const result = attemptHide(
        this.manager.battlefield,
        character,
        context.enemies,
        (amount: number) => this.manager.spendAp(character, amount),
      );
      if (!result.canHide) {
        return this.createFailure(
          { type: 'hide', reason: 'Hide', priority: 2, requiresAP: true },
          character,
          result.reason ?? 'Hide failed'
        );
      }

      return this.createSuccess(
        { type: 'hide', reason: 'Hide from enemies', priority: 2, requiresAP: true },
        character,
        'Hide successful'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'hide', reason: 'Hide', priority: 2, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Hide failed'
      );
    }
  }

  /**
   * Execute Detect action
   */
  private executeDetect(
    character: Character,
    target: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'detect', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    try {
      if (!this.manager.spendAp(character, 1)) {
        return this.createFailure(
          { type: 'detect', target, reason: 'Detect', priority: 2, requiresAP: true },
          character,
          'Not enough AP'
        );
      }
      const result = attemptDetect(
        this.manager.battlefield,
        character,
        target,
        context.enemies,
      );
      if (!result.success) {
        return this.createFailure(
          { type: 'detect', target, reason: 'Detect', priority: 2, requiresAP: true },
          character,
          result.reason ?? 'Detect failed'
        );
      }

      return this.createSuccess(
        { type: 'detect', target, reason: 'Detect hidden enemy', priority: 2, requiresAP: true },
        character,
        'Detect successful'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'detect', target, reason: 'Detect', priority: 2, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Detect failed'
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createSuccess(
    action: ActionDecision,
    character: Character,
    detail: string
  ): ExecutionResult {
    this.log(`${character.id}: ${action.type} - ${detail}`);
    return {
      success: true,
      action,
      character,
      replanningRecommended: false,
    };
  }

  private createFailure(
    action: ActionDecision,
    character: Character,
    error: string
  ): ExecutionResult {
    this.log(`${character.id}: ${action.type} FAILED - ${error}`);
    return {
      success: false,
      action,
      character,
      error,
      replanningRecommended: true,
    };
  }

  private mapActionType(type: ActionType): any {
    const mapping: Record<string, string> = {
      'hold': 'hold',
      'move': 'move',
      'close_combat': 'close_combat',
      'ranged_combat': 'ranged_combat',
      'disengage': 'disengage',
      'rally': 'rally',
      'revive': 'revive',
      'wait': 'wait',
      'hide': 'hide',
      'detect': 'detect',
      'none': 'hold',
    };
    return mapping[type] || 'hold';
  }

  private findMeleeWeapon(character: Character): Item | null {
    const items = character.profile?.items ?? [];
    for (const item of items) {
      const classification = item.classification || item.class || '';
      if (classification.toLowerCase().includes('melee') || 
          classification.toLowerCase().includes('natural')) {
        return item;
      }
    }
    return null;
  }

  private findRangedWeapon(character: Character): Item | null {
    const items = character.profile?.items ?? [];
    for (const item of items) {
      const classification = item.classification || item.class || '';
      // Check for ranged weapon classifications
      if (classification.toLowerCase().includes('bow') ||
          classification.toLowerCase().includes('thrown') ||
          classification.toLowerCase().includes('firearm') ||
          classification.toLowerCase().includes('range') ||
          classification.toLowerCase().includes('support')) {
        return item;
      }
      // Check for Melee/Natural weapons with Throwable trait (can be thrown)
      if ((classification.toLowerCase().includes('melee') || classification.toLowerCase().includes('natural')) &&
          item.traits && item.traits.some(t => t.toLowerCase().includes('throwable'))) {
        return item;
      }
    }
    return null;
  }

  private buildSpatialModel(character: Character): any {
    if (!this.manager.battlefield) return null;
    const position = this.manager.battlefield.getCharacterPosition(character);
    if (!position) return null;
    const siz = character.finalAttributes.siz ?? 3;
    return {
      id: character.id,
      position,
      baseDiameter: siz / 3,
      siz,
    };
  }

  private log(message: string): void {
    if (this.config.verboseLogging) {
      console.log(`[AIExecutor] ${message}`);
    }
  }

  /**
   * Reset replan attempts (call at start of each turn)
   */
  resetReplanAttempts(): void {
    this.replanAttempts.clear();
  }
}

/**
 * Create AI Action Executor for a GameManager
 */
export function createAIExecutor(
  manager: GameManager,
  config?: Partial<AIExecutorConfig>
): AIActionExecutor {
  return new AIActionExecutor(manager, config);
}

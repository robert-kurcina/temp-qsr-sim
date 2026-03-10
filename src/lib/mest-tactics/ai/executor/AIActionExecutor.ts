/**
 * AI Action Executor - Phase 4 Integration
 *
 * Bridges AI decisions (from SideAI → AssemblyAI → CharacterAI) to GameManager execution.
 * Handles action validation, execution, failure handling, and replanning.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { Item } from '../../core/Item';
import { GameManager } from '../../engine/GameManager';
import { ActionDecision, ActionType } from '../core/AIController';
import { validateAction, ActionValidation } from '../tactical/GOAP';
import { attemptHide, attemptDetect } from '../../status/concealment';
import { performPushing } from '../../actions/pushing-and-maneuvers';
import { InstrumentationLogger, LoggedActionType, LoggedAction } from '../../instrumentation/QSRInstrumentation';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';
import { getSprintMovementBonus, getLeapAgilityBonus } from '../../traits/combat-traits';
import { assessBestMeleeLegality, getMeleeWeaponsForLegality } from '../shared/MeleeLegality';

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
  /** Actions already executed by this model in the current initiative */
  actionsTakenThisInitiative?: number;
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
  private logger: InstrumentationLogger | null = null;
  private replanAttempts: Map<string, number> = new Map();
  private lastDecision: ActionDecision | null = null;

  constructor(manager: GameManager, config: Partial<AIExecutorConfig> = {}, logger?: InstrumentationLogger) {
    this.manager = manager;
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
    this.logger = logger || null;
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

      // Log action if logger is available
      if (this.logger && result.success) {
        this.logAction(decision, character, context, result);
      }

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
  validateActionDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ActionValidation {
    return this.validateDecision(decision, character, context);
  }

  /**
   * Validate an action decision
   */
  private validateDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ActionValidation {
    if (decision.type === 'close_combat') {
      return this.validateCloseCombatDecision(decision, character, context);
    }
    if (decision.type === 'charge') {
      return this.validateChargeDecision(decision, character, context);
    }

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

  private validateChargeDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ActionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!decision.target) {
      errors.push('Charge requires target');
    }
    if (!decision.position) {
      errors.push('Charge requires destination');
    }
    if (context.apRemaining < 1) {
      errors.push(`Insufficient AP: need 1, have ${context.apRemaining}`);
    }
    if (this.isEngagedWithAnyOpponents(character, context.enemies)) {
      errors.push('Engaged models must Disengage before charging');
    }

    const startPos = context.battlefield.getCharacterPosition(character);
    const targetPos = decision.target ? context.battlefield.getCharacterPosition(decision.target) : undefined;
    if (!startPos) {
      errors.push('Missing charger position');
    }
    if (decision.target && !targetPos) {
      errors.push('Missing charge target position');
    }
    if (decision.target?.state.isKOd || decision.target?.state.isEliminated) {
      errors.push('Charge target is out-of-play');
    }

    if (startPos && decision.position) {
      const maxDistance = this.estimateChargeMovementAllowance(character, context.battlefield, context.enemies);
      const distance = Math.hypot(decision.position.x - startPos.x, decision.position.y - startPos.y);
      if (distance > maxDistance + 0.25) {
        errors.push(`Charge destination out of range: ${distance.toFixed(2)} > ${maxDistance.toFixed(2)}`);
      }
    }

    if (decision.position && targetPos) {
      const attackerModel = {
        id: character.id,
        position: decision.position,
        baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? character.attributes.siz ?? 3),
        siz: character.finalAttributes.siz ?? character.attributes.siz ?? 3,
      };
      const targetModel = {
        id: decision.target!.id,
        position: targetPos,
        baseDiameter: getBaseDiameterFromSiz(decision.target!.finalAttributes.siz ?? decision.target!.attributes.siz ?? 3),
        siz: decision.target!.finalAttributes.siz ?? decision.target!.attributes.siz ?? 3,
      };
      if (!SpatialRules.isEngaged(attackerModel, targetModel)) {
        errors.push('Charge destination does not reach base-contact engagement');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateCloseCombatDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ActionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!decision.target) {
      errors.push('Close combat requires target');
      return { isValid: false, errors, warnings };
    }
    if (context.apRemaining < 1) {
      errors.push(`Insufficient AP: need 1, have ${context.apRemaining}`);
    }
    if (decision.target.state.isKOd || decision.target.state.isEliminated) {
      errors.push('Close combat target is out-of-play');
    }
    const selectedWeapon = decision.weapon ?? this.findMeleeWeapon(character) ?? undefined;
    const actionsTakenThisInitiative = Math.max(0, context.actionsTakenThisInitiative ?? 0);
    const meleeLegality = assessBestMeleeLegality(character, decision.target, context.battlefield, {
      weapons: selectedWeapon ? [selectedWeapon] : getMeleeWeaponsForLegality(character),
      isFirstAction: actionsTakenThisInitiative === 0,
      isFreeAtStart: !this.isEngagedWithAnyOpponents(character, context.enemies),
    });
    if (!meleeLegality.canAttack) {
      errors.push('Target not in legal melee range (base-contact/reach/overreach)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute a validated decision
   */
  private executeDecision(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    // Store decision for sub-action execution (e.g., fiddle stow/unstow)
    this.lastDecision = decision;
    
    const { battlefield } = context;

    switch (decision.type) {
      case 'hold':
        return this.executeHold(character);

      case 'move':
        if (!decision.position) {
          return this.createFailure(decision, character, 'Move requires position');
        }
        return this.executeMove(character, decision.position, context);

      case 'charge':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Charge requires target');
        }
        if (!decision.position) {
          return this.createFailure(decision, character, 'Charge requires destination');
        }
        return this.executeCharge(character, decision.target, decision.position, decision.weapon, context);

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
        return this.executeWait(character, context);

      case 'pushing':
        return this.executePushing(character, context);

      case 'refresh':
        return this.executeRefresh(character, context);

      case 'hide':
        return this.executeHide(character, context);

      case 'detect':
        if (!decision.target) {
          return this.createFailure(decision, character, 'Detect requires target');
        }
        return this.executeDetect(character, decision.target, context);

      case 'fiddle':
        return this.executeFiddle(character);

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
   * Execute Pushing action (QSR p.789-791)
   * Character gains +1 AP but acquires a Delay token
   * Does NOT cost AP to perform
   */
  private executePushing(
    character: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    if (context.apRemaining > 0) {
      return this.createFailure(
        { type: 'pushing', reason: 'Pushing failed', priority: 2, requiresAP: false },
        character,
        'Pushing requires 0 AP'
      );
    }
    if (!character.state.isAttentive) {
      return this.createFailure(
        { type: 'pushing', reason: 'Pushing failed', priority: 2, requiresAP: false },
        character,
        'Character is not Attentive'
      );
    }
    const result = performPushing(
      this.manager.activationDeps(),
      character
    );

    if (result.success) {
      return this.createSuccess(
        { type: 'pushing', reason: 'Pushing for extra AP', priority: 2, requiresAP: false },
        character,
        `Pushing: gained ${result.apGained} AP, acquired Delay token`
      );
    }

    return this.createFailure(
      { type: 'pushing', reason: 'Pushing failed', priority: 2, requiresAP: false },
      character,
      result.reason ?? 'Pushing failed'
    );
  }

  /**
   * Execute Refresh action (QSR p.784)
   * Spend 1 IP from Side to remove 1 Delay token from character
   * Does NOT cost AP to perform
   */
  private executeRefresh(
    character: Character,
    context: AIExecutionContext
  ): ExecutionResult {
    // Spend 1 IP and remove 1 Delay token
    const result = this.manager.refreshForCharacter(character);

    if (result) {
      // Log IP spending (grade 2+)
      if (this.logger && this.logger['config'].grade >= 2) {
        // Find character's side for logging
        const side = this.findCharacterSideForLogging(character);
        if (side) {
          this.logger.logIpSpending(side, character.id, 'push' as any, context.currentTurn);
        }
      }
      
      return this.createSuccess(
        { type: 'refresh', reason: 'Refresh: remove Delay token', priority: 2, requiresAP: false },
        character,
        'Refresh: removed 1 Delay token, spent 1 IP'
      );
    }

    return this.createFailure(
      { type: 'refresh', reason: 'Refresh failed', priority: 2, requiresAP: false },
      character,
      'Insufficient IP or no Delay tokens to remove'
    );
  }

  /**
   * Find character's side for logging purposes
   */
  private findCharacterSideForLogging(character: Character): string | null {
    // Try to find side from manager's missionSides
    const missionSides = (this.manager as any).missionSides;
    if (!missionSides) return null;
    
    for (const side of missionSides) {
      if (side.members?.some((m: any) => m.character.id === character.id)) {
        return side.id;
      }
    }
    return null;
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

    // Spend 1 AP for move action
    if (!this.manager.spendAp(character, 1)) {
      return this.createFailure({ type: 'move', reason: '', priority: 0, requiresAP: true }, character, 'Not enough AP');
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
   * Execute Charge action (move into engagement + immediate close combat).
   * Charge spends 1 AP for the combined sequence.
   */
  private executeCharge(
    character: Character,
    target: Character,
    destination: Position,
    weapon: Item | undefined,
    context: AIExecutionContext
  ): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure(
        { type: 'charge', target, position: destination, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        'No battlefield'
      );
    }

    if (this.isEngagedWithAnyOpponents(character, context.enemies)) {
      return this.createFailure(
        { type: 'charge', target, position: destination, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        'Engaged models must Disengage before charging'
      );
    }

    const selectedWeapon = weapon ?? this.findMeleeWeapon(character);
    if (!selectedWeapon) {
      return this.createFailure(
        { type: 'charge', target, position: destination, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        'No melee weapon available'
      );
    }

    if (!this.manager.spendAp(character, 1)) {
      return this.createFailure(
        { type: 'charge', target, position: destination, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        'Not enough AP'
      );
    }

    const moveResult = this.manager.executeMove(character, destination, {
      opponents: context.enemies,
      allowOpportunityAttack: true,
      opportunityWeapon: selectedWeapon,
      isMovingStraight: true,
      isAtStartOrEndOfMovement: false,
    });
    if (!moveResult.moved) {
      return this.createFailure(
        { type: 'charge', target, position: destination, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        moveResult.reason ?? 'Charge move failed'
      );
    }

    const attackerModel = this.buildSpatialModel(character);
    const targetModel = this.buildSpatialModel(target);
    if (!attackerModel || !targetModel || !SpatialRules.isEngaged(attackerModel, targetModel)) {
      return this.createFailure(
        { type: 'charge', target, position: destination, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        'Charge did not end in base-contact engagement'
      );
    }

    try {
      this.manager.executeCloseCombatAttack(
        character,
        target,
        selectedWeapon,
        {
          context: { isCharge: true } as any,
          attacker: attackerModel,
          target: targetModel,
          allowBonusActions: true,
        }
      );
      return this.createSuccess(
        { type: 'charge', target, position: destination, weapon: selectedWeapon, reason: 'Charge attack', priority: 3, requiresAP: true },
        character,
        'Charge executed'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'charge', target, position: destination, weapon: selectedWeapon, reason: 'Charge', priority: 3, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Charge failed'
      );
    }
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

    if (target.state.isKOd || target.state.isEliminated) {
      return this.createFailure(
        { type: 'close_combat', target, weapon: selectedWeapon, reason: 'Close combat', priority: 3, requiresAP: true },
        character,
        'Target is out-of-play'
      );
    }

    const attackerModel = this.buildSpatialModel(character);
    const targetModel = this.buildSpatialModel(target);
    if (!attackerModel || !targetModel) {
      return this.createFailure(
        { type: 'close_combat', target, weapon: selectedWeapon, reason: 'Close combat', priority: 3, requiresAP: true },
        character,
        'Unable to resolve melee positions'
      );
    }
    const meleeLegality = assessBestMeleeLegality(character, target, this.manager.battlefield, {
      weapons: [selectedWeapon],
      isFirstAction: Math.max(0, context.actionsTakenThisInitiative ?? 0) === 0,
      isFreeAtStart: !this.isEngagedWithAnyOpponents(character, context.enemies),
    });
    if (!meleeLegality.canAttack) {
      return this.createFailure(
        { type: 'close_combat', target, weapon: selectedWeapon, reason: 'Close combat', priority: 3, requiresAP: true },
        character,
        'Target not in legal melee range'
      );
    }

    // Spend 1 AP for close combat attack
    if (!this.manager.spendAp(character, 1)) {
      return this.createFailure({ type: 'close_combat', reason: '', priority: 0, requiresAP: true }, character, 'Not enough AP');
    }

    try {
      const result = this.manager.executeCloseCombatAttack(
        character,
        target,
        selectedWeapon,
        {
          attacker: attackerModel,
          target: targetModel,
          context: meleeLegality.requiresOverreach ? { isOverreach: true } : undefined,
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

    // Spend 1 AP for ranged combat attack
    if (!this.manager.spendAp(character, 1)) {
      return this.createFailure({ type: 'ranged_combat', reason: '', priority: 0, requiresAP: true }, character, 'Not enough AP');
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
      const result = this.manager.executeDisengage(
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
  private executeWait(character: Character, context: AIExecutionContext): ExecutionResult {
    try {
      const result = this.manager.executeWait(character, {
        spendAp: true,
        opponents: context.enemies,
        allowRevealReposition: false,
      });
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
   * QSR Line 855: "The first Detect costs zero AP. Otherwise 1 AP."
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
      // QSR Line 855: First Detect per activation is FREE (0 AP)
      const hasDetectedThisActivation = character.state.hasDetectedThisActivation ?? false;
      const apCost = hasDetectedThisActivation ? 1 : 0;

      // QSR Line 855: First Detect is FREE (0 AP), but still counts as an action
      // Only spend AP for subsequent Detects
      if (apCost > 0 && !this.manager.spendAp(character, apCost)) {
        return this.createFailure(
          { type: 'detect', target, reason: 'Detect', priority: 2, requiresAP: true },
          character,
          'Not enough AP'
        );
      }

      // Mark that this character has Detected this activation
      character.state.hasDetectedThisActivation = true;

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
        { type: 'detect', target, reason: `Detect hidden enemy (${apCost === 0 ? 'FREE' : '1 AP'})`, priority: 2, requiresAP: apCost > 0 },
        character,
        `Detect successful (${apCost === 0 ? 'first is free!' : 'subsequent Detect'})`
      );
    } catch (error) {
      return this.createFailure(
        { type: 'detect', target, reason: 'Detect', priority: 2, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Detect failed'
      );
    }
  }

  /**
   * Execute Focus option (QSR Line 859)
   * Focus: Remove Wait status while Attentive to receive +1 Wild die for any Test instead of performing a React.
   * This is called during enemy's action as an alternative to Reacting.
   */
  executeFocus(character: Character): ExecutionResult {
    // Check if character has Wait status
    if (!character.state.isWaiting) {
      return this.createFailure(
        { type: 'focus', reason: 'Focus', priority: 2, requiresAP: false },
        character,
        'Not in Wait status'
      );
    }

    // Check if character is Attentive
    if (!character.state.isAttentive) {
      return this.createFailure(
        { type: 'focus', reason: 'Focus', priority: 2, requiresAP: false },
        character,
        'Not Attentive (must be Attentive to Focus)'
      );
    }

    // Remove Wait status
    character.state.isWaiting = false;

    // Grant Focus bonus (+1w for next Test)
    character.state.hasFocus = true;

    return this.createSuccess(
      { type: 'focus', reason: 'Focus for +1w', priority: 2, requiresAP: false },
      character,
      'Removed Wait status, gain +1 Wild die for next Test'
    );
  }

  /**
   * Execute Fiddle action
   */
  private executeFiddle(character: Character): ExecutionResult {
    if (!this.manager.battlefield) {
      return this.createFailure({ type: 'fiddle', reason: '', priority: 0, requiresAP: true }, character, 'No battlefield');
    }

    try {
      // Check for weapon swap sub-action
      const decision = this.lastDecision;
      if (decision?.subAction === 'unstow' && decision.itemName) {
        const result = this.manager.executeUnstowItem(character, {
          itemName: decision.itemName,
        });
        if (!result.success) {
          return this.createFailure(
            { type: 'fiddle', reason: 'Unstow', priority: 2, requiresAP: true },
            character,
            result.reason || 'Unstow failed'
          );
        }
        return this.createSuccess(
          { type: 'fiddle', reason: `Unstow ${decision.itemName}`, priority: 2, requiresAP: true },
          character,
          `Drew ${decision.itemName}`
        );
      }
      
      if (decision?.subAction === 'stow' && decision.itemName) {
        const result = this.manager.executeStowItem(character, {
          itemName: decision.itemName,
        });
        if (!result.success) {
          return this.createFailure(
            { type: 'fiddle', reason: 'Stow', priority: 2, requiresAP: true },
            character,
            result.reason || 'Stow failed'
          );
        }
        return this.createSuccess(
          { type: 'fiddle', reason: `Stow ${decision.itemName}`, priority: 2, requiresAP: true },
          character,
          `Stowed ${decision.itemName}`
        );
      }

      // Default fiddle action
      const result = this.manager.executeFiddle(character, {
        spendAp: true,
        attribute: 'int',
        difficulty: 2,
      });
      if (!result.success) {
        return this.createFailure(
          { type: 'fiddle', reason: 'Fiddle', priority: 2, requiresAP: true },
          character,
          'Fiddle failed'
        );
      }

      return this.createSuccess(
        { type: 'fiddle', reason: 'Fiddle interaction', priority: 2, requiresAP: true },
        character,
        'Fiddle successful'
      );
    } catch (error) {
      return this.createFailure(
        { type: 'fiddle', reason: 'Fiddle', priority: 2, requiresAP: true },
        character,
        error instanceof Error ? error.message : 'Fiddle failed'
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
      'charge': 'move',
      'close_combat': 'close_combat',
      'ranged_combat': 'ranged_combat',
      'disengage': 'disengage',
      'rally': 'rally',
      'revive': 'revive',
      'wait': 'wait',
      'hide': 'hide',
      'detect': 'detect',
      'fiddle': 'fiddle',
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
    const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
    return {
      id: character.id,
      position,
      baseDiameter: getBaseDiameterFromSiz(siz),
      siz,
    };
  }

  private isEngagedWithTarget(attacker: Character, target: Character): boolean {
    const attackerModel = this.buildSpatialModel(attacker);
    const targetModel = this.buildSpatialModel(target);
    if (!attackerModel || !targetModel) return false;
    return SpatialRules.isEngaged(attackerModel, targetModel);
  }

  private isEngagedWithAnyOpponents(character: Character, opponents: Character[]): boolean {
    const actorModel = this.buildSpatialModel(character);
    if (!actorModel) return false;

    for (const opponent of opponents) {
      if (!opponent || opponent.state.isKOd || opponent.state.isEliminated) continue;
      const opponentModel = this.buildSpatialModel(opponent);
      if (!opponentModel) continue;
      if (SpatialRules.isEngaged(actorModel, opponentModel)) {
        return true;
      }
    }

    return false;
  }

  private estimateChargeMovementAllowance(character: Character, battlefield: Battlefield, opponents: Character[] = []): number {
    const baseMov = character.finalAttributes.mov ?? character.attributes.mov ?? 2;
    const engagedWithOpponent = this.isEngagedWithAnyOpponents(character, opponents);
    const sprintBonus = getSprintMovementBonus(
      character,
      true,
      Boolean(character.state.isAttentive),
      !engagedWithOpponent
    );
    const leapBonus = getLeapAgilityBonus(character);
    return Math.max(0, baseMov + 2 + sprintBonus + leapBonus);
  }

  private log(message: string): void {
    if (this.config.verboseLogging) {
      console.log(`[AIExecutor] ${message}`);
    }
  }

  /**
   * Log an action to the instrumentation logger
   */
  private logAction(
    decision: ActionDecision,
    character: Character,
    context: AIExecutionContext,
    result: ExecutionResult
  ): void {
    if (!this.logger) return;

    const actionType = this.mapActionTypeToLogged(decision.type);
    const apRemaining = this.manager.getApRemaining(character);
    const loggedAction: LoggedAction = {
      turn: context.currentTurn,
      initiative: 0, // Would need to get from manager
      actorId: character.id,
      actorName: character.name || character.profile.name,
      actorProfile: character.profile.name,
      actionType,
      description: this.getActionDescription(decision, character),
      apSpent: 1, // Most actions cost 1 AP
      apRemaining,
      targetId: decision.target?.id,
      targetName: decision.target?.name,
      targetProfile: decision.target?.profile.name,
      outcome: result.error || 'Completed',
      timestamp: new Date().toISOString(),
    };

    this.logger.logAction(loggedAction);
  }

  private mapActionTypeToLogged(type: ActionType): LoggedActionType {
    const typeMap: Record<ActionType, LoggedActionType> = {
      'move': LoggedActionType.MOVE,
      'close_combat': LoggedActionType.CLOSE_COMBAT,
      'ranged_combat': LoggedActionType.RANGE_COMBAT,
      'disengage': LoggedActionType.DISENGAGE,
      'wait': LoggedActionType.WAIT,
      'hide': LoggedActionType.HIDE,
      'rally': LoggedActionType.RALLY,
      'revive': LoggedActionType.REVIVE,
      'fiddle': LoggedActionType.FIDDLE,
      'hold': LoggedActionType.OTHER,
      'focus': LoggedActionType.OTHER,
      'detect': LoggedActionType.OTHER,
      'none': LoggedActionType.OTHER,
      'pushing': LoggedActionType.OTHER,
      'refresh': LoggedActionType.OTHER,
      'reload': LoggedActionType.OTHER,
      'charge': LoggedActionType.MOVE,
      'combined': LoggedActionType.OTHER,
      'react-move': LoggedActionType.OTHER,
      'react_counter_strike': LoggedActionType.OTHER,
      'react_counter_fire': LoggedActionType.OTHER,
      'compulsory': LoggedActionType.OTHER,
      'bottle_test': LoggedActionType.OTHER,
    };
    return typeMap[type] || LoggedActionType.OTHER;
  }

  private getActionDescription(decision: ActionDecision, character: Character): string {
    if (decision.target) {
      return `${decision.type} vs ${decision.target.name || decision.target.profile.name}`;
    }
    if (decision.position) {
      return `Move to (${decision.position.x}, ${decision.position.y})`;
    }
    return decision.type;
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
  config?: Partial<AIExecutorConfig>,
  logger?: InstrumentationLogger
): AIActionExecutor {
  return new AIActionExecutor(manager, config, logger);
}

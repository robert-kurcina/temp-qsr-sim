/**
 * React System - QSR Compliant Implementation
 * 
 * Implements the full React action rules from MEST.Tactics.QSR (Lines 1114-1160)
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { AIContext } from '../core/AIController';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';

/**
 * React Trigger Types (QSR p.1115)
 */
export type ReactTriggerType = 'move-only' | 'abrupt-move' | 'abrupt-non-move';

/**
 * React Opportunity (QSR p.1115)
 */
export interface ReactOpportunity {
  /** Type of action triggering the react */
  trigger: ReactTriggerType;
  /** Character performing the action */
  actor: Character;
  /** Actor's current position */
  actorPosition: Position;
  /** Actor's previous position (for movement tracking) */
  actorPreviousPosition?: Position;
  /** Action costs zero AP (no react allowed) */
  isZeroAPAction: boolean;
  /** Action is a reposition (react disallowed unless base-contact) */
  isReposition: boolean;
  /** Actor used Agility (makes it abrupt) */
  usedAgility: boolean;
  /** Actor is leaning (treated as non-movement) */
  isLeaning: boolean;
}

/**
 * React Result
 */
export interface ReactResult {
  /** Whether character should react */
  shouldReact: boolean;
  /** Type of react action */
  reactType: ReactActionType;
  /** Priority score for ordering multiple reacts */
  priority: number;
  /** REF requirement check passed */
  meetsREFRequirement: boolean;
  /** Reason for decision */
  reason?: string;
}

/**
 * React Action Types (QSR p.1115-1119)
 * 
 * Note: The QSR doesn't name specific React types for basic Reacts.
 * It simply says "perform a React action" against Move or non-Move actions.
 *
 * Counter-strike!, Counter-fire!, Counter-action! are Passive Player Options
 * (Advanced Game, p.1250), not basic React actions.
 *
 * Focus (QSR Line 859): Remove Wait status while Attentive to receive +1 Wild die
 * for any Test instead of performing a React.
 */
export type ReactActionType =
  | 'none'
  | 'react-move'        // React to Move action (attack moving target)
  | 'react-abrupt'      // React to Abrupt action (attack or move to engage)
  | 'counter_strike'    // Passive Player Option (Advanced, p.1250)
  | 'counter_fire'      // Passive Player Option (Advanced, p.1250)
  | 'focus';            // QSR Line 859: Remove Wait, gain +1w instead of React

/**
 * React State - Tracks react limitations per initiative
 */
export interface ReactState {
  /** Characters that have already reacted this initiative */
  reactedThisInitiative: Set<string>;
  /** Sides that have used their one react per action */
  sideUsedReactForAction: Map<string, boolean>;
  /** Current initiative turn */
  currentInitiative: number;
}

/**
 * React Configuration
 */
export interface ReactConfig {
  /** Enable react to Move actions */
  enableReactMove: boolean;
  /** Enable counter-strike (Passive Player Option, Advanced) */
  enableCounterStrike: boolean;
  /** Enable counter-fire (Passive Player Option, Advanced) */
  enableCounterFire: boolean;
  /** Aggression affects react tendency */
  aggression: number;
  /** Caution affects react tendency */
  caution: number;
}

export const DEFAULT_REACT_CONFIG: ReactConfig = {
  enableReactMove: true,
  enableCounterStrike: true,
  enableCounterFire: true,
  aggression: 0.5,
  caution: 0.5,
};

/**
 * React Evaluator - QSR Compliant
 * 
 * Key QSR Rules Implemented:
 * - Requires Wait status (p.1115)
 * - One react per opposing side per action (p.1115)
 * - REF requirements for abrupt actions (p.1117)
 * - +1 REF for Waiting (p.1119)
 * - React resolution order by REF then Initiative (p.1116)
 */
export class ReactEvaluator {
  config: ReactConfig;
  private state: ReactState;

  constructor(config: Partial<ReactConfig> = {}) {
    this.config = { ...DEFAULT_REACT_CONFIG, ...config };
    this.state = {
      reactedThisInitiative: new Set(),
      sideUsedReactForAction: new Map(),
      currentInitiative: 0,
    };
  }

  /**
   * Reset state for new initiative
   */
  startNewInitiative(initiativeNumber: number): void {
    this.state.currentInitiative = initiativeNumber;
    this.state.reactedThisInitiative.clear();
    this.state.sideUsedReactForAction.clear();
  }

  /**
   * Reset state for new action (within same initiative)
   */
  startNewAction(): void {
    this.state.sideUsedReactForAction.clear();
  }

  /**
   * Check if react opportunity exists (QSR p.1115)
   */
  canReact(character: Character, opportunity: ReactOpportunity, context: AIContext): {
    canReact: boolean;
    reason?: string;
  } {
    // QSR: Reacts require Wait status
    if (!character.state.isWaiting) {
      return { canReact: false, reason: 'Character not in Wait status' };
    }

    // QSR: Can't react if already part of a React
    if (this.state.reactedThisInitiative.has(character.id)) {
      return { canReact: false, reason: 'Already reacted this initiative' };
    }

    // QSR: Actions costing zero AP don't provide opportunity
    if (opportunity.isZeroAPAction) {
      return { canReact: false, reason: 'Zero AP actions don\'t trigger reacts' };
    }

    // QSR: Reposition doesn't allow react unless base-contact made
    if (opportunity.isReposition) {
      const charPos = context.battlefield.getCharacterPosition(character);
      if (charPos && opportunity.actorPosition) {
        const dist = Math.sqrt(
          Math.pow(charPos.x - opportunity.actorPosition.x, 2) +
          Math.pow(charPos.y - opportunity.actorPosition.y, 2)
        );
        if (dist > 1) {
          return { canReact: false, reason: 'Reposition without base-contact' };
        }
      }
    }

    // QSR: Must be within LOS of active model
    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos || !opportunity.actorPosition) {
      return { canReact: false, reason: 'Missing position data' };
    }

    const charModel = {
      id: character.id,
      position: charPos,
      baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? 3),
      siz: character.finalAttributes.siz ?? 3,
    };
    const actorModel = {
      id: opportunity.actor.id,
      position: opportunity.actorPosition,
      baseDiameter: getBaseDiameterFromSiz(opportunity.actor.finalAttributes.siz ?? 3),
      siz: opportunity.actor.finalAttributes.siz ?? 3,
    };

    const hasLOS = SpatialRules.hasLineOfSight(context.battlefield, charModel, actorModel);
    if (!hasLOS) {
      return { canReact: false, reason: 'No LOS to actor' };
    }

    return { canReact: true };
  }

  /**
   * Check REF requirement for react (QSR p.1117)
   */
  checkREFRequirement(
    reactor: Character,
    actor: Character,
    trigger: ReactTriggerType,
    isEngaged: boolean,
    isReactingToReact: boolean
  ): {
    meets: boolean;
    requiredREF: number;
    actualREF: number;
  } {
    const actorREF = actor.finalAttributes.ref ?? actor.attributes.ref ?? 0;
    const actorMOV = actor.finalAttributes.mov ?? actor.attributes.mov ?? 0;
    const reactorREF = reactor.finalAttributes.ref ?? reactor.attributes.ref ?? 0;

    // QSR: +1 REF for Waiting
    const effectiveReactorREF = reactor.state.isWaiting ? reactorREF + 1 : reactorREF;

    let requiredREF: number;

    if (trigger === 'abrupt-non-move') {
      // QSR: Reacting to Abrupt non-movement requires REF >= Active REF
      requiredREF = actorREF;
    } else if (trigger === 'abrupt-move') {
      // QSR: Reacting to Abrupt movement requires REF >= Active MOV
      requiredREF = actorMOV;
    } else {
      // Move-only: No REF requirement
      requiredREF = 0;
    }

    // QSR: +1 if reacting to being Engaged
    if (isEngaged) {
      requiredREF += 1;
    }

    // QSR: +1 if reacting to another React
    if (isReactingToReact) {
      requiredREF += 1;
    }

    return {
      meets: effectiveReactorREF >= requiredREF,
      requiredREF,
      actualREF: effectiveReactorREF,
    };
  }

  /**
   * Evaluate all react opportunities for a character (QSR p.1115-1119)
   */
  evaluateReacts(
    character: Character,
    opportunity: ReactOpportunity,
    context: AIContext,
    isReactingToReact: boolean = false
  ): ReactResult {
    // Check basic react eligibility
    const canReactResult = this.canReact(character, opportunity, context);
    if (!canReactResult.canReact) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: false,
        reason: canReactResult.reason,
      };
    }

    // Check if side already used react for this action
    const sideId = this.getSideId(character, context);
    if (this.state.sideUsedReactForAction.get(sideId)) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: false,
        reason: 'Side already reacted to this action',
      };
    }

    // Determine trigger type and evaluate
    let reactResult: ReactResult;
    switch (opportunity.trigger) {
      case 'move-only':
        reactResult = this.evaluateMoveOnlyReact(character, opportunity, context);
        break;
      case 'abrupt-move':
      case 'abrupt-non-move':
        reactResult = this.evaluateAbruptReact(character, opportunity, context, isReactingToReact);
        break;
      default:
        reactResult = {
          shouldReact: false,
          reactType: 'none',
          priority: 0,
          meetsREFRequirement: false,
          reason: 'Unknown trigger type',
        };
    }

    // Compare React vs Focus - choose the better option
    // Focus is only an alternative when React is allowed
    const focusResult = this.evaluateFocus(character, context);
    if (focusResult.shouldReact && focusResult.priority > reactResult.priority) {
      return focusResult;
    }

    return reactResult;
  }

  /**
   * Evaluate Focus option (QSR Line 859)
   * Focus: Remove Wait status while Attentive to receive +1 Wild die for any Test instead of performing a React.
   */
  private evaluateFocus(
    character: Character,
    context: AIContext
  ): ReactResult {
    // Focus requires Wait status and Attentive
    if (!character.state.isWaiting || !character.state.isAttentive) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: true,
        reason: 'No Wait status or not Attentive',
      };
    }

    // Focus priority based on value of +1w for future tests
    // Higher priority if character has important attacks planned
    let priority = 1.5; // Base Focus priority

    // Higher priority if character is a key attacker (Elite, Veteran)
    const archetype = character.profile?.archetype;
    if (archetype === 'Elite') {
      priority += 1.0;
    } else if (archetype === 'Veteran') {
      priority += 0.5;
    }

    // Higher priority if no good React target available
    // (Focus is better than a poor React)

    return {
      shouldReact: true,
      reactType: 'focus',
      priority,
      meetsREFRequirement: true,
      reason: 'Focus: Remove Wait, gain +1w for next Test',
    };
  }

  /**
   * Evaluate react to move-only action (QSR p.1117)
   */
  private evaluateMoveOnlyReact(
    character: Character,
    opportunity: ReactOpportunity,
    context: AIContext
  ): ReactResult {
    if (!this.config.enableReactMove) {
      return { shouldReact: false, reactType: 'none', priority: 0, meetsREFRequirement: true };
    }

    // Check if character has ranged weapon
    const hasRangedWeapon = this.hasRangedWeapon(character);
    if (!hasRangedWeapon) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: true,
        reason: 'No ranged weapon',
      };
    }

    // Calculate priority
    let priority = 2.0 + this.config.aggression;

    // QSR: +1 REF for Waiting (already applied in checkREFRequirement)
    // Higher priority for optimal range
    const charPos = context.battlefield.getCharacterPosition(character);
    if (charPos && opportunity.actorPosition) {
      const distance = Math.sqrt(
        Math.pow(charPos.x - opportunity.actorPosition.x, 2) +
        Math.pow(charPos.y - opportunity.actorPosition.y, 2)
      );

      // Prefer Standard react when enemy is in optimal range (4-12 MU)
      if (distance >= 4 && distance <= 12) {
        priority += 1.0;
      }

      // Prefer Standard react when enemy is wounded
      if (opportunity.actor.state.wounds > 0) {
        priority += 0.5;
      }
    }

    return {
      shouldReact: priority > 2.5,
      reactType: 'react-move',
      priority,
      meetsREFRequirement: true, // Move-only has no REF requirement
      reason: `React to Move (priority: ${priority.toFixed(1)})`,
    };
  }

  /**
   * Evaluate react to abrupt action (QSR p.1117)
   */
  private evaluateAbruptReact(
    character: Character,
    opportunity: ReactOpportunity,
    context: AIContext,
    isReactingToReact: boolean
  ): ReactResult {
    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos || !opportunity.actorPosition) {
      return { shouldReact: false, reactType: 'none', priority: 0, meetsREFRequirement: false };
    }

    // Check if in melee range
    const inMelee = this.isInMeleeRange(character, opportunity.actor, context.battlefield);

    if (inMelee) {
      // Counter-strike for melee
      return this.evaluateCounterStrike(
        character,
        opportunity.actor,
        context,
        isReactingToReact
      );
    } else {
      // Counter-fire for ranged
      return this.evaluateCounterFire(
        character,
        opportunity.actor,
        opportunity,
        context,
        isReactingToReact
      );
    }
  }

  /**
   * Evaluate counter-strike (QSR p.1117, p.1250)
   */
  private evaluateCounterStrike(
    character: Character,
    actor: Character,
    context: AIContext,
    isReactingToReact: boolean
  ): ReactResult {
    if (!this.config.enableCounterStrike) {
      return { shouldReact: false, reactType: 'none', priority: 0, meetsREFRequirement: false };
    }

    // Check REF requirement
    const refCheck = this.checkREFRequirement(
      character,
      actor,
      'abrupt-non-move',
      true, // Is engaged
      isReactingToReact
    );

    if (!refCheck.meets) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: false,
        reason: `REF ${refCheck.actualREF} < required ${refCheck.requiredREF}`,
      };
    }

    // Calculate priority based on CCA comparison
    const cca = character.finalAttributes.cca ?? character.attributes.cca ?? 2;
    const actorCCA = actor.finalAttributes.cca ?? actor.attributes.cca ?? 2;

    let priority = 2.5;
    if (cca >= actorCCA) {
      priority += 1.0;
    }
    if (character.state.wounds < (character.finalAttributes.siz ?? 3) - 1) {
      priority += 0.5;
    }

    return {
      shouldReact: priority > 3.0,
      reactType: 'counter_strike',
      priority,
      meetsREFRequirement: true,
      reason: `Counter-strike (REF ${refCheck.actualREF} >= ${refCheck.requiredREF})`,
    };
  }

  /**
   * Evaluate counter-fire (QSR p.1117, p.1250)
   */
  private evaluateCounterFire(
    character: Character,
    actor: Character,
    opportunity: ReactOpportunity,
    context: AIContext,
    isReactingToReact: boolean
  ): ReactResult {
    if (!this.config.enableCounterFire) {
      return { shouldReact: false, reactType: 'none', priority: 0, meetsREFRequirement: false };
    }

    // Check if character has ranged weapon
    const hasRangedWeapon = this.hasRangedWeapon(character);
    if (!hasRangedWeapon) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: false,
        reason: 'No ranged weapon',
      };
    }

    // Check REF requirement
    const refCheck = this.checkREFRequirement(
      character,
      actor,
      opportunity.trigger,
      false, // Not engaged
      isReactingToReact
    );

    if (!refCheck.meets) {
      return {
        shouldReact: false,
        reactType: 'none',
        priority: 0,
        meetsREFRequirement: false,
        reason: `REF ${refCheck.actualREF} < required ${refCheck.requiredREF}`,
      };
    }

    // Calculate priority
    const rca = character.finalAttributes.rca ?? character.attributes.rca ?? 2;
    const actorRCA = actor.finalAttributes.rca ?? actor.attributes.rca ?? 2;

    let priority = 2.0;
    if (rca >= actorRCA) {
      priority += 1.0;
    }

    return {
      shouldReact: priority > 2.5,
      reactType: 'counter_fire',
      priority,
      meetsREFRequirement: true,
      reason: `Counter-fire (REF ${refCheck.actualREF} >= ${refCheck.requiredREF})`,
    };
  }

  /**
   * Mark character as having reacted
   */
  markReacted(character: Character, context: AIContext): void {
    this.state.reactedThisInitiative.add(character.id);
    
    const sideId = this.getSideId(character, context);
    this.state.sideUsedReactForAction.set(sideId, true);
  }

  /**
   * Get side ID for character
   */
  private getSideId(character: Character, context: AIContext): string {
    // Check if character is in allies list (same side as context.character)
    const isAlly = context.allies.some(a => a.id === character.id) || 
                   character.id === context.character.id;
    return isAlly ? 'friendly' : 'opposing';
  }

  /**
   * Check if two characters are in melee range
   */
  private isInMeleeRange(a: Character, b: Character, battlefield: Battlefield): boolean {
    const aPos = battlefield.getCharacterPosition(a);
    const bPos = battlefield.getCharacterPosition(b);
    
    if (!aPos || !bPos) return false;

    const aModel = {
      id: a.id,
      position: aPos,
      baseDiameter: getBaseDiameterFromSiz(a.finalAttributes.siz ?? 3),
      siz: a.finalAttributes.siz ?? 3,
    };
    const bModel = {
      id: b.id,
      position: bPos,
      baseDiameter: getBaseDiameterFromSiz(b.finalAttributes.siz ?? 3),
      siz: b.finalAttributes.siz ?? 3,
    };

    return SpatialRules.isEngaged(aModel, bModel);
  }

  /**
   * Check if character has ranged weapon
   */
  private hasRangedWeapon(character: Character): boolean {
    const items = character.profile?.items ?? [];
    return items.some(i => {
      const classification = i.classification || i.class || '';
      // Check for ranged weapon classifications
      if (classification === 'Bow' ||
          classification === 'Thrown' ||
          classification === 'Range' ||
          classification === 'Firearm' ||
          classification === 'Support') {
        return true;
      }
      // Check for Melee/Natural weapons with Throwable trait (can be thrown)
      if ((classification === 'Melee' || classification === 'Natural') &&
          i.traits && i.traits.some(t => t.toLowerCase().includes('throwable'))) {
        return true;
      }
      return false;
    });
  }
}

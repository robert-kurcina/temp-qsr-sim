/**
 * React System for AI
 * 
 * Handles interrupt actions during opponent's activation.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { AIContext, ReactOpportunity, ReactResult, ReactActionType } from '../core/AIController';
import { SpatialRules } from '../../battlefield/spatial/spatial-rules';
import { getBaseDiameterFromSiz } from '../../battlefield/spatial/size-utils';

/**
 * React Configuration
 */
export interface ReactConfig {
  /** Enable react to Move actions */
  enableReactMove: boolean;
  /** Enable counter-strike react */
  enableCounterStrike: boolean;
  /** Enable counter-fire react */
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
 * React Evaluator
 * 
 * Determines when and how to react during opponent's activation.
 */
export class ReactEvaluator {
  config: ReactConfig;

  constructor(config: Partial<ReactConfig> = {}) {
    this.config = { ...DEFAULT_REACT_CONFIG, ...config };
  }

  /**
   * Evaluate all react opportunities for a character
   */
  evaluateReacts(
    character: Character,
    actor: Character,
    trigger: ReactOpportunity['trigger'],
    context: AIContext
  ): ReactResult {
    // Check if character can react
    if (!this.canReact(character, context)) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Evaluate based on trigger type
    switch (trigger) {
      case 'move':
        return this.evaluateMoveReact(character, actor, context);
      case 'attack':
        return this.evaluateAttackReact(character, actor, context);
      case 'disengage':
        return this.evaluateDisengageReact(character, actor, context);
      default:
        return { shouldReact: false, reactType: 'none', priority: 0 };
    }
  }

  /**
   * Check if character can react
   */
  private canReact(character: Character, context: AIContext): boolean {
    // Must be attentive and not KO'd/eliminated
    if (character.state.isKOd || character.state.isEliminated) {
      return false;
    }

    if (!character.state.isAttentive) {
      return false;
    }

    // Must have Wait status or be attentive for basic reacts
    // (Full implementation would check Wait status)
    return true;
  }

  /**
   * Evaluate react to movement
   */
  private evaluateMoveReact(
    character: Character,
    actor: Character,
    context: AIContext
  ): ReactResult {
    if (!this.config.enableReactMove) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    const charPos = context.battlefield.getCharacterPosition(character);
    const actorPos = context.battlefield.getCharacterPosition(actor);

    if (!charPos || !actorPos) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check LOS to actor
    const charModel = {
      id: character.id,
      position: charPos,
      baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? 3),
      siz: character.finalAttributes.siz ?? 3,
    };
    const actorModel = {
      id: actor.id,
      position: actorPos,
      baseDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? 3),
      siz: actor.finalAttributes.siz ?? 3,
    };

    const hasLOS = SpatialRules.hasLineOfSight(context.battlefield, charModel, actorModel);
    if (!hasLOS) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check if character has ranged weapon
    const hasRangedWeapon = character.profile?.items?.some(
      i => i.classification === 'Bow' || i.classification === 'Thrown' || i.classification === 'Range'
    ) ?? false;

    if (!hasRangedWeapon) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Calculate priority based on aggression and opportunity
    let priority = 2.0 + this.config.aggression;

    // Higher priority if actor is moving into advantageous position
    const distance = Math.sqrt(
      Math.pow(charPos.x - actorPos.x, 2) +
      Math.pow(charPos.y - actorPos.y, 2)
    );

    // Prefer react when enemy is in optimal range
    if (distance >= 4 && distance <= 12) {
      priority += 1.0;
    }

    // Prefer react when enemy is wounded
    if (actor.state.wounds > 0) {
      priority += 0.5;
    }

    return {
      shouldReact: priority > 2.5,
      reactType: 'react-move',
      priority,
    };
  }

  /**
   * Evaluate react to attack
   */
  private evaluateAttackReact(
    character: Character,
    actor: Character,
    context: AIContext
  ): ReactResult {
    const charPos = context.battlefield.getCharacterPosition(character);
    const actorPos = context.battlefield.getCharacterPosition(actor);
    
    if (!charPos || !actorPos) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check if in melee range
    const inMelee = this.isInMeleeRange(character, actor, context.battlefield);

    if (inMelee) {
      // Counter-strike for melee
      if (!this.config.enableCounterStrike) {
        return { shouldReact: false, reactType: 'none', priority: 0 };
      }

      const cca = character.finalAttributes.cca ?? character.attributes.cca ?? 2;
      const actorCCA = actor.finalAttributes.cca ?? actor.attributes.cca ?? 2;

      // Only counter-strike if we have decent chance
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
      };
    } else {
      // Counter-fire for ranged
      if (!this.config.enableCounterFire) {
        return { shouldReact: false, reactType: 'none', priority: 0 };
      }

      const rca = character.finalAttributes.rca ?? character.attributes.rca ?? 2;
      const actorRCA = actor.finalAttributes.rca ?? actor.attributes.rca ?? 2;

      // Check LOS
      const charModel = {
        id: character.id,
        position: charPos,
        baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? 3),
        siz: character.finalAttributes.siz ?? 3,
      };
      const actorModel = {
        id: actor.id,
        position: actorPos,
        baseDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? 3),
        siz: actor.finalAttributes.siz ?? 3,
      };

      const hasLOS = SpatialRules.hasLineOfSight(context.battlefield, charModel, actorModel);
      if (!hasLOS) {
        return { shouldReact: false, reactType: 'none', priority: 0 };
      }

      let priority = 2.0;
      if (rca >= actorRCA) {
        priority += 1.0;
      }

      return {
        shouldReact: priority > 2.5,
        reactType: 'counter_fire',
        priority,
      };
    }
  }

  /**
   * Evaluate react to disengage
   */
  private evaluateDisengageReact(
    character: Character,
    actor: Character,
    context: AIContext
  ): ReactResult {
    if (!this.config.enableCounterCharge) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Counter-charge when enemy tries to disengage
    const inMelee = this.isInMeleeRange(character, actor, context.battlefield);
    if (!inMelee) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check if we can pursue
    const mov = character.finalAttributes.mov ?? character.attributes.mov ?? 2;
    if (mov < 2) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    let priority = 1.5 + this.config.aggression;

    // Higher priority if enemy is wounded (easy kill)
    const siz = actor.finalAttributes.siz ?? actor.attributes.siz ?? 3;
    if (actor.state.wounds >= siz - 1) {
      priority += 1.5;
    }

    return {
      shouldReact: priority > 2.5,
      reactType: 'counter_charge',
      priority,
    };
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
}

/**
 * Bonus Action Evaluator
 * 
 * Determines when to use bonus actions after successful attacks.
 */
export class BonusActionEvaluator {
  /**
   * Evaluate available bonus actions after successful hit
   */
  evaluateBonusActions(
    character: Character,
    target: Character,
    cascades: number,
    context: AIContext
  ): BonusActionDecision {
    const decisions: BonusActionOption[] = [];

    // Check if character is distracted (reduced cascades)
    const effectiveCascades = character.state.isDistracted 
      ? Math.max(0, cascades - 1) 
      : cascades;

    if (effectiveCascades <= 0) {
      return { available: [], selected: null };
    }

    // Evaluate Refresh (remove Delay token)
    if (character.state.delayTokens > 0) {
      decisions.push({
        type: 'refresh',
        cost: 1,
        priority: 3.0,
        reason: 'Remove Delay token',
      });
    }

    // Evaluate Reposition
    if (effectiveCascades >= 1) {
      decisions.push({
        type: 'reposition',
        cost: 1,
        priority: 2.0,
        reason: 'Reposition after attack',
      });
    }

    // Evaluate Push-back (if in base contact)
    const inBaseContact = this.isInBaseContact(character, target, context.battlefield);
    if (inBaseContact && effectiveCascades >= 1) {
      decisions.push({
        type: 'push_back',
        cost: 1,
        priority: 2.5,
        reason: 'Push enemy back',
      });
    }

    // Evaluate Hide (if behind cover)
    if (character.state.isInCover && effectiveCascades >= 1) {
      decisions.push({
        type: 'hide',
        cost: 1,
        priority: 2.0,
        reason: 'Hide behind cover',
      });
    }

    // Sort by priority
    decisions.sort((a, b) => b.priority - a.priority);

    // Select best action if enough cascades
    const selected = decisions.length > 0 && decisions[0].cost <= effectiveCascades
      ? decisions[0]
      : null;

    return {
      available: decisions,
      selected,
    };
  }

  /**
   * Check if two characters are in base contact
   */
  private isInBaseContact(a: Character, b: Character, battlefield: Battlefield): boolean {
    const aPos = battlefield.getCharacterPosition(a);
    const bPos = battlefield.getCharacterPosition(b);
    
    if (!aPos || !bPos) return false;

    const distance = Math.sqrt(
      Math.pow(aPos.x - bPos.x, 2) +
      Math.pow(aPos.y - bPos.y, 2)
    );

    return distance < 1;
  }
}

export interface BonusActionOption {
  type: 'refresh' | 'reposition' | 'push_back' | 'pull_back' | 'circle' | 'reversal' | 'disengage' | 'hide';
  cost: number;
  priority: number;
  reason: string;
}

export interface BonusActionDecision {
  available: BonusActionOption[];
  selected: BonusActionOption | null;
}

/**
 * Stealth Evaluator
 * 
 * Handles Hide and Detect actions.
 */
export class StealthEvaluator {
  /**
   * Evaluate whether character should Hide
   */
  evaluateHide(context: AIContext): HideDecision {
    const character = context.character;

    // Can only hide if behind cover
    if (!character.state.isInCover) {
      return { shouldHide: false, reason: 'Not behind cover' };
    }

    // Check if enemies can see character
    const visibleToEnemy = this.isVisibleToEnemy(character, context);
    if (visibleToEnemy) {
      return { shouldHide: false, reason: 'Visible to enemy' };
    }

    // Check if already hidden
    if (character.state.isHidden) {
      return { shouldHide: false, reason: 'Already hidden' };
    }

    // Evaluate benefit of hiding
    let priority = 2.0;

    // Higher priority if low health
    const siz = character.finalAttributes.siz ?? 3;
    if (character.state.wounds >= siz - 1) {
      priority += 1.5;
    }

    // Higher priority if outnumbered
    const enemyCount = context.enemies.filter(e => !e.state.isEliminated && !e.state.isKOd).length;
    const allyCount = context.allies.filter(a => !a.state.isEliminated && !a.state.isKOd).length + 1;
    if (enemyCount > allyCount) {
      priority += 1.0;
    }

    return {
      shouldHide: priority > 3.0,
      reason: `Hide behind cover (priority: ${priority.toFixed(1)})`,
      priority,
    };
  }

  /**
   * Evaluate whether character should Detect hidden enemies
   */
  evaluateDetect(context: AIContext): DetectDecision {
    const character = context.character;

    // Check if there are hidden enemies
    const hiddenEnemies = context.enemies.filter(e => 
      !e.state.isEliminated && 
      !e.state.isKOd && 
      e.state.isHidden
    );

    if (hiddenEnemies.length === 0) {
      return { shouldDetect: false, targets: [] };
    }

    // Check if character has AP available
    if (context.apRemaining < 1) {
      return { shouldDetect: false, targets: [], reason: 'Not enough AP' };
    }

    // Evaluate priority based on threat
    let priority = 2.0;
    if (hiddenEnemies.length >= 2) {
      priority += 1.0;
    }

    return {
      shouldDetect: priority > 2.5,
      targets: hiddenEnemies,
      priority,
      reason: `Detect ${hiddenEnemies.length} hidden enemy(ies)`,
    };
  }

  /**
   * Check if character is visible to any enemy
   */
  private isVisibleToEnemy(character: Character, context: AIContext): boolean {
    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos) return false;

    const charModel = {
      id: character.id,
      position: charPos,
      baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? 3),
      siz: character.finalAttributes.siz ?? 3,
    };

    for (const enemy of context.enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;

      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes.siz ?? 3),
        siz: enemy.finalAttributes.siz ?? 3,
      };

      const hasLOS = SpatialRules.hasLineOfSight(context.battlefield, enemyModel, charModel);
      if (hasLOS) {
        return true;
      }
    }

    return false;
  }
}

export interface HideDecision {
  shouldHide: boolean;
  reason: string;
  priority?: number;
}

export interface DetectDecision {
  shouldDetect: boolean;
  targets: Character[];
  reason?: string;
  priority?: number;
}

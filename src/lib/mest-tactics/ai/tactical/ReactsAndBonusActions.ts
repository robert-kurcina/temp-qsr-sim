/**
 * React System for AI
 * 
 * Handles interrupt actions during opponent's activation.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { AIContext, ReactOpportunity, ReactResult, ReactActionType } from '../core/AIController';
import { isAttackableEnemy } from '../core/ai-utils';
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
  /** Enable counter-charge react */
  enableCounterCharge: boolean;
  /** Aggression affects react tendency */
  aggression: number;
  /** Caution affects react tendency */
  caution: number;
}

export const DEFAULT_REACT_CONFIG: ReactConfig = {
  enableReactMove: true,
  enableCounterStrike: true,
  enableCounterFire: true,
  enableCounterCharge: true, // NEW: Enable counter-charge tactical evaluation
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
   * QSR: Counter-charge can block entrances, exits, objective access, or prevent scrum addition
   */
  private evaluateMoveReact(
    character: Character,
    actor: Character,
    context: AIContext
  ): ReactResult {
    // Check for Counter-charge opportunity first (tactical evaluation)
    if (this.config.enableCounterCharge) {
      const counterChargeResult = this.evaluateCounterChargeTactical(character, actor, context);
      if (counterChargeResult.shouldReact) {
        return counterChargeResult;
      }
    }

    // Fall back to standard Counter-charge on disengage attempt
    return this.evaluateDisengageReact(character, actor, context);
  }

  /**
   * Counter-charge Tactical Evaluation
   * QSR: Counter-charge can be used to:
   * - Block entrance/exit (doorway, gate, chokepoint)
   * - Foil objective access (prevent enemy from reaching objective marker)
   * - Prevent scrum addition (stop enemy from joining engagement for outnumbering)
   */
  private evaluateCounterChargeTactical(
    character: Character,
    actor: Character,
    context: AIContext
  ): ReactResult {
    if (!this.config.enableCounterCharge) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    const charPos = context.battlefield.getCharacterPosition(character);
    const actorPos = context.battlefield.getCharacterPosition(actor);

    if (!charPos || !actorPos) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check if character can counter-charge (Attentive + Ordered)
    if (!character.state.isAttentive || !character.state.isOrdered) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check LOS and Visibility
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
    const visibilityOrMu = context.config.visibilityOrMu ?? 16;
    const edgeDistance = SpatialRules.distanceEdgeToEdge(charModel, actorModel);

    if (!hasLOS || edgeDistance > visibilityOrMu) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Check if character can reach actor (MOV check)
    const moveLimit = character.finalAttributes.mov ?? character.attributes.mov ?? 0;
    const canEngage = edgeDistance <= moveLimit;

    if (!canEngage) {
      return { shouldReact: false, reactType: 'none', priority: 0 };
    }

    // Calculate tactical priority based on strategic value
    let priority = 2.0 + this.config.aggression;
    let tacticalReason = '';

    // 1. Block Entrance/Exit (doorway, gate, chokepoint)
    const isBlockingChokepoint = this.isBlockingChokepoint(actorPos, context);
    if (isBlockingChokepoint) {
      priority += 2.0;
      tacticalReason = 'Block chokepoint';
    }

    // 2. Foil Objective Access (enemy moving toward objective)
    const isMovingToObjective = this.isMovingTowardObjective(actor, context);
    if (isMovingToObjective) {
      priority += 2.5;
      tacticalReason = 'Deny objective access';
    }

    // 3. Prevent Scrum Addition (enemy trying to join engagement for outnumbering)
    const isJoiningScrum = this.isEnemyJoiningScrum(actor, context);
    if (isJoiningScrum) {
      priority += 3.0; // Highest priority - prevents outnumbering
      tacticalReason = 'Prevent scrum addition (deny outnumbering)';
    }

    // 4. Wounded enemy (easy kill)
    const siz = actor.finalAttributes.siz ?? actor.attributes.siz ?? 3;
    if (actor.state.wounds >= siz - 1) {
      priority += 1.5;
      if (!tacticalReason) tacticalReason = 'Wounded target';
    }

    // 5. High-value target (leader, VIP)
    if (this.isHighValueTarget(actor, context)) {
      priority += 1.0;
      if (!tacticalReason) tacticalReason = 'High-value target';
    }

    return {
      shouldReact: priority > 3.0, // Higher threshold for tactical counter-charge
      reactType: 'counter_charge',
      priority,
      reason: tacticalReason,
    };
  }

  /**
   * Get effective movement allowance for a character
   * QSR: Accounts for Sprint X (×4 MU/level) and Flight X (MOV +X, +6 MU/level flying)
   */
  private getEffectiveMovement(character: Character, considerFlying: boolean = false): number {
    const baseMov = character.finalAttributes.mov ?? character.attributes.mov ?? 0;
    let effectiveMov = baseMov;

    // Check for Sprint X trait
    const sprintTrait = character.profile?.finalTraits?.find(t => t.toLowerCase().includes('sprint'));
    if (sprintTrait) {
      // Extract level from trait (e.g., "Sprint 2" -> level 2)
      const match = sprintTrait.match(/Sprint\s*(\d+)?/i);
      const level = match && match[1] ? parseInt(match[1], 10) : 1;
      // Sprint X: X × 4 MU in straight line
      effectiveMov = Math.max(effectiveMov, level * 4);
    }

    // Check for Flight X trait (if considering flying status)
    if (considerFlying) {
      const flightTrait = character.profile?.finalTraits?.find(t => t.toLowerCase().includes('flight'));
      if (flightTrait) {
        // Extract level from trait (e.g., "Flight 3" -> level 3)
        const match = flightTrait.match(/Flight\s*(\d+)?/i);
        const level = match && match[1] ? parseInt(match[1], 10) : 1;
        // Flight X: MOV + X, +6 MU/level while flying
        effectiveMov = Math.max(effectiveMov, baseMov + level + (level * 6));
      }
    }

    return effectiveMov;
  }

  /**
   * Check if actor is moving through a chokepoint (entrance/exit)
   * QSR: Uses character's effective MOV for threat range
   */
  private isBlockingChokepoint(position: Position, context: AIContext): boolean {
    // Check if position is near terrain that forms a chokepoint
    // Use dynamic threat range based on actor's movement capability
    const actorMov = this.getEffectiveMovement(context.character);
    const threatRange = Math.min(6, actorMov); // Cap at 6 for chokepoint detection
    const nearbyBlocking = this.countNearbyBlockingTerrain(position, context.battlefield, threatRange);
    return nearbyBlocking >= 2;
  }

  /**
   * Check if actor is moving toward an objective marker
   * QSR: Uses character's effective MOV for threat range
   */
  private isMovingTowardObjective(actor: Character, context: AIContext): boolean {
    if (!context.objectives || context.objectives.length === 0) {
      return false;
    }

    const actorPos = context.battlefield.getCharacterPosition(actor);
    if (!actorPos) return false;

    // Use actor's effective movement as threat range
    const threatRange = this.getEffectiveMovement(actor);

    for (const obj of context.objectives) {
      if (obj.position) {
        const dx = actorPos.x - obj.position.x;
        const dy = actorPos.y - obj.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Within threat range of objective
        if (distance <= threatRange) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if actor is trying to join an existing engagement (scrum)
   * QSR: Uses character's effective MOV for threat range
   */
  private isEnemyJoiningScrum(actor: Character, context: AIContext): boolean {
    const actorPos = context.battlefield.getCharacterPosition(actor);
    if (!actorPos) return false;

    const actorModel = {
      id: actor.id,
      position: actorPos,
      baseDiameter: getBaseDiameterFromSiz(actor.finalAttributes.siz ?? 3),
      siz: actor.finalAttributes.siz ?? 3,
    };

    // Use actor's effective movement as threat range
    const threatRange = this.getEffectiveMovement(actor);

    // Find engaged models
    for (const enemy of context.enemies) {
      if (enemy.id === actor.id) continue;
      const enemyPos = context.battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      // Check if enemy is engaged
      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes.siz ?? 3),
        siz: enemy.finalAttributes.siz ?? 3,
      };

      if (SpatialRules.isEngaged(enemyModel, actorModel)) {
        // Actor is already engaged, not joining
        return false;
      }

      // Check if actor is moving toward this engagement
      const dx = actorPos.x - enemyPos.x;
      const dy = actorPos.y - enemyPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Within threat range of engagement
      if (distance <= threatRange && distance > 1) {
        return true; // Moving toward engagement, could join for outnumbering
      }
    }

    return false;
  }

  /**
   * Count nearby blocking terrain elements
   */
  private countNearbyBlockingTerrain(position: Position, battlefield: Battlefield, radius: number): number {
    let count = 0;
    // Simplified: check 4 cardinal directions
    const directions = [
      { x: position.x + radius, y: position.y },
      { x: position.x - radius, y: position.y },
      { x: position.x, y: position.y + radius },
      { x: position.x, y: position.y - radius },
    ];

    for (const dir of directions) {
      if (dir.x >= 0 && dir.x < battlefield.width && dir.y >= 0 && dir.y < battlefield.height) {
        const terrain = battlefield.getTerrainAt(dir);
        if (terrain.type === 'blocking' || terrain.type === 'impassable') {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Check if target is high-value (leader, VIP)
   */
  private isHighValueTarget(target: Character, context: AIContext): boolean {
    // Simplified: check if target has Leadership trait or is designated VIP
    const hasLeadership = target.profile?.finalTraits?.some(t => t.toLowerCase().includes('leadership')) ?? false;
    return hasLeadership;
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
   * Decision based on Keys to Victory cost-benefit analysis
   */
  evaluateHide(context: AIContext): HideDecision {
    const character = context.character;

    // Can only hide if in/behind cover against at least one enemy.
    if (!this.hasCoverFromEnemy(character, context)) {
      return { shouldHide: false, reason: 'Not behind cover' };
    }

    // Check if enemies can see character
    const visibleToEnemy = this.isVisibleToEnemy(character, context);
    if (character.state.isHidden) {
      return { shouldHide: false, reason: 'Already hidden' };
    }

    // QSR Line 855: First Detect is FREE - defer Hide if Detect is available
    const hasDetectedThisActivation = character.state.hasDetectedThisActivation ?? false;
    const hiddenEnemies = context.enemies.filter(e =>
      !e.state.isEliminated &&
      isAttackableEnemy(context.character, e, context.config) &&
      e.state.isHidden
    );

    if (!hasDetectedThisActivation && hiddenEnemies.length > 0 && context.apRemaining >= 0) {
      // First Detect is FREE, should Detect before Hiding
      return { shouldHide: false, reason: 'Should Detect first (first is free)' };
    }

    // === Keys to Victory Cost-Benefit Analysis ===
    // Base priority for Hide action
    let priority = 2.2;

    // Tactical factors
    if (visibleToEnemy) {
      priority += 1.1; // Hiding while visible is valuable
    }

    const siz = character.finalAttributes.siz ?? 3;
    if (character.state.wounds >= siz - 1) {
      priority += 1.5; // Low health = hide to survive
    }

    const enemyCount = context.enemies.filter(e => isAttackableEnemy(context.character, e, context.config)).length;
    const allyCount = context.allies.filter(a => !a.state.isEliminated && !a.state.isKOd).length + 1;
    if (enemyCount > allyCount) {
      priority += 1.0; // Outnumbered = hide to regroup
    }

    // VP/RP pressure from Keys to Victory
    const myVP = context.vpBySide?.[context.sideId ?? ''] ?? 0;
    const enemyVP = Object.entries(context.vpBySide ?? {})
      .filter(([sid]) => sid !== context.sideId)
      .reduce((max, [, vp]) => Math.max(max, vp), 0);
    const vpDeficit = enemyVP - myVP;
    const currentTurn = context.currentTurn ?? 1;
    const maxTurns = context.maxTurns ?? 6;
    const turnsRemaining = maxTurns - currentTurn + 1;

    // Behind on VP - hiding is lower priority (need to score)
    if (vpDeficit > 0) {
      priority -= Math.min(1.5, vpDeficit * 0.3);
    }

    // Late game with VP lead - hiding is valuable (protect lead)
    if (myVP > enemyVP && turnsRemaining <= 3) {
      priority += 0.8; // Protect the lead
    }

    // Scoring context from Side AI
    if (context.scoringContext && context.scoringContext.amILeading) {
      priority += 0.5; // Leading = more defensive
    }

    return {
      shouldHide: priority >= 3.0,
      reason: `Hide (VP: ${myVP}-${enemyVP}, priority: ${priority.toFixed(1)})`,
      priority,
    };
  }

  /**
   * Evaluate whether character should Detect hidden enemies
   * QSR Line 855: First Detect costs 0 AP, subsequent cost 1 AP
   * Decision based on Keys to Victory cost-benefit analysis
   */
  evaluateDetect(context: AIContext): DetectDecision {
    const character = context.character;

    // Check if there are hidden enemies
    const hiddenEnemies = context.enemies.filter(e =>
      !e.state.isEliminated &&
      isAttackableEnemy(context.character, e, context.config) &&
      e.state.isHidden
    );

    if (hiddenEnemies.length === 0) {
      return { shouldDetect: false, targets: [] };
    }

    // QSR Line 855: First Detect is FREE (0 AP)
    const hasDetectedThisActivation = character.state.hasDetectedThisActivation ?? false;
    const apCost = hasDetectedThisActivation ? 1 : 0;

    if (context.apRemaining < apCost) {
      return { shouldDetect: false, targets: [], reason: `Not enough AP (need ${apCost})` };
    }

    // === Keys to Victory Cost-Benefit Analysis ===
    // Base priority for Detect action
    let priority = 2.2;
    const charPos = context.battlefield.getCharacterPosition(character);
    const nearbyHiddenCount = charPos
      ? hiddenEnemies.filter(enemy => {
          const enemyPos = context.battlefield.getCharacterPosition(enemy);
          if (!enemyPos) return false;
          const distance = Math.hypot(charPos.x - enemyPos.x, charPos.y - enemyPos.y);
          return distance <= 16;
        }).length
      : 0;

    // Tactical factors
    if (hiddenEnemies.length >= 2) {
      priority += 0.6; // Multiple targets = higher value
    }
    if (nearbyHiddenCount > 0) {
      priority += 0.5; // Nearby targets = easier to reveal
    }
    if (character.state.isInCover) {
      priority += 0.2; // Safe to Detect
    }

    // VP/RP pressure from Keys to Victory
    const myVP = context.vpBySide?.[context.sideId ?? ''] ?? 0;
    const enemyVP = Object.entries(context.vpBySide ?? {})
      .filter(([sid]) => sid !== context.sideId)
      .reduce((max, [, vp]) => Math.max(max, vp), 0);
    const vpDeficit = enemyVP - myVP;
    const currentTurn = context.currentTurn ?? 1;
    const maxTurns = context.maxTurns ?? 6;
    const turnsRemaining = maxTurns - currentTurn + 1;

    // Elimination Key: Revealing enemies enables VP from eliminations
    if (vpDeficit > 0) {
      // Behind on VP - Detect to enable combat
      priority += Math.min(2.0, vpDeficit * 0.5);
    }

    // Late game pressure: Need VP soon
    if (turnsRemaining <= 2 && myVP === 0) {
      priority += 1.5; // Desperate for VP
    } else if (turnsRemaining <= 3 && myVP === 0) {
      priority += 0.8; // Need to start scoring
    }

    // First Detect is FREE - always valuable when enemies Hidden
    if (!hasDetectedThisActivation) {
      priority += 1.0; // Free action to reveal enemies
    }

    // Scoring context from Side AI (Keys to Victory priorities)
    if (context.scoringContext) {
      const losingKeys = context.scoringContext.losingKeys || [];
      if (losingKeys.includes('elimination') || losingKeys.includes('first_blood')) {
        priority += 1.0; // Behind on elimination keys
      }
    }

    return {
      shouldDetect: priority >= 2.4,
      targets: hiddenEnemies,
      priority,
      reason: `Detect ${hiddenEnemies.length} hidden (VP: ${myVP}-${enemyVP}, AP: ${apCost}, priority: ${priority.toFixed(1)})`,
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
      if (!isAttackableEnemy(context.character, enemy, context.config)) continue;

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

  private hasCoverFromEnemy(character: Character, context: AIContext): boolean {
    const charPos = context.battlefield.getCharacterPosition(character);
    if (!charPos) return false;
    const charModel = {
      id: character.id,
      position: charPos,
      baseDiameter: getBaseDiameterFromSiz(character.finalAttributes.siz ?? 3),
      siz: character.finalAttributes.siz ?? 3,
    };

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
      const cover = SpatialRules.getCoverResult(context.battlefield, enemyModel, charModel);
      if (cover.hasLOS && (cover.hasDirectCover || cover.hasInterveningCover)) {
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

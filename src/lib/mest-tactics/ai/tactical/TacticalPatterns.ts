/**
 * Tactical Patterns System
 * 
 * Encodes tactical knowledge as reusable patterns that can be
 * recognized and applied in similar situations.
 */

import { Character } from '../../core/Character';
import { Battlefield } from '../../battlefield/Battlefield';
import { Position } from '../../battlefield/Position';
import { ActionDecision, AIContext, ActionType } from '../core/AIController';
import { isAttackableEnemy } from '../core/ai-utils';

/**
 * Tactical pattern recognition result
 */
export interface PatternMatch {
  /** Pattern that was matched */
  pattern: TacticalPattern;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggested actions */
  actions: ActionDecision[];
}

/**
 * Tactical pattern definition
 */
export interface TacticalPattern {
  /** Unique pattern identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of when this pattern applies */
  description: string;
  /** Conditions that must be met */
  conditions: PatternCondition[];
  /** Actions to execute when pattern matches */
  execute: (context: AIContext, match: PatternMatch) => ActionDecision[];
  /** Priority (higher = more important) */
  priority: number;
  /** Success rate (tracked during gameplay) */
  successRate: number;
  /** Times used */
  timesUsed: number;
}

/**
 * Pattern condition
 */
export interface PatternCondition {
  /** Condition name for debugging */
  name: string;
  /** Check function */
  check: (context: AIContext) => boolean;
}

/**
 * Pattern Registry
 * 
 * Stores and manages all tactical patterns.
 */
export class PatternRegistry {
  private patterns: Map<string, TacticalPattern> = new Map();

  /**
   * Register a tactical pattern
   */
  register(pattern: TacticalPattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Get a pattern by ID
   */
  get(id: string): TacticalPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all registered patterns
   */
  getAll(): TacticalPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Update pattern statistics
   */
  recordOutcome(patternId: string, success: boolean): void {
    const pattern = this.patterns.get(patternId);
    if (pattern) {
      pattern.timesUsed++;
      // Exponential moving average for success rate
      const alpha = 0.1;
      pattern.successRate = pattern.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    }
  }
}

/**
 * Pattern Recognizer
 * 
 * Analyzes battlefield situation and matches tactical patterns.
 */
export class PatternRecognizer {
  private registry: PatternRegistry;

  constructor(registry: PatternRegistry) {
    this.registry = registry;
  }

  /**
   * Recognize all matching patterns for current situation
   */
  recognize(context: AIContext): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const pattern of this.registry.getAll()) {
      const confidence = this.evaluatePattern(pattern, context);
      if (confidence > 0.5) {
        const actions = pattern.execute(context, { pattern, confidence, actions: [] });
        matches.push({ pattern, confidence, actions });
      }
    }

    // Sort by priority and confidence
    matches.sort((a, b) => 
      (b.pattern.priority * b.confidence) - (a.pattern.priority * a.confidence)
    );

    return matches;
  }

  /**
   * Evaluate how well a pattern matches current situation
   */
  private evaluatePattern(pattern: TacticalPattern, context: AIContext): number {
    if (pattern.conditions.length === 0) return 0.5;

    let matchCount = 0;
    for (const condition of pattern.conditions) {
      if (condition.check(context)) {
        matchCount++;
      }
    }

    return matchCount / pattern.conditions.length;
  }

  /**
   * Get the best matching pattern
   */
  getBestMatch(context: AIContext): PatternMatch | null {
    const matches = this.recognize(context);
    return matches.length > 0 ? matches[0] : null;
  }
}

// ============================================================================
// Pattern Conditions (Reusable)
// ============================================================================

export const Conditions = {
  /** Enemy is flanking our position */
  EnemyFlanking: {
    name: 'Enemy Flanking',
    check: (ctx: AIContext) => {
      const charPos = ctx.battlefield.getCharacterPosition(ctx.character);
      if (!charPos) return false;

      // Check if enemies are on multiple sides
      let leftCount = 0;
      let rightCount = 0;
      
      for (const enemy of ctx.enemies) {
        if (!isAttackableEnemy(ctx.character, enemy, ctx.config)) continue;
        const enemyPos = ctx.battlefield.getCharacterPosition(enemy);
        if (!enemyPos) continue;
        
        if (enemyPos.x < charPos.x) leftCount++;
        else if (enemyPos.x > charPos.x) rightCount++;
      }

      return leftCount > 0 && rightCount > 0;
    },
  },

  /** Ally is overwhelmed (engaged by multiple enemies) */
  AllyOverwhelmed: {
    name: 'Ally Overwhelmed',
    check: (ctx: AIContext) => {
      for (const ally of ctx.allies) {
        if (ally.state.isEliminated || ally.state.isKOd) continue;
        if (!ctx.battlefield.isEngaged?.(ally)) continue;

        // Count enemies engaged with this ally
        let enemyCount = 0;
        for (const enemy of ctx.enemies) {
          if (ctx.battlefield.isEngaged?.(enemy)) enemyCount++;
        }

        if (enemyCount >= 2) return true;
      }
      return false;
    },
  },

  /** Enemy is wounded (easy kill) */
  EnemyWounded: {
    name: 'Enemy Wounded',
    check: (ctx: AIContext) => {
      return ctx.enemies.some(e => {
        if (!isAttackableEnemy(ctx.character, e, ctx.config)) return false;
        const siz = e.finalAttributes.siz ?? e.attributes.siz ?? 3;
        return e.state.wounds >= siz - 1;
      });
    },
  },

  /** We outnumber the enemy */
  WeOutnumber: {
    name: 'We Outnumber',
    check: (ctx: AIContext) => {
      const friendlyCount = ctx.allies.filter(a => 
        !a.state.isEliminated && !a.state.isKOd
      ).length;
      const enemyCount = ctx.enemies.filter(e => 
        isAttackableEnemy(ctx.character, e, ctx.config)
      ).length;
      return friendlyCount > enemyCount * 1.5;
    },
  },

  /** Enemy outnumbers us */
  EnemyOutnumbers: {
    name: 'Enemy Outnumbers',
    check: (ctx: AIContext) => {
      const friendlyCount = ctx.allies.filter(a => 
        !a.state.isEliminated && !a.state.isKOd
      ).length + 1; // Include self
      const enemyCount = ctx.enemies.filter(e => 
        isAttackableEnemy(ctx.character, e, ctx.config)
      ).length;
      return enemyCount > friendlyCount * 1.5;
    },
  },

  /** Character is engaged in melee */
  IsEngaged: {
    name: 'Is Engaged',
    check: (ctx: AIContext) => !!ctx.battlefield.isEngaged?.(ctx.character),
  },

  /** Character has LOS to enemy */
  HasLOS: {
    name: 'Has LOS',
    check: (ctx: AIContext) => {
      return ctx.enemies.some(e => {
        if (!isAttackableEnemy(ctx.character, e, ctx.config)) return false;
        // Simplified LOS check
        return true;
      });
    },
  },

  /** Character is in cover */
  InCover: {
    name: 'In Cover',
    check: (ctx: AIContext) => {
      // TODO: Check actual cover status
      // Rules Reference: rules-terrain.md - Cover classification
      // rules-situational-modifiers.md - Cover modifiers
      return ctx.character.state.isInCover ?? false;
    },
  },

  /** Character is low on health */
  LowHealth: {
    name: 'Low Health',
    check: (ctx: AIContext) => {
      const siz = ctx.character.finalAttributes.siz ?? ctx.character.attributes.siz ?? 3;
      return ctx.character.state.wounds >= siz - 1;
    },
  },

  /** Objective is nearby */
  ObjectiveNearby: {
    name: 'Objective Nearby',
    check: (ctx: AIContext) => {
      // TODO: Check for mission objectives
      // Rules Reference: rules-missions-qai.md - Mission-specific objectives
      // rules-mission-keys.md - Keys to Victory
      // rules-objective-markers.md - OM types and actions
      return false;
    },
  },
};

// ============================================================================
// Tactical Patterns (Pre-defined)
// ============================================================================

export const Patterns = {
  /** Focus Fire - concentrate attacks on wounded enemy */
  FocusFire: {
    id: 'focus_fire',
    name: 'Focus Fire',
    description: 'Concentrate all attacks on a wounded enemy to eliminate them quickly',
    conditions: [Conditions.EnemyWounded],
    execute: (ctx: AIContext, match: PatternMatch): ActionDecision[] => {
      const actions: ActionDecision[] = [];
      
      // Find the most wounded enemy
      let mostWounded: Character | null = null;
      let highestWoundRatio = 0;

      for (const enemy of ctx.enemies) {
        if (!isAttackableEnemy(ctx.character, enemy, ctx.config)) continue;
        const siz = enemy.finalAttributes.siz ?? enemy.attributes.siz ?? 3;
        const woundRatio = enemy.state.wounds / siz;
        if (woundRatio > highestWoundRatio) {
          highestWoundRatio = woundRatio;
          mostWounded = enemy;
        }
      }

      if (mostWounded) {
        actions.push({
          type: 'close_combat',
          target: mostWounded,
          reason: 'Focus fire on wounded target',
          priority: 5.0,
          requiresAP: true,
        });
      }

      return actions;
    },
    priority: 5,
    successRate: 0.0,
    timesUsed: 0,
  },

  /** Flanking Maneuver - attack from multiple sides */
  FlankingManeuver: {
    id: 'flanking_maneuver',
    name: 'Flanking Maneuver',
    description: 'Coordinate attacks from multiple directions',
    conditions: [Conditions.EnemyFlanking, Conditions.WeOutnumber],
    execute: (ctx: AIContext, match: PatternMatch): ActionDecision[] => {
      const actions: ActionDecision[] = [];
      
      // Find enemy to flank
      const nearestEnemy = ctx.enemies.find(e => 
        isAttackableEnemy(ctx.character, e, ctx.config)
      );

      if (nearestEnemy) {
        actions.push({
          type: 'move',
          reason: 'Move to flank position',
          priority: 4.0,
          requiresAP: true,
        });
        actions.push({
          type: 'close_combat',
          target: nearestEnemy,
          reason: 'Attack from flank',
          priority: 4.5,
          requiresAP: true,
        });
      }

      return actions;
    },
    priority: 4,
    successRate: 0.0,
    timesUsed: 0,
  },

  /** Support Ally - help overwhelmed teammate */
  SupportAlly: {
    id: 'support_ally',
    name: 'Support Ally',
    description: 'Move to help an ally who is outnumbered',
    conditions: [Conditions.AllyOverwhelmed],
    execute: (ctx: AIContext, match: PatternMatch): ActionDecision[] => {
      const actions: ActionDecision[] = [];
      
      // Find overwhelmed ally
      const overwhelmedAlly = ctx.allies.find(ally => {
        if (ally.state.isEliminated || ally.state.isKOd) return false;
        if (!ctx.battlefield.isEngaged?.(ally)) return false;
        // Count enemies engaged
        let enemyCount = 0;
        for (const enemy of ctx.enemies) {
          if (ctx.battlefield.isEngaged?.(enemy)) enemyCount++;
        }
        return enemyCount >= 2;
      });

      if (overwhelmedAlly) {
        actions.push({
          type: 'move',
          reason: 'Move to support overwhelmed ally',
          priority: 4.5,
          requiresAP: true,
        });
        actions.push({
          type: 'close_combat',
          target: ctx.enemies[0], // Attack enemy engaging ally
          reason: 'Attack enemy engaging ally',
          priority: 5.0,
          requiresAP: true,
        });
      }

      return actions;
    },
    priority: 5,
    successRate: 0.0,
    timesUsed: 0,
  },

  /** Defensive Formation - form up when outnumbered */
  DefensiveFormation: {
    id: 'defensive_formation',
    name: 'Defensive Formation',
    description: 'Form defensive position when outnumbered',
    conditions: [Conditions.EnemyOutnumbers],
    execute: (ctx: AIContext, match: PatternMatch): ActionDecision[] => {
      const actions: ActionDecision[] = [];
      
      // Move toward nearest ally for mutual support
      const nearestAlly = ctx.allies.find(a => 
        !a.state.isEliminated && !a.state.isKOd
      );

      if (nearestAlly) {
        actions.push({
          type: 'move',
          reason: 'Move to defensive position near ally',
          priority: 3.5,
          requiresAP: true,
        });
      } else {
        // Hold position and defend
        actions.push({
          type: 'hold',
          reason: 'Hold defensive position',
          priority: 3.0,
          requiresAP: false,
        });
      }

      return actions;
    },
    priority: 4,
    successRate: 0.0,
    timesUsed: 0,
  },

  /** Retreat - fall back when critically wounded */
  Retreat: {
    id: 'retreat',
    name: 'Retreat',
    description: 'Fall back to safety when critically wounded',
    conditions: [Conditions.LowHealth],
    execute: (ctx: AIContext, match: PatternMatch): ActionDecision[] => {
      const actions: ActionDecision[] = [];
      
      // Disengage if engaged
      if (ctx.battlefield.isEngaged?.(ctx.character)) {
        const enemy = ctx.enemies.find(e => 
          isAttackableEnemy(ctx.character, e, ctx.config)
        );
        if (enemy) {
          actions.push({
            type: 'disengage',
            target: enemy,
            reason: 'Disengage to retreat',
            priority: 5.0,
            requiresAP: true,
          });
        }
      }

      // Move away from enemies
      actions.push({
        type: 'move',
        reason: 'Retreat to safety',
        priority: 4.5,
        requiresAP: true,
      });

      return actions;
    },
    priority: 5,
    successRate: 0.0,
    timesUsed: 0,
  },

  /** Objective Assault - attack mission objective */
  ObjectiveAssault: {
    id: 'objective_assault',
    name: 'Objective Assault',
    description: 'Attack or defend mission objective',
    conditions: [Conditions.ObjectiveNearby],
    execute: (ctx: AIContext, match: PatternMatch): ActionDecision[] => {
      const actions: ActionDecision[] = [];
      
      // Move toward objective
      actions.push({
        type: 'move',
        reason: 'Move toward objective',
        priority: 4.0,
        requiresAP: true,
      });

      // Attack enemies near objective
      const enemy = ctx.enemies.find(e => 
        isAttackableEnemy(ctx.character, e, ctx.config)
      );
      if (enemy) {
        actions.push({
          type: 'close_combat',
          target: enemy,
          reason: 'Clear enemies from objective',
          priority: 4.5,
          requiresAP: true,
        });
      }

      return actions;
    },
    priority: 4,
    successRate: 0.0,
    timesUsed: 0,
  },
};

/**
 * Create default pattern registry with all standard patterns
 */
export function createDefaultPatternRegistry(): PatternRegistry {
  const registry = new PatternRegistry();
  
  // Register all standard patterns
  registry.register(Patterns.FocusFire);
  registry.register(Patterns.FlankingManeuver);
  registry.register(Patterns.SupportAlly);
  registry.register(Patterns.DefensiveFormation);
  registry.register(Patterns.Retreat);
  registry.register(Patterns.ObjectiveAssault);

  return registry;
}

/**
 * Statistics Tracker
 * 
 * Tracks battle statistics and metrics for AI battles.
 * Handles all stats collection, aggregation, and reporting.
 */

import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { BonusActionOption, BonusActionOutcome } from '../../../src/lib/mest-tactics/actions/bonus-actions';
import type { PassiveOption, PassiveOptionType, PassiveEvent } from '../../../src/lib/mest-tactics/status/passive-options';
import type { TestContext } from '../../../src/lib/mest-tactics/utils/TestContext';
import type { AIResult } from '../../../src/lib/mest-tactics/ai/core/AIController';
import type {
  BattleStats,
  AdvancedRuleMetrics,
  RuleTypeBreakdown,
  ModelUsageStats
} from '../../shared/BattleReportTypes';
import { CONTEXT_MODIFIER_KEYS } from '../validation/ValidationMetrics';
import type { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import type { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';

export interface TrackSituationalParams {
  context?: TestContext | Record<string, unknown>;
  hitTestResult?: { finalPools?: Record<string, unknown> };
}

export interface TrackCombatExtrasParams {
  bonusActionOptions?: BonusActionOption[];
  bonusActionOutcome?: BonusActionOutcome;
  context?: TestContext;
  result?: { hitTestResult?: { finalPools?: Record<string, unknown> } };
  hitTestResult?: { finalPools?: Record<string, unknown> };
}

export class StatisticsTracker {
  private stats: BattleStats;
  private advancedRules: AdvancedRuleMetrics;
  private modelUsageByCharacter: Map<Character, ModelUsageStats>;
  private sideNameByCharacterId: Map<string, string>;

  constructor() {
    this.stats = this.createEmptyStats();
    this.advancedRules = this.createEmptyAdvancedRuleMetrics();
    this.modelUsageByCharacter = new Map();
    this.sideNameByCharacterId = new Map();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  initializeModelUsage(
    sides: Array<{ characters: Character[]; name: string }>,
    sideDoctrines?: Map<string, any>
  ) {
    this.modelUsageByCharacter = new Map<Character, ModelUsageStats>();
    this.sideNameByCharacterId = new Map<string, string>();
    
    for (const side of sides) {
      for (const character of side.characters) {
        this.sideNameByCharacterId.set(character.id, side.name);
        this.modelUsageByCharacter.set(character, {
          modelId: character.id,
          modelName: character.profile.name,
          side: side.name,
          pathLength: 0,
          moveActions: 0,
          waitChoicesGiven: 0,
          waitAttempts: 0,
          waitSuccesses: 0,
          detectAttempts: 0,
          detectSuccesses: 0,
          hideAttempts: 0,
          hideSuccesses: 0,
          reactChoiceWindows: 0,
          reactChoicesGiven: 0,
          reactAttempts: 0,
          reactSuccesses: 0,
        });
      }
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getStats(): BattleStats {
    return { ...this.stats };
  }

  getAdvancedRules(): AdvancedRuleMetrics {
    return { ...this.advancedRules };
  }

  getModelUsage(character: Character): ModelUsageStats | undefined {
    return this.modelUsageByCharacter.get(character);
  }

  getAllModelUsage(): ModelUsageStats[] {
    return Array.from(this.modelUsageByCharacter.values());
  }

  getSideNameForCharacter(characterId: string): string | undefined {
    return this.sideNameByCharacterId.get(characterId);
  }

  // ============================================================================
  // Movement Tracking
  // ============================================================================

  trackPathMovement(character: Character, movedDistance: number) {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    usage.pathLength += movedDistance;
    usage.moveActions += 1;
    this.stats.totalPathLength += movedDistance;
  }

  // ============================================================================
  // Wait & React Tracking
  // ============================================================================

  trackWaitChoiceGiven(character: Character) {
    this.stats.waitChoicesGiven += 1;
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    usage.waitChoicesGiven += 1;
  }

  trackReactChoiceWindow(
    options: Array<{ actor: Character; available: boolean; type: string }>
  ) {
    const available = options.filter(option => option.available && option.type === 'StandardReact');
    if (available.length === 0) return;
    
    this.stats.reactChoiceWindows += 1;
    this.stats.reactChoicesGiven += available.length;
    
    const byActor = new Map<string, { actor: Character; count: number }>();
    for (const option of available) {
      const entry = byActor.get(option.actor.id);
      if (entry) {
        entry.count += 1;
      } else {
        byActor.set(option.actor.id, { actor: option.actor, count: 1 });
      }
    }
    
    for (const { actor, count } of byActor.values()) {
      const usage = this.modelUsageByCharacter.get(actor);
      if (!usage) continue;
      usage.reactChoiceWindows += 1;
      usage.reactChoicesGiven += count;
    }
  }

  trackDecisionChoiceSet(character: Character, debug: AIResult['debug'] | undefined) {
    const availability = debug?.actionAvailability;
    if (!availability) return;
    const waitChoices = Number(availability.wait ?? 0);
    if (Number.isFinite(waitChoices) && waitChoices > 0) {
      this.trackWaitChoiceGiven(character);
    }
  }

  trackAttempt(character: Character, action: 'wait' | 'detect' | 'hide' | 'react') {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    if (action === 'wait') usage.waitAttempts += 1;
    if (action === 'detect') usage.detectAttempts += 1;
    if (action === 'hide') usage.hideAttempts += 1;
    if (action === 'react') usage.reactAttempts += 1;
  }

  trackSuccess(character: Character, action: 'wait' | 'detect' | 'hide' | 'react') {
    const usage = this.modelUsageByCharacter.get(character);
    if (!usage) return;
    if (action === 'wait') usage.waitSuccesses += 1;
    if (action === 'detect') usage.detectSuccesses += 1;
    if (action === 'hide') usage.hideSuccesses += 1;
    if (action === 'react') usage.reactSuccesses += 1;
  }

  trackWaitSelection(planningSource?: string) {
    if (planningSource === 'goap_forecast' || planningSource === 'goap_plan') {
      this.stats.waitsSelectedPlanner += 1;
      return;
    }
    this.stats.waitsSelectedUtility += 1;
  }

  // ============================================================================
  // Bonus Actions Tracking
  // ============================================================================

  private incrementTypeBreakdown(breakdown: RuleTypeBreakdown, type: string, amount: number = 1) {
    if (!type || !Number.isFinite(amount) || amount === 0) return;
    breakdown[type] = (breakdown[type] ?? 0) + amount;
  }

  trackBonusActionOptions(options: BonusActionOption[] | undefined) {
    if (!Array.isArray(options) || options.length === 0) return;
    
    this.advancedRules.bonusActions.opportunities += 1;
    this.advancedRules.bonusActions.optionsOffered += options.length;
    
    for (const option of options) {
      this.incrementTypeBreakdown(this.advancedRules.bonusActions.offeredByType, option.type);
      if (option.available) {
        this.advancedRules.bonusActions.optionsAvailable += 1;
        this.incrementTypeBreakdown(this.advancedRules.bonusActions.availableByType, option.type);
      }
    }
  }

  trackBonusActionOutcome(outcome: BonusActionOutcome | undefined) {
    if (!outcome || !outcome.executed) return;
    
    const type = outcome.type ?? 'Unknown';
    this.advancedRules.bonusActions.executed += 1;
    this.incrementTypeBreakdown(this.advancedRules.bonusActions.executedByType, type);
  }

  // ============================================================================
  // Passive Options Tracking
  // ============================================================================

  trackPassiveOptions(options: PassiveOption[] | undefined) {
    if (!Array.isArray(options) || options.length === 0) return;
    
    this.advancedRules.passiveOptions.opportunities += 1;
    this.advancedRules.passiveOptions.optionsOffered += options.length;
    
    for (const option of options) {
      this.incrementTypeBreakdown(this.advancedRules.passiveOptions.offeredByType, option.type);
      if (option.available) {
        this.advancedRules.passiveOptions.optionsAvailable += 1;
        this.incrementTypeBreakdown(this.advancedRules.passiveOptions.availableByType, option.type);
      }
    }
  }

  trackPassiveUsage(type: PassiveOptionType, amount: number = 1) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.advancedRules.passiveOptions.used += amount;
    this.incrementTypeBreakdown(this.advancedRules.passiveOptions.usedByType, type, amount);
  }

  inspectPassiveOptions(gameManager: GameManager, event: PassiveEvent): PassiveOption[] {
    const options = gameManager.getPassiveOptions(event);
    this.trackPassiveOptions(options);
    return options;
  }

  // ============================================================================
  // Situational Modifiers Tracking
  // ============================================================================

  trackSituationalModifiers(params: TrackSituationalParams) {
    const { context, hitTestResult } = params;
    const applied = new Set<string>();
    
    if (context && typeof context === 'object') {
      for (const [key, label] of Object.entries(CONTEXT_MODIFIER_KEYS)) {
        const value = (context as Record<string, unknown>)[key];
        if (typeof value === 'boolean' && value) {
          applied.add(label);
        } else if (typeof value === 'number' && value > 0) {
          applied.add(label);
        }
      }
    }
    
    const finalPools = hitTestResult?.finalPools;
    if (finalPools && typeof finalPools === 'object') {
      const buckets = [
        ['p1FinalBonus', 'attacker_bonus'],
        ['p1FinalPenalty', 'attacker_penalty'],
        ['p2FinalBonus', 'defender_bonus'],
        ['p2FinalPenalty', 'defender_penalty'],
      ] as const;
      
      for (const [poolKey, prefix] of buckets) {
        const pool = (finalPools as Record<string, unknown>)[poolKey];
        if (!pool || typeof pool !== 'object') continue;
        for (const dieType of ['base', 'modifier', 'wild']) {
          const value = (pool as Record<string, unknown>)[dieType];
          if (typeof value === 'number' && value > 0) {
            applied.add(`${prefix}_${dieType}`);
          }
        }
      }
    }

    this.advancedRules.situationalModifiers.testsObserved += 1;
    if (applied.size > 0) {
      this.advancedRules.situationalModifiers.modifiedTests += 1;
      this.advancedRules.situationalModifiers.modifiersApplied += applied.size;
      for (const type of applied) {
        this.incrementTypeBreakdown(this.advancedRules.situationalModifiers.byType, type);
      }
    }
  }

  // ============================================================================
  // Combat Extras Tracking
  // ============================================================================

  trackCombatExtras(params: TrackCombatExtrasParams) {
    this.trackBonusActionOptions(params.bonusActionOptions);
    this.trackBonusActionOutcome(params.bonusActionOutcome);
    
    const hitTestResult = params.result?.hitTestResult ?? params.hitTestResult;
    if (params.context || hitTestResult) {
      this.trackSituationalModifiers({ context: params.context, hitTestResult });
    }
  }

  // ============================================================================
  // Action Counters
  // ============================================================================

  incrementAction(actionType: string) {
    switch (actionType) {
      case 'Move':
        this.stats.moves += 1;
        break;
      case 'CloseCombatAttack':
        this.stats.closeCombats += 1;
        break;
      case 'RangedAttack':
        this.stats.rangedCombats += 1;
        break;
      case 'Disengage':
        this.stats.disengages += 1;
        break;
      case 'Wait':
        this.stats.waits += 1;
        break;
      case 'Detect':
        this.stats.detects += 1;
        break;
      case 'Hide':
        this.stats.hides += 1;
        break;
    }
    this.stats.totalActions += 1;
  }

  incrementTotalActions() {
    this.stats.totalActions += 1;
  }

  trackElimination() {
    this.stats.eliminations += 1;
  }

  trackKO() {
    this.stats.kos += 1;
  }

  trackLOSCheck() {
    this.stats.losChecks += 1;
  }

  trackLOFCheck() {
    this.stats.lofChecks += 1;
  }

  trackMovesWhileWaiting() {
    this.stats.movesWhileWaiting += 1;
  }

  trackWaitMaintained() {
    this.stats.waitMaintained += 1;
  }

  trackWaitUpkeepPaid() {
    this.stats.waitUpkeepPaid += 1;
  }

  trackReactWoundsInflicted(wounds: number) {
    this.stats.reactWoundsInflicted += wounds;
  }

  trackWaitReactWoundsInflicted(wounds: number) {
    this.stats.waitReactWoundsInflicted += wounds;
  }

  trackWaitTriggeredReact() {
    this.stats.waitTriggeredReacts += 1;
  }

  setTurnsCompleted(turn: number) {
    this.stats.turnsCompleted = turn;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private createEmptyStats(): BattleStats {
    return {
      totalActions: 0,
      moves: 0,
      movesWhileWaiting: 0,
      closeCombats: 0,
      rangedCombats: 0,
      disengages: 0,
      waits: 0,
      waitsSelectedPlanner: 0,
      waitsSelectedUtility: 0,
      waitChoicesGiven: 0,
      waitChoicesTaken: 0,
      waitChoicesSucceeded: 0,
      waitMaintained: 0,
      waitUpkeepPaid: 0,
      detects: 0,
      hides: 0,
      reacts: 0,
      reactChoiceWindows: 0,
      reactChoicesGiven: 0,
      reactChoicesTaken: 0,
      waitTriggeredReacts: 0,
      reactWoundsInflicted: 0,
      waitReactWoundsInflicted: 0,
      eliminations: 0,
      kos: 0,
      turnsCompleted: 0,
      losChecks: 0,
      lofChecks: 0,
      totalPathLength: 0,
      modelsMoved: 0,
    };
  }

  private createEmptyAdvancedRuleMetrics(): AdvancedRuleMetrics {
    return {
      bonusActions: {
        opportunities: 0,
        optionsOffered: 0,
        optionsAvailable: 0,
        offeredByType: {},
        availableByType: {},
        executed: 0,
        executedByType: {},
      },
      passiveOptions: {
        opportunities: 0,
        optionsOffered: 0,
        optionsAvailable: 0,
        offeredByType: {},
        availableByType: {},
        used: 0,
        usedByType: {},
      },
      situationalModifiers: {
        testsObserved: 0,
        modifiedTests: 0,
        modifiersApplied: 0,
        byType: {},
      },
    };
  }

  reset() {
    this.stats = this.createEmptyStats();
    this.advancedRules = this.createEmptyAdvancedRuleMetrics();
    this.modelUsageByCharacter = new Map();
    this.sideNameByCharacterId = new Map();
  }
}

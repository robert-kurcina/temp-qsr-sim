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
  ModelUsageStats,
  ActionStepAudit,
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
  bonusActionOptionSets?: BonusActionOption[][];
  bonusActionOutcome?: BonusActionOutcome;
  bonusActionOutcomes?: BonusActionOutcome[];
  context?: TestContext;
  result?: { hitTestResult?: { finalPools?: Record<string, unknown> } };
  hitTestResult?: { finalPools?: Record<string, unknown> };
}

interface CombatAssignmentBreakdown {
  wounds: number;
  fear: number;
  delay: number;
}

interface FearFromWoundsTelemetry {
  woundsTrigger?: number;
  testRequired?: boolean;
  testAttempted?: boolean;
  pass?: boolean;
  skipReason?: string;
  fearAdded?: number;
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
    if (availability) {
      const waitChoices = Number(availability.wait ?? 0);
      if (Number.isFinite(waitChoices) && waitChoices > 0) {
        this.trackWaitChoiceGiven(character);
      }
    }

    const telemetry = debug?.decisionTelemetry;
    if (!telemetry) return;

    this.stats.decisionTelemetrySamples = (this.stats.decisionTelemetrySamples ?? 0) + 1;
    switch (telemetry.attackOpportunityGrade) {
      case 'immediate-high':
        this.stats.attackOpportunityImmediateHigh = (this.stats.attackOpportunityImmediateHigh ?? 0) + 1;
        break;
      case 'immediate-low':
        this.stats.attackOpportunityImmediateLow = (this.stats.attackOpportunityImmediateLow ?? 0) + 1;
        break;
      case 'setup':
        this.stats.attackOpportunitySetup = (this.stats.attackOpportunitySetup ?? 0) + 1;
        break;
      case 'none':
      default:
        this.stats.attackOpportunityNone = (this.stats.attackOpportunityNone ?? 0) + 1;
        break;
    }

    if (telemetry.attackGateApplied) {
      this.stats.attackGateAppliedDecisions = (this.stats.attackGateAppliedDecisions ?? 0) + 1;
      if (telemetry.attackGateReason === 'immediate_high_window') {
        this.stats.attackGateImmediateHighApplied = (this.stats.attackGateImmediateHighApplied ?? 0) + 1;
      } else {
        this.stats.attackGateDirectiveApplied = (this.stats.attackGateDirectiveApplied ?? 0) + 1;
      }
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

  private isPassiveStatusGateReason(normalizedReason: string): boolean {
    return normalizedReason === 'not_attentive'
      || normalizedReason === 'not_ordered'
      || normalizedReason === 'not_attentive_ordered';
  }

  private trackPassiveStatusGateByType(
    normalizedReason: string,
    optionType: string | undefined,
    amount: number = 1
  ) {
    if (!optionType || !Number.isFinite(amount) || amount <= 0) return;
    if (!this.isPassiveStatusGateReason(normalizedReason)) {
      return;
    }
    this.incrementTypeBreakdown(
      this.advancedRules.passiveOptions.rejectedStatusByType,
      `${normalizedReason}:${optionType}`,
      amount
    );
  }

  private normalizePassiveRejectionReason(reason: string | undefined): string {
    const normalized = String(reason ?? '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    if (normalized.includes('carry-over')) return 'no_carry_over';
    if (normalized.includes('failed hit test')) return 'not_failed_hit';
    if (normalized.includes('attentive+ordered')) return 'not_attentive_ordered';
    if (normalized.includes('requires attentive')) return 'not_attentive';
    if (normalized.includes('requires ordered')) return 'not_ordered';
    if (normalized.includes('attentive defender')) return 'not_attentive';
    if (normalized.includes('engaged with mover')) return 'not_engaged_with_mover';
    if (normalized.includes('engaged in melee')) return 'not_melee_engaged';
    if (normalized.includes('ref >=') || normalized.includes('ref >=')) return 'ref_gate';
    if (normalized.includes('melee engagement')) return 'not_melee_engaged';
    if (normalized.includes('counter-strike')) return 'missing_counter_strike_trait';
    if (normalized.includes('out of visibility')) return 'out_of_visibility';
    if (normalized.includes('los blocked by model')) return 'no_los_model_blocker';
    if (normalized.includes('los blocked')) return 'no_los_terrain_or_other';
    if (normalized.includes('los unavailable')) return 'no_los_unavailable';
    if (normalized.includes('los within visibility')) return 'no_los_or_visibility';
    if (normalized.includes('requires los')) return 'no_los';
    if (normalized.includes('requires defender to be free')) return 'defender_not_free';
    if (normalized.includes('requires revealed attacker')) return 'attacker_hidden';
    if (normalized.includes('ranged attack context')) return 'wrong_attack_context';
    if (normalized.includes('battlefield context required')) return 'missing_battlefield_context';
    if (normalized.includes('not prioritized')) return 'not_prioritized';
    if (normalized.includes('low damage potential')) return 'low_damage_potential';
    if (normalized.includes('no weapon available')) return 'no_weapon';
    if (normalized.includes('execution failed')) return 'execution_failed';
    if (normalized.includes('no viable passive candidate')) return 'no_viable_candidate';
    if (normalized.includes('unable to reach engagement')) return 'cannot_reach_engagement';
    if (normalized.includes('requires move to engage')) return 'cannot_reach_engagement';
    if (normalized.includes('move blocked')) return 'move_blocked';
    if (normalized.includes('target to spend enough ap on movement')) return 'insufficient_move_ap_spent';
    if (normalized.includes('available when hidden status is removed')) return 'hidden_reposition_unavailable';
    return 'other';
  }

  private passiveTurnBucket(currentTurn: number | undefined): string {
    if (typeof currentTurn !== 'number' || !Number.isFinite(currentTurn)) return 'unknown';
    if (currentTurn <= 1) return 'T1';
    if (currentTurn === 2) return 'T2';
    return 'T3+';
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

  trackPassiveOptions(options: PassiveOption[] | undefined, currentTurn?: number) {
    if (!Array.isArray(options) || options.length === 0) return;
    
    this.advancedRules.passiveOptions.opportunities += 1;
    this.advancedRules.passiveOptions.optionsOffered += options.length;
    
    for (const option of options) {
      this.incrementTypeBreakdown(this.advancedRules.passiveOptions.offeredByType, option.type);
      if (option.available) {
        this.advancedRules.passiveOptions.optionsAvailable += 1;
        this.incrementTypeBreakdown(this.advancedRules.passiveOptions.availableByType, option.type);
      } else {
        const normalizedReason = this.normalizePassiveRejectionReason(option.reason);
        this.incrementTypeBreakdown(
          this.advancedRules.passiveOptions.rejectedByReason,
          normalizedReason
        );
        this.trackPassiveStatusGateByType(normalizedReason, option.type, 1);
        const turnBucket = this.passiveTurnBucket(currentTurn);
        const byTurn = this.advancedRules.passiveOptions.rejectedByReasonByTurn;
        if (!byTurn[turnBucket]) {
          byTurn[turnBucket] = {};
        }
        this.incrementTypeBreakdown(byTurn[turnBucket], normalizedReason);
      }
    }
  }

  trackPassiveUsage(type: PassiveOptionType, amount: number = 1) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.advancedRules.passiveOptions.used += amount;
    this.incrementTypeBreakdown(this.advancedRules.passiveOptions.usedByType, type, amount);
  }

  trackPassiveRejection(
    reason: string,
    amount: number = 1,
    currentTurn?: number,
    optionType?: PassiveOptionType
  ) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const normalizedReason = this.normalizePassiveRejectionReason(reason);
    this.incrementTypeBreakdown(
      this.advancedRules.passiveOptions.rejectedByReason,
      normalizedReason,
      amount
    );
    this.trackPassiveStatusGateByType(normalizedReason, optionType, amount);
    const turnBucket = this.passiveTurnBucket(currentTurn);
    const byTurn = this.advancedRules.passiveOptions.rejectedByReasonByTurn;
    if (!byTurn[turnBucket]) {
      byTurn[turnBucket] = {};
    }
    this.incrementTypeBreakdown(byTurn[turnBucket], normalizedReason, amount);
  }

  trackPassivePrefilter(reason: string, amount: number = 1, currentTurn?: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const normalizedReason = this.normalizePassiveRejectionReason(reason);
    this.incrementTypeBreakdown(
      this.advancedRules.passiveOptions.prefilteredByReason,
      normalizedReason,
      amount
    );
    const turnBucket = this.passiveTurnBucket(currentTurn);
    const byTurn = this.advancedRules.passiveOptions.prefilteredByReasonByTurn;
    if (!byTurn[turnBucket]) {
      byTurn[turnBucket] = {};
    }
    this.incrementTypeBreakdown(byTurn[turnBucket], normalizedReason, amount);
  }

  inspectPassiveOptions(gameManager: GameManager, event: PassiveEvent): PassiveOption[] {
    const currentTurn = gameManager.currentTurn;
    const options = gameManager.getPassiveOptions(event);
    if (!Array.isArray(options) || options.length === 0) {
      return options;
    }

    const filtered: PassiveOption[] = [];
    for (const option of options) {
      if (option.available) {
        filtered.push(option);
        continue;
      }
      const normalizedReason = this.normalizePassiveRejectionReason(option.reason);
      if (this.isPassiveStatusGateReason(normalizedReason)) {
        this.trackPassivePrefilter(option.reason ?? 'unknown', 1, currentTurn);
        this.trackPassiveStatusGateByType(normalizedReason, option.type, 1);
        continue;
      }
      filtered.push(option);
    }

    this.trackPassiveOptions(filtered, currentTurn);
    return filtered;
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

  trackSituationalModifierType(type: string, amount: number = 1) {
    this.incrementTypeBreakdown(this.advancedRules.situationalModifiers.byType, type, amount);
  }

  // ============================================================================
  // Combat Extras Tracking
  // ============================================================================

  trackCombatExtras(params: TrackCombatExtrasParams) {
    const optionSets = Array.isArray(params.bonusActionOptionSets) && params.bonusActionOptionSets.length > 0
      ? params.bonusActionOptionSets
      : (params.bonusActionOptions ? [params.bonusActionOptions] : []);
    for (const options of optionSets) {
      this.trackBonusActionOptions(options);
    }

    const outcomes = Array.isArray(params.bonusActionOutcomes) && params.bonusActionOutcomes.length > 0
      ? params.bonusActionOutcomes
      : (params.bonusActionOutcome ? [params.bonusActionOutcome] : []);
    for (const outcome of outcomes) {
      this.trackBonusActionOutcome(outcome);
    }

    const combatResultPayload = this.resolveCombatResultPayload(params);
    const hitTestResult = this.extractHitTestResult(combatResultPayload)
      ?? params.result?.hitTestResult
      ?? params.hitTestResult;
    if (params.context || hitTestResult) {
      this.trackSituationalModifiers({ context: params.context, hitTestResult });
    }

    this.trackFearFromWoundsTelemetry(combatResultPayload ?? params.result ?? params);
    this.trackCombatTests(combatResultPayload ?? params.hitTestResult);
  }

  trackCombatAssignmentsFromStep(step: ActionStepAudit) {
    if (!this.isCombatStep(step)) {
      return;
    }
    if (!Array.isArray(step.affectedModels) || step.affectedModels.length === 0) {
      return;
    }

    let woundsAssigned = 0;
    let fearAssigned = 0;
    let delayAssigned = 0;

    for (const effect of step.affectedModels) {
      const before = effect?.before;
      const after = effect?.after;
      if (!before || !after) continue;
      woundsAssigned += Math.max(0, (after.wounds ?? 0) - (before.wounds ?? 0));
      fearAssigned += Math.max(0, (after.fearTokens ?? 0) - (before.fearTokens ?? 0));
      delayAssigned += Math.max(0, (after.delayTokens ?? 0) - (before.delayTokens ?? 0));
    }

    this.stats.woundsAssigned = (this.stats.woundsAssigned ?? 0) + woundsAssigned;
    this.stats.fearAssigned = (this.stats.fearAssigned ?? 0) + fearAssigned;
    this.stats.delayAssigned = (this.stats.delayAssigned ?? 0) + delayAssigned;

    const damageAssignments = this.extractDamageAssignmentsFromStep(step, {
      wounds: woundsAssigned,
      fear: fearAssigned,
      delay: delayAssigned,
    });
    const passiveOrOtherDelay = Math.max(0, delayAssigned - damageAssignments.delay);

    this.stats.damageWoundsAssigned = (this.stats.damageWoundsAssigned ?? 0) + damageAssignments.wounds;
    this.stats.damageFearAssigned = (this.stats.damageFearAssigned ?? 0) + damageAssignments.fear;
    this.stats.damageDelayAssigned = (this.stats.damageDelayAssigned ?? 0) + damageAssignments.delay;
    this.stats.passiveOrOtherDelayAssigned = (this.stats.passiveOrOtherDelayAssigned ?? 0) + passiveOrOtherDelay;
  }

  private isCombatStep(step: ActionStepAudit): boolean {
    const actionType = String(step.actionType ?? '').toLowerCase();
    if (
      actionType === 'close_combat'
      || actionType === 'charge'
      || actionType === 'ranged_combat'
      || actionType === 'attack'
      || actionType === 'disengage'
    ) {
      return true;
    }

    const details = this.asRecord(step.details);
    if (details && (details.attackResult || details.opportunityAttack || details.disengageResult)) {
      return true;
    }

    const interactions = Array.isArray(step.interactions) ? step.interactions : [];
    return interactions.some(interaction =>
      interaction?.kind === 'react' || interaction?.kind === 'opportunity_attack'
    );
  }

  private extractDamageAssignmentsFromStep(
    step: ActionStepAudit,
    totalAssignments: CombatAssignmentBreakdown
  ): CombatAssignmentBreakdown {
    const details = this.asRecord(step.details);
    const explicit = this.extractExplicitDamageAssignments(details);
    if (explicit) {
      return {
        wounds: Math.min(totalAssignments.wounds, explicit.wounds),
        fear: Math.min(totalAssignments.fear, explicit.fear),
        delay: Math.min(totalAssignments.delay, explicit.delay),
      };
    }

    const damageResolution = this.extractDamageResolution(
      details?.attackResult ?? details?.opportunityAttack ?? details?.disengageResult ?? details?.result ?? details
    );
    if (!damageResolution) {
      return { wounds: 0, fear: 0, delay: 0 };
    }

    const woundsAdded = this.toSafeNonNegativeNumber(damageResolution.woundsAdded);
    const stunWoundsAdded = this.toSafeNonNegativeNumber(damageResolution.stunWoundsAdded);
    const delayTokensAdded = this.toSafeNonNegativeNumber(damageResolution.delayTokensAdded);

    return {
      wounds: Math.min(totalAssignments.wounds, woundsAdded + stunWoundsAdded),
      fear: 0,
      delay: Math.min(totalAssignments.delay, Math.max(0, delayTokensAdded - stunWoundsAdded)),
    };
  }

  private extractExplicitDamageAssignments(
    details: Record<string, unknown> | undefined
  ): CombatAssignmentBreakdown | undefined {
    const payload = this.asRecord(details?.damageAssignments);
    if (!payload) return undefined;
    return {
      wounds: this.toSafeNonNegativeNumber(payload.wounds),
      fear: this.toSafeNonNegativeNumber(payload.fear),
      delay: this.toSafeNonNegativeNumber(payload.delay),
    };
  }

  private trackCombatTests(rawResult: unknown) {
    const hitPass = this.extractHitTestPass(rawResult);
    if (hitPass !== undefined) {
      this.stats.hitTestsAttempted = (this.stats.hitTestsAttempted ?? 0) + 1;
      if (hitPass) {
        this.stats.hitTestsPassed = (this.stats.hitTestsPassed ?? 0) + 1;
      } else {
        this.stats.hitTestsFailed = (this.stats.hitTestsFailed ?? 0) + 1;
      }
    }

    const damagePass = this.extractDamageTestPass(rawResult);
    if (damagePass !== undefined) {
      this.stats.damageTestsAttempted = (this.stats.damageTestsAttempted ?? 0) + 1;
      if (damagePass) {
        this.stats.damageTestsPassed = (this.stats.damageTestsPassed ?? 0) + 1;
      } else {
        this.stats.damageTestsFailed = (this.stats.damageTestsFailed ?? 0) + 1;
      }
    }
  }

  private trackFearFromWoundsTelemetry(rawResult: unknown) {
    const fear = this.extractFearFromWoundsResult(rawResult);
    if (!fear) return;

    const woundsTrigger = this.toSafeNonNegativeNumber(fear.woundsTrigger);
    const testRequired = Boolean(fear.testRequired);
    const testAttempted = Boolean(fear.testAttempted);
    const pass = typeof fear.pass === 'boolean' ? fear.pass : undefined;
    const skipReason = typeof fear.skipReason === 'string' ? fear.skipReason : undefined;
    const fearAdded = this.toSafeNonNegativeNumber(fear.fearAdded);

    if (woundsTrigger > 0) {
      this.stats.fearTestsFromWoundsTriggered = (this.stats.fearTestsFromWoundsTriggered ?? 0) + 1;
    }
    if (testRequired) {
      this.stats.fearTestsFromWoundsRequired = (this.stats.fearTestsFromWoundsRequired ?? 0) + 1;
    }
    if (testAttempted) {
      this.stats.fearTestsFromWoundsAttempted = (this.stats.fearTestsFromWoundsAttempted ?? 0) + 1;
      this.stats.fearTestsFromWoundsFearAdded = (this.stats.fearTestsFromWoundsFearAdded ?? 0) + fearAdded;
      if (pass === true) {
        this.stats.fearTestsFromWoundsPassed = (this.stats.fearTestsFromWoundsPassed ?? 0) + 1;
      } else if (pass === false) {
        this.stats.fearTestsFromWoundsFailed = (this.stats.fearTestsFromWoundsFailed ?? 0) + 1;
        if (fearAdded <= 0) {
          this.stats.fearTestsFromWoundsFailedNoFearAdded =
            (this.stats.fearTestsFromWoundsFailedNoFearAdded ?? 0) + 1;
        }
      }
      return;
    }

    if (!testRequired && woundsTrigger > 0) {
      this.stats.fearTestsFromWoundsSkipped = (this.stats.fearTestsFromWoundsSkipped ?? 0) + 1;
      switch (skipReason) {
        case 'already_disordered':
          this.stats.fearTestsFromWoundsSkippedAlreadyDisordered =
            (this.stats.fearTestsFromWoundsSkippedAlreadyDisordered ?? 0) + 1;
          break;
        case 'engaged_not_distracted':
          this.stats.fearTestsFromWoundsSkippedEngagedNotDistracted =
            (this.stats.fearTestsFromWoundsSkippedEngagedNotDistracted ?? 0) + 1;
          break;
        case 'already_tested_this_turn':
          this.stats.fearTestsFromWoundsSkippedAlreadyTestedThisTurn =
            (this.stats.fearTestsFromWoundsSkippedAlreadyTestedThisTurn ?? 0) + 1;
          break;
        case 'immune_to_fear':
          this.stats.fearTestsFromWoundsSkippedImmuneToFear =
            (this.stats.fearTestsFromWoundsSkippedImmuneToFear ?? 0) + 1;
          break;
        case 'morale_exempt':
          this.stats.fearTestsFromWoundsSkippedMoraleExempt =
            (this.stats.fearTestsFromWoundsSkippedMoraleExempt ?? 0) + 1;
          break;
        default:
          break;
      }
    }
  }

  private extractHitTestPass(rawResult: unknown): boolean | undefined {
    const hitTest = this.extractHitTestResult(rawResult);
    return this.extractPassValue(hitTest);
  }

  private extractDamageTestPass(rawResult: unknown): boolean | undefined {
    const damageResolution = this.extractDamageResolution(rawResult);
    if (!damageResolution) return undefined;
    const damageTest = this.asRecord(damageResolution.damageTestResult);
    return this.extractPassValue(damageTest);
  }

  private extractPassValue(testResult: Record<string, unknown> | undefined): boolean | undefined {
    if (!testResult) return undefined;
    if (typeof testResult.pass === 'boolean') return testResult.pass;
    if (typeof testResult.actorWins === 'boolean') return testResult.actorWins;
    return undefined;
  }

  private extractHitTestResult(rawResult: unknown): Record<string, unknown> | undefined {
    const payload = this.asRecord(rawResult);
    if (!payload) return undefined;

    const directHit = this.asRecord(payload.hitTestResult);
    if (directHit) return directHit;

    const nestedResult = this.asRecord(payload.result);
    const nestedHit = this.asRecord(nestedResult?.hitTestResult);
    if (nestedHit) return nestedHit;

    // Some call paths pass the hit test payload directly.
    if (typeof payload.pass === 'boolean' || typeof payload.actorWins === 'boolean') {
      return payload;
    }
    return undefined;
  }

  private extractDamageResolution(rawResult: unknown): Record<string, unknown> | undefined {
    const payload = this.asRecord(rawResult);
    if (!payload) return undefined;

    const directResolution = this.asRecord(payload.damageResolution ?? payload.damageResult);
    if (directResolution) return directResolution;

    const nestedResult = this.asRecord(payload.result);
    const nestedResolution = this.asRecord(nestedResult?.damageResolution ?? nestedResult?.damageResult);
    if (nestedResolution) return nestedResolution;

    return undefined;
  }

  private extractFearFromWoundsResult(rawResult: unknown): FearFromWoundsTelemetry | undefined {
    const payload = this.asRecord(rawResult);
    if (!payload) return undefined;

    const directFear = this.asRecord(payload.fearFromWounds);
    if (directFear) return directFear as FearFromWoundsTelemetry;

    const directResult = this.asRecord(payload.result);
    const nestedFear = this.asRecord(directResult?.fearFromWounds);
    if (nestedFear) return nestedFear as FearFromWoundsTelemetry;

    return undefined;
  }

  /**
   * Callers may provide either a wrapper shape:
   *   { result: { hitTestResult, damageResolution }, ... }
   * or a direct combat result payload:
   *   { hitTestResult, damageResolution, ... }
   *
   * Normalize to the richest payload so hit/damage test extraction can see both.
   */
  private resolveCombatResultPayload(params: TrackCombatExtrasParams): unknown {
    const wrappedResult = (params as Record<string, unknown> | undefined)?.result;
    if (wrappedResult !== undefined && wrappedResult !== null) {
      return wrappedResult;
    }
    const direct = this.asRecord(params);
    if (!direct) {
      return params.hitTestResult;
    }
    if (direct.hitTestResult || direct.damageResolution || direct.damageResult) {
      return direct;
    }
    return params.hitTestResult;
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object') return undefined;
    return value as Record<string, unknown>;
  }

  private toSafeNonNegativeNumber(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, parsed);
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
      decisionTelemetrySamples: 0,
      attackGateAppliedDecisions: 0,
      attackGateImmediateHighApplied: 0,
      attackGateDirectiveApplied: 0,
      attackOpportunityImmediateHigh: 0,
      attackOpportunityImmediateLow: 0,
      attackOpportunitySetup: 0,
      attackOpportunityNone: 0,
      hitTestsAttempted: 0,
      hitTestsPassed: 0,
      hitTestsFailed: 0,
      damageTestsAttempted: 0,
      damageTestsPassed: 0,
      damageTestsFailed: 0,
      woundsAssigned: 0,
      fearAssigned: 0,
      delayAssigned: 0,
      damageWoundsAssigned: 0,
      damageFearAssigned: 0,
      damageDelayAssigned: 0,
      passiveOrOtherDelayAssigned: 0,
      fearTestsFromWoundsTriggered: 0,
      fearTestsFromWoundsRequired: 0,
      fearTestsFromWoundsAttempted: 0,
      fearTestsFromWoundsPassed: 0,
      fearTestsFromWoundsFailed: 0,
      fearTestsFromWoundsSkipped: 0,
      fearTestsFromWoundsSkippedAlreadyDisordered: 0,
      fearTestsFromWoundsSkippedEngagedNotDistracted: 0,
      fearTestsFromWoundsSkippedAlreadyTestedThisTurn: 0,
      fearTestsFromWoundsSkippedImmuneToFear: 0,
      fearTestsFromWoundsSkippedMoraleExempt: 0,
      fearTestsFromWoundsFearAdded: 0,
      fearTestsFromWoundsFailedNoFearAdded: 0,
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
        rejectedByReason: {},
        rejectedByReasonByTurn: {},
        rejectedStatusByType: {},
        prefilteredByReason: {},
        prefilteredByReasonByTurn: {},
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

import { MissionSide } from '../mission/MissionSide';
import { ObjectiveMarker } from '../mission/objective-markers';
import { PointOfInterest, ZoneControlState } from '../mission/poi-zone-control';
import { VIP } from '../mission/vip-system';

/**
 * Event trigger types
 */
export enum EventTriggerType {
  /** Trigger at start of turn */
  TurnStart = 'TurnStart',
  /** Trigger at end of turn */
  TurnEnd = 'TurnEnd',
  /** Trigger at start of round */
  RoundStart = 'RoundStart',
  /** Trigger at end of round */
  RoundEnd = 'RoundEnd',
  /** Trigger when a model is eliminated */
  ModelEliminated = 'ModelEliminated',
  /** Trigger when a model is KO'd */
  ModelKOd = 'ModelKOd',
  /** Trigger when a zone changes control */
  ZoneControlChanged = 'ZoneControlChanged',
  /** Trigger when a marker is scored */
  MarkerScored = 'MarkerScored',
  /** Trigger when a VIP is extracted */
  VIPExtracted = 'VIPExtracted',
  /** Trigger when a VIP is eliminated */
  VIPEliminated = 'VIPEliminated',
  /** Trigger when a condition is met */
  ConditionMet = 'ConditionMet',
  /** Trigger on specific turn number */
  OnTurn = 'OnTurn',
  /** Trigger after N turns */
  AfterTurn = 'AfterTurn',
  /** Immediate trigger (checked continuously) */
  Immediate = 'Immediate',
}

/**
 * Event condition types
 */
export enum EventConditionType {
  /** Check if side has N models remaining */
  ModelsRemaining = 'ModelsRemaining',
  /** Check if side controls N zones */
  ZonesControlled = 'ZonesControlled',
  /** Check if side has N VP */
  VictoryPoints = 'VictoryPoints',
  /** Check if specific model is alive */
  ModelAlive = 'ModelAlive',
  /** Check if specific model is eliminated */
  ModelEliminated = 'ModelEliminated',
  /** Check if VIP is extracted */
  VIPExtracted = 'VIPExtracted',
  /** Check if VIP is eliminated */
  VIPEliminated = 'VIPEliminated',
  /** Check if marker is scored */
  MarkerScored = 'MarkerScored',
  /** Check custom condition by ID */
  Custom = 'Custom',
}

/**
 * Event effect types
 */
export enum EventEffectType {
  /** Award victory points */
  AwardVP = 'AwardVP',
  /** Remove victory points */
  RemoveVP = 'RemoveVP',
  /** End the mission immediately */
  EndMission = 'EndMission',
  /** Trigger victory for a side */
  TriggerVictory = 'TriggerVictory',
  /** Trigger defeat for a side */
  TriggerDefeat = 'TriggerDefeat',
  /** Spawn reinforcements */
  SpawnReinforcements = 'SpawnReinforcements',
  /** Add status to models */
  AddStatus = 'AddStatus',
  /** Remove status from models */
  RemoveStatus = 'RemoveStatus',
  /** Activate/deactivate zone */
  ToggleZone = 'ToggleZone',
  /** Reveal hidden information */
  RevealInfo = 'RevealInfo',
  /** Custom effect by ID */
  Custom = 'Custom',
}

/**
 * Event condition definition
 */
export interface EventCondition {
  /** Condition type */
  type: EventConditionType;
  /** Side to check (if applicable) */
  sideId?: string;
  /** Model ID (if applicable) */
  modelId?: string;
  /** VIP ID (if applicable) */
  vipId?: string;
  /** Marker ID (if applicable) */
  markerId?: string;
  /** Zone ID (if applicable) */
  zoneId?: string;
  /** Threshold value */
  threshold?: number;
  /** Custom condition ID */
  customId?: string;
  /** Invert the condition result */
  invert?: boolean;
}

/**
 * Event effect definition
 */
export interface EventEffect {
  /** Effect type */
  type: EventEffectType;
  /** Victory points to award/remove */
  vpAmount?: number;
  /** Side affected */
  sideId?: string;
  /** Reinforcement group ID */
  reinforcementId?: string;
  /** Target model IDs */
  targetIds?: string[];
  /** Status to add/remove */
  status?: string;
  /** Zone ID */
  zoneId?: string;
  /** Custom effect ID */
  customId?: string;
  /** Effect metadata */
  metadata?: Record<string, unknown>;
  /** Instant win trigger (backward compatibility) */
  instantWin?: boolean;
}

/**
 * Mission event hook definition
 */
export interface MissionEventHook {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** When this event triggers */
  trigger: EventTriggerType;
  /** Turn number for OnTurn trigger */
  turnNumber?: number;
  /** Conditions that must be met */
  conditions: EventCondition[];
  /** Effects to apply when triggered */
  effects: EventEffect[];
  /** Has this event been triggered? */
  hasTriggered: boolean;
  /** Can this event trigger multiple times? */
  repeatable: boolean;
  /** Priority for ordering (higher = first) */
  priority: number;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Event trigger result
 */
export interface EventTriggerResult {
  triggered: boolean;
  hook: MissionEventHook;
  conditionsMet: boolean;
  effectsApplied: EventEffectResult[];
  reason?: string;
}

/**
 * Effect application result
 */
export interface EventEffectResult {
  success: boolean;
  effect: EventEffect;
  vpAwarded?: number;
  reason?: string;
}

/**
 * Check conditions result
 */
export interface ConditionsCheckResult {
  allMet: boolean;
  results: Array<{ condition: EventCondition; met: boolean }>;
}

/**
 * Mission Event Manager - handles all event hook operations
 */
export class MissionEventManager {
  private hooks: Map<string, MissionEventHook> = new Map();

  /**
   * Add an event hook
   */
  addHook(hook: MissionEventHook | Partial<MissionEventHook>): void {
    const normalized: MissionEventHook = {
      id: hook.id ?? `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: hook.name ?? 'Event Hook',
      trigger: hook.trigger ?? EventTriggerType.Immediate,
      turnNumber: hook.turnNumber,
      conditions: hook.conditions ?? [],
      effects: hook.effects ?? [],
      hasTriggered: hook.hasTriggered ?? false,
      repeatable: hook.repeatable ?? false,
      priority: hook.priority ?? 0,
      metadata: hook.metadata ?? {},
    };
    const hookRef = hook as MissionEventHook;
    hookRef.id = normalized.id;
    hookRef.name = normalized.name;
    hookRef.trigger = normalized.trigger;
    hookRef.turnNumber = normalized.turnNumber;
    hookRef.conditions = normalized.conditions;
    hookRef.effects = normalized.effects;
    hookRef.hasTriggered = normalized.hasTriggered;
    hookRef.repeatable = normalized.repeatable;
    hookRef.priority = normalized.priority;
    hookRef.metadata = normalized.metadata;
    this.hooks.set(normalized.id, hookRef);
  }

  /**
   * Remove an event hook
   */
  removeHook(hookId: string): boolean {
    return this.hooks.delete(hookId);
  }

  /**
   * Get a hook by ID
   */
  getHook(hookId: string): MissionEventHook | undefined {
    return this.hooks.get(hookId);
  }

  /**
   * Get all hooks
   */
  getAllHooks(): MissionEventHook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hooks by trigger type
   */
  getHooksByTrigger(trigger: EventTriggerType): MissionEventHook[] {
    return this.getAllHooks()
      .filter(h => h.trigger === trigger)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get pending (not yet triggered) hooks
   */
  getPendingHooks(): MissionEventHook[] {
    return this.getAllHooks().filter(h => !h.hasTriggered);
  }

  /**
   * Check if conditions are met for a hook
   */
  checkConditions(
    hook: MissionEventHook,
    context: EventContext
  ): ConditionsCheckResult {
    const results = hook.conditions.map(condition => ({
      condition,
      met: this.evaluateCondition(condition, context),
    }));

    return {
      allMet: results.every(r => r.met),
      results,
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: EventCondition,
    context: EventContext
  ): boolean {
    let result = false;

    switch (condition.type) {
      case EventConditionType.ModelsRemaining:
        if (!condition.sideId) return false;
        result = context.getModelsRemaining(condition.sideId) >= (condition.threshold ?? 0);
        break;

      case EventConditionType.ZonesControlled:
        if (!condition.sideId) return false;
        result = context.getZonesControlled(condition.sideId) >= (condition.threshold ?? 0);
        break;

      case EventConditionType.VictoryPoints:
        if (!condition.sideId) return false;
        result = context.getVictoryPoints(condition.sideId) >= (condition.threshold ?? 0);
        break;

      case EventConditionType.ModelAlive:
        result = context.isModelAlive(condition.modelId ?? '');
        break;

      case EventConditionType.ModelEliminated:
        result = context.isModelEliminated(condition.modelId ?? '');
        break;

      case EventConditionType.VIPExtracted:
        result = context.isVIPExtracted(condition.vipId ?? '');
        break;

      case EventConditionType.VIPEliminated:
        result = context.isVIPEliminated(condition.vipId ?? '');
        break;

      case EventConditionType.MarkerScored:
        result = context.isMarkerScored(condition.markerId ?? '');
        break;

      case EventConditionType.Custom:
        result = context.checkCustomCondition(condition.customId ?? '');
        break;
    }

    return condition.invert ? !result : result;
  }

  /**
   * Trigger hooks for a specific event
   */
  triggerHooks(
    triggerType: EventTriggerType,
    context: EventContext,
    extraData?: Record<string, unknown>
  ): EventTriggerResult[] {
    const hooks = this.getHooksByTrigger(triggerType);
    const results: EventTriggerResult[] = [];

    for (const hook of hooks) {
      // Skip already triggered non-repeatable hooks
      if (hook.hasTriggered && !hook.repeatable) continue;

      // Check turn-based triggers
      if (triggerType === EventTriggerType.OnTurn) {
        if (hook.turnNumber !== context.currentTurn) continue;
      }

      if (triggerType === EventTriggerType.AfterTurn) {
        if ((hook.turnNumber ?? 0) >= context.currentTurn) continue;
      }

      // Check conditions
      const conditionResult = this.checkConditions(hook, context);

      if (!conditionResult.allMet) {
        results.push({
          triggered: false,
          hook,
          conditionsMet: false,
          effectsApplied: [],
          reason: 'Conditions not met',
        });
        continue;
      }

      // Apply effects
      const effectResults = this.applyEffects(hook.effects, context, extraData);

      // Mark as triggered
      hook.hasTriggered = true;

      results.push({
        triggered: true,
        hook,
        conditionsMet: true,
        effectsApplied: effectResults,
      });
    }

    return results;
  }

  /**
   * Apply effects from a triggered hook
   */
  private applyEffects(
    effects: EventEffect[],
    context: EventContext,
    extraData?: Record<string, unknown>
  ): EventEffectResult[] {
    const results: EventEffectResult[] = [];

    for (const effect of effects) {
      const result = this.applyEffect(effect, context, extraData);
      results.push(result);
    }

    return results;
  }

  /**
   * Apply a single effect
   */
  private applyEffect(
    effect: EventEffect,
    context: EventContext,
    extraData?: Record<string, unknown>
  ): EventEffectResult {
    switch (effect.type) {
      case EventEffectType.AwardVP:
        if (!effect.sideId) {
          return { success: false, effect, reason: 'No side specified' };
        }
        context.awardVP(effect.sideId, effect.vpAmount ?? 0);
        return {
          success: true,
          effect,
          vpAwarded: effect.vpAmount ?? 0,
        };

      case EventEffectType.RemoveVP:
        if (!effect.sideId) {
          return { success: false, effect, reason: 'No side specified' };
        }
        context.removeVP(effect.sideId, effect.vpAmount ?? 0);
        return { success: true, effect };

      case EventEffectType.EndMission:
        context.endMission();
        return { success: true, effect };

      case EventEffectType.TriggerVictory:
        if (!effect.sideId) {
          return { success: false, effect, reason: 'No side specified' };
        }
        context.triggerVictory(effect.sideId);
        return { success: true, effect };

      case EventEffectType.TriggerDefeat:
        if (!effect.sideId) {
          return { success: false, effect, reason: 'No side specified' };
        }
        context.triggerDefeat(effect.sideId);
        return { success: true, effect };

      case EventEffectType.SpawnReinforcements:
        if (!effect.reinforcementId) {
          return { success: false, effect, reason: 'No reinforcement group specified' };
        }
        context.spawnReinforcements(effect.reinforcementId);
        return { success: true, effect };

      case EventEffectType.AddStatus:
        if (!effect.targetIds || !effect.status) {
          return { success: false, effect, reason: 'Missing targetIds or status' };
        }
        context.addStatus(effect.targetIds, effect.status);
        return { success: true, effect };

      case EventEffectType.RemoveStatus:
        if (!effect.targetIds || !effect.status) {
          return { success: false, effect, reason: 'Missing targetIds or status' };
        }
        context.removeStatus(effect.targetIds, effect.status);
        return { success: true, effect };

      case EventEffectType.ToggleZone:
        if (!effect.zoneId) {
          return { success: false, effect, reason: 'No zone specified' };
        }
        context.toggleZone(effect.zoneId);
        return { success: true, effect };

      case EventEffectType.RevealInfo:
        context.revealInfo(effect.metadata ?? {});
        return { success: true, effect };

      case EventEffectType.Custom:
        if (!effect.customId) {
          return { success: false, effect, reason: 'No custom effect ID' };
        }
        context.applyCustomEffect(effect.customId, effect.metadata ?? {});
        return { success: true, effect };

      default:
        return { success: false, effect, reason: 'Unknown effect type' };
    }
  }

  /**
   * Check for immediate win/loss conditions
   */
  checkImmediateConditions(context: EventContext): {
    winner?: string;
    loser?: string;
    reason?: string;
  } {
    const immediateHooks = this.getHooksByTrigger(EventTriggerType.Immediate);

    for (const hook of immediateHooks) {
      const conditionResult = this.checkConditions(hook, context);

      if (conditionResult.allMet) {
        // Check for victory/defeat effects
        for (const effect of hook.effects) {
          if (effect.type === EventEffectType.TriggerVictory && effect.sideId) {
            return { winner: effect.sideId, reason: hook.name };
          }
          if (effect.type === EventEffectType.TriggerDefeat && effect.sideId) {
            return { loser: effect.sideId, reason: hook.name };
          }
          if (effect.type === EventEffectType.EndMission) {
            return { reason: hook.name };
          }
        }
      }
    }

    return {};
  }

  /**
   * Reset all hooks (for mission restart)
   */
  reset(): void {
    for (const hook of this.hooks.values()) {
      hook.hasTriggered = false;
    }
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear();
  }

  /**
   * Export event state
   */
  exportState(): Record<string, MissionEventHook> {
    const result: Record<string, MissionEventHook> = {};
    for (const [id, hook] of this.hooks.entries()) {
      result[id] = { ...hook };
    }
    return result;
  }

  /**
   * Import event state
   */
  importState(state: Record<string, MissionEventHook>): void {
    this.hooks.clear();
    for (const [id, hook] of Object.entries(state)) {
      this.hooks.set(id, hook);
    }
  }
}

/**
 * Event context interface for condition/effect evaluation
 */
export interface EventContext {
  /** Current turn number */
  currentTurn: number;
  /** Current round number */
  currentRound: number;

  /** Get models remaining for a side */
  getModelsRemaining(sideId: string): number;
  /** Get zones controlled by a side */
  getZonesControlled(sideId: string): number;
  /** Get victory points for a side */
  getVictoryPoints(sideId: string): number;

  /** Check if model is alive */
  isModelAlive(modelId: string): boolean;
  /** Check if model is eliminated */
  isModelEliminated(modelId: string): boolean;
  /** Check if VIP is extracted */
  isVIPExtracted(vipId: string): boolean;
  /** Check if VIP is eliminated */
  isVIPEliminated(vipId: string): boolean;
  /** Check if marker is scored */
  isMarkerScored(markerId: string): boolean;
  /** Check custom condition */
  checkCustomCondition(conditionId: string): boolean;

  /** Award VP to a side */
  awardVP(sideId: string, amount: number): void;
  /** Remove VP from a side */
  removeVP(sideId: string, amount: number): void;
  /** End the mission */
  endMission(): void;
  /** Trigger victory for a side */
  triggerVictory(sideId: string): void;
  /** Trigger defeat for a side */
  triggerDefeat(sideId: string): void;
  /** Spawn reinforcements */
  spawnReinforcements(groupId: string): void;
  /** Add status to models */
  addStatus(modelIds: string[], status: string): void;
  /** Remove status from models */
  removeStatus(modelIds: string[], status: string): void;
  /** Toggle zone state */
  toggleZone(zoneId: string): void;
  /** Reveal information */
  revealInfo(info: Record<string, unknown>): void;
  /** Apply custom effect */
  applyCustomEffect(effectId: string, metadata: Record<string, unknown>): void;
}

/**
 * Create a turn-based event hook
 */
export function createTurnEventHook(
  turnNumber: number,
  effects: EventEffect[],
  options: {
    id?: string;
    name?: string;
    conditions?: EventCondition[];
    effects?: EventEffect[]; // Backward compatibility
    repeatable?: boolean;
    priority?: number;
  } = {}
): MissionEventHook {
  const resolvedEffects = effects.length > 0 ? effects : (options.effects ?? []);
  return {
    id: options.id ?? `turn-${turnNumber}-${Date.now()}`,
    name: options.name ?? `Turn ${turnNumber} Event`,
    trigger: EventTriggerType.OnTurn,
    turnNumber,
    conditions: options.conditions ?? [],
    effects: resolvedEffects,
    hasTriggered: false,
    repeatable: options.repeatable ?? false,
    priority: options.priority ?? 0,
    metadata: {},
  };
}

/**
 * Create an end-of-turn event hook
 */
export function createEndTurnEventHook(
  effects: EventEffect[],
  options: {
    id?: string;
    name?: string;
    conditions?: EventCondition[];
    effects?: EventEffect[]; // Backward compatibility
    repeatable?: boolean;
    priority?: number;
  } = {}
): MissionEventHook {
  const resolvedEffects = effects.length > 0 ? effects : (options.effects ?? []);
  return {
    id: options.id ?? `end-turn-${Date.now()}`,
    name: options.name ?? 'End Turn Event',
    trigger: EventTriggerType.TurnEnd,
    conditions: options.conditions ?? [],
    effects: resolvedEffects,
    hasTriggered: false,
    repeatable: options.repeatable ?? true,
    priority: options.priority ?? 0,
    metadata: {},
  };
}

/**
 * Create a victory condition hook
 */
export function createVictoryConditionHook(
  conditions: EventCondition[],
  winningSide: string,
  options: {
    id?: string;
    name?: string;
    vpAward?: number;
    instantWin?: boolean;
  } = {}
): MissionEventHook {
  const effects: EventEffect[] = [
    { type: EventEffectType.TriggerVictory, sideId: winningSide },
  ];

  if (options.vpAward) {
    effects.push({ type: EventEffectType.AwardVP, sideId: winningSide, vpAmount: options.vpAward });
  }

  return {
    id: options.id ?? `victory-${Date.now()}`,
    name: options.name ?? 'Victory Condition',
    trigger: EventTriggerType.Immediate,
    conditions,
    effects,
    hasTriggered: false,
    repeatable: false,
    priority: 100, // High priority for victory checks
    metadata: {},
  };
}

// Backward compatibility type aliases
export type MissionEventHooks = MissionEventManager;
export type MissionEvent = MissionEventHook;

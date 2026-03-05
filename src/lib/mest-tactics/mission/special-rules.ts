import { MissionState } from '../missions/mission-config';
import { MissionSide } from './MissionSide';
import { Position } from '../battlefield/Position';

/**
 * Special Rule Handler Interface
 * All special rule handlers implement this interface
 */
export interface SpecialRuleHandler {
  /** Rule identifier */
  id: string;
  /** Initialize rule state */
  initialize(state: MissionState): void;
  /** Handle rule event */
  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult;
}

/**
 * Special Rule Event
 */
export interface SpecialRuleEvent {
  /** Event type */
  type: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Triggering side ID */
  sideId?: string;
}

/**
 * Special Rule Result
 */
export interface SpecialRuleResult {
  /** Event was handled */
  handled: boolean;
  /** VP awarded */
  vpAwarded?: number;
  /** State changes */
  stateChanges?: Record<string, unknown>;
  /** Result message */
  message?: string;
}

/**
 * Base special rule handler
 */
export abstract class BaseSpecialRuleHandler implements SpecialRuleHandler {
  abstract readonly id: string;

  initialize(state: MissionState): void {
    // Override to initialize rule-specific state
  }

  abstract handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult;

  /**
   * Award VP helper
   */
  protected awardVP(state: MissionState, sideId: string, amount: number): void {
    const currentVP = state.vpBySide.get(sideId) ?? 0;
    state.vpBySide.set(sideId, currentVP + amount);

    const side = state.sides.find(s => s.id === sideId);
    if (side) {
      side.state.victoryPoints = currentVP + amount;
    }
  }

  /**
   * Get custom state value
   */
  protected getCustomState<T>(state: MissionState, key: string, defaultValue: T): T {
    return (state.customState[key] as T) ?? defaultValue;
  }

  /**
   * Set custom state value
   */
  protected setCustomState(state: MissionState, key: string, value: unknown): void {
    state.customState[key] = value;
  }
}

/**
 * Reinforcement Wave Handler
 * Handles reinforcement arrivals for Convergence and other missions
 */
export class ReinforcementWaveHandler extends BaseSpecialRuleHandler {
  readonly id = 'reinforcements';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'reinforcementGroups', []);
    this.setCustomState(state, 'reinforcementsArrived', new Map());
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'reinforcement.roll':
        return this.handleReinforcementRoll(state, event);
      case 'reinforcement.deploy':
        return this.handleReinforcementDeploy(state, event);
      default:
        return { handled: false };
    }
  }

  /**
   * Handle reinforcement dice roll
   */
  private handleReinforcementRoll(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, roll, target } = event.data as { sideId: string; roll: number; target: number };
    
    const success = roll >= target;
    const groups = this.getCustomState<Array<{ id: string; deployed: boolean }>>(state, 'reinforcementGroups', []);
    const arrived = this.getCustomState<Map<string, boolean>>(state, 'reinforcementsArrived', new Map());

    if (success) {
      // Find first undeployed group
      const undeployedGroup = groups.find(g => !g.deployed);
      if (undeployedGroup) {
        undeployedGroup.deployed = true;
        arrived.set(sideId, true);
        
        return {
          handled: true,
          message: `Reinforcements deployed for ${sideId}`,
          stateChanges: { reinforcementGroups: groups, reinforcementsArrived: arrived },
        };
      }
    }

    return {
      handled: true,
      message: `Reinforcement roll ${success ? 'success' : 'failed'} for ${sideId}`,
    };
  }

  /**
   * Handle reinforcement deployment
   */
  private handleReinforcementDeploy(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, position } = event.data as { sideId: string; position: Position };
    
    // Validate deployment position (within 6 MU of entry edge)
    const deploymentDistance = this.getCustomState<number>(state, 'deploymentDistance', 6);
    
    return {
      handled: true,
      message: `Reinforcements deployed for ${sideId} at ${JSON.stringify(position)}`,
    };
  }
}

/**
 * Alert Level Handler
 * Handles alert mechanics for Incursion mission
 */
export class AlertLevelHandler extends BaseSpecialRuleHandler {
  readonly id = 'alert_level';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'alertLevel', 0);
    this.setCustomState(state, 'alertThreshold', 6);
    this.setCustomState(state, 'lockdownTriggered', false);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'alert.increase':
        return this.handleAlertIncrease(state, event);
      case 'alert.check':
        return this.handleAlertCheck(state);
      default:
        return { handled: false };
    }
  }

  /**
   * Handle alert level increase
   */
  private handleAlertIncrease(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { amount, reason } = event.data as { amount: number; reason: string };
    
    const currentAlert = this.getCustomState<number>(state, 'alertLevel', 0);
    const newAlert = currentAlert + amount;
    const threshold = this.getCustomState<number>(state, 'alertThreshold', 6);
    
    this.setCustomState(state, 'alertLevel', newAlert);
    
    const lockdownTriggered = newAlert >= threshold;
    if (lockdownTriggered) {
      this.setCustomState(state, 'lockdownTriggered', true);
    }

    return {
      handled: true,
      message: `Alert level increased to ${newAlert} (${reason})`,
      stateChanges: { 
        alertLevel: newAlert,
        lockdownTriggered,
      },
    };
  }

  /**
   * Handle alert level check
   */
  private handleAlertCheck(state: MissionState): SpecialRuleResult {
    const currentAlert = this.getCustomState<number>(state, 'alertLevel', 0);
    const threshold = this.getCustomState<number>(state, 'alertThreshold', 6);
    const lockdownTriggered = currentAlert >= threshold;

    return {
      handled: true,
      message: `Alert level: ${currentAlert}/${threshold}`,
      stateChanges: { 
        lockdownTriggered,
        alertLevel: currentAlert,
      },
    };
  }
}

/**
 * Threat Level Handler
 * Handles threat mechanics for Caches mission
 */
export class ThreatLevelHandler extends BaseSpecialRuleHandler {
  readonly id = 'threat_level';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'threatLevel', 0);
    this.setCustomState(state, 'maxThreatLevel', 6);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'threat.increase':
        return this.handleThreatIncrease(state, event);
      case 'threat.effect':
        return this.handleThreatEffect(state);
      default:
        return { handled: false };
    }
  }

  /**
   * Handle threat level increase
   */
  private handleThreatIncrease(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const currentThreat = this.getCustomState<number>(state, 'threatLevel', 0);
    const newThreat = currentThreat + 1;
    const maxThreat = this.getCustomState<number>(state, 'maxThreatLevel', 6);
    
    this.setCustomState(state, 'threatLevel', newThreat);

    // Apply threat effects
    const effects: string[] = [];
    if (newThreat >= 2) {
      effects.push('-1 Base die Range Combat Hit Tests');
    }
    if (newThreat >= 4) {
      effects.push('-1 Base die Close Combat Hit Tests');
    }
    if (newThreat >= maxThreat) {
      effects.push('Hard Cover degrades to Soft Cover');
    }

    return {
      handled: true,
      message: `Threat level increased to ${newThreat}`,
      stateChanges: { threatLevel: newThreat, activeEffects: effects },
    };
  }

  /**
   * Handle threat effect query
   */
  private handleThreatEffect(state: MissionState): SpecialRuleResult {
    const currentThreat = this.getCustomState<number>(state, 'threatLevel', 0);
    const effects: string[] = [];

    if (currentThreat >= 2) {
      effects.push('range_penalty');
    }
    if (currentThreat >= 4) {
      effects.push('melee_penalty');
    }
    if (currentThreat >= this.getCustomState<number>(state, 'maxThreatLevel', 6)) {
      effects.push('cover_degradation');
    }

    return {
      handled: true,
      stateChanges: { activeEffects: effects, threatLevel: currentThreat },
    };
  }
}

/**
 * Courier/Extraction Handler
 * Handles courier mechanics for Signal, Rescue missions
 */
export class CourierHandler extends BaseSpecialRuleHandler {
  readonly id = 'courier';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'couriers', new Map());
    this.setCustomState(state, 'edgeReached', new Map());
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'courier.designate':
        return this.handleCourierDesignate(state, event);
      case 'courier.edge_reach':
        return this.handleCourierEdgeReach(state, event);
      case 'courier.turn_end':
        return this.handleCourierTurnEnd(state, event);
      default:
        return { handled: false };
    }
  }

  /**
   * Handle courier designation
   */
  private handleCourierDesignate(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, modelId } = event.data as { sideId: string; modelId: string };
    
    const couriers = this.getCustomState<Map<string, string>>(state, 'couriers', new Map());
    couriers.set(sideId, modelId);

    return {
      handled: true,
      message: `${modelId} designated as courier for ${sideId}`,
      stateChanges: { couriers },
    };
  }

  /**
   * Handle courier reaching edge
   */
  private handleCourierEdgeReach(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, vpImmediate } = event.data as { sideId: string; vpImmediate: number };
    
    const edgeReached = this.getCustomState<Map<string, boolean>>(state, 'edgeReached', new Map());
    edgeReached.set(sideId, true);

    if (vpImmediate > 0) {
      this.awardVP(state, sideId, vpImmediate);
    }

    return {
      handled: true,
      vpAwarded: vpImmediate,
      message: `Courier reached edge for ${sideId}`,
      stateChanges: { edgeReached },
    };
  }

  /**
   * Handle end of turn courier VP
   */
  private handleCourierTurnEnd(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, vpPerTurn } = event.data as { sideId: string; vpPerTurn: number };
    
    const edgeReached = this.getCustomState<Map<string, boolean>>(state, 'edgeReached', new Map());
    
    if (edgeReached.get(sideId)) {
      this.awardVP(state, sideId, vpPerTurn);
      return {
        handled: true,
        vpAwarded: vpPerTurn,
        message: `Courier VP for ${sideId}`,
      };
    }

    return { handled: false };
  }
}

/**
 * Mechanism Activation Handler
 * Handles mechanism mechanics for Sequence, Incursion missions
 */
export class MechanismHandler extends BaseSpecialRuleHandler {
  readonly id = 'mechanism';

  initialize(state: MissionState, config?: { mechanismCount?: number }): void {
    this.setCustomState(state, 'mechanisms', new Map());
    this.setCustomState(state, 'allMechanismsOn', false);
    this.setCustomState(state, 'thresholdOpen', false);
    this.setCustomState(state, 'mechanismCount', config?.mechanismCount ?? 3);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'mechanism.activate':
        return this.handleMechanismActivate(state, event);
      case 'mechanism.check':
        return this.handleMechanismCheck(state);
      default:
        return { handled: false };
    }
  }

  /**
   * Handle mechanism activation
   */
  private handleMechanismActivate(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { mechanismId, sideId } = event.data as { mechanismId: string; sideId: string };

    const mechanisms = this.getCustomState<Map<string, { active: boolean; controller?: string }>>(
      state,
      'mechanisms',
      new Map()
    );

    mechanisms.set(mechanismId, { active: true, controller: sideId });

    // Check if all mechanisms are on
    const mechanismCount = this.getCustomState<number>(state, 'mechanismCount', 3);
    const activeCount = Array.from(mechanisms.values()).filter(m => m.active).length;
    const allOn = activeCount >= mechanismCount;
    
    if (allOn) {
      this.setCustomState(state, 'allMechanismsOn', true);
      this.setCustomState(state, 'thresholdOpen', true);
    }

    return {
      handled: true,
      message: `Mechanism ${mechanismId} activated by ${sideId}`,
      stateChanges: {
        mechanisms,
        allMechanismsOn: allOn,
        thresholdOpen: allOn,
      },
    };
  }

  /**
   * Handle mechanism state check
   */
  private handleMechanismCheck(state: MissionState): SpecialRuleResult {
    const mechanisms = this.getCustomState<Map<string, { active: boolean; controller?: string }>>(
      state, 
      'mechanisms', 
      new Map()
    );
    const allOn = this.getCustomState<boolean>(state, 'allMechanismsOn', false);
    const thresholdOpen = this.getCustomState<boolean>(state, 'thresholdOpen', false);

    return {
      handled: true,
      stateChanges: {
        mechanisms: Object.fromEntries(mechanisms),
        allMechanismsOn: allOn,
        thresholdOpen: thresholdOpen,
      },
    };
  }
}

/**
 * Special Rule Handler Registry
 * Manages all special rule handlers
 */
export class SpecialRuleHandlerRegistry {
  private handlers: Map<string, SpecialRuleHandler> = new Map();

  /**
   * Register a handler
   */
  register(handler: SpecialRuleHandler): void {
    this.handlers.set(handler.id, handler);
  }

  /**
   * Initialize all handlers for a mission
   */
  initializeAll(state: MissionState, ruleIds: string[]): void {
    for (const ruleId of ruleIds) {
      const handler = this.handlers.get(ruleId);
      if (handler) {
        handler.initialize(state);
      }
    }
  }

  /**
   * Handle an event
   */
  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult[] {
    const results: SpecialRuleResult[] = [];

    for (const handler of this.handlers.values()) {
      const result = handler.handle(state, event);
      if (result.handled) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get handler by ID
   */
  getHandler(id: string): SpecialRuleHandler | undefined {
    return this.handlers.get(id);
  }
}

/**
 * Vigilance Handler
 * Handles enhanced visibility for Sequence mission
 */
export class VigilanceHandler extends BaseSpecialRuleHandler {
  readonly id = 'vigilance';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'vigilanceActive', false);
    this.setCustomState(state, 'normalVisibility', 8);
    this.setCustomState(state, 'enhancedVisibility', 16);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'vigilance.activate':
        return this.handleVigilanceActivate(state);
      case 'vigilance.deactivate':
        return this.handleVigilanceDeactivate(state);
      case 'visibility.get':
        return this.handleVisibilityGet(state);
      default:
        return { handled: false };
    }
  }

  /**
   * Activate vigilance (enhanced visibility)
   */
  private handleVigilanceActivate(state: MissionState): SpecialRuleResult {
    this.setCustomState(state, 'vigilanceActive', true);

    return {
      handled: true,
      message: 'Vigilance activated - visibility doubled',
      stateChanges: { vigilanceActive: true },
    };
  }

  /**
   * Deactivate vigilance
   */
  private handleVigilanceDeactivate(state: MissionState): SpecialRuleResult {
    this.setCustomState(state, 'vigilanceActive', false);

    return {
      handled: true,
      message: 'Vigilance deactivated',
      stateChanges: { vigilanceActive: false },
    };
  }

  /**
   * Get current visibility range
   */
  private handleVisibilityGet(state: MissionState): SpecialRuleResult {
    const vigilanceActive = this.getCustomState<boolean>(state, 'vigilanceActive', false);
    const normalVis = this.getCustomState<number>(state, 'normalVisibility', 8);
    const enhancedVis = this.getCustomState<number>(state, 'enhancedVisibility', 16);

    return {
      handled: true,
      stateChanges: {
        visibility: vigilanceActive ? enhancedVis : normalVis,
        vigilanceActive,
      },
    };
  }
}

/**
 * Commander Handler
 * Handles commander mechanics for Trinity mission
 */
export class CommanderHandler extends BaseSpecialRuleHandler {
  readonly id = 'commander';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'commanders', new Map());
    this.setCustomState(state, 'commanderKO', new Map());
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'commander.designate':
        return this.handleCommanderDesignate(state, event);
      case 'commander.ko':
        return this.handleCommanderKO(state, event);
      case 'commander.eliminated':
        return this.handleCommanderEliminated(state, event);
      case 'commander.check':
        return this.handleCommanderCheck(state, event);
      default:
        return { handled: false };
    }
  }

  /**
   * Designate a commander
   */
  private handleCommanderDesignate(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, modelId } = event.data as { sideId: string; modelId: string };

    const commanders = this.getCustomState<Map<string, string>>(state, 'commanders', new Map());
    commanders.set(sideId, modelId);

    return {
      handled: true,
      message: `${modelId} designated as commander for ${sideId}`,
      stateChanges: { commanders },
    };
  }

  /**
   * Handle commander KO
   */
  private handleCommanderKO(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId } = event.data as { sideId: string };

    const commanderKO = this.getCustomState<Map<string, boolean>>(state, 'commanderKO', new Map());
    commanderKO.set(sideId, true);

    return {
      handled: true,
      message: `Commander KO'd for ${sideId} - cannot gain VP next turn`,
      stateChanges: { commanderKO },
    };
  }

  /**
   * Handle commander elimination
   */
  private handleCommanderEliminated(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, eliminatingSideId } = event.data as { sideId: string; eliminatingSideId?: string };

    const commanders = this.getCustomState<Map<string, string>>(state, 'commanders', new Map());
    commanders.delete(sideId);

    let vpAwarded = 0;
    if (eliminatingSideId) {
      vpAwarded = 2;
      this.awardVP(state, eliminatingSideId, vpAwarded);
    }

    return {
      handled: true,
      vpAwarded: vpAwarded > 0 ? vpAwarded : undefined,
      message: `Commander eliminated for ${sideId}${eliminatingSideId ? ` by ${eliminatingSideId}` : ''}`,
      stateChanges: { commanders },
    };
  }

  /**
   * Check if commander is KO'd (for VP blocking)
   */
  private handleCommanderCheck(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId } = event.data as { sideId: string };

    const commanderKO = this.getCustomState<Map<string, boolean>>(state, 'commanderKO', new Map());
    const isKO = commanderKO.get(sideId) ?? false;

    // Clear KO status after check (for next turn)
    if (isKO) {
      commanderKO.set(sideId, false);
    }

    return {
      handled: true,
      stateChanges: {
        commanderKO: isKO,
        canGainVP: !isKO,
      },
    };
  }
}

/**
 * Time Pressure Handler
 * Handles time limit mechanics for Rupture mission
 */
export class TimePressureHandler extends BaseSpecialRuleHandler {
  readonly id = 'time_pressure';

  initialize(state: MissionState, config?: { endTurn?: number }): void {
    this.setCustomState(state, 'timePressureEndTurn', config?.endTurn ?? 5);
    this.setCustomState(state, 'timePressureEnded', false);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'time.check':
        return this.handleTimeCheck(state);
      case 'time.end':
        return this.handleTimeEnd(state);
      default:
        return { handled: false };
    }
  }

  /**
   * Check if time pressure has ended the game
   */
  private handleTimeCheck(state: MissionState): SpecialRuleResult {
    const endTurn = this.getCustomState<number>(state, 'timePressureEndTurn', 5);
    const ended = this.getCustomState<boolean>(state, 'timePressureEnded', false);

    if (state.currentTurn >= endTurn && !ended) {
      this.setCustomState(state, 'timePressureEnded', true);
      return {
        handled: true,
        message: `Time pressure: Game ends at turn ${endTurn}`,
        stateChanges: { timePressureEnded: true, gameEnd: true },
      };
    }

    return {
      handled: true,
      stateChanges: {
        currentTurn: state.currentTurn,
        endTurn,
        gameEnd: ended,
      },
    };
  }

  /**
   * Force end game
   */
  private handleTimeEnd(state: MissionState): SpecialRuleResult {
    this.setCustomState(state, 'timePressureEnded', true);

    return {
      handled: true,
      message: 'Time pressure: Game ended',
      stateChanges: { timePressureEnded: true, gameEnd: true },
    };
  }
}

/**
 * Harvest Handler
 * Handles VC harvest/extraction for Caches mission
 */
export class HarvestHandler extends BaseSpecialRuleHandler {
  readonly id = 'harvest';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'vitalCaches', new Map());
    this.setCustomState(state, 'extractedCaches', []);
    this.setCustomState(state, 'hiddenCaches', new Map());
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'cache.acquire':
        return this.handleCacheAcquire(state, event);
      case 'cache.extract':
        return this.handleCacheExtract(state, event);
      case 'cache.reveal':
        return this.handleCacheReveal(state, event);
      default:
        return { handled: false };
    }
  }

  /**
   * Acquire a cache (Fiddle action)
   */
  private handleCacheAcquire(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { cacheId, sideId } = event.data as { cacheId: string; sideId: string };

    const caches = this.getCustomState<Map<string, { acquired: boolean; controller?: string }>>(
      state,
      'vitalCaches',
      new Map()
    );

    caches.set(cacheId, { acquired: true, controller: sideId });

    return {
      handled: true,
      message: `Cache ${cacheId} acquired by ${sideId}`,
      stateChanges: { vitalCaches: caches },
    };
  }

  /**
   * Extract a cache (at battlefield edge)
   */
  private handleCacheExtract(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { cacheId, sideId, vpAward } = event.data as { cacheId: string; sideId: string; vpAward: number };

    const extracted = this.getCustomState<Array<string>>(state, 'extractedCaches', []);
    extracted.push(cacheId);

    if (vpAward > 0) {
      this.awardVP(state, sideId, vpAward);
    }

    return {
      handled: true,
      vpAwarded: vpAward,
      message: `Cache ${cacheId} extracted by ${sideId}`,
      stateChanges: { extractedCaches: extracted },
    };
  }

  /**
   * Reveal a hidden cache
   */
  private handleCacheReveal(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { cacheId } = event.data as { cacheId: string };

    const hidden = this.getCustomState<Map<string, boolean>>(state, 'hiddenCaches', new Map());
    hidden.set(cacheId, false);

    return {
      handled: true,
      message: `Cache ${cacheId} revealed`,
      stateChanges: { hiddenCaches: hidden },
    };
  }
}

/**
 * Hidden Object Handler
 * Handles hidden object mechanics for Incursion mission
 */
export class HiddenObjectHandler extends BaseSpecialRuleHandler {
  readonly id = 'hidden_object';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'objectLocation', null);
    this.setCustomState(state, 'objectRevealed', false);
    this.setCustomState(state, 'objectAuthentic', true);
    this.setCustomState(state, 'objectExtracted', false);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'object.place':
        return this.handleObjectPlace(state, event);
      case 'object.find':
        return this.handleObjectFind(state, event);
      case 'object.identify':
        return this.handleObjectIdentify(state, event);
      case 'object.extract':
        return this.handleObjectExtract(state, event);
      default:
        return { handled: false };
    }
  }

  /**
   * Place hidden object
   */
  private handleObjectPlace(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { position, isAuthentic } = event.data as { position: Position; isAuthentic?: boolean };

    this.setCustomState(state, 'objectLocation', position);
    this.setCustomState(state, 'objectAuthentic', isAuthentic ?? true);
    this.setCustomState(state, 'objectRevealed', false);

    return {
      handled: true,
      message: 'Object placed (hidden)',
      stateChanges: { objectLocation: position, objectRevealed: false },
    };
  }

  /**
   * Find object (within range)
   */
  private handleObjectFind(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId, position } = event.data as { sideId: string; position: Position };

    const location = this.getCustomState<Position | null>(state, 'objectLocation', null);
    const revealed = this.getCustomState<boolean>(state, 'objectRevealed', false);

    if (location && !revealed) {
      // Check if within reveal range (4 MU for Twilight)
      const distance = Math.sqrt(
        Math.pow(position.x - location.x, 2) + Math.pow(position.y - location.y, 2)
      );

      if (distance <= 4) {
        this.setCustomState(state, 'objectRevealed', true);
        return {
          handled: true,
          message: 'Object found!',
          stateChanges: { objectRevealed: true },
        };
      }
    }

    return {
      handled: true,
      message: 'Object not found',
      stateChanges: { objectRevealed: revealed },
    };
  }

  /**
   * Identify object (authentic or decoy)
   */
  private handleObjectIdentify(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const roll = Math.floor(Math.random() * 6) + 1;
    const isAuthentic = this.getCustomState<boolean>(state, 'objectAuthentic', true);

    // 1-3 = Authentic, 4-6 = Decoy
    const identifiedAsAuthentic = roll <= 3;
    const actuallyAuthentic = isAuthentic && identifiedAsAuthentic;

    return {
      handled: true,
      stateChanges: {
        roll,
        identifiedAsAuthentic,
        actuallyAuthentic,
        isDecoy: !actuallyAuthentic,
      },
    };
  }

  /**
   * Extract object
   */
  private handleObjectExtract(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { sideId } = event.data as { sideId: string };

    const isAuthentic = this.getCustomState<boolean>(state, 'objectAuthentic', true);
    const extracted = this.getCustomState<boolean>(state, 'objectExtracted', false);

    if (extracted) {
      return {
        handled: true,
        message: 'Object already extracted',
        stateChanges: { alreadyExtracted: true },
      };
    }

    this.setCustomState(state, 'objectExtracted', true);

    if (isAuthentic) {
      return {
        handled: true,
        message: 'Authentic object extracted - victory!',
        stateChanges: { objectExtracted: true, victory: true },
      };
    } else {
      return {
        handled: true,
        message: 'Decoy object extracted',
        stateChanges: { objectExtracted: true, decoy: true },
      };
    }
  }
}

/**
 * Breakthrough Handler
 * Handles breakthrough mechanics for Bastion mission
 */
export class BreakthroughHandler extends BaseSpecialRuleHandler {
  readonly id = 'breakthrough';

  initialize(state: MissionState): void {
    this.setCustomState(state, 'breakthroughMarkers', { alpha: false, beta: false, gamma: false });
    this.setCustomState(state, 'hordeVictory', false);
  }

  handle(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    switch (event.type) {
      case 'breakthrough.trigger':
        return this.handleBreakthroughTrigger(state, event);
      case 'breakthrough.check':
        return this.handleBreakthroughCheck(state);
      default:
        return { handled: false };
    }
  }

  /**
   * Trigger breakthrough marker
   */
  private handleBreakthroughTrigger(state: MissionState, event: SpecialRuleEvent): SpecialRuleResult {
    const { marker, sideId } = event.data as { marker: 'alpha' | 'beta' | 'gamma'; sideId: string };

    const markers = this.getCustomState<{ alpha: boolean; beta: boolean; gamma: boolean }>(
      state,
      'breakthroughMarkers',
      { alpha: false, beta: false, gamma: false }
    );

    markers[marker] = true;

    // Gamma = immediate Horde victory
    if (marker === 'gamma') {
      this.setCustomState(state, 'hordeVictory', true);
      return {
        handled: true,
        message: 'GAMMA marker triggered - Horde victory!',
        stateChanges: { breakthroughMarkers: markers, hordeVictory: true, victory: true },
      };
    }

    return {
      handled: true,
      message: `${marker.toUpperCase()} marker triggered`,
      stateChanges: { breakthroughMarkers: markers },
    };
  }

  /**
   * Check breakthrough status
   */
  private handleBreakthroughCheck(state: MissionState): SpecialRuleResult {
    const markers = this.getCustomState<{ alpha: boolean; beta: boolean; gamma: boolean }>(
      state,
      'breakthroughMarkers',
      { alpha: false, beta: false, gamma: false }
    );

    return {
      handled: true,
      stateChanges: {
        breakthroughMarkers: markers,
        hordeVictory: markers.gamma,
      },
    };
  }
}

/**
 * Create default special rule handlers registry
 * Registers all built-in special rule handlers
 */
export function createDefaultHandlers(): SpecialRuleHandlerRegistry {
  const registry = new SpecialRuleHandlerRegistry();
  registry.register(new ReinforcementWaveHandler());
  registry.register(new AlertLevelHandler());
  registry.register(new ThreatLevelHandler());
  registry.register(new CourierHandler());
  registry.register(new MechanismHandler());
  registry.register(new CommanderHandler());
  registry.register(new TimePressureHandler());
  registry.register(new HarvestHandler());
  registry.register(new HiddenObjectHandler());
  registry.register(new BreakthroughHandler());
  registry.register(new VigilanceHandler());
  return registry;
}

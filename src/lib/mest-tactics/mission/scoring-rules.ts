import { ScoringRuleConfig, ScoringResult, MissionState } from '../mission-config';

/**
 * Scoring Trigger
 * All scoring triggers supported by the mission system
 */
export enum ScoringTrigger {
  TURN_END = 'turn.end',
  TURN_END_ZONE_CONTROL = 'turn.end.zone_control',
  MODEL_ELIMINATED = 'model.eliminated',
  ZONE_CAPTURED = 'zone.captured',
  COURIER_EDGE_REACH = 'courier.edge_reach',
  VIP_EXTRACTED = 'vip.extracted',
  VP_DESTROYED = 'vp.destroyed',
  CACHE_HARVESTED = 'cache.harvested',
  FIRST_BLOOD = 'first_blood',
  OBJECTIVE_COMPLETE = 'objective.complete',
  REINFORCEMENT_ARRIVAL = 'reinforcement.arrival',
  ALERT_LEVEL = 'alert.level',
  THREAT_LEVEL = 'threat.level',
  MECHANISM_ACTIVATED = 'mechanism.activated',
  SALLY_FORTH = 'sally.forth',
}

/**
 * Scoring Rule Interface (Command Pattern)
 * All scoring rules implement this interface
 */
export interface ScoringRule {
  /** Unique identifier */
  id: string;
  /** Scoring trigger */
  trigger: string;
  /** Apply scoring rule */
  apply(state: MissionState, context?: Record<string, unknown>): ScoringResult;
}

/**
 * Base scoring rule with common functionality
 */
export abstract class BaseScoringRule implements ScoringRule {
  readonly id: string;
  abstract readonly trigger: string;

  constructor(config: ScoringRuleConfig) {
    this.id = `${config.trigger}-${Math.random().toString(36).substr(2, 9)}`;
  }

  abstract apply(state: MissionState, context?: Record<string, unknown>): ScoringResult;

  /**
   * Award VP to a side
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
   * Get VP for a side
   */
  protected getVP(state: MissionState, sideId: string): number {
    return state.vpBySide.get(sideId) ?? 0;
  }

  /**
   * Get zones controlled by a side
   */
  protected getControlledZoneCount(state: MissionState, sideId: string): number {
    const zones = state.customState['zones'] as Array<{ controller?: string }> | [];
    return zones.filter(z => z.controller === sideId).length;
  }
}

/**
 * Turn End Scoring Rule
 * Award VP at end of each turn
 */
export class TurnEndScoring extends BaseScoringRule {
  readonly trigger = 'turn.end';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState): ScoringResult {
    // Base turn end scoring - no VP by default
    return { vpAwarded: 0 };
  }
}

/**
 * Turn End Zone Control Scoring Rule
 * Award VP per zone controlled at end of turn
 */
export class TurnEndZoneControlScoring extends BaseScoringRule {
  readonly trigger = 'turn.end.zone_control';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState): ScoringResult {
    const results: ScoringResult[] = [];

    for (const side of state.sides) {
      const zoneCount = this.getControlledZoneCount(state, side.id);
      if (zoneCount > 0) {
        const vpAwarded = zoneCount * this.config.vp;
        this.awardVP(state, side.id, vpAwarded);
        results.push({
          vpAwarded,
          sideId: side.id,
          reason: `${zoneCount} zones controlled`,
        });
      }
    }

    return results.reduce(
      (acc, r) => ({ ...acc, vpAwarded: acc.vpAwarded + r.vpAwarded }),
      { vpAwarded: 0 }
    );
  }
}

/**
 * Model Eliminated Scoring Rule
 * Award VP when enemy model is eliminated
 */
export class ModelEliminatedScoring extends BaseScoringRule {
  readonly trigger = 'model.eliminated';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState, context?: { eliminatedSideId?: string; eliminatingSideId?: string }): ScoringResult {
    if (!context?.eliminatingSideId || !context.eliminatedSideId) {
      return { vpAwarded: 0 };
    }

    // Don't award VP for eliminating your own models
    if (context.eliminatingSideId === context.eliminatedSideId) {
      return { vpAwarded: 0 };
    }

    this.awardVP(state, context.eliminatingSideId, this.config.vp);

    return {
      vpAwarded: this.config.vp,
      sideId: context.eliminatingSideId,
      reason: 'Enemy model eliminated',
    };
  }
}

/**
 * First Blood Scoring Rule
 * Award VP to first side to wound an enemy model
 */
export class FirstBloodScoring extends BaseScoringRule {
  readonly trigger = 'first_blood';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState, context?: { sideId?: string }): ScoringResult {
    if (!context?.sideId) {
      return { vpAwarded: 0 };
    }

    // Check if first blood already awarded
    if (state.customState['firstBloodAwarded'] as boolean) {
      return { vpAwarded: 0 };
    }

    state.customState['firstBloodAwarded'] = true;
    this.awardVP(state, context.sideId, this.config.vp);

    return {
      vpAwarded: this.config.vp,
      sideId: context.sideId,
      reason: 'First blood',
    };
  }
}

/**
 * Reinforcement Arrival Scoring Rule
 * Award VP when reinforcements arrive
 */
export class ReinforcementArrivalScoring extends BaseScoringRule {
  readonly trigger = 'reinforcement.arrival';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState, context?: { sideId?: string }): ScoringResult {
    if (!context?.sideId) {
      return { vpAwarded: 0 };
    }

    this.awardVP(state, context.sideId, this.config.vp);

    return {
      vpAwarded: this.config.vp,
      sideId: context.sideId,
      reason: 'Reinforcements arrived',
    };
  }
}

/**
 * Alert Level Scoring Rule
 * Award VP when alert level reaches certain thresholds (Incursion mission)
 */
export class AlertLevelScoring extends BaseScoringRule {
  readonly trigger = 'alert.level';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState, context?: { alertLevel?: number }): ScoringResult {
    if (!context?.alertLevel) {
      return { vpAwarded: 0 };
    }

    // Award VP based on alert level threshold
    const currentAlert = state.customState['alertLevel'] as number ?? 0;
    if (context.alertLevel > currentAlert) {
      state.customState['alertLevel'] = context.alertLevel;
      this.awardVP(state, 'defender', this.config.vp);
      return {
        vpAwarded: this.config.vp,
        sideId: 'defender',
        reason: `Alert level reached ${context.alertLevel}`,
      };
    }

    return { vpAwarded: 0 };
  }
}

/**
 * Threat Level Scoring Rule
 * Award VP when threat level increases (Caches mission)
 */
export class ThreatLevelScoring extends BaseScoringRule {
  readonly trigger = 'threat.level';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState, context?: { threatLevel?: number }): ScoringResult {
    if (!context?.threatLevel) {
      return { vpAwarded: 0 };
    }

    const currentThreat = state.customState['threatLevel'] as number ?? 0;
    if (context.threatLevel > currentThreat) {
      state.customState['threatLevel'] = context.threatLevel;
      // Award to side that triggered it
      this.awardVP(state, context.sideId ?? 'unknown', this.config.vp);
      return {
        vpAwarded: this.config.vp,
        sideId: context.sideId,
        reason: `Threat level reached ${context.threatLevel}`,
      };
    }

    return { vpAwarded: 0 };
  }
}

/**
 * Sally Forth Scoring Rule
 * Award VP for defenders killing enemies after exiting Ward (Bastion mission)
 */
export class SallyForthScoring extends BaseScoringRule {
  readonly trigger = 'sally.forth';

  constructor(
    private config: ScoringRuleConfig & { vp: number }
  ) {
    super(config);
  }

  apply(state: MissionState, context?: { sideId?: string; kills?: number }): ScoringResult {
    if (!context?.sideId || !context.kills) {
      return { vpAwarded: 0 };
    }

    const vpAwarded = context.kills * this.config.vp;
    this.awardVP(state, context.sideId, vpAwarded);

    return {
      vpAwarded,
      sideId: context.sideId,
      reason: `Sally forth: ${context.kills} kills`,
    };
  }
}

/**
 * Scoring Rule Factory
 * Creates scoring rule instances from config
 */
export function createScoringRule(config: ScoringRuleConfig): ScoringRule {
  // Handle vp as number or { per: string }
  const vpNumber = typeof config.vp === 'number' ? config.vp : 1;
  const configWithVp = { ...config, vp: vpNumber } as ScoringRuleConfig & { vp: number };

  switch (config.trigger) {
    case 'turn.end':
      return new TurnEndScoring(configWithVp);
    case 'turn.end.zone_control':
      return new TurnEndZoneControlScoring(configWithVp);
    case 'model.eliminated':
      return new ModelEliminatedScoring(configWithVp);
    case 'first_blood':
      return new FirstBloodScoring(configWithVp);
    case 'reinforcement.arrival':
      return new ReinforcementArrivalScoring(configWithVp);
    case 'alert.level':
      return new AlertLevelScoring(configWithVp);
    case 'threat.level':
      return new ThreatLevelScoring(configWithVp);
    case 'sally.forth':
      return new SallyForthScoring(configWithVp);
    default:
      // Return a no-op scoring rule for unknown triggers
      return {
        id: config.trigger,
        trigger: config.trigger,
        apply: () => ({ vpAwarded: 0 }),
      };
  }
}

/**
 * Create multiple scoring rules from config array
 */
export function createScoringRules(configs: ScoringRuleConfig[]): ScoringRule[] {
  return configs.map(createScoringRule);
}

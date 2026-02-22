import { VictoryConditionConfig, VictoryResult, MissionState } from '../mission-config';

/**
 * Victory Condition Type
 * All victory condition types supported by the mission system
 */
export enum VictoryConditionType {
  ELIMINATION = 'elimination',
  DOMINANCE = 'dominance',
  EXTRACTION = 'extraction',
  SURVIVAL = 'survival',
  VP_MAJORITY = 'vp_majority',
  COURIER = 'courier',
  RUPTURE = 'rupture',
  HARVEST = 'harvest',
  FIRST_TO_VP = 'first_to_vp',
  CONTROL_ALL = 'control_all',
  LAST_STANDING = 'last_standing',
  THRESHOLD_REACHED = 'threshold_reached',
}

/**
 * Victory Condition Interface (Strategy Pattern)
 * All victory conditions implement this interface
 */
export interface VictoryCondition {
  /** Unique identifier */
  id: string;
  /** Victory condition type */
  type: string;
  /** Check if victory condition is met */
  check(state: MissionState): VictoryResult;
}

/**
 * Base victory condition with common functionality
 */
export abstract class BaseVictoryCondition implements VictoryCondition {
  readonly id: string;
  abstract readonly type: string;

  constructor(config: VictoryConditionConfig) {
    this.id = config.type;
  }

  abstract check(state: MissionState): VictoryResult;

  /**
   * Get VP for a side
   */
  protected getVP(state: MissionState, sideId: string): number {
    return state.vpBySide.get(sideId) ?? 0;
  }

  /**
   * Get total active models for a side
   */
  protected getActiveModelCount(state: MissionState, sideId: string): number {
    const side = state.sides.find(s => s.id === sideId);
    if (!side) return 0;
    return side.members.filter(
      m => m.status !== 'Eliminated' as any && m.status !== 'KO' as any
    ).length;
  }

  /**
   * Get total BP eliminated for a side
   */
  protected getEliminatedBP(state: MissionState, sideId: string): number {
    // This would need to be tracked in customState
    return (state.customState[`eliminatedBP_${sideId}`] as number) ?? 0;
  }
}

/**
 * Elimination Victory Condition
 * Win by eliminating all enemy models
 */
export class EliminationVictory extends BaseVictoryCondition {
  readonly type = 'elimination';

  check(state: MissionState): VictoryResult {
    // Find sides with active models
    const sidesWithModels = state.sides.filter(side => 
      this.getActiveModelCount(state, side.id) > 0
    );

    if (sidesWithModels.length === 1) {
      return {
        achieved: true,
        winner: sidesWithModels[0].id,
        reason: 'Last side with active models',
      };
    }

    return { achieved: false };
  }
}

/**
 * Dominance Victory Condition
 * Win by reaching VP threshold
 */
export class DominanceVictory extends BaseVictoryCondition {
  readonly type = 'dominance';

  constructor(
    private config: VictoryConditionConfig & { threshold: number }
  ) {
    super(config);
  }

  check(state: MissionState): VictoryResult {
    for (const side of state.sides) {
      const vp = this.getVP(state, side.id);
      if (vp >= this.config.threshold) {
        return {
          achieved: true,
          winner: side.id,
          reason: `Reached ${this.config.threshold} VP`,
        };
      }
    }

    return { achieved: false };
  }
}

/**
 * VP Majority Victory Condition
 * Win by having most VP at game end
 */
export class VPMajorityVictory extends BaseVictoryCondition {
  readonly type = 'vp_majority';

  check(state: MissionState): VictoryResult {
    if (!state.ended) {
      return { achieved: false };
    }

    let maxVP = -1;
    let winner: string | undefined;

    for (const side of state.sides) {
      const vp = this.getVP(state, side.id);
      if (vp > maxVP && this.getActiveModelCount(state, side.id) > 0) {
        maxVP = vp;
        winner = side.id;
      }
    }

    if (winner) {
      return {
        achieved: true,
        winner,
        reason: 'Most VP at game end',
      };
    }

    return { achieved: false };
  }
}

/**
 * Survival Victory Condition
 * Win by surviving until turn X
 */
export class SurvivalVictory extends BaseVictoryCondition {
  readonly type = 'survival';

  constructor(
    private config: VictoryConditionConfig & { threshold: number }
  ) {
    super(config);
  }

  check(state: MissionState): VictoryResult {
    if (state.currentTurn < this.config.threshold) {
      return { achieved: false };
    }

    // Find sides that survived
    const survivingSides = state.sides.filter(side =>
      this.getActiveModelCount(state, side.id) > 0
    );

    if (survivingSides.length === 1) {
      return {
        achieved: true,
        winner: survivingSides[0].id,
        reason: `Survived until turn ${this.config.threshold}`,
      };
    }

    return { achieved: false };
  }
}

/**
 * First to VP Victory Condition
 * Win by being first to reach VP threshold
 */
export class FirstToVPVictory extends BaseVictoryCondition {
  readonly type = 'first_to_vp';

  constructor(
    private config: VictoryConditionConfig & { threshold: number }
  ) {
    super(config);
  }

  check(state: MissionState): VictoryResult {
    for (const side of state.sides) {
      const vp = this.getVP(state, side.id);
      if (vp >= this.config.threshold) {
        return {
          achieved: true,
          winner: side.id,
          reason: `First to ${this.config.threshold} VP`,
        };
      }
    }

    return { achieved: false };
  }
}

/**
 * Control All Victory Condition
 * Win by controlling all zones/objectives
 */
export class ControlAllVictory extends BaseVictoryCondition {
  readonly type = 'control_all';

  check(state: MissionState): VictoryResult {
    const zones = state.customState['zones'] as Array<{ controller?: string }> | [];
    if (zones.length === 0) return { achieved: false };

    for (const side of state.sides) {
      const controlledCount = zones.filter(z => z.controller === side.id).length;
      if (controlledCount === zones.length && zones.length > 0) {
        return {
          achieved: true,
          winner: side.id,
          reason: 'Controls all objectives',
        };
      }
    }

    return { achieved: false };
  }
}

/**
 * Custom Victory Condition
 * For mission-specific victory conditions checked via custom state
 */
export class CustomVictory extends BaseVictoryCondition {
  readonly type = 'custom';

  check(state: MissionState): VictoryResult {
    // Check custom victory state
    const customVictory = state.customState['victory'] as { achieved?: boolean; winner?: string; reason?: string };
    if (customVictory?.achieved) {
      return {
        achieved: true,
        winner: customVictory.winner,
        reason: customVictory.reason,
      };
    }

    return { achieved: false };
  }
}

/**
 * Victory Condition Factory
 * Creates victory condition instances from config
 */
export function createVictoryCondition(config: VictoryConditionConfig): VictoryCondition {
  switch (config.type) {
    case 'elimination':
      return new EliminationVictory(config);
    case 'dominance':
      if (!config.threshold) {
        throw new Error('Dominance victory requires threshold');
      }
      return new DominanceVictory(config as VictoryConditionConfig & { threshold: number });
    case 'vp_majority':
      return new VPMajorityVictory(config);
    case 'survival':
      if (!config.threshold) {
        throw new Error('Survival victory requires threshold');
      }
      return new SurvivalVictory(config as VictoryConditionConfig & { threshold: number });
    case 'first_to_vp':
      if (!config.threshold) {
        throw new Error('FirstToVP victory requires threshold');
      }
      return new FirstToVPVictory(config as VictoryConditionConfig & { threshold: number });
    case 'control_all':
      return new ControlAllVictory(config);
    case 'courier':
    case 'extraction':
    case 'rupture':
    case 'harvest':
    case 'threshold_reached':
      // These require mission-specific state checks
      return new CustomVictory(config);
    default:
      throw new Error(`Unknown victory condition type: ${config.type}`);
  }
}

/**
 * Create multiple victory conditions from config array
 */
export function createVictoryConditions(configs: VictoryConditionConfig[]): VictoryCondition[] {
  return configs.map(createVictoryCondition);
}

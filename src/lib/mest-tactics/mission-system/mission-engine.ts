import { MissionConfig, MissionState, VictoryResult, ScoringResult, ZoneInstance, GameSize } from '../missions/mission-config';
import { VictoryCondition, createVictoryConditions } from './victory-conditions';
import { ScoringRule, createScoringRules } from './scoring-rules';
import { ZoneFactory } from './zone-factory';
import { BalanceValidator } from './balance-validator';
import { MissionSide } from './MissionSide';
import { Position } from '../battlefield/Position';

/**
 * Mission Engine
 * Loads mission configurations and executes mission logic
 */
export class MissionEngine {
  /** Mission configuration */
  readonly config: MissionConfig;
  /** Victory condition components */
  private victoryConditions: VictoryCondition[];
  /** Scoring rule components */
  private scoringRules: ScoringRule[];
  /** Zone instances */
  private zones: ZoneInstance[];
  /** Mission state */
  private state: MissionState;

  constructor(config: MissionConfig) {
    this.config = config;
    
    // Validate configuration
    const validation = BalanceValidator.validate(config);
    if (!validation.passed) {
      console.warn('Mission configuration warnings:', BalanceValidator.getReport(validation));
    }

    // Create components from config
    this.victoryConditions = createVictoryConditions(config.victoryConditions);
    this.scoringRules = createScoringRules(config.scoringRules);
    this.zones = [];
    
    // Initialize state
    this.state = this.createInitialState();
  }

  /**
   * Create initial mission state
   */
  private createInitialState(): MissionState {
    return {
      currentTurn: 0,
      currentRound: 0,
      sides: [],
      vpBySide: new Map(),
      ended: false,
      customState: {
        zones: [],
        firstBloodAwarded: false,
      },
    };
  }

  /**
   * Initialize mission with sides
   */
  initialize(sides: MissionSide[], battlefieldCenter: Position = { x: 12, y: 12 }): void {
    this.state.sides = sides;
    
    // Initialize VP for each side
    for (const side of sides) {
      this.state.vpBySide.set(side.id, 0);
    }

    // Create zones from config
    if (this.config.battlefield?.zones) {
      this.zones = [];
      for (const zoneConfig of this.config.battlefield.zones) {
        const zoneInstances = ZoneFactory.createZones(zoneConfig, battlefieldCenter);
        this.zones.push(...zoneInstances);
      }
      (this.state.customState['zones'] as ZoneInstance[]) = this.zones;
    }
  }

  /**
   * Start the mission
   */
  start(): void {
    this.state.currentTurn = 1;
    this.state.currentRound = 1;
  }

  /**
   * End turn processing
   */
  endTurn(): { scoringResults: ScoringResult[]; victoryResult?: VictoryResult } {
    const scoringResults: ScoringResult[] = [];

    // Apply turn-end scoring rules
    for (const rule of this.scoringRules) {
      if (rule.trigger.startsWith('turn.end')) {
        const result = rule.apply(this.state);
        if (result.vpAwarded > 0) {
          scoringResults.push(result);
        }
      }
    }

    // Check victory conditions
    const victoryResult = this.checkVictory();

    return { scoringResults, victoryResult };
  }

  /**
   * Advance to next turn
   */
  nextTurn(): void {
    this.state.currentTurn++;
    this.state.currentRound = 1;
  }

  /**
   * Check all victory conditions
   */
  checkVictory(): VictoryResult | undefined {
    for (const condition of this.victoryConditions) {
      const result = condition.check(this.state);
      if (result.achieved) {
        this.state.ended = true;
        this.state.winner = result.winner;
        this.state.endReason = result.reason;
        return result;
      }
    }

    // Check turn limit
    if (this.state.currentTurn >= this.config.turnLimit && this.config.turnLimit > 0) {
      // VP majority victory at turn limit
      const vpMajority = this.victoryConditions.find(c => c.type === 'vp_majority');
      if (vpMajority) {
        const result = vpMajority.check(this.state);
        if (result.achieved) {
          this.state.ended = true;
          this.state.winner = result.winner;
          this.state.endReason = result.reason;
          return result;
        }
      }
    }

    return undefined;
  }

  /**
   * Award VP for an event
   */
  awardVP(sideId: string, amount: number, reason?: string): ScoringResult {
    const currentVP = this.state.vpBySide.get(sideId) ?? 0;
    this.state.vpBySide.set(sideId, currentVP + amount);

    const side = this.state.sides.find(s => s.id === sideId);
    if (side) {
      side.state.victoryPoints = currentVP + amount;
    }

    // Check if any scoring rule triggered this
    const scoringResult: ScoringResult = {
      vpAwarded: amount,
      sideId,
      reason,
    };

    // Check victory after awarding VP
    const victoryResult = this.checkVictory();
    if (victoryResult) {
      scoringResult.reason = scoringResult.reason 
        ? `${scoringResult.reason} - ${victoryResult.reason}`
        : victoryResult.reason;
    }

    return scoringResult;
  }

  /**
   * Handle model elimination event
   */
  onModelEliminated(eliminatedSideId: string, eliminatingSideId?: string): ScoringResult[] {
    const results: ScoringResult[] = [];

    // Apply model eliminated scoring
    for (const rule of this.scoringRules) {
      if (rule.trigger === 'model.eliminated') {
        const result = rule.apply(this.state, { eliminatedSideId, eliminatingSideId });
        if (result.vpAwarded > 0) {
          results.push(result);
        }
      }
    }

    // Check first blood
    for (const rule of this.scoringRules) {
      if (rule.trigger === 'first_blood' && eliminatingSideId) {
        const result = rule.apply(this.state, { sideId: eliminatingSideId });
        if (result.vpAwarded > 0) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Update zone control
   */
  updateZoneControl(zoneId: string, controllerId?: string): void {
    const zone = this.zones.find(z => z.id === zoneId);
    if (zone) {
      zone.controller = controllerId;
    }
  }

  /**
   * Get current mission state
   */
  getState(): MissionState {
    return { ...this.state };
  }

  /**
   * Get zones
   */
  getZones(): ZoneInstance[] {
    return [...this.zones];
  }

  /**
   * Get VP for a side
   */
  getVP(sideId: string): number {
    return this.state.vpBySide.get(sideId) ?? 0;
  }

  /**
   * Get VP standings
   */
  getVPStandings(): Array<{ sideId: string; vp: number }> {
    return Array.from(this.state.vpBySide.entries())
      .map(([sideId, vp]) => ({ sideId, vp }))
      .sort((a, b) => b.vp - a.vp);
  }

  /**
   * Check if mission has ended
   */
  hasEnded(): boolean {
    return this.state.ended;
  }

  /**
   * Get winner
   */
  getWinner(): string | undefined {
    return this.state.winner;
  }

  /**
   * Get end reason
   */
  getEndReason(): string | undefined {
    return this.state.endReason;
  }

  /**
   * Get current turn
   */
  getCurrentTurn(): number {
    return this.state.currentTurn;
  }

  /**
   * Get balance validation report
   */
  getBalanceReport(): string {
    const validation = BalanceValidator.validate(this.config);
    return BalanceValidator.getReport(validation);
  }

  /**
   * Load mission from JSON config
   */
  static fromConfig(config: MissionConfig): MissionEngine {
    return new MissionEngine(config);
  }

  /**
   * Create default Elimination mission config
   */
  static createEliminationConfig(): MissionConfig {
    return {
      id: 'QAI_1',
      name: 'Elimination',
      description: 'Destroy your opponent\'s fighting strength before they destroy yours.',
      sides: { min: 2, max: 2 },
      defaultGameSize: GameSize.SMALL,
      victoryConditions: [
        { type: 'elimination', immediate: true, description: 'Eliminate all enemy models' },
        { type: 'vp_majority', description: 'Most VP at game end' },
      ],
      scoringRules: [
        { trigger: 'model.eliminated', vp: 1, description: '1 VP per enemy model eliminated' },
      ],
      turnLimit: 10,
      endGameDieRoll: true,
      endGameDieStart: 6,
    };
  }
}

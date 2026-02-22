import { MissionConfig, MissionState, GameSize } from './mission-config';
import { MissionEngine } from './mission-engine';
import {
  SpecialRuleHandlerRegistry,
  createDefaultHandlers,
  SpecialRuleEvent,
  SpecialRuleResult,
} from './mission-components/special-rules';
import { MissionEventLogger, EventLog } from './mission-event-logger';
import { MissionUIBridge, UIEvent } from './mission-ui-bridge';

/**
 * Mission Runtime
 * Integrates MissionEngine with special rules, event logging, and UI bridge
 */
export class MissionRuntime {
  /** Core mission engine */
  readonly engine: MissionEngine;
  /** Special rules handler registry */
  readonly specialRules: SpecialRuleHandlerRegistry;
  /** Event logger for replays */
  readonly logger: MissionEventLogger;
  /** UI bridge for web interface */
  readonly uiBridge: MissionUIBridge;
  /** Mission configuration */
  readonly config: MissionConfig;

  private state: MissionState;

  constructor(config: MissionConfig) {
    this.config = config;
    this.engine = MissionEngine.fromConfig(config);
    this.specialRules = createDefaultHandlers();
    this.logger = new MissionEventLogger();
    this.logger.setMissionId(config.id);
    this.uiBridge = new MissionUIBridge();
    this.uiBridge.connect();
    this.state = this.engine.getState();

    // Initialize special rules from config
    this.initializeSpecialRules();
  }

  /**
   * Initialize special rules based on mission config
   */
  private initializeSpecialRules(): void {
    const ruleIds = this.config.specialRules?.map(r => r.id) ?? [];

    // Map mission types to special rules
    const missionRuleMap: Record<string, string[]> = {
      'QAI_12': ['reinforcements'], // Convergence
      'QAI_13': ['time_pressure', 'harvest'], // Assault
      'QAI_14': ['courier'], // Dominion
      'QAI_15': ['threat_level', 'harvest'], // Recovery
      'QAI_16': ['courier', 'reinforcements'], // Escort
      'QAI_17': ['commander'], // Triumvirate
      'QAI_18': ['alert_level', 'hidden_object'], // Stealth
      'QAI_19': ['breakthrough', 'sally_forth'], // Defiance
      'QAI_20': ['mechanism', 'vigilance'], // Breach
    };

    const missionRules = missionRuleMap[this.config.id] ?? [];
    const allRules = [...new Set([...ruleIds, ...missionRules])];

    this.specialRules.initializeAll(this.state, allRules);

    // Log initialization
    this.logger.log({
      type: 'system.init',
      timestamp: Date.now(),
      data: { missionId: this.config.id, specialRules: allRules },
    });
  }

  /**
   * Start the mission
   */
  start(): void {
    this.engine.start();
    
    this.logger.log({
      type: 'game.start',
      timestamp: Date.now(),
      data: { turn: this.state.currentTurn },
    });

    this.uiBridge.emit({
      type: 'mission.started',
      payload: { missionId: this.config.id, missionName: this.config.name },
    });
  }

  /**
   * End turn with full processing
   */
  endTurn(): {
    scoringResults: SpecialRuleResult[];
    victoryResult?: { achieved: boolean; winner?: string; reason?: string };
  } {
    // Log turn end
    this.logger.log({
      type: 'game.turn_end',
      timestamp: Date.now(),
      data: { turn: this.state.currentTurn },
    });

    // Process special rules for turn end
    const scoringResults = this.specialRules.handle(this.state, {
      type: 'turn.end',
      data: {},
    });

    // Engine turn processing
    const engineResult = this.engine.endTurn();

    // Emit UI event
    this.uiBridge.emit({
      type: 'game.turn_ended',
      payload: {
        turn: this.state.currentTurn,
        vpStandings: this.engine.getVPStandings(),
        scoringResults: scoringResults.map(r => ({
          vpAwarded: r.vpAwarded ?? 0,
          message: r.message,
        })),
      },
    });

    return {
      scoringResults,
      victoryResult: engineResult.victoryResult,
    };
  }

  /**
   * Advance to next turn
   */
  nextTurn(): void {
    this.engine.nextTurn();

    this.logger.log({
      type: 'game.turn_start',
      timestamp: Date.now(),
      data: { turn: this.state.currentTurn },
    });

    this.uiBridge.emit({
      type: 'game.turn_started',
      payload: { turn: this.state.currentTurn },
    });
  }

  /**
   * Handle special rule event
   */
  handleSpecialRule(event: SpecialRuleEvent): SpecialRuleResult[] {
    const results = this.specialRules.handle(this.state, event);

    // Log event
    this.logger.log({
      type: 'special_rule.event',
      timestamp: Date.now(),
      data: { event, results },
    });

    // Emit UI event
    this.uiBridge.emit({
      type: 'special_rule.triggered',
      payload: {
        eventType: event.type,
        results: results.map(r => ({
          handled: r.handled,
          vpAwarded: r.vpAwarded,
          message: r.message,
        })),
      },
    });

    return results;
  }

  /**
   * Award VP
   */
  awardVP(sideId: string, amount: number, reason?: string): void {
    this.engine.awardVP(sideId, amount, reason);

    this.logger.log({
      type: 'game.vp_awarded',
      timestamp: Date.now(),
      data: { sideId, amount, reason },
    });

    this.uiBridge.emit({
      type: 'game.vp_changed',
      payload: {
        sideId,
        amount,
        total: this.engine.getVP(sideId),
        reason,
      },
    });
  }

  /**
   * Handle model elimination
   */
  onModelEliminated(eliminatedSideId: string, eliminatingSideId?: string): void {
    // Engine processing
    this.engine.onModelEliminated(eliminatedSideId, eliminatingSideId);

    // Special rules processing
    this.specialRules.handle(this.state, {
      type: 'model.eliminated',
      sideId: eliminatingSideId,
      data: { eliminatedSideId, eliminatingSideId },
    });

    // Log event
    this.logger.log({
      type: 'combat.model_eliminated',
      timestamp: Date.now(),
      data: { eliminatedSideId, eliminatingSideId },
    });

    // Emit UI event
    this.uiBridge.emit({
      type: 'combat.model_eliminated',
      payload: {
        eliminatedSideId,
        eliminatingSideId,
        vpStandings: this.engine.getVPStandings(),
      },
    });
  }

  /**
   * Get current state
   */
  getState(): MissionState {
    return this.engine.getState();
  }

  /**
   * Get event log (for replays)
   */
  getEventLog(): EventLog {
    return this.logger.getLog();
  }

  /**
   * Export state for UI
   */
  exportUIState(): {
    missionId: string;
    missionName: string;
    currentTurn: number;
    ended: boolean;
    winner?: string;
    vpStandings: Array<{ sideId: string; vp: number }>;
    specialRuleState: Record<string, unknown>;
  } {
    const currentState = this.engine.getState();
    return {
      missionId: this.config.id,
      missionName: this.config.name,
      currentTurn: currentState.currentTurn,
      ended: currentState.ended,
      winner: currentState.winner,
      vpStandings: this.engine.getVPStandings(),
      specialRuleState: currentState.customState,
    };
  }

  /**
   * Check if mission has ended
   */
  hasEnded(): boolean {
    return this.engine.hasEnded();
  }

  /**
   * Get winner
   */
  getWinner(): string | undefined {
    return this.engine.getWinner();
  }
}

/**
 * Create mission runtime from config
 */
export function createMissionRuntime(config: MissionConfig): MissionRuntime {
  return new MissionRuntime(config);
}

/**
 * Load mission runtime from JSON
 */
export async function loadMissionRuntime(missionId: string): Promise<MissionRuntime | null> {
  // Dynamic import for MissionLoader
  const { MissionLoader } = await import('./mission-loader');
  const config = await MissionLoader.byId(missionId);
  
  if (!config) {
    return null;
  }

  return createMissionRuntime(config);
}

import { describe, it, expect, beforeEach } from 'vitest';
import { MissionRuntime, createMissionRuntime, loadMissionRuntime } from './mission-runtime';
import { MissionConfig, GameSize } from './mission-config';
import { EventTypes } from './mission-event-logger';
import { UIEventTypes } from './mission-ui-bridge';

function createTestConfig(): MissionConfig {
  return {
    id: 'QAI_1',
    name: 'Elimination',
    description: 'Test elimination mission',
    sides: { min: 2, max: 2 },
    defaultGameSize: GameSize.SMALL,
    victoryConditions: [
      { type: 'elimination', immediate: true },
      { type: 'vp_majority' },
    ],
    scoringRules: [
      { trigger: 'model.eliminated', vp: 1 },
    ],
    turnLimit: 10,
    endGameDieRoll: true,
    endGameDieStart: 6,
  };
}

describe('MissionRuntime', () => {
  let runtime: MissionRuntime;
  let config: MissionConfig;

  beforeEach(() => {
    config = createTestConfig();
    runtime = createMissionRuntime(config);
  });

  it('should create runtime with all components', () => {
    expect(runtime.engine).toBeDefined();
    expect(runtime.specialRules).toBeDefined();
    expect(runtime.logger).toBeDefined();
    expect(runtime.uiBridge).toBeDefined();
  });

  it('should start mission', () => {
    let eventReceived = false;
    
    runtime.uiBridge.on(UIEventTypes.MISSION_STARTED, () => {
      eventReceived = true;
    });

    runtime.start();

    expect(runtime.getState().currentTurn).toBe(1);
    expect(eventReceived).toBe(true);
  });

  it('should end turn with scoring', () => {
    runtime.start();
    const result = runtime.endTurn();

    expect(result.scoringResults).toBeDefined();
  });

  it('should advance turns', () => {
    runtime.start();
    runtime.nextTurn();

    expect(runtime.getState().currentTurn).toBe(2);
  });

  it('should handle special rule events', () => {
    runtime.start();
    
    const results = runtime.handleSpecialRule({
      type: 'turn.end',
      data: {},
    });

    expect(results).toBeDefined();
  });

  it('should award VP', () => {
    runtime.start();
    runtime.awardVP('SideA', 5, 'Test');

    expect(runtime.engine.getVP('SideA')).toBe(5);
  });

  it('should handle model elimination', () => {
    runtime.start();
    
    // This should trigger special rules
    runtime.onModelEliminated('SideB', 'SideA');

    // Check VP was awarded
    expect(runtime.engine.getVP('SideA')).toBeGreaterThan(0);
  });

  it('should export UI state', () => {
    runtime.start();
    runtime.awardVP('SideA', 5);

    const uiState = runtime.exportUIState();

    expect(uiState.missionId).toBe('QAI_1');
    expect(uiState.currentTurn).toBe(1);
    expect(uiState.vpStandings.length).toBeGreaterThan(0);
  });

  it('should log events', () => {
    runtime.start();
    runtime.awardVP('SideA', 5);

    const log = runtime.getEventLog();

    expect(log.missionId).toBe('QAI_1');
    expect(log.events.length).toBeGreaterThan(0);
  });
});

describe('MissionRuntime with Special Rules', () => {
  it('should initialize Convergence special rules', () => {
    const config: MissionConfig = {
      id: 'QAI_12',
      name: 'Convergence',
      description: 'Test',
      sides: { min: 2, max: 2 },
      defaultGameSize: GameSize.SMALL,
      victoryConditions: [{ type: 'dominance', threshold: 5 }],
      scoringRules: [{ trigger: 'turn.end.zone_control', vp: 1 }],
      turnLimit: 10,
      endGameDieRoll: true,
      endGameDieStart: 6,
    };

    const runtime = createMissionRuntime(config);
    runtime.start();

    // Should have reinforcement handler initialized
    const state = runtime.getState();
    expect(state.customState['reinforcementGroups']).toBeDefined();
  });

  it('should initialize Incursion special rules', () => {
    const config: MissionConfig = {
      id: 'QAI_18',
      name: 'Incursion',
      description: 'Test',
      sides: { min: 2, max: 2 },
      defaultGameSize: GameSize.SMALL,
      victoryConditions: [{ type: 'courier', immediate: true }],
      scoringRules: [],
      turnLimit: 8,
      endGameDieRoll: false,
      endGameDieStart: 6,
    };

    const runtime = createMissionRuntime(config);
    runtime.start();

    const state = runtime.getState();
    expect(state.customState['alertLevel']).toBe(0);
    expect(state.customState['objectLocation']).toBeDefined();
  });

  it('should initialize Trinity special rules', () => {
    const config: MissionConfig = {
      id: 'QAI_17',
      name: 'Trinity',
      description: 'Test',
      sides: { min: 3, max: 4 },
      defaultGameSize: GameSize.LARGE,
      victoryConditions: [{ type: 'dominance', threshold: 4 }],
      scoringRules: [{ trigger: 'turn.end.zone_control', vp: 1 }],
      turnLimit: 10,
      endGameDieRoll: true,
      endGameDieStart: 6,
    };

    const runtime = createMissionRuntime(config);
    runtime.start();

    const state = runtime.getState();
    expect(state.customState['commanders']).toBeDefined();
    expect(state.customState['commanderKO']).toBeDefined();
  });
});

describe('MissionRuntime UI Events', () => {
  it('should emit mission started event', () => {
    const config = createTestConfig();
    const runtime = createMissionRuntime(config);
    
    let eventReceived: { type: string; payload: Record<string, unknown> } | null = null;
    
    runtime.uiBridge.on(UIEventTypes.MISSION_STARTED, (event) => {
      eventReceived = event;
    });

    runtime.uiBridge.connect();
    runtime.start();

    expect(eventReceived).not.toBeNull();
    expect(eventReceived?.payload.missionId).toBe('QAI_1');
  });

  it('should emit VP changed event', () => {
    const config = createTestConfig();
    const runtime = createMissionRuntime(config);
    
    let vpEvent: { amount: number; total: number } | null = null;
    
    runtime.uiBridge.on(UIEventTypes.GAME_VP_CHANGED, (event) => {
      vpEvent = event.payload as { amount: number; total: number };
    });

    runtime.uiBridge.connect();
    runtime.start();
    runtime.awardVP('SideA', 5, 'Test');

    expect(vpEvent).not.toBeNull();
    expect(vpEvent?.amount).toBe(5);
    expect(vpEvent?.total).toBe(5);
  });

  it('should emit turn ended event', () => {
    const config = createTestConfig();
    const runtime = createMissionRuntime(config);
    
    let turnEnded = false;
    
    runtime.uiBridge.on(UIEventTypes.GAME_TURN_ENDED, () => {
      turnEnded = true;
    });

    runtime.uiBridge.connect();
    runtime.start();
    runtime.endTurn();

    expect(turnEnded).toBe(true);
  });

  it('should emit special rule triggered event', () => {
    const config = createTestConfig();
    const runtime = createMissionRuntime(config);
    
    let specialEvent: { eventType: string } | null = null;
    
    runtime.uiBridge.on(UIEventTypes.SPECIAL_RULE_TRIGGERED, (event) => {
      specialEvent = event.payload as { eventType: string };
    });

    runtime.uiBridge.connect();
    runtime.start();
    runtime.handleSpecialRule({ type: 'turn.end', data: {} });

    expect(specialEvent).not.toBeNull();
    expect(specialEvent?.eventType).toBe('turn.end');
  });
});

describe('MissionRuntime Event Logging', () => {
  it('should log all events', () => {
    const config = createTestConfig();
    const runtime = createMissionRuntime(config);

    runtime.start();
    runtime.awardVP('SideA', 5);
    runtime.nextTurn();
    runtime.endTurn();

    const log = runtime.getEventLog();

    expect(log.missionId).toBe('QAI_1');
    expect(log.events.length).toBeGreaterThan(3);
    
    // Check specific event types
    const startEvents = log.events.filter(e => e.type === 'game.start');
    const vpEvents = log.events.filter(e => e.type === 'game.vp_awarded');
    const turnEvents = log.events.filter(e => e.type === 'game.turn_start');

    expect(startEvents.length).toBe(1);
    expect(vpEvents.length).toBe(1);
    expect(turnEvents.length).toBe(1);
  });

  it('should export log as JSON', () => {
    const config = createTestConfig();
    const runtime = createMissionRuntime(config);

    runtime.start();
    runtime.awardVP('SideA', 5);

    const log = runtime.getEventLog();
    const json = log.events.length > 0 
      ? JSON.stringify(log, null, 2)
      : '{}';

    expect(json).toContain('QAI_1');
    expect(json).toContain('events');
  });
});

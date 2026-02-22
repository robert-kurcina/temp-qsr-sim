import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpecialRuleHandlerRegistry,
  ReinforcementWaveHandler,
  AlertLevelHandler,
  ThreatLevelHandler,
  CourierHandler,
  MechanismHandler,
  CommanderHandler,
  TimePressureHandler,
  HarvestHandler,
  HiddenObjectHandler,
  BreakthroughHandler,
  VigilanceHandler,
  createDefaultHandlers,
} from './special-rules';
import { MissionState } from '../mission-config';

function createTestState(): MissionState {
  return {
    currentTurn: 1,
    currentRound: 1,
    sides: [
      { id: 'SideA', name: 'Side A', assemblies: [], members: [], totalBP: 0, deploymentZones: [], state: { currentTurn: 0, activatedModels: new Set(), readyModels: new Set(), woundsThisTurn: 0, eliminatedModels: [], victoryPoints: 0, missionState: {} } },
      { id: 'SideB', name: 'Side B', assemblies: [], members: [], totalBP: 0, deploymentZones: [], state: { currentTurn: 0, activatedModels: new Set(), readyModels: new Set(), woundsThisTurn: 0, eliminatedModels: [], victoryPoints: 0, missionState: {} } },
    ],
    vpBySide: new Map(),
    ended: false,
    customState: {},
  };
}

describe('SpecialRuleHandlerRegistry', () => {
  let registry: SpecialRuleHandlerRegistry;

  beforeEach(() => {
    registry = new SpecialRuleHandlerRegistry();
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
  });

  it('should register all handlers', () => {
    expect(registry.getHandler('reinforcements')).toBeDefined();
    expect(registry.getHandler('alert_level')).toBeDefined();
    expect(registry.getHandler('threat_level')).toBeDefined();
    expect(registry.getHandler('courier')).toBeDefined();
    expect(registry.getHandler('mechanism')).toBeDefined();
    expect(registry.getHandler('commander')).toBeDefined();
    expect(registry.getHandler('time_pressure')).toBeDefined();
    expect(registry.getHandler('harvest')).toBeDefined();
    expect(registry.getHandler('hidden_object')).toBeDefined();
    expect(registry.getHandler('breakthrough')).toBeDefined();
    expect(registry.getHandler('vigilance')).toBeDefined();
  });

  it('should initialize all handlers', () => {
    const state = createTestState();
    registry.initializeAll(state, ['reinforcements', 'alert_level']);

    expect(state.customState['reinforcementGroups']).toBeDefined();
    expect(state.customState['alertLevel']).toBe(0);
  });
});

describe('ReinforcementWaveHandler', () => {
  let handler: ReinforcementWaveHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new ReinforcementWaveHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should handle successful reinforcement roll', () => {
    const result = handler.handle(state, {
      type: 'reinforcement.roll',
      sideId: 'SideA',
      data: { sideId: 'SideA', roll: 5, target: 4 },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('success');
  });

  it('should handle failed reinforcement roll', () => {
    const result = handler.handle(state, {
      type: 'reinforcement.roll',
      sideId: 'SideA',
      data: { sideId: 'SideA', roll: 3, target: 4 },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('failed');
  });
});

describe('AlertLevelHandler', () => {
  let handler: AlertLevelHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new AlertLevelHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should increase alert level', () => {
    const result = handler.handle(state, {
      type: 'alert.increase',
      data: { amount: 2, reason: 'Revelation' },
    });

    expect(result.handled).toBe(true);
    expect(state.customState['alertLevel']).toBe(2);
  });

  it('should trigger lockdown at threshold', () => {
    handler.handle(state, {
      type: 'alert.increase',
      data: { amount: 6, reason: 'Multiple' },
    });

    expect(state.customState['lockdownTriggered']).toBe(true);
  });

  it('should check alert level', () => {
    handler.handle(state, {
      type: 'alert.increase',
      data: { amount: 3, reason: 'Test' },
    });

    const result = handler.handle(state, {
      type: 'alert.check',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.alertLevel).toBe(3);
  });
});

describe('ThreatLevelHandler', () => {
  let handler: ThreatLevelHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new ThreatLevelHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should increase threat level', () => {
    const result = handler.handle(state, {
      type: 'threat.increase',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(state.customState['threatLevel']).toBe(1);
  });

  it('should apply level 2 effects', () => {
    handler.handle(state, { type: 'threat.increase', data: {} });
    handler.handle(state, { type: 'threat.increase', data: {} });

    const result = handler.handle(state, {
      type: 'threat.effect',
      data: {},
    });

    expect(result.stateChanges?.activeEffects).toContain('range_penalty');
  });

  it('should apply level 4 effects', () => {
    for (let i = 0; i < 4; i++) {
      handler.handle(state, { type: 'threat.increase', data: {} });
    }

    const result = handler.handle(state, {
      type: 'threat.effect',
      data: {},
    });

    expect(result.stateChanges?.activeEffects).toContain('range_penalty');
    expect(result.stateChanges?.activeEffects).toContain('melee_penalty');
  });
});

describe('CourierHandler', () => {
  let handler: CourierHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new CourierHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should designate courier', () => {
    const result = handler.handle(state, {
      type: 'courier.designate',
      sideId: 'SideA',
      data: { sideId: 'SideA', modelId: 'model-1' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('model-1');
  });

  it('should award VP for edge reach', () => {
    handler.handle(state, {
      type: 'courier.designate',
      sideId: 'SideA',
      data: { sideId: 'SideA', modelId: 'model-1' },
    });

    const result = handler.handle(state, {
      type: 'courier.edge_reach',
      sideId: 'SideA',
      data: { sideId: 'SideA', vpImmediate: 1 },
    });

    expect(result.handled).toBe(true);
    expect(result.vpAwarded).toBe(1);
  });

  it('should award VP at turn end', () => {
    handler.handle(state, {
      type: 'courier.edge_reach',
      sideId: 'SideA',
      data: { sideId: 'SideA', vpImmediate: 1 },
    });

    const result = handler.handle(state, {
      type: 'courier.turn_end',
      sideId: 'SideA',
      data: { sideId: 'SideA', vpPerTurn: 1 },
    });

    expect(result.handled).toBe(true);
    expect(result.vpAwarded).toBe(1);
  });
});

describe('MechanismHandler', () => {
  let handler: MechanismHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new MechanismHandler();
    state = createTestState();
    handler.initialize(state, { mechanismCount: 3 });
  });

  it('should activate mechanism', () => {
    const result = handler.handle(state, {
      type: 'mechanism.activate',
      sideId: 'SideA',
      data: { mechanismId: 'mech-1', sideId: 'SideA' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('activated');
  });

  it('should open threshold when all mechanisms on', () => {
    handler.handle(state, {
      type: 'mechanism.activate',
      sideId: 'SideA',
      data: { mechanismId: 'mech-1', sideId: 'SideA' },
    });
    handler.handle(state, {
      type: 'mechanism.activate',
      sideId: 'SideA',
      data: { mechanismId: 'mech-2', sideId: 'SideA' },
    });
    handler.handle(state, {
      type: 'mechanism.activate',
      sideId: 'SideA',
      data: { mechanismId: 'mech-3', sideId: 'SideA' },
    });

    expect(state.customState['thresholdOpen']).toBe(true);
  });

  it('should check mechanism state', () => {
    handler.handle(state, {
      type: 'mechanism.activate',
      sideId: 'SideA',
      data: { mechanismId: 'mech-1', sideId: 'SideA' },
    });

    const result = handler.handle(state, {
      type: 'mechanism.check',
      data: {},
    });

    expect(result.handled).toBe(true);
    // Only 1 of 3 mechanisms activated, so allMechanismsOn should be false
    const mechanisms = result.stateChanges?.mechanisms as Record<string, { active: boolean }>;
    expect(mechanisms['mech-1']?.active).toBe(true);
    expect(result.stateChanges?.allMechanismsOn).toBe(false);
  });
});

describe('CommanderHandler', () => {
  let handler: CommanderHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new CommanderHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should designate commander', () => {
    const result = handler.handle(state, {
      type: 'commander.designate',
      sideId: 'SideA',
      data: { sideId: 'SideA', modelId: 'commander-1' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('commander-1');
  });

  it('should handle commander KO', () => {
    handler.handle(state, {
      type: 'commander.designate',
      sideId: 'SideA',
      data: { sideId: 'SideA', modelId: 'commander-1' },
    });

    const result = handler.handle(state, {
      type: 'commander.ko',
      sideId: 'SideA',
      data: { sideId: 'SideA' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain("KO'd");
  });

  it('should award VP for commander elimination', () => {
    handler.handle(state, {
      type: 'commander.designate',
      sideId: 'SideA',
      data: { sideId: 'SideA', modelId: 'commander-1' },
    });

    const result = handler.handle(state, {
      type: 'commander.eliminated',
      sideId: 'SideA',
      data: { sideId: 'SideA', eliminatingSideId: 'SideB' },
    });

    expect(result.handled).toBe(true);
    expect(result.vpAwarded).toBe(2);
  });
});

describe('TimePressureHandler', () => {
  let handler: TimePressureHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new TimePressureHandler();
    state = createTestState();
    handler.initialize(state, { endTurn: 5 });
  });

  it('should end game at turn limit', () => {
    state.currentTurn = 5;

    const result = handler.handle(state, {
      type: 'time.check',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.gameEnd).toBe(true);
  });

  it('should not end game before turn limit', () => {
    state.currentTurn = 3;

    const result = handler.handle(state, {
      type: 'time.check',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.gameEnd).toBe(false);
  });
});

describe('HarvestHandler', () => {
  let handler: HarvestHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new HarvestHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should acquire cache', () => {
    const result = handler.handle(state, {
      type: 'cache.acquire',
      sideId: 'SideA',
      data: { cacheId: 'vc-1', sideId: 'SideA' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('acquired');
  });

  it('should extract cache and award VP', () => {
    handler.handle(state, {
      type: 'cache.acquire',
      sideId: 'SideA',
      data: { cacheId: 'vc-1', sideId: 'SideA' },
    });

    const result = handler.handle(state, {
      type: 'cache.extract',
      sideId: 'SideA',
      data: { cacheId: 'vc-1', sideId: 'SideA', vpAward: 1 },
    });

    expect(result.handled).toBe(true);
    expect(result.vpAwarded).toBe(1);
  });
});

describe('HiddenObjectHandler', () => {
  let handler: HiddenObjectHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new HiddenObjectHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should place hidden object', () => {
    const result = handler.handle(state, {
      type: 'object.place',
      data: { position: { x: 10, y: 10 } },
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.objectRevealed).toBe(false);
  });

  it('should find object within range', () => {
    handler.handle(state, {
      type: 'object.place',
      data: { position: { x: 10, y: 10 } },
    });

    const result = handler.handle(state, {
      type: 'object.find',
      sideId: 'SideA',
      data: { sideId: 'SideA', position: { x: 12, y: 12 } }, // Within 4 MU
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.objectRevealed).toBe(true);
  });

  it('should identify object', () => {
    const result = handler.handle(state, {
      type: 'object.identify',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.roll).toBeDefined();
    expect(result.stateChanges?.roll).toBeGreaterThanOrEqual(1);
    expect(result.stateChanges?.roll).toBeLessThanOrEqual(6);
  });
});

describe('BreakthroughHandler', () => {
  let handler: BreakthroughHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new BreakthroughHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should trigger alpha marker', () => {
    const result = handler.handle(state, {
      type: 'breakthrough.trigger',
      sideId: 'Horde',
      data: { marker: 'alpha', sideId: 'Horde' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('ALPHA');
    // Alpha doesn't trigger victory, only gamma does
    expect(result.stateChanges?.breakthroughMarkers?.alpha).toBe(true);
  });

  it('should trigger gamma marker for victory', () => {
    const result = handler.handle(state, {
      type: 'breakthrough.trigger',
      sideId: 'Horde',
      data: { marker: 'gamma', sideId: 'Horde' },
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('victory');
    expect(result.stateChanges?.hordeVictory).toBe(true);
    expect(result.stateChanges?.victory).toBe(true);
  });
});

describe('VigilanceHandler', () => {
  let handler: VigilanceHandler;
  let state: MissionState;

  beforeEach(() => {
    handler = new VigilanceHandler();
    state = createTestState();
    handler.initialize(state);
  });

  it('should activate vigilance', () => {
    const result = handler.handle(state, {
      type: 'vigilance.activate',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.vigilanceActive).toBe(true);
  });

  it('should get enhanced visibility when active', () => {
    handler.handle(state, {
      type: 'vigilance.activate',
      data: {},
    });

    const result = handler.handle(state, {
      type: 'visibility.get',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.visibility).toBe(16);
  });

  it('should get normal visibility when inactive', () => {
    const result = handler.handle(state, {
      type: 'visibility.get',
      data: {},
    });

    expect(result.handled).toBe(true);
    expect(result.stateChanges?.visibility).toBe(8);
  });
});

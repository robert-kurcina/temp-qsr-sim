import { describe, it, expect, beforeEach } from 'vitest';
import {
  MissionEventManager,
  EventTriggerType,
  EventConditionType,
  EventEffectType,
  EventContext,
  createTurnEventHook,
  createEndTurnEventHook,
  createVictoryConditionHook,
} from '../missions/mission-event-hooks';

// Mock EventContext for testing
function createMockContext(): EventContext & {
  state: {
    modelsRemaining: Map<string, number>;
    zonesControlled: Map<string, number>;
    victoryPoints: Map<string, number>;
    aliveModels: Set<string>;
    eliminatedModels: Set<string>;
    extractedVIPs: Set<string>;
    eliminatedVIPs: Set<string>;
    scoredMarkers: Set<string>;
    ended: boolean;
    winner?: string;
    loser?: string;
  };
} {
  const state = {
    modelsRemaining: new Map<string, number>(),
    zonesControlled: new Map<string, number>(),
    victoryPoints: new Map<string, number>(),
    aliveModels: new Set<string>(),
    eliminatedModels: new Set<string>(),
    extractedVIPs: new Set<string>(),
    eliminatedVIPs: new Set<string>(),
    scoredMarkers: new Set<string>(),
    ended: false,
  };

  return {
    state,
    currentTurn: 1,
    currentRound: 1,
    getModelsRemaining: (sideId: string) => state.modelsRemaining.get(sideId) ?? 0,
    getZonesControlled: (sideId: string) => state.zonesControlled.get(sideId) ?? 0,
    getVictoryPoints: (sideId: string) => state.victoryPoints.get(sideId) ?? 0,
    isModelAlive: (modelId: string) => state.aliveModels.has(modelId),
    isModelEliminated: (modelId: string) => state.eliminatedModels.has(modelId),
    isVIPExtracted: (vipId: string) => state.extractedVIPs.has(vipId),
    isVIPEliminated: (vipId: string) => state.eliminatedVIPs.has(vipId),
    isMarkerScored: (markerId: string) => state.scoredMarkers.has(markerId),
    checkCustomCondition: () => false,
    awardVP: (sideId: string, amount: number) => {
      const current = state.victoryPoints.get(sideId) ?? 0;
      state.victoryPoints.set(sideId, current + amount);
    },
    removeVP: (sideId: string, amount: number) => {
      const current = state.victoryPoints.get(sideId) ?? 0;
      state.victoryPoints.set(sideId, Math.max(0, current - amount));
    },
    endMission: () => { state.ended = true; },
    triggerVictory: (sideId: string) => { state.winner = sideId; state.ended = true; },
    triggerDefeat: (sideId: string) => { state.loser = sideId; },
    spawnReinforcements: () => {},
    addStatus: () => {},
    removeStatus: () => {},
    toggleZone: () => {},
    revealInfo: () => {},
    applyCustomEffect: () => {},
  };
}

describe('MissionEventManager', () => {
  let manager: MissionEventManager;
  let context: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    manager = new MissionEventManager();
    context = createMockContext();
    context.state.modelsRemaining.set('SideA', 5);
    context.state.modelsRemaining.set('SideB', 5);
    context.state.aliveModels.add('model-1');
  });

  describe('addHook / getHook', () => {
    it('should add and retrieve a hook', () => {
      const hook = createTurnEventHook(3, [{ type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 1 }]);
      manager.addHook(hook);

      const retrieved = manager.getHook(hook.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(hook.id);
    });

    it('should return undefined for unknown hook', () => {
      const retrieved = manager.getHook('unknown');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getHooksByTrigger', () => {
    it('should return hooks sorted by priority', () => {
      const hook1 = {
        id: 'h1',
        name: 'Hook 1',
        trigger: EventTriggerType.OnTurn,
        turnNumber: 3,
        conditions: [],
        effects: [],
        hasTriggered: false,
        repeatable: false,
        priority: 10,
        metadata: {},
      };
      const hook2 = {
        id: 'h2',
        name: 'Hook 2',
        trigger: EventTriggerType.OnTurn,
        turnNumber: 3,
        conditions: [],
        effects: [],
        hasTriggered: false,
        repeatable: false,
        priority: 20,
        metadata: {},
      };
      const hook3 = {
        id: 'h3',
        name: 'Hook 3',
        trigger: EventTriggerType.OnTurn,
        turnNumber: 3,
        conditions: [],
        effects: [],
        hasTriggered: false,
        repeatable: false,
        priority: 5,
        metadata: {},
      };

      manager.addHook(hook1);
      manager.addHook(hook2);
      manager.addHook(hook3);

      const hooks = manager.getHooksByTrigger(EventTriggerType.OnTurn);
      expect(hooks.map(h => h.priority)).toEqual([20, 10, 5]);
    });
  });

  describe('checkConditions', () => {
    it('should return true when all conditions are met', () => {
      const hook = createTurnEventHook(3, [], {
        conditions: [
          { type: EventConditionType.ModelsRemaining, sideId: 'SideA', threshold: 3 },
        ],
      });

      const result = manager.checkConditions(hook, context);
      expect(result.allMet).toBe(true);
    });

    it('should return false when conditions are not met', () => {
      const hook = createTurnEventHook(3, [], {
        conditions: [
          { type: EventConditionType.ModelsRemaining, sideId: 'SideA', threshold: 10 },
        ],
      });

      const result = manager.checkConditions(hook, context);
      expect(result.allMet).toBe(false);
    });

    it('should handle inverted conditions', () => {
      const hook = createTurnEventHook(3, [], {
        conditions: [
          { type: EventConditionType.ModelsRemaining, sideId: 'SideA', threshold: 10, invert: true },
        ],
      });

      const result = manager.checkConditions(hook, context);
      expect(result.allMet).toBe(true); // 5 < 10, so inverted is true
    });

    it('should check ModelAlive condition', () => {
      const hook = createTurnEventHook(3, [], {
        conditions: [
          { type: EventConditionType.ModelAlive, modelId: 'model-1' },
        ],
      });

      const result = manager.checkConditions(hook, context);
      expect(result.allMet).toBe(true);
    });

    it('should check ModelEliminated condition', () => {
      context.state.eliminatedModels.add('model-2');

      const hook = createTurnEventHook(3, [], {
        conditions: [
          { type: EventConditionType.ModelEliminated, modelId: 'model-2' },
        ],
      });

      const result = manager.checkConditions(hook, context);
      expect(result.allMet).toBe(true);
    });
  });

  describe('triggerHooks', () => {
    it('should trigger hooks when conditions are met', () => {
      const hook = createTurnEventHook(3, [
        { type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 5 },
      ]);
      manager.addHook(hook);

      context.currentTurn = 3;
      const results = manager.triggerHooks(EventTriggerType.OnTurn, context);

      expect(results.length).toBe(1);
      expect(results[0].triggered).toBe(true);
      expect(context.state.victoryPoints.get('SideA')).toBe(5);
      expect(hook.hasTriggered).toBe(true);
    });

    it('should not trigger hooks when conditions are not met', () => {
      const hook = createTurnEventHook(3, [], {
        conditions: [
          { type: EventConditionType.ModelsRemaining, sideId: 'SideA', threshold: 10 },
        ],
        effects: [{ type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 5 }],
      });
      manager.addHook(hook);

      context.currentTurn = 3;
      const results = manager.triggerHooks(EventTriggerType.OnTurn, context);

      expect(results.length).toBe(1);
      expect(results[0].triggered).toBe(false);
      expect(hook.hasTriggered).toBe(false);
    });

    it('should not re-trigger non-repeatable hooks', () => {
      const hook = createTurnEventHook(3, [
        { type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 5 },
      ], { repeatable: false });
      manager.addHook(hook);

      context.currentTurn = 3;
      manager.triggerHooks(EventTriggerType.OnTurn, context);

      // Reset VP
      context.state.victoryPoints.set('SideA', 0);

      // Try again
      manager.triggerHooks(EventTriggerType.OnTurn, context);

      expect(context.state.victoryPoints.get('SideA')).toBe(0); // Not awarded again
    });

    it('should re-trigger repeatable hooks', () => {
      const hook = createEndTurnEventHook([
        { type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 2 },
      ], { repeatable: true });
      manager.addHook(hook);

      manager.triggerHooks(EventTriggerType.TurnEnd, context);
      manager.triggerHooks(EventTriggerType.TurnEnd, context);

      expect(context.state.victoryPoints.get('SideA')).toBe(4);
    });
  });

  describe('checkImmediateConditions', () => {
    it('should detect victory condition', () => {
      // Victory when enemy has 0 models remaining
      const hook = createVictoryConditionHook(
        [{ type: EventConditionType.ModelsRemaining, sideId: 'SideB', threshold: 1, invert: true }],
        'SideA',
        { name: 'Elimination Victory' }
      );
      manager.addHook(hook);

      // SideB has 0 models
      context.state.modelsRemaining.set('SideB', 0);

      const result = manager.checkImmediateConditions(context);

      expect(result.winner).toBe('SideA');
      expect(result.reason).toBe('Elimination Victory');
    });
  });

  describe('reset', () => {
    it('should reset all hooks', () => {
      const hook = createTurnEventHook(3, []);
      hook.hasTriggered = true;
      manager.addHook(hook);

      manager.reset();

      expect(manager.getHook(hook.id)?.hasTriggered).toBe(false);
    });
  });

  describe('exportState / importState', () => {
    it('should export and import state', () => {
      const hook = createTurnEventHook(3, []);
      hook.hasTriggered = true;
      manager.addHook(hook);

      const exported = manager.exportState();
      const newManager = new MissionEventManager();
      newManager.importState(exported);

      expect(newManager.getHook(hook.id)?.hasTriggered).toBe(true);
    });
  });
});

describe('Event hook creation helpers', () => {
  describe('createTurnEventHook', () => {
    it('should create a turn-based event hook', () => {
      const hook = createTurnEventHook(5, [
        { type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 3 },
      ], {
        name: 'Turn 5 Bonus',
        priority: 10,
      });

      expect(hook.trigger).toBe(EventTriggerType.OnTurn);
      expect(hook.turnNumber).toBe(5);
      expect(hook.name).toBe('Turn 5 Bonus');
      expect(hook.priority).toBe(10);
    });
  });

  describe('createEndTurnEventHook', () => {
    it('should create an end-of-turn event hook', () => {
      const hook = createEndTurnEventHook([
        { type: EventEffectType.AwardVP, sideId: 'SideA', vpAmount: 1 },
      ], {
        name: 'Control VP',
        repeatable: true,
      });

      expect(hook.trigger).toBe(EventTriggerType.TurnEnd);
      expect(hook.name).toBe('Control VP');
      expect(hook.repeatable).toBe(true);
    });
  });

  describe('createVictoryConditionHook', () => {
    it('should create a victory condition hook', () => {
      const hook = createVictoryConditionHook(
        [{ type: EventConditionType.ZonesControlled, sideId: 'SideA', threshold: 3 }],
        'SideA',
        { name: 'Zone Control Victory', vpAward: 10 }
      );

      expect(hook.trigger).toBe(EventTriggerType.Immediate);
      expect(hook.priority).toBe(100);
      expect(hook.effects.length).toBe(2); // Victory + VP
      expect(hook.effects[0].type).toBe(EventEffectType.TriggerVictory);
      expect(hook.effects[1].type).toBe(EventEffectType.AwardVP);
    });
  });
});

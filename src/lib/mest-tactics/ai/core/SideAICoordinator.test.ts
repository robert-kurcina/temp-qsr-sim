import { describe, it, expect } from 'vitest';
import { SideAICoordinator, SideCoordinatorManager } from './SideAICoordinator';
import { TacticalDoctrine } from '../stratagems/AIStratagems';
import type { MissionVPConfig } from '../stratagems/PredictedScoringIntegration';

// Default mission config for tests (Elimination mission)
const DEFAULT_MISSION_CONFIG: MissionVPConfig = {
  totalVPPool: 5,
  hasRPToVPConversion: false,
  currentTurn: 3,
  maxTurns: 10,
};

describe('SideAICoordinator', () => {
  describe('construction', () => {
    it('should create coordinator with default doctrine', () => {
      const coordinator = new SideAICoordinator('Alpha');
      expect(coordinator.getSideId()).toBe('Alpha');
      expect(coordinator.getTacticalDoctrine()).toBe('operative');
    });

    it('should create coordinator with specified doctrine', () => {
      const coordinator = new SideAICoordinator('Bravo', TacticalDoctrine.Juggernaut);
      expect(coordinator.getTacticalDoctrine()).toBe('juggernaut');
    });
  });

  describe('scoring context', () => {
    it('should update and return scoring context', () => {
      const coordinator = new SideAICoordinator('Alpha');
      
      const myKeyScores = {
        elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 },
      };
      const opponentKeyScores = {
        elimination: { current: 0, predicted: 1, confidence: 0.5, leadMargin: 1 },
      };

      const context = coordinator.updateScoringContext(myKeyScores, opponentKeyScores, 1, DEFAULT_MISSION_CONFIG);

      expect(context).toBeDefined();
      expect(context.amILeading).toBe(true);
      expect(context.vpMargin).toBeGreaterThan(0);
      expect(coordinator.getScoringContext()).toBe(context);
    });

    it('should return null before context is set', () => {
      const coordinator = new SideAICoordinator('Alpha');
      expect(coordinator.getScoringContext()).toBeNull();
    });

    it('should detect stale context', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext({}, {}, 1, DEFAULT_MISSION_CONFIG);

      expect(coordinator.isContextStale(1)).toBe(false);
      expect(coordinator.isContextStale(2)).toBe(false);
      expect(coordinator.isContextStale(3)).toBe(true);
    });
  });

  describe('strategic advice', () => {
    it('should provide advice when leading', () => {
      const coordinator = new SideAICoordinator('Alpha');

      // totalVPPool=10, I have 7, opponent has 2, remaining = 3
      // Opponent needs 5 VP to catch up, but only 3 VP remaining = 167% deficit
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 7, confidence: 0.9, leadMargin: 5 } },
        { elimination: { current: 0, predicted: 2, confidence: 0.5, leadMargin: 1 } },
        1,
        missionConfig
      );

      const advice = coordinator.getStrategicAdvice();
      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('lead') || a.includes('defensive'))).toBe(true);
    });

    it('should provide advice when trailing', () => {
      const coordinator = new SideAICoordinator('Alpha');

      // totalVPPool=10, I have 0, opponent has 8, remaining = 2
      // I need 8 VP to catch up, but only 2 VP remaining = 400% deficit
      const missionConfig: MissionVPConfig = {
        ...DEFAULT_MISSION_CONFIG,
        totalVPPool: 10,
      };
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 0, confidence: 0, leadMargin: 0 } },
        { elimination: { current: 0, predicted: 8, confidence: 1, leadMargin: 8 } },
        1,
        missionConfig
      );

      const advice = coordinator.getStrategicAdvice();
      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some(a => a.includes('deficit') || a.includes('risk') || a.includes('aggressive'))).toBe(true);
    });

    it('should return message when no context available', () => {
      const coordinator = new SideAICoordinator('Alpha');
      const advice = coordinator.getStrategicAdvice();
      expect(advice).toContain('No scoring context available');
    });
  });

  describe('state management', () => {
    it('should reset state', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext({}, {}, 1, DEFAULT_MISSION_CONFIG);
      
      coordinator.reset();
      
      expect(coordinator.getScoringContext()).toBeNull();
      expect(coordinator.isContextStale(1)).toBe(true);
    });

    it('should export and import state', () => {
      const coordinator = new SideAICoordinator('Alpha', TacticalDoctrine.Sniper);
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } },
        {},
        3,
        DEFAULT_MISSION_CONFIG
      );

      const state = coordinator.exportState();

      const newCoordinator = new SideAICoordinator('Beta');
      newCoordinator.importState(state);

      expect(newCoordinator.getSideId()).toBe('Alpha');
      expect(newCoordinator.getTacticalDoctrine()).toBe('sniper');
      expect(newCoordinator.getScoringContext()).toBeDefined();
    });
  });
});

describe('SideCoordinatorManager', () => {
  describe('coordinator management', () => {
    it('should create coordinator on first access', () => {
      const manager = new SideCoordinatorManager();
      const coordinator = manager.getCoordinator('Alpha');
      expect(coordinator).toBeDefined();
      expect(coordinator.getSideId()).toBe('Alpha');
    });

    it('should return same coordinator on subsequent access', () => {
      const manager = new SideCoordinatorManager();
      const coord1 = manager.getCoordinator('Alpha');
      const coord2 = manager.getCoordinator('Alpha');
      expect(coord1).toBe(coord2);
    });

    it('should update doctrine on subsequent access with doctrine', () => {
      const manager = new SideCoordinatorManager();
      manager.getCoordinator('Alpha', TacticalDoctrine.Operative);
      const coordinator = manager.getCoordinator('Alpha', TacticalDoctrine.Juggernaut);
      expect(coordinator.getTacticalDoctrine()).toBe('juggernaut');
    });

    it('should remove coordinator', () => {
      const manager = new SideCoordinatorManager();
      manager.getCoordinator('Alpha');
      manager.removeCoordinator('Alpha');
      expect(manager.getAllCoordinators().length).toBe(0);
    });

    it('should clear all coordinators', () => {
      const manager = new SideCoordinatorManager();
      manager.getCoordinator('Alpha');
      manager.getCoordinator('Bravo');
      manager.clear();
      expect(manager.getAllCoordinators().length).toBe(0);
    });
  });

  describe('scoring context updates', () => {
    it('should update all coordinators', () => {
      const manager = new SideCoordinatorManager();
      manager.getCoordinator('Alpha');
      manager.getCoordinator('Bravo');

      const sideKeyScores = new Map([
        ['Alpha', { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } }],
        ['Bravo', { elimination: { current: 0, predicted: 1, confidence: 0.5, leadMargin: 1 } }],
      ]);

      manager.updateAllScoringContexts(sideKeyScores, 1, DEFAULT_MISSION_CONFIG);

      const alphaContext = manager.getCoordinator('Alpha').getScoringContext();
      const bravoContext = manager.getCoordinator('Bravo').getScoringContext();

      expect(alphaContext).toBeDefined();
      expect(bravoContext).toBeDefined();
      expect(alphaContext?.amILeading).toBe(true);
      expect(bravoContext?.amILeading).toBe(false);
    });

    it('should handle missing coordinators gracefully', () => {
      const manager = new SideCoordinatorManager();
      manager.getCoordinator('Alpha');

      const sideKeyScores = new Map([
        ['Alpha', { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } }],
        ['Bravo', { elimination: { current: 0, predicted: 1, confidence: 0.5, leadMargin: 1 } }],
      ]);

      // Should not throw
      expect(() => manager.updateAllScoringContexts(sideKeyScores, 1, DEFAULT_MISSION_CONFIG)).not.toThrow();
    });
  });
});

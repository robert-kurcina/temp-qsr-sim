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

    it('should maintain monotonic fractional potential ledger and track denial deltas', () => {
      const coordinator = new SideAICoordinator('Alpha');
      const context1 = coordinator.updateScoringContext(
        {
          elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 },
        },
        {
          elimination: { current: 0, predicted: 3, confidence: 0.9, leadMargin: 1 },
        },
        1,
        DEFAULT_MISSION_CONFIG
      );
      const ledger1 = context1.fractionalPotentialLedger;
      expect(ledger1).toBeDefined();

      const context2 = coordinator.updateScoringContext(
        {
          elimination: { current: 0, predicted: 1, confidence: 0.7, leadMargin: 1 },
        },
        {
          elimination: { current: 0, predicted: 1, confidence: 0.6, leadMargin: 1 },
        },
        2,
        DEFAULT_MISSION_CONFIG
      );
      const ledger2 = context2.fractionalPotentialLedger;
      expect(ledger2).toBeDefined();
      expect(ledger2!.myTotalPotential).toBeGreaterThanOrEqual(ledger1!.myTotalPotential);
      expect(ledger2!.opponentTotalPotential).toBeGreaterThanOrEqual(ledger1!.opponentTotalPotential);
      expect(ledger2!.myDeniedPotential).toBeGreaterThan(0);
      expect(ledger2!.opponentDeniedPotential).toBeGreaterThan(0);
    });

    it('should expose initiative signal for the current turn', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 0, confidence: 0.6, leadMargin: 0 } },
        { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } },
        3,
        DEFAULT_MISSION_CONFIG
      );

      const signal = coordinator.getInitiativeSignalForTurn(3);
      expect(signal.sideId).toBe('Alpha');
      expect(signal.turn).toBe(3);
      expect(signal.priority).toBe('recover_deficit');
      expect(signal.urgency).toBeGreaterThan(0);
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
      coordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 3, 1.0);
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 3, confidence: 0.85, leadMargin: 1 } },
        { elimination: { current: 0, predicted: 1, confidence: 0.4, leadMargin: 1 } },
        4,
        DEFAULT_MISSION_CONFIG
      );

      const state = coordinator.exportState();

      const newCoordinator = new SideAICoordinator('Beta');
      newCoordinator.importState(state);

      expect(newCoordinator.getSideId()).toBe('Alpha');
      expect(newCoordinator.getTacticalDoctrine()).toBe('sniper');
      expect(newCoordinator.getScoringContext()).toBeDefined();
      expect(newCoordinator.getTargetCommitments(3)['Enemy-1']).toBeDefined();
      expect(newCoordinator.getDecisionTrace().length).toBeGreaterThan(0);
    });
  });

  describe('coordinator decision trace instrumentation', () => {
    it('should record high-level observation/response trace per scoring update', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 2, 1.0, 'close_combat');
      coordinator.recordTargetCommitment('Enemy-2', 'Ally-2', 2, 1.0, 'ranged_combat');

      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 3, confidence: 0.9, leadMargin: 1 } },
        { elimination: { current: 0, predicted: 1, confidence: 0.5, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );

      const trace = coordinator.getDecisionTrace();
      expect(trace.length).toBe(1);
      expect(trace[0].turn).toBe(2);
      expect(trace[0].sideId).toBe('Alpha');
      expect(trace[0].response.priority).toBe('press_advantage');
      expect(trace[0].response.focusTargets).toContain('Enemy-1');
      expect(trace[0].observations.topTargetCommitments.length).toBeGreaterThan(0);
      expect(trace[0].observations.topScrumContinuity.length).toBeGreaterThan(0);
      expect(trace[0].observations.topLanePressure.length).toBeGreaterThan(0);
      expect(trace[0].observations.fractionalPotential).toBeDefined();
      expect(trace[0].observations.fractionalPotential?.myDeniedPotential).toBeDefined();
      expect(trace[0].observations.fractionalPotential?.opponentDeniedPotential).toBeDefined();
      expect(trace[0].response.potentialDirective).toBeDefined();
      expect(trace[0].response.pressureDirective).toBeDefined();
    });

    it('should clear decision trace on reset', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 1, confidence: 0.7, leadMargin: 1 } },
        {},
        1,
        DEFAULT_MISSION_CONFIG
      );
      expect(coordinator.getDecisionTrace().length).toBe(1);

      coordinator.reset();

      expect(coordinator.getDecisionTrace().length).toBe(0);
    });

    it('should replace same-turn decision trace entries instead of appending duplicates', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 1, confidence: 0.7, leadMargin: 1 } },
        { elimination: { current: 0, predicted: 4, confidence: 0.9, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 4, confidence: 0.9, leadMargin: 1 } },
        { elimination: { current: 0, predicted: 1, confidence: 0.6, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );

      const trace = coordinator.getDecisionTrace();
      expect(trace.length).toBe(1);
      expect(trace[0].turn).toBe(2);
      expect(trace[0].response.priority).toBe('press_advantage');
    });
  });

  describe('initiative spend policy', () => {
    it('recommends force spend for pushing momentum windows', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 0, confidence: 0.7, leadMargin: 0 } },
        { elimination: { current: 0, predicted: 2, confidence: 0.9, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );

      const decision = coordinator.recommendForceInitiativeSpend({
        currentTurn: 2,
        endGameTurn: 6,
        availableIp: 1,
        readyIndex: 1,
        scoreGain: 12,
        candidateNearestEnemyDistance: 6,
        candidateCanPush: true,
      });

      expect(decision.shouldSpend).toBe(true);
      expect(decision.reason).toContain('pushing_window');
    });

    it('recommends maintain spend for chain pushing momentum', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 0, confidence: 0.7, leadMargin: 0 } },
        { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );

      const decision = coordinator.recommendMaintainInitiativeSpend({
        currentTurn: 2,
        endGameTurn: 6,
        availableIp: 1,
        candidateOpportunity: true,
        candidateCanPush: true,
        actorGeneratedMomentum: true,
      });

      expect(decision.shouldSpend).toBe(true);
      expect(decision.reason).toContain('chain_pushing_momentum');
    });

    it('recommends refresh spend when it unlocks pushing momentum', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 0, confidence: 0.7, leadMargin: 0 } },
        { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );

      const decision = coordinator.recommendRefreshInitiativeSpend({
        currentTurn: 2,
        endGameTurn: 6,
        availableIp: 1,
        delayTokens: 1,
        apPerActivation: 2,
        hasMomentumOpportunity: true,
        canUnlockPushingMomentum: true,
        trailingOnScore: true,
      });

      expect(decision.shouldSpend).toBe(true);
      expect(decision.reason).toContain('unlock_pushing_momentum');
    });
  });

  describe('target commitments', () => {
    it('should record and decay target commitments by turn', () => {
      const coordinator = new SideAICoordinator('Alpha');

      coordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 1, 1.0);
      coordinator.recordTargetCommitment('Enemy-1', 'Ally-2', 1, 1.0);

      const sameTurn = coordinator.getTargetCommitments(1);
      expect(sameTurn['Enemy-1']).toBeCloseTo(2.2, 4);

      const nextTurn = coordinator.getTargetCommitments(2);
      expect(nextTurn['Enemy-1']).toBeCloseTo(1.65, 4);
    });

    it('should clear target commitment when requested', () => {
      const coordinator = new SideAICoordinator('Alpha');

      coordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 1, 1.0);
      coordinator.clearTargetCommitment('Enemy-1');

      expect(coordinator.getTargetCommitments(1)['Enemy-1']).toBeUndefined();
    });

    it('should clear target commitments on reset', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 1, 1.0);

      coordinator.reset();

      expect(coordinator.getTargetCommitments(1)).toEqual({});
    });

    it('should track scrum and lane continuity by action channel', () => {
      const coordinator = new SideAICoordinator('Alpha');
      coordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 1, 1.0, 'close_combat');
      coordinator.recordTargetCommitment('Enemy-1', 'Ally-2', 1, 1.0, 'charge');
      coordinator.recordTargetCommitment('Enemy-2', 'Ally-3', 1, 0.9, 'ranged_combat');

      const scrum = coordinator.getScrumContinuity(1);
      const lane = coordinator.getLanePressure(1);

      expect(scrum['Enemy-1']).toBeGreaterThan(0);
      expect(scrum['Enemy-2']).toBeUndefined();
      expect(lane['Enemy-2']).toBeGreaterThan(0);
      expect(lane['Enemy-1']).toBeUndefined();
    });

    it('should reward stable pressure topology and penalize topology breaks', () => {
      const stableCoordinator = new SideAICoordinator('Alpha');
      stableCoordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 1, 1.0, 'ranged_combat', 'lane|target=Enemy-1|angle=2');
      stableCoordinator.recordTargetCommitment('Enemy-1', 'Ally-2', 1, 1.0, 'ranged_combat', 'lane|target=Enemy-1|angle=2');
      stableCoordinator.recordTargetCommitment('Enemy-1', 'Ally-3', 1, 1.0, 'ranged_combat', 'lane|target=Enemy-1|angle=2');
      const stableScore = stableCoordinator.getLanePressure(1)['Enemy-1'];
      const stableDiag = stableCoordinator.getPressureContinuityDiagnostics();

      const brokenCoordinator = new SideAICoordinator('Alpha');
      brokenCoordinator.recordTargetCommitment('Enemy-1', 'Ally-1', 1, 1.0, 'ranged_combat', 'lane|target=Enemy-1|angle=2');
      brokenCoordinator.recordTargetCommitment('Enemy-1', 'Ally-2', 1, 1.0, 'ranged_combat', 'lane|target=Enemy-1|angle=2');
      brokenCoordinator.recordTargetCommitment('Enemy-1', 'Ally-3', 1, 1.0, 'ranged_combat', 'lane|target=Enemy-1|angle=6');
      const brokenScore = brokenCoordinator.getLanePressure(1)['Enemy-1'];
      const brokenDiag = brokenCoordinator.getPressureContinuityDiagnostics();

      expect(stableScore).toBeGreaterThan(brokenScore);
      expect(stableDiag.lane.breakRate).toBe(0);
      expect(brokenDiag.lane.breakRate).toBeGreaterThan(0);
      expect(brokenDiag.combined.signatureCoverageRate).toBeGreaterThan(0);
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

    it('should expose initiative signals for all coordinators', () => {
      const manager = new SideCoordinatorManager();
      manager.getCoordinator('Alpha');
      manager.getCoordinator('Bravo');
      manager.updateAllScoringContexts(new Map([
        ['Alpha', { elimination: { current: 0, predicted: 3, confidence: 0.9, leadMargin: 1 } }],
        ['Bravo', { elimination: { current: 0, predicted: 1, confidence: 0.7, leadMargin: 1 } }],
      ]), 2, DEFAULT_MISSION_CONFIG);

      const signals = manager.getInitiativeSignalsForTurn(2);
      expect(signals.Alpha).toBeDefined();
      expect(signals.Bravo).toBeDefined();
      expect(signals.Alpha.turn).toBe(2);
      expect(typeof signals.Alpha.priority).toBe('string');
    });

    it('should proxy initiative spend decisions to the side coordinator', () => {
      const manager = new SideCoordinatorManager();
      const coordinator = manager.getCoordinator('Alpha');
      coordinator.updateScoringContext(
        { elimination: { current: 0, predicted: 0, confidence: 0.6, leadMargin: 0 } },
        { elimination: { current: 0, predicted: 2, confidence: 0.8, leadMargin: 1 } },
        2,
        DEFAULT_MISSION_CONFIG
      );

      const decision = manager.recommendRefreshInitiativeSpend('Alpha', {
        currentTurn: 2,
        endGameTurn: 6,
        availableIp: 1,
        delayTokens: 1,
        apPerActivation: 2,
        hasMomentumOpportunity: true,
        canUnlockPushingMomentum: true,
        trailingOnScore: true,
      });

      expect(decision.shouldSpend).toBe(true);
      expect(decision.reason).toContain('unlock_pushing_momentum');
    });
  });
});

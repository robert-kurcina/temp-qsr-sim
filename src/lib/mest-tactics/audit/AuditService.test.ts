/**
 * AuditService Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditService, ModelStateAudit, AuditVector, ModelEffectAudit } from './AuditService';
import { Position } from '../battlefield/Position';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService();
    service.reset();
  });

  describe('initialization', () => {
    it('should initialize with battle configuration', () => {
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });

      const audit = service.getAudit();
      
      expect(audit.version).toBe('1.0');
      expect(audit.session.missionId).toBe('QAI_11');
      expect(audit.session.missionName).toBe('Elimination');
      expect(audit.session.seed).toBe(12345);
      expect(audit.session.visibilityOrMu).toBe(16);
      expect(audit.battlefield.widthMu).toBe(24);
      expect(audit.battlefield.heightMu).toBe(24);
      expect(audit.turns).toEqual([]);
    });

    it('should throw error when not initialized', () => {
      expect(() => service.startTurn(1)).toThrow('AuditService not initialized');
    });
  });

  describe('turn audit', () => {
    beforeEach(() => {
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
    });

    it('should start and end turn audit', () => {
      service.startTurn(1);
      service.endTurn([
        { sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 },
        { sideName: 'Side B', activeModelsStart: 4, activeModelsEnd: 3 },
      ]);

      const audit = service.getAudit();
      
      expect(audit.turns.length).toBe(1);
      expect(audit.turns[0].turn).toBe(1);
      expect(audit.turns[0].sideSummaries.length).toBe(2);
    });

    it('should track multiple turns', () => {
      service.startTurn(1);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 }]);
      
      service.startTurn(2);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 3 }]);
      
      service.startTurn(3);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 3, activeModelsEnd: 2 }]);

      const audit = service.getAudit();
      
      expect(audit.turns.length).toBe(3);
      expect(audit.turns.map(t => t.turn)).toEqual([1, 2, 3]);
    });

    it('should throw error when ending turn without starting', () => {
      expect(() => service.endTurn([])).toThrow('No active turn');
    });
  });

  describe('activation audit', () => {
    beforeEach(() => {
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
      service.startTurn(1);
    });

    it('should start and end activation audit', () => {
      service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: false,
        delayTokensAtStart: 0,
      });

      service.endActivation(0, false, false, 0);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 }]);

      const audit = service.getAudit();

      expect(audit.turns[0].activations.length).toBe(1);
      const activation = audit.turns[0].activations[0];
      expect(activation.modelId).toBe('char-001');
      expect(activation.modelName).toBe('AA-00');
      expect(activation.apStart).toBe(2);
      expect(activation.apEnd).toBe(0);
    });

    it('should track wait activation', () => {
      service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: true,
        delayTokensAtStart: 0,
      });

      service.endActivation(2, true, true, 0);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 }]);

      const audit = service.getAudit();
      const activation = audit.turns[0].activations[0];

      expect(activation.waitAtStart).toBe(true);
      expect(activation.waitMaintained).toBe(true);
      expect(activation.waitUpkeepPaid).toBe(true);
      expect(activation.apEnd).toBe(2); // Wait costs 0 AP if maintained
    });

    it('should throw error when starting activation without turn', () => {
      service.reset();
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
      
      expect(() => service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: false,
        delayTokensAtStart: 0,
      })).toThrow('No active turn');
    });
  });

  describe('action recording', () => {
    beforeEach(() => {
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
      service.startTurn(1);
      service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: false,
        delayTokensAtStart: 0,
      });
    });

    it('should record move action', () => {
      const positionBefore: Position = { x: 5, y: 5 };
      const positionAfter: Position = { x: 9, y: 5 };
      
      const moveVector: AuditVector = {
        kind: 'movement',
        from: positionBefore,
        to: positionAfter,
        distanceMu: 4,
      };

      const actorState: ModelStateAudit = {
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: false,
        isOrdered: false,
      };

      service.recordAction({
        actionType: 'move',
        decisionReason: 'Advance toward enemy',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 0,
        actorPositionBefore: positionBefore,
        actorPositionAfter: positionAfter,
        actorStateBefore: actorState,
        actorStateAfter: actorState,
        vectors: [moveVector],
        targets: [{
          modelId: 'char-001',
          modelName: 'AA-00',
          relation: 'self',
        }],
        affectedModels: [],
        interactions: [],
      });

      service.endActivation(0, false, false, 0);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 }]);

      const audit = service.getAudit();
      const activation = audit.turns[0].activations[0];
      
      expect(activation.steps.length).toBe(1);
      expect(activation.steps[0].actionType).toBe('move');
      expect(activation.steps[0].apSpent).toBe(2);
      expect(activation.steps[0].vectors[0].distanceMu).toBe(4);
    });

    it('should record attack action with opposed test', () => {
      const actorState: ModelStateAudit = {
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: false,
        isOrdered: false,
      };

      const targetEffect: ModelEffectAudit = {
        modelId: 'char-002',
        modelName: 'BA-00',
        side: 'Side B',
        relation: 'target',
        before: { ...actorState },
        after: { ...actorState, wounds: 1 },
        changed: ['wounds'],
      };

      service.recordAction({
        actionType: 'close_combat_attack',
        decisionReason: 'Attack nearest enemy',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 0,
        actorPositionBefore: { x: 5, y: 5 },
        actorPositionAfter: { x: 5, y: 5 },
        actorStateBefore: actorState,
        actorStateAfter: actorState,
        vectors: [],
        targets: [
          { modelId: 'char-001', modelName: 'AA-00', relation: 'self' },
          { modelId: 'char-002', modelName: 'BA-00', relation: 'enemy' },
        ],
        affectedModels: [targetEffect],
        interactions: [{
          kind: 'opposed_test',
          sourceModelId: 'char-001',
          targetModelId: 'char-002',
          success: true,
          detail: 'CCA vs CCA: 3 successes vs 1 success',
        }],
        opposedTest: {
          pass: true,
          score: 2,
          participant1Score: 3,
          participant2Score: 1,
          p1Rolls: [5, 6, 3],
          p2Rolls: [2, 1, 4],
        },
      });

      service.endActivation(0, false, false, 0);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 }]);

      const audit = service.getAudit();
      const activation = audit.turns[0].activations[0];
      const step = activation.steps[0];
      
      expect(step.actionType).toBe('close_combat_attack');
      expect(step.success).toBe(true);
      expect(step.opposedTest?.pass).toBe(true);
      expect(step.opposedTest?.participant1Score).toBe(3);
      expect(step.opposedTest?.participant2Score).toBe(1);
      expect(step.affectedModels[0].after.wounds).toBe(1);
    });

    it('should track action sequence numbers', () => {
      const actorState: ModelStateAudit = {
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: false,
        isOrdered: false,
      };

      // First action
      service.recordAction({
        actionType: 'move',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 1,
        actorPositionBefore: { x: 5, y: 5 },
        actorPositionAfter: { x: 7, y: 5 },
        actorStateBefore: actorState,
        actorStateAfter: actorState,
        vectors: [{ kind: 'movement', from: { x: 5, y: 5 }, to: { x: 7, y: 5 }, distanceMu: 2 }],
        targets: [{ modelId: 'char-001', modelName: 'AA-00', relation: 'self' }],
        affectedModels: [],
        interactions: [],
      });

      // Second action
      service.recordAction({
        actionType: 'close_combat_attack',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 1,
        apAfter: 0,
        actorPositionBefore: { x: 7, y: 5 },
        actorPositionAfter: { x: 7, y: 5 },
        actorStateBefore: actorState,
        actorStateAfter: actorState,
        vectors: [],
        targets: [
          { modelId: 'char-001', modelName: 'AA-00', relation: 'self' },
          { modelId: 'char-002', modelName: 'BA-00', relation: 'enemy' },
        ],
        affectedModels: [],
        interactions: [],
      });

      service.endActivation(0, false, false, 0);
      service.endTurn([{ sideName: 'Side A', activeModelsStart: 4, activeModelsEnd: 4 }]);

      const audit = service.getAudit();
      const activation = audit.turns[0].activations[0];
      
      expect(activation.steps.length).toBe(2);
      expect(activation.steps[0].sequence).toBe(1);
      expect(activation.steps[1].sequence).toBe(2);
    });
  });

  describe('frame generation', () => {
    beforeEach(() => {
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
      service.startTurn(1);
      service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: false,
        delayTokensAtStart: 0,
      });
    });

    it('should generate frames for actions', () => {
      const actorState: ModelStateAudit = {
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: false,
        isOrdered: false,
      };

      service.recordAction({
        actionType: 'move',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 0,
        actorPositionBefore: { x: 5, y: 5 },
        actorPositionAfter: { x: 9, y: 5 },
        actorStateBefore: actorState,
        actorStateAfter: actorState,
        vectors: [{ kind: 'movement', from: { x: 5, y: 5 }, to: { x: 9, y: 5 }, distanceMu: 4 }],
        targets: [{ modelId: 'char-001', modelName: 'AA-00', relation: 'self' }],
        affectedModels: [],
        interactions: [],
      });

      const frames = service.getFrames();
      
      expect(frames.length).toBe(1);
      expect(frames[0].frameIndex).toBe(1);
      expect(frames[0].turn).toBe(1);
      expect(frames[0].actionType).toBe('move');
      expect(frames[0].apSpent).toBe(2);
    });

    it('should generate action log entries', () => {
      const actorState: ModelStateAudit = {
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: false,
        isOrdered: false,
      };

      service.recordAction({
        actionType: 'move',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 0,
        actorPositionBefore: { x: 5, y: 5 },
        actorPositionAfter: { x: 9, y: 5 },
        actorStateBefore: actorState,
        actorStateAfter: actorState,
        vectors: [{ kind: 'movement', from: { x: 5, y: 5 }, to: { x: 9, y: 5 }, distanceMu: 4 }],
        targets: [{ modelId: 'char-001', modelName: 'AA-00', relation: 'self' }],
        affectedModels: [],
        interactions: [],
      });

      const frames = service.getFrames();
      
      expect(frames[0].actionLog).toContain('AA-00');
      expect(frames[0].actionLog).toContain('moved');
      expect(frames[0].actionLog).toContain('4');
    });

    it('should track model state changes in frames', () => {
      const beforeState: ModelStateAudit = {
        wounds: 0,
        delayTokens: 0,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: false,
        isWaiting: false,
        isAttentive: false,
        isOrdered: false,
      };

      const afterState: ModelStateAudit = {
        ...beforeState,
        wounds: 1,
      };

      const targetEffect: ModelEffectAudit = {
        modelId: 'char-002',
        modelName: 'BA-00',
        side: 'Side B',
        relation: 'target',
        before: beforeState,
        after: afterState,
        changed: ['wounds'],
      };

      service.recordAction({
        actionType: 'close_combat_attack',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 0,
        actorPositionBefore: { x: 5, y: 5 },
        actorPositionAfter: { x: 5, y: 5 },
        actorStateBefore: beforeState,
        actorStateAfter: beforeState,
        vectors: [],
        targets: [
          { modelId: 'char-001', modelName: 'AA-00', relation: 'self' },
          { modelId: 'char-002', modelName: 'BA-00', relation: 'enemy' },
        ],
        affectedModels: [targetEffect],
        interactions: [],
      });

      const frames = service.getFrames();
      const modelStates = frames[0].modelStates;
      
      expect(modelStates.length).toBe(2);
      const targetState = modelStates.find(m => m.modelId === 'char-002');
      expect(targetState?.state.wounds).toBe(1);
      expect(targetState?.tokens.find(t => t.type === 'wound')?.count).toBe(1);
    });
  });

  describe('model state capture', () => {
    it('should convert model state to tokens', () => {
      // This tests the private method indirectly through frame generation
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
      service.startTurn(1);
      service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: false,
        delayTokensAtStart: 0,
      });

      const woundedState: ModelStateAudit = {
        wounds: 2,
        delayTokens: 1,
        fearTokens: 0,
        isKOd: false,
        isEliminated: false,
        isHidden: true,
        isWaiting: true,
        isAttentive: false,
        isOrdered: false,
      };

      service.recordAction({
        actionType: 'wait',
        resultCode: 'SUCCESS',
        success: true,
        apBefore: 2,
        apAfter: 2,
        actorPositionBefore: { x: 5, y: 5 },
        actorPositionAfter: { x: 5, y: 5 },
        actorStateBefore: woundedState,
        actorStateAfter: woundedState,
        vectors: [],
        targets: [{ modelId: 'char-001', modelName: 'AA-00', relation: 'self' }],
        affectedModels: [],
        interactions: [],
      });

      const frames = service.getFrames();
      const tokens = frames[0].modelStates[0].tokens;
      
      expect(tokens.find(t => t.type === 'wound')?.count).toBe(2);
      expect(tokens.find(t => t.type === 'delay')?.count).toBe(1);
      expect(tokens.find(t => t.type === 'hidden')?.count).toBe(1);
      expect(tokens.find(t => t.type === 'wait')?.count).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset service to initial state', () => {
      service.initialize({
        missionId: 'QAI_11',
        missionName: 'Elimination',
        seed: 12345,
        lighting: 'Day, Clear',
        visibilityOrMu: 16,
        maxOrm: 3,
        allowConcentrateRangeExtension: true,
        perCharacterFovLos: false,
        battlefieldWidth: 24,
        battlefieldHeight: 24,
      });
      service.startTurn(1);
      service.startActivation({
        activationSequence: 1,
        turn: 1,
        sideIndex: 0,
        sideName: 'Side A',
        modelId: 'char-001',
        modelName: 'AA-00',
        initiative: 5,
        apStart: 2,
        waitAtStart: false,
        delayTokensAtStart: 0,
      });

      service.reset();

      expect(() => service.getAudit()).toThrow('AuditService not initialized');
      expect(service.getFrames()).toEqual([]);
    });
  });
});

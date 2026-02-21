import { describe, it, expect, beforeEach } from 'vitest';
import { createEliminationMission, EliminationMissionManager } from './elimination-manager';
import { buildOpposingSides } from '../MissionSideBuilder';
import { ModelSlotStatus } from '../MissionSide';

describe('Elimination Mission', () => {
  let manager: EliminationMissionManager;
  let sideA: ReturnType<typeof buildOpposingSides>['sideA'];
  let sideB: ReturnType<typeof buildOpposingSides>['sideB'];

  beforeEach(() => {
    const result = buildOpposingSides(
      'Side A',
      [{ archetypeName: 'Veteran', count: 2 }],
      'Side B',
      [{ archetypeName: 'Militia', count: 2 }]
    );
    sideA = result.sideA;
    sideB = result.sideB;

    manager = createEliminationMission([sideA, sideB]);
  });

  describe('createEliminationMission', () => {
    it('should create mission manager with sides', () => {
      expect(manager).toBeDefined();
      expect(manager.hasEnded()).toBe(false);
    });

    it('should initialize VP to 0', () => {
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should initialize eliminations to 0', () => {
      expect(manager.getEliminationCount(sideA.id)).toBe(0);
      expect(manager.getEliminationCount(sideB.id)).toBe(0);
    });
  });

  describe('processModelElimination', () => {
    it('should track elimination count', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);

      expect(manager.getEliminationCount(sideB.id)).toBe(1);
    });

    it('should award VP to eliminating side', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);

      expect(manager.getVictoryPoints(sideA.id)).toBe(1);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should not award VP for self-elimination', () => {
      manager.processModelElimination('model-1', sideB.id, sideB.id);

      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
      expect(manager.getVictoryPoints(sideB.id)).toBe(0);
    });

    it('should update side VP state', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);

      expect(sideA.state.victoryPoints).toBe(1);
    });

    it('should track multiple eliminations', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);
      manager.processModelElimination('model-2', sideB.id, sideA.id);

      expect(manager.getEliminationCount(sideB.id)).toBe(2);
      expect(manager.getVictoryPoints(sideA.id)).toBe(2);
    });
  });

  describe('checkForVictory', () => {
    it('should detect victory when all enemies eliminated', () => {
      // Eliminate all Side B models
      sideB.members.forEach(m => m.status = ModelSlotStatus.Eliminated);

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('All enemies eliminated');
    });

    it('should not end if any enemy remains', () => {
      // Eliminate only one Side B model
      sideB.members[0].status = ModelSlotStatus.Eliminated;

      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(false);
    });

    it('should handle multi-side elimination', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 1 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );
      const sideC = buildOpposingSides(
        'Side C',
        [{ archetypeName: 'Veteran', count: 1 }],
        'Side D',
        [{ archetypeName: 'Veteran', count: 1 }]
      ).sideA;

      const threeSideManager = createEliminationMission([result.sideA, result.sideB, sideC]);

      // Eliminate all Side C models
      sideC.members.forEach(m => m.status = ModelSlotStatus.Eliminated);
      threeSideManager.checkForVictory();

      // Should not end yet - Side A and B still have models
      expect(threeSideManager.hasEnded()).toBe(false);
    });
  });

  describe('endMission', () => {
    it('should end mission with winner', () => {
      manager.endMission(sideA.id, 'Test victory');

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(sideA.id);
      expect(manager.getEndReason()).toBe('Test victory');
    });

    it('should determine VP winner if no winner specified', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);
      manager.processModelElimination('model-2', sideB.id, sideA.id);

      manager.endMission(undefined, 'Turn limit');

      expect(manager.getWinner()).toBe(sideA.id);
    });

    it('should only consider active models for VP victory', () => {
      // Side A has more VP but is eliminated
      manager.processModelElimination('model-1', sideB.id, sideA.id);
      sideA.members.forEach(m => m.status = ModelSlotStatus.Eliminated);

      manager.endMission(undefined, 'Turn limit');

      // Side B should win by default (only active side)
      expect(manager.getWinner()).toBe(sideB.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);
      manager.processModelElimination('model-2', sideB.id, sideA.id);
      manager.processModelElimination('model-3', sideA.id, sideB.id);

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      expect(standings[0].sideId).toBe(sideA.id);
      expect(standings[0].vp).toBe(2);
      expect(standings[1].sideId).toBe(sideB.id);
      expect(standings[1].vp).toBe(1);
    });

    it('should include elimination counts', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);
      manager.processModelElimination('model-2', sideB.id, sideA.id);

      const standings = manager.getVPStandings();

      // Side A has 2 VP from eliminating Side B models
      expect(standings.find(s => s.sideId === sideA.id)?.eliminations).toBe(0); // Side A wasn't eliminated
      // Side B has 2 eliminations (their models were eliminated)
      expect(standings.find(s => s.sideId === sideB.id)?.eliminations).toBe(2);
    });
  });

  describe('getState', () => {
    it('should return complete mission state', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id);

      const state = manager.getState();

      expect(state.sideIds).toContain(sideA.id);
      expect(state.sideIds).toContain(sideB.id);
      expect(state.ended).toBe(false);
      expect(state.winner).toBeUndefined();
    });
  });
});

describe('Elimination Mission - Edge Cases', () => {
  describe('Tie conditions', () => {
    it('should handle tie VP at end game', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 1 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );
      const manager = createEliminationMission([result.sideA, result.sideB]);

      // Both sides eliminate each other simultaneously (not possible in real game, but test edge case)
      result.sideA.members.forEach(m => m.status = ModelSlotStatus.Eliminated);
      result.sideB.members.forEach(m => m.status = ModelSlotStatus.Eliminated);

      manager.endMission(undefined, 'Mutual destruction');

      // No winner when all eliminated
      expect(manager.getWinner()).toBeUndefined();
    });
  });

  describe('Single model scenarios', () => {
    it('should handle last model standing', () => {
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 1 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 1 }]
      );
      const manager = createEliminationMission([result.sideA, result.sideB]);

      result.sideB.members[0].status = ModelSlotStatus.Eliminated;
      manager.checkForVictory();

      expect(manager.hasEnded()).toBe(true);
      expect(manager.getWinner()).toBe(result.sideA.id);
    });
  });
});

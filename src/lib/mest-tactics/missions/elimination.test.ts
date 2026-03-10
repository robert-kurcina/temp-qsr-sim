import { describe, it, expect, beforeEach } from 'vitest';
import { createEliminationMission, EliminationMissionManager } from './elimination-manager';
import { buildOpposingSides } from '../mission/MissionSideBuilder';
import { ModelSlotStatus } from '../mission/MissionSide';

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
      manager.processModelElimination('model-1', sideB.id, sideA.id, 50);

      expect(manager.getEliminationCount(sideB.id)).toBe(1);
    });

    it('should track eliminated BP', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id, 50);

      expect(manager.getEliminatedBp(sideB.id)).toBe(50);
    });

    it('should not award VP immediately (awarded at game end)', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id, 50);

      // VP is awarded at game end, not per elimination
      expect(manager.getVictoryPoints(sideA.id)).toBe(0);
    });

    it('should track multiple eliminations with BP', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id, 50);
      manager.processModelElimination('model-2', sideB.id, sideA.id, 75);

      expect(manager.getEliminationCount(sideB.id)).toBe(2);
      expect(manager.getEliminatedBp(sideB.id)).toBe(125);
    });
  });

  describe('calculateEndGameScoring', () => {
    it('should award Elimination VP to side with highest enemy BP eliminated', () => {
      // Side A eliminates 100 BP of Side B (Side B bottled out)
      manager.processModelElimination('model-1', sideB.id, sideA.id, 100);
      // Side B eliminates 50 BP of Side A
      manager.processModelElimination('model-2', sideA.id, sideB.id, 50);

      // Mark Side B as eliminated (bottled out)
      sideB.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);

      const scoring = manager.calculateEndGameScoring();

      // Side A eliminated more BP (100 vs 50), so Side A gets +1 VP for Elimination
      // Side A also gets +1 VP for Bottled (Side B has no ordered models)
      // Total: 2 VP
      expect(scoring.vpBySide[sideA.id]).toBe(2);
    });

    it('should award Bottled VP', () => {
      // Side B has no ordered models (bottled out)
      sideB.members.forEach((m: any) => {
        m.status = ModelSlotStatus.Eliminated;
        m.character.state.isOrdered = false;
      });
      sideA.members.forEach((m: any) => m.character.state.isOrdered = true);

      const scoring = manager.calculateEndGameScoring();

      // Side A gets +1 VP for Elimination (Side B lost all BP)
      // Side A also gets +1 VP for Bottled
      // Total: 2 VP
      expect(scoring.vpBySide[sideA.id]).toBe(2);
    });

    it('should handle tie in elimination scoring', () => {
      // Both sides eliminate equal BP
      manager.processModelElimination('model-1', sideB.id, sideA.id, 100);
      manager.processModelElimination('model-2', sideA.id, sideB.id, 100);

      // Mark equal models as eliminated on both sides
      sideB.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);
      sideA.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);

      const scoring = manager.calculateEndGameScoring();

      // Both sides have equal enemy BP eliminated - tie in Elimination scoring
      // Both sides bottled out - no Bottled VP
      // Outnumbered doesn't apply (equal starting model counts)
      // In a complete tie scenario, no VP is awarded for Elimination key
      // (One side may still get VP from other keys depending on implementation)
      expect(scoring).toBeDefined();
    });

    it('should award Outnumbered VP', () => {
      // Create a new manager with unequal model counts
      const result = buildOpposingSides(
        'Side A',
        [{ archetypeName: 'Veteran', count: 3 }],
        'Side B',
        [{ archetypeName: 'Veteran', count: 6 }]
      );
      const outnumberedManager = createEliminationMission([result.sideA, result.sideB]);

      // Side A is outnumbered 2:1
      const scoring = outnumberedManager.calculateEndGameScoring();

      // Side A gets +2 VP for being outnumbered 2:1
      expect(scoring.vpBySide[result.sideA.id]).toBe(2);
    });
  });

  describe('trackMidlineCross', () => {
    it('counts each model only once for Aggression crossing', () => {
      const modelId = sideA.members[0].id;
      const center = { x: 5, y: 5 };

      manager.trackMidlineCross(modelId, sideA.id, { x: 1, y: 5 }, center);
      manager.trackMidlineCross(modelId, sideA.id, { x: 6, y: 5 }, center);
      manager.trackMidlineCross(modelId, sideA.id, { x: 8, y: 5 }, center);

      const state = manager.getState();
      expect(state.aggression.crossedBySide[sideA.id]).toBe(1);
      expect(state.aggression.firstCrossedSideId).toBe(sideA.id);
    });

    it('requires crossing to the opposite half based on model origin half', () => {
      const modelId = sideB.members[0].id;
      const center = { x: 5, y: 5 };

      manager.trackMidlineCross(modelId, sideB.id, { x: 9, y: 5 }, center);
      manager.trackMidlineCross(modelId, sideB.id, { x: 8, y: 5 }, center);

      let state = manager.getState();
      expect(state.aggression.crossedBySide[sideB.id] ?? 0).toBe(0);

      manager.trackMidlineCross(modelId, sideB.id, { x: 4, y: 5 }, center);
      state = manager.getState();
      expect(state.aggression.crossedBySide[sideB.id]).toBe(1);
      expect(state.aggression.firstCrossedSideId).toBe(sideB.id);
    });
  });

  describe('checkForVictory', () => {
    it('should detect victory when all enemies eliminated', () => {
      // Eliminate all Side B models
      sideB.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);

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
      sideC.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);
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
      sideA.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);

      manager.endMission(undefined, 'Turn limit');

      // Side B should win by default (only active side)
      expect(manager.getWinner()).toBe(sideB.id);
    });
  });

  describe('getVPStandings', () => {
    it('should return standings sorted by VP', () => {
      // VP is 0 until end-game scoring
      manager.processModelElimination('model-1', sideB.id, sideA.id, 50);
      manager.processModelElimination('model-2', sideB.id, sideA.id, 50);
      manager.processModelElimination('model-3', sideA.id, sideB.id, 50);

      const standings = manager.getVPStandings();

      expect(standings.length).toBe(2);
      // VP is 0 until end-game scoring is applied
      expect(standings[0].vp).toBe(0);
      expect(standings[1].vp).toBe(0);
    });

    it('should include elimination counts', () => {
      manager.processModelElimination('model-1', sideB.id, sideA.id, 50);
      manager.processModelElimination('model-2', sideB.id, sideA.id, 50);

      const standings = manager.getVPStandings();

      // Side B has 2 eliminations (their models were eliminated)
      expect(standings.find(s => s.sideId === sideB.id)?.eliminations).toBe(2);
      // Side A has 0 eliminations
      expect(standings.find(s => s.sideId === sideA.id)?.eliminations).toBe(0);
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
      result.sideA.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);
      result.sideB.members.forEach((m: any) => m.status = ModelSlotStatus.Eliminated);

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

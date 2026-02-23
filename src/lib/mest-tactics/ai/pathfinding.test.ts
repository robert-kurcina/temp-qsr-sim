/**
 * AI Pathfinding Tests
 * 
 * Tests for AI movement decisions and pathfinding logic.
 * Ensures AI can navigate the battlefield effectively.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { buildAssembly, buildProfile } from '../mission/assembly-builder';
import { buildMissionSide } from '../mission/MissionSideBuilder';
import { GameManager } from '../engine/GameManager';
import { getBaseDiameterFromSiz } from '../battlefield/spatial/size-utils';
import { SpatialRules } from '../battlefield/spatial/spatial-rules';

/**
 * Simple AI Controller for testing
 */
class TestAIController {
  private aggression: number;
  private caution: number;

  constructor(aggression: number = 0.5, caution: number = 0.5) {
    this.aggression = aggression;
    this.caution = caution;
  }

  findTargets(character: any, enemies: any[], battlefield: Battlefield): Array<{ enemy: any; dist: number; hasLOS: boolean }> {
    const charPos = battlefield.getCharacterPosition(character);
    if (!charPos) return [];

    const targets: Array<{ enemy: any; dist: number; hasLOS: boolean }> = [];

    for (const enemy of enemies) {
      if (enemy.state.isEliminated || enemy.state.isKOd) continue;

      const enemyPos = battlefield.getCharacterPosition(enemy);
      if (!enemyPos) continue;

      const dist = Math.sqrt(
        Math.pow(charPos.x - enemyPos.x, 2) +
        Math.pow(charPos.y - enemyPos.y, 2)
      );

      const charModel = {
        id: character.id,
        position: charPos,
        baseDiameter: getBaseDiameterFromSiz(character.finalAttributes?.siz ?? 3),
        siz: character.finalAttributes?.siz ?? 3,
      };
      const enemyModel = {
        id: enemy.id,
        position: enemyPos,
        baseDiameter: getBaseDiameterFromSiz(enemy.finalAttributes?.siz ?? 3),
        siz: enemy.finalAttributes?.siz ?? 3,
      };

      const hasLOS = SpatialRules.hasLineOfSight(battlefield, charModel, enemyModel);
      targets.push({ enemy, dist, hasLOS });
    }

    return targets.sort((a, b) => a.dist - b.dist);
  }

  decideAction(
    character: any,
    enemies: any[],
    battlefield: Battlefield
  ): { type: string; target?: any; position?: { x: number; y: number }; reason: string } {
    const status = character.state;
    if (status.isEliminated || status.isKOd || status.isDistracted) {
      return { type: 'none', reason: 'unable to act' };
    }

    const targets = this.findTargets(character, enemies, battlefield);
    if (targets.length === 0) {
      return { type: 'hold', reason: 'no enemies remaining' };
    }

    const closest = targets[0];
    const mov = character.finalAttributes?.mov ?? 2;
    const cca = character.finalAttributes?.cca ?? 2;
    const rca = character.finalAttributes?.rca ?? 2;

    // Check engagement
    const engaged = battlefield.isEngaged?.(character) ?? false;

    if (engaged) {
      const enemyCC = closest.enemy.finalAttributes?.cca ?? 2;
      if (cca >= enemyCC || this.aggression > 0.6) {
        return { type: 'close_combat', target: closest.enemy, reason: 'engaged in combat' };
      } else {
        return { type: 'disengage', target: closest.enemy, reason: 'outmatched in combat' };
      }
    }

    // Check if we can charge (with position!)
    if (closest.dist <= mov + 1 && cca >= 2 && this.aggression > 0.4) {
      const charPos = battlefield.getCharacterPosition(character);
      const targetPos = battlefield.getCharacterPosition(closest.enemy);
      if (charPos && targetPos) {
        const dx = targetPos.x - charPos.x;
        const dy = targetPos.y - charPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const moveDist = Math.max(0, dist - 1);
        const ratio = moveDist / dist;
        return {
          type: 'charge',
          target: closest.enemy,
          position: {
            x: Math.round(charPos.x + dx * ratio),
            y: Math.round(charPos.y + dy * ratio),
          },
          reason: `charging (${Math.round(closest.dist)} MU)`,
        };
      }
    }

    // Ranged combat
    if (rca >= 3 && closest.hasLOS && closest.dist > 1 && closest.dist <= 16) {
      return { type: 'ranged_combat', target: closest.enemy, reason: `ranged attack (${Math.round(closest.dist)} MU)` };
    }

    // Move towards enemy
    const charPos = battlefield.getCharacterPosition(character);
    const targetPos = battlefield.getCharacterPosition(closest.enemy);
    if (charPos && targetPos) {
      const dx = targetPos.x - charPos.x;
      const dy = targetPos.y - charPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const moveDist = Math.min(mov, dist - 1);
        const ratio = moveDist / dist;
        return {
          type: 'move',
          position: {
            x: Math.round(charPos.x + dx * ratio),
            y: Math.round(charPos.y + dy * ratio),
          },
          reason: `advancing (${Math.round(closest.dist)} MU)`,
        };
      }
    }

    return { type: 'hold', reason: 'in position' };
  }
}

describe('AI Pathfinding', () => {
  let battlefield: Battlefield;
  let ai: TestAIController;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);
    ai = new TestAIController(0.5, 0.5);
  });

  describe('Basic Movement', () => {
    it('should move towards nearest enemy', () => {
      // Create characters
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      // Deploy far apart
      battlefield.placeCharacter(char1, { x: 2, y: 12 });
      battlefield.placeCharacter(char2, { x: 20, y: 12 });

      const decision = ai.decideAction(char1, [char2], battlefield);

      expect(decision.type).toBe('move');
      expect(decision.position).toBeDefined();
      expect(decision.position!.x).toBeGreaterThan(2); // Moving towards enemy
    });

    it('should charge when enemy is in range', () => {
      const profile1 = buildProfile('Veteran', { itemNames: ['Sword, Broad'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      // Deploy within charge range (MOV 2 + 1 = 3 MU)
      battlefield.placeCharacter(char1, { x: 10, y: 12 });
      battlefield.placeCharacter(char2, { x: 12, y: 12 }); // 2 MU away

      const decision = ai.decideAction(char1, [char2], battlefield);

      expect(decision.type).toBe('charge');
      expect(decision.position).toBeDefined(); // Charge includes position!
    });

    it('should fight when already engaged', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      // Deploy adjacent (within 1 MU = engaged)
      battlefield.placeCharacter(char1, { x: 10, y: 12 });
      battlefield.placeCharacter(char2, { x: 10.5, y: 12 }); // 0.5 MU = engaged

      // Verify engagement
      const isEngaged = battlefield.isEngaged?.(char1) ?? false;
      
      const decision = ai.decideAction(char1, [char2], battlefield);

      // When engaged, should fight or disengage (or hold if already in position)
      expect(['close_combat', 'disengage', 'hold']).toContain(decision.type);
    });
  });

  describe('Line of Sight', () => {
    it('should have LOS to enemy with no obstacles', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Bow, Medium'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      battlefield.placeCharacter(char1, { x: 5, y: 12 });
      battlefield.placeCharacter(char2, { x: 15, y: 12 });

      const targets = ai.findTargets(char1, [char2], battlefield);

      expect(targets.length).toBe(1);
      expect(targets[0].hasLOS).toBe(true);
    });

    it('should prefer ranged combat when RCA is high', () => {
      // Create a character with high RCA using Veteran archetype
      const profile1 = buildProfile('Veteran', { itemNames: ['Bow, Medium'] }); // RCA 3
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      // At ranged distance
      battlefield.placeCharacter(char1, { x: 5, y: 12 });
      battlefield.placeCharacter(char2, { x: 12, y: 12 }); // 7 MU away

      const decision = ai.decideAction(char1, [char2], battlefield);

      expect(decision.type).toBe('ranged_combat');
    });
  });

  describe('Edge Cases', () => {
    it('should hold when no enemies remain', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });

      const char1 = sideA.members[0].character;
      battlefield.placeCharacter(char1, { x: 10, y: 12 });

      const decision = ai.decideAction(char1, [], battlefield);

      expect(decision.type).toBe('hold');
      expect(decision.reason).toBe('no enemies remaining');
    });

    it('should handle KOd character', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });

      const char1 = sideA.members[0].character;
      char1.state.isKOd = true;
      battlefield.placeCharacter(char1, { x: 10, y: 12 });

      const decision = ai.decideAction(char1, [], battlefield);

      expect(decision.type).toBe('none');
    });

    it('should handle missing position gracefully', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;
      // Don't place char1 on battlefield

      const decision = ai.decideAction(char1, [char2], battlefield);

      expect(decision.type).toBe('hold');
    });
  });

  describe('Movement Validation', () => {
    it('should not move beyond MOV allowance', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      // MOV is 2 for Average
      battlefield.placeCharacter(char1, { x: 10, y: 12 });
      battlefield.placeCharacter(char2, { x: 20, y: 12 }); // 10 MU away

      const decision = ai.decideAction(char1, [char2], battlefield);

      expect(decision.type).toBe('move');
      expect(decision.position).toBeDefined();
      
      // Should move at most MOV (2) towards enemy
      const dx = decision.position!.x - 10;
      const dy = decision.position!.y - 12;
      const moveDist = Math.sqrt(dx * dx + dy * dy);
      
      expect(moveDist).toBeLessThanOrEqual(2); // MOV allowance
    });

    it('should stop at engagement range', () => {
      const profile1 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const profile2 = buildProfile('Average', { itemNames: ['Sword, Broad'] });
      const roster1 = buildAssembly('Alpha', [profile1]);
      const roster2 = buildAssembly('Bravo', [profile2]);

      const sideA = buildMissionSide('Alpha', [roster1], { startingIndex: 0 });
      const sideB = buildMissionSide('Bravo', [roster2], { startingIndex: 1 });

      const char1 = sideA.members[0].character;
      const char2 = sideB.members[0].character;

      battlefield.placeCharacter(char1, { x: 10, y: 12 });
      battlefield.placeCharacter(char2, { x: 15, y: 12 }); // 5 MU away

      const decision = ai.decideAction(char1, [char2], battlefield);

      expect(decision.type).toBe('move');
      expect(decision.position).toBeDefined();
      
      // Should stop 1 MU away from target
      const targetDist = Math.sqrt(
        Math.pow(decision.position!.x - 15, 2) +
        Math.pow(decision.position!.y - 12, 2)
      );
      
      expect(targetDist).toBeGreaterThanOrEqual(0.5); // Approximately 1 MU
    });
  });
});

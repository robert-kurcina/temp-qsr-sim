/**
 * Hidden at Initiative Start Tests (QSR Line 849)
 *
 * QSR 849.1: "If the Active model is without Cover at the start of its Initiative,
 *             it loses its Hidden status."
 * QSR 849.2: "Allow it to reposition."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { checkHiddenAtInitiativeStart } from './concealment';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: {
      name: 'Average',
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp: 30,
    },
    items: [],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string): Character {
  const character = new Character(makeTestProfile(name));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Hidden at Initiative Start (QSR Line 849)', () => {
  let battlefield: Battlefield;
  let activeModel: Character;
  let opponent: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    activeModel = makeTestCharacter('Active');
    opponent = makeTestCharacter('Opponent');

    battlefield.placeCharacter(activeModel, { x: 10, y: 12 });
    battlefield.placeCharacter(opponent, { x: 16, y: 12 });

    activeModel.state.isHidden = true;
  });

  describe('Lose Hidden When Without Cover (QSR 849.1)', () => {
    it('should lose Hidden if without Cover at Initiative start (QSR 849.1)', () => {
      // Setup: Hidden Active model with no Cover from opponent
      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should lose Hidden
      expect(result.mustReveal).toBe(true);
      expect(activeModel.state.isHidden).toBe(false);
      expect(result.reason).toContain('Initiative start');
    });

    it('should NOT lose Hidden if has Cover at Initiative start (QSR 849.1)', () => {
      // Setup: Add terrain providing Cover
      battlefield.addTerrain({
        id: 'wall1',
        type: 'Obstacle',
        vertices: [
          { x: 12.5, y: 11.5 },
          { x: 13.5, y: 11.5 },
          { x: 13.5, y: 12.5 },
          { x: 12.5, y: 12.5 },
        ],
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (has Cover)
      expect(result.mustReveal).toBe(false);
      expect(activeModel.state.isHidden).toBe(true);
      expect(result.reason).toBe('Still in Cover');
    });

    it('should NOT lose Hidden if no LOS to opponent (QSR 849.1)', () => {
      // Setup: Add terrain blocking LOS
      battlefield.addTerrain({
        id: 'wall2',
        type: 'Obstacle',
        vertices: [
          { x: 12.5, y: 11.5 },
          { x: 13.5, y: 11.5 },
          { x: 13.5, y: 12.5 },
          { x: 12.5, y: 12.5 },
        ],
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (no LOS)
      expect(result.mustReveal).toBe(false);
      expect(activeModel.state.isHidden).toBe(true);
    });

    it('should NOT lose Hidden if opponent is Hidden (QSR 849.1)', () => {
      // Setup: Opponent is also Hidden
      opponent.state.isHidden = true;

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (opponent Hidden)
      expect(result.mustReveal).toBe(false);
      expect(activeModel.state.isHidden).toBe(true);
    });

    it('should NOT lose Hidden if opponent is KOd (QSR 849.1)', () => {
      // Setup: Opponent is KO'd
      opponent.state.isKOd = true;

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (opponent KO'd)
      expect(result.mustReveal).toBe(false);
      expect(activeModel.state.isHidden).toBe(true);
    });

    it('should NOT lose Hidden if opponent is Eliminated (QSR 849.1)', () => {
      // Setup: Opponent is Eliminated
      opponent.state.isEliminated = true;

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (opponent Eliminated)
      expect(result.mustReveal).toBe(false);
      expect(activeModel.state.isHidden).toBe(true);
    });

    it('should NOT lose Hidden if character is not Hidden (QSR 849.1)', () => {
      // Setup: Character not Hidden
      activeModel.state.isHidden = false;

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (already not Hidden)
      expect(result.mustReveal).toBe(false);
      expect(result.reason).toBe('Not Hidden');
    });

    it('should handle multiple opponents - lose Hidden if exposed to any (QSR 849.1)', () => {
      // Setup: Add second opponent with LOS
      const opponent2 = makeTestCharacter('Opponent2');
      battlefield.placeCharacter(opponent2, { x: 10, y: 18 }); // Different angle, no Cover

      // Add Cover from first opponent but not second
      battlefield.addTerrain({
        id: 'wall3',
        type: 'Obstacle',
        vertices: [
          { x: 12.5, y: 11.5 },
          { x: 13.5, y: 11.5 },
          { x: 13.5, y: 12.5 },
          { x: 12.5, y: 12.5 },
        ],
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent, opponent2], {
        allowReposition: false,
      });

      // Should lose Hidden (exposed to opponent2)
      expect(result.mustReveal).toBe(true);
      expect(activeModel.state.isHidden).toBe(false);
    });
  });

  describe('Reposition Option (QSR 849.2)', () => {
    it('should allow reposition when losing Hidden at Initiative start (QSR 849.2)', () => {
      // Setup: Mock reposition function
      const mockReposition = () => ({
        position: { x: 8, y: 12 },
        reason: 'Move to Cover',
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: true,
        revealReposition: mockReposition,
      });

      // Should allow reposition
      expect(result.mustReveal).toBe(true);
      expect(result.canReposition).toBe(true);
      expect(result.repositioned).toBe(true);
      expect(result.position).toEqual({ x: 8, y: 12 });
    });

    it('should not reposition if allowReposition is false (QSR 849.2)', () => {
      const mockReposition = () => ({
        position: { x: 8, y: 12 },
        reason: 'Move to Cover',
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: false,
        revealReposition: mockReposition,
      });

      // Should NOT reposition
      expect(result.mustReveal).toBe(true);
      expect(result.canReposition).toBe(false);
      expect(result.repositioned).toBeUndefined();
    });

    it('should handle reposition failure gracefully (QSR 849.2)', () => {
      // Setup: Mock reposition function that returns null (no valid position)
      const mockReposition = () => null;

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: true,
        revealReposition: mockReposition,
      });

      // Should still lose Hidden, but not reposition
      expect(result.mustReveal).toBe(true);
      expect(result.canReposition).toBe(true);
      expect(result.repositioned).toBeUndefined();
      expect(result.reason).toContain('Initiative start');
    });

    it('should handle reposition that fails to move (QSR 849.2)', () => {
      // Setup: Mock reposition function that returns position but move fails
      const mockReposition = () => ({
        position: { x: 100, y: 100 }, // Off battlefield
        reason: 'Invalid position',
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: true,
        revealReposition: mockReposition,
      });

      // Should still lose Hidden, but reposition failed (undefined = not repositioned)
      expect(result.mustReveal).toBe(true);
      expect(result.canReposition).toBe(true);
      // repositioned is undefined when move fails (not explicitly set to false)
      expect(result.repositioned).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle character with no position', () => {
      // Setup: Character not placed on battlefield
      const unplacedCharacter = makeTestCharacter('Unplaced');
      unplacedCharacter.state.isHidden = true;

      const result = checkHiddenAtInitiativeStart(battlefield, unplacedCharacter, [opponent], {
        allowReposition: false,
      });

      // Should handle gracefully
      expect(result.mustReveal).toBe(false);
      expect(result.canReposition).toBe(false);
      expect(result.reason).toBe('No position');
    });

    it('should handle empty opponents list', () => {
      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [], {
        allowReposition: false,
      });

      // Should NOT lose Hidden (no opponents to expose)
      expect(result.mustReveal).toBe(false);
      expect(activeModel.state.isHidden).toBe(true);
      expect(result.reason).toBe('Still in Cover');
    });

    it('should handle character with MOV 0 (can still reposition 0 MU)', () => {
      activeModel.finalAttributes.mov = 0;

      const mockReposition = () => ({
        position: { x: 10, y: 12 }, // Same position
        reason: 'No movement possible',
      });

      const result = checkHiddenAtInitiativeStart(battlefield, activeModel, [opponent], {
        allowReposition: true,
        revealReposition: mockReposition,
      });

      // Should still lose Hidden
      expect(result.mustReveal).toBe(true);
      expect(result.canReposition).toBe(true);
    });
  });
});

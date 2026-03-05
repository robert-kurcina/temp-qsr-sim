/**
 * Hidden Status Effects Tests (QSR Lines 847.1-847.4)
 *
 * QSR 847.1: "When Hidden; Visibility and Cohesion distance are halved unless not within Opposing LOS"
 * QSR 847.3: "When Hidden; all Terrain is degraded except for that crossed using Agility"
 * QSR 847.4: "Ignore this rule if the entire path of movement is out of LOS from all Revealed Opposing models"
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { getHiddenEffects } from './concealment';

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

describe('Hidden Status Effects (QSR Lines 847.1-847.4)', () => {
  let battlefield: Battlefield;
  let hiddenCharacter: Character;
  let opponent: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    hiddenCharacter = makeTestCharacter('Hider');
    opponent = makeTestCharacter('Opponent');

    battlefield.placeCharacter(hiddenCharacter, { x: 10, y: 12 });
    battlefield.placeCharacter(opponent, { x: 16, y: 12 });

    hiddenCharacter.state.isHidden = true;
  });

  describe('Visibility and Cohesion Halving (QSR 847.1)', () => {
    it('should halve Visibility when Hidden and in Opposing LOS (QSR 847.1)', () => {
      // Setup: Hidden character with LOS to opponent (no Cover)
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
      });

      // Visibility should be halved (16 / 2 = 8)
      expect(result.effectiveVisibility).toBe(8);
      expect(result.reason).toContain('in Opposing LOS');
    });

    it('should NOT halve Visibility when Hidden but not in Opposing LOS (QSR 847.1)', () => {
      // Setup: Add terrain blocking LOS
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

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
      });

      // Visibility should NOT be halved (no LOS)
      expect(result.effectiveVisibility).toBe(16);
      expect(result.reason).toContain('Not in Opposing LOS');
    });

    it('should halve Cohesion when Hidden and in Opposing LOS (QSR 847.1)', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        cohesionBase: 8,
      });

      // Cohesion should be halved (8 / 2 = 4)
      expect(result.effectiveCohesion).toBe(4);
    });

    it('should NOT halve Cohesion when Hidden but not in Opposing LOS (QSR 847.1)', () => {
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

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        cohesionBase: 8,
      });

      // Cohesion should NOT be halved (no LOS)
      expect(result.effectiveCohesion).toBe(8);
    });

    it('should use floor for halving odd values (QSR 847.1)', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 15, // Odd value
        cohesionBase: 7, // Odd value
      });

      // Should use floor: 15/2 = 7, 7/2 = 3
      expect(result.effectiveVisibility).toBe(7);
      expect(result.effectiveCohesion).toBe(3);
    });
  });

  describe('Terrain Degradation (QSR 847.3)', () => {
    it('should mark terrain as degraded when Hidden and in Opposing LOS (QSR 847.3)', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield);

      // Terrain should be degraded
      expect(result.terrainDegraded).toBe(true);
    });

    it('should NOT mark terrain as degraded when Hidden but not in Opposing LOS (QSR 847.3)', () => {
      // Setup: Add terrain blocking LOS
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

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield);

      // Terrain should NOT be degraded
      expect(result.terrainDegraded).toBe(false);
    });

    it('should NOT mark terrain as degraded when character is not Hidden', () => {
      hiddenCharacter.state.isHidden = false;

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield);

      expect(result.terrainDegraded).toBe(false);
      expect(result.reason).toBe('Not Hidden');
    });
  });

  describe('Entire Path Out of LOS Exception (QSR 847.4)', () => {
    it('should ignore all Hidden effects if entire path is out of LOS (QSR 847.4)', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
        cohesionBase: 8,
        isEntirePathOutOfLOS: true,
      });

      // No effects should apply
      expect(result.effectiveVisibility).toBe(16); // Not halved
      expect(result.effectiveCohesion).toBe(8); // Not halved
      expect(result.terrainDegraded).toBe(false);
      expect(result.reason).toContain('Entire path out of LOS');
    });

    it('should apply Hidden effects if entire path is NOT out of LOS (QSR 847.4)', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
        cohesionBase: 8,
        isEntirePathOutOfLOS: false,
      });

      // Effects should apply
      expect(result.effectiveVisibility).toBe(8); // Halved
      expect(result.effectiveCohesion).toBe(4); // Halved
      expect(result.terrainDegraded).toBe(true);
    });
  });

  describe('Multiple Opponents', () => {
    it('should check LOS to all opponents (QSR 847.1)', () => {
      // Setup: Add second opponent with LOS
      const opponent2 = makeTestCharacter('Opponent2');
      battlefield.placeCharacter(opponent2, { x: 10, y: 18 });

      // Add Cover from first opponent but not second
      battlefield.addTerrain({
        id: 'wall4',
        type: 'Obstacle',
        vertices: [
          { x: 12.5, y: 11.5 },
          { x: 13.5, y: 11.5 },
          { x: 13.5, y: 12.5 },
          { x: 12.5, y: 12.5 },
        ],
      });

      const result = getHiddenEffects(hiddenCharacter, [opponent, opponent2], battlefield, {
        visibilityOrMu: 16,
      });

      // Should be halved (LOS to opponent2)
      expect(result.effectiveVisibility).toBe(8);
    });

    it('should ignore Hidden opponents for LOS check (QSR 847.1)', () => {
      opponent.state.isHidden = true;

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
      });

      // Should NOT be halved (opponent is Hidden)
      expect(result.effectiveVisibility).toBe(16);
    });

    it('should ignore KOd opponents for LOS check (QSR 847.1)', () => {
      opponent.state.isKOd = true;

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
      });

      // Should NOT be halved (opponent is KO'd)
      expect(result.effectiveVisibility).toBe(16);
    });

    it('should ignore Eliminated opponents for LOS check (QSR 847.1)', () => {
      opponent.state.isEliminated = true;

      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield, {
        visibilityOrMu: 16,
      });

      // Should NOT be halved (opponent is Eliminated)
      expect(result.effectiveVisibility).toBe(16);
    });
  });

  describe('Default Values', () => {
    it('should use default visibilityOrMu of 16', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield);

      expect(result.effectiveVisibility).toBe(8); // 16 / 2
    });

    it('should use default cohesionBase of 8', () => {
      const result = getHiddenEffects(hiddenCharacter, [opponent], battlefield);

      expect(result.effectiveCohesion).toBe(4); // 8 / 2
    });
  });
});

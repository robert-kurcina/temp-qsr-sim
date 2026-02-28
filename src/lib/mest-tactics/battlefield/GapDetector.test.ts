/**
 * Gap Detector Tests
 *
 * Tests for gap detection utility used in AI tactical awareness.
 * QSR Reference: Running Jump, Jump Across, Leap X trait
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import {
  detectGapAlongLine,
  calculateJumpCapability,
  canJumpGap,
  findGapsAroundPosition,
  getGapTacticalValue,
} from './GapDetector';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';

// Helper to create test character
function createTestCharacter(name: string, mov: number = 4): Character {
  const profile: Profile = {
    name,
    archetype: 'Average',
    attributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov, siz: 3,
    },
    finalAttributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2, str: 2, for: 2, mov, siz: 3,
    },
    totalBp: 30,
    adjustedBp: 30,
    physicality: 2,
    durability: 3,
    burden: { totalBurden: 0, totalLaden: 0, items: [] },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
    items: [],
    equipment: [],
    inHandItems: [],
    stowedItems: [],
  };
  
  const character = new Character(profile);
  character.id = name;
  character.name = name;
  return character;
}

describe('GapDetector', () => {
  let battlefield: Battlefield;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24, []);
  });

  describe('detectGapAlongLine', () => {
    it('should detect gap between two positions', () => {
      // Simple test - gap detection on empty battlefield
      const from = { x: 5, y: 10 };
      const to = { x: 15, y: 10 };
      
      const gap = detectGapAlongLine(battlefield, from, to);
      
      // On empty battlefield, gap detection returns start/end info
      // Gap is only "real" if there's terrain blocking
      expect(gap).toBeDefined();
    });

    it('should return gap info even for short distances', () => {
      const from = { x: 10, y: 10 };
      const to = { x: 10.3, y: 10 }; // Less than 0.5 MU
      
      const gap = detectGapAlongLine(battlefield, from, to);
      
      // Gap detector returns info even for short distances
      expect(gap).toBeDefined();
      expect(gap?.width).toBeLessThan(0.5);
    });
  });

  describe('calculateJumpCapability', () => {
    it('should calculate correct jump range with base Agility', () => {
      // MOV 4 = Agility 2
      const capability = calculateJumpCapability(2);
      
      expect(capability.agility).toBe(2);
      expect(capability.leapBonus).toBe(0);
      expect(capability.runningBonus).toBe(0);
      expect(capability.downwardBonus).toBe(0);
      expect(capability.maxRange).toBe(2);
    });

    it('should include Leap X bonus', () => {
      // MOV 4 + Leap 2
      const capability = calculateJumpCapability(2, 2);
      
      expect(capability.leapBonus).toBe(2);
      expect(capability.maxRange).toBe(4); // 2 + 2
    });

    it('should include running start bonus', () => {
      // MOV 4 with running start
      const capability = calculateJumpCapability(2, 0, true);
      
      expect(capability.runningBonus).toBe(2);
      expect(capability.maxRange).toBe(4); // 2 + 2
    });

    it('should include downward jump bonus', () => {
      // MOV 4 with 4 MU fall
      const capability = calculateJumpCapability(2, 0, false, 4);
      
      expect(capability.downwardBonus).toBe(2); // 4 * 0.5
      expect(capability.maxRange).toBe(4); // 2 + 2
    });

    it('should combine all bonuses', () => {
      // MOV 6, Leap 2, running start, 4 MU fall
      const capability = calculateJumpCapability(3, 2, true, 4);
      
      expect(capability.maxRange).toBe(9); // 3 + 2 + 2 + 2
    });
  });

  describe('canJumpGap', () => {
    it('should return true when gap is within jump range', () => {
      const gap = {
        startPos: { x: 10, y: 10 },
        endPos: { x: 12, y: 10 },
        width: 2,
        startHeight: 1,
        endHeight: 0,
        startTerrain: 'wall',
        endTerrain: 'clear',
        isJumpable: true,
        isWallToWall: false,
      };
      
      // Agility 3 can jump 2 MU gap
      const canJump = canJumpGap(gap, 3);
      
      expect(canJump).toBe(true);
    });

    it('should return false when gap exceeds jump range', () => {
      const gap = {
        startPos: { x: 10, y: 10 },
        endPos: { x: 15, y: 10 },
        width: 5,
        startHeight: 1,
        endHeight: 0,
        startTerrain: 'wall',
        endTerrain: 'clear',
        isJumpable: false,
        isWallToWall: false,
      };
      
      // Agility 2 cannot jump 5 MU gap
      const canJump = canJumpGap(gap, 2);
      
      expect(canJump).toBe(false);
    });

    it('should account for downward bonus', () => {
      const gap = {
        startPos: { x: 10, y: 10 },
        endPos: { x: 14, y: 10 },
        width: 4,
        startHeight: 4, // 4 MU fall = +2 MU across
        endHeight: 0,
        startTerrain: 'wall',
        endTerrain: 'clear',
        isJumpable: true,
        isWallToWall: false,
      };
      
      // Agility 2 + 2 (downward) = 4 MU can jump
      const canJump = canJumpGap(gap, 2);
      
      expect(canJump).toBe(true);
    });
  });

  describe('getGapTacticalValue', () => {
    it('should score wall-to-wall gaps higher', () => {
      const gap = {
        startPos: { x: 10, y: 10 },
        endPos: { x: 12, y: 10 },
        width: 2,
        startHeight: 1,
        endHeight: 1,
        startTerrain: 'wall',
        endTerrain: 'wall',
        isJumpable: true,
        isWallToWall: true,
      };
      
      const value = getGapTacticalValue(gap);
      
      // Wall-to-wall: +5, jumpable: +3
      expect(value).toBeGreaterThanOrEqual(8);
    });

    it('should score jumpable gaps', () => {
      const gap = {
        startPos: { x: 10, y: 10 },
        endPos: { x: 12, y: 10 },
        width: 2,
        startHeight: 0,
        endHeight: 0,
        startTerrain: 'clear',
        endTerrain: 'clear',
        isJumpable: true,
        isWallToWall: false,
      };
      
      const value = getGapTacticalValue(gap);
      
      // Jumpable: +3
      expect(value).toBeGreaterThanOrEqual(3);
    });

    it('should score height advantage', () => {
      const gap = {
        startPos: { x: 10, y: 10 },
        endPos: { x: 12, y: 10 },
        width: 2,
        startHeight: 2,
        endHeight: 0,
        startTerrain: 'wall',
        endTerrain: 'clear',
        isJumpable: true,
        isWallToWall: false,
      };
      
      const value = getGapTacticalValue(gap);
      
      // Height advantage: +2
      expect(value).toBeGreaterThanOrEqual(2);
    });
  });

  describe('findGapsAroundPosition', () => {
    it('should scan in multiple directions', () => {
      const position = { x: 12, y: 12 };
      
      const gaps = findGapsAroundPosition(battlefield, position, 8, 8);
      
      // Scans in 8 directions, returns gap info for each
      expect(gaps.length).toBe(8);
    });
  });
});

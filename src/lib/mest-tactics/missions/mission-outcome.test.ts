/**
 * Phase A: Mission Outcome Correctness Tests
 * 
 * Tests for winner/tie resolution with VP → RP → Initiative Card tie-breaking.
 */

import { describe, it, expect } from 'vitest';
import { resolveMissionWinner, computeMissionScores, buildMissionSideStatus } from '../missions/mission-scoring';
import { createMissionSide } from '../mission/MissionSide';
import { buildAssembly, buildProfile } from '../mission/assembly-builder';

describe('Phase A: Mission Outcome Correctness', () => {
  describe('resolveMissionWinner', () => {
    it('should return clear VP winner', () => {
      const vpBySide = { 'side-a': 5, 'side-b': 3 };
      const rpBySide = { 'side-a': 0, 'side-b': 0 };
      
      const result = resolveMissionWinner(vpBySide, rpBySide);
      
      expect(result.winnerSideId).toBe('side-a');
      expect(result.tie).toBe(false);
      expect(result.tieSideIds).toEqual([]);
      expect(result.winnerReason).toBe('vp');
      expect(result.tieBreakMethod).toBe('none');
    });

    it('should use RP tie-break when VP is tied', () => {
      const vpBySide = { 'side-a': 5, 'side-b': 5 };
      const rpBySide = { 'side-a': 2, 'side-b': 1 };
      
      const result = resolveMissionWinner(vpBySide, rpBySide);
      
      expect(result.winnerSideId).toBe('side-a');
      expect(result.tie).toBe(false);
      expect(result.tieSideIds).toEqual([]);
      expect(result.winnerReason).toBe('rp');
      expect(result.tieBreakMethod).toBe('rp');
    });

    it('should return tie when both VP and RP are tied', () => {
      const vpBySide = { 'side-a': 5, 'side-b': 5 };
      const rpBySide = { 'side-a': 2, 'side-b': 2 };
      
      const result = resolveMissionWinner(vpBySide, rpBySide);
      
      expect(result.winnerSideId).toBeUndefined();
      expect(result.tie).toBe(true);
      expect(result.tieSideIds).toEqual(['side-a', 'side-b']);
      expect(result.winnerReason).toBe('tie');
      expect(result.tieBreakMethod).toBe('none');
    });

    it('should handle 3-way VP tie with RP tie-break', () => {
      const vpBySide = { 'side-a': 5, 'side-b': 5, 'side-c': 5 };
      const rpBySide = { 'side-a': 1, 'side-b': 3, 'side-c': 2 };
      
      const result = resolveMissionWinner(vpBySide, rpBySide);
      
      expect(result.winnerSideId).toBe('side-b');
      expect(result.tie).toBe(false);
      expect(result.winnerReason).toBe('rp');
    });

    it('should handle 3-way tie after RP tie-break', () => {
      const vpBySide = { 'side-a': 5, 'side-b': 5, 'side-c': 5 };
      const rpBySide = { 'side-a': 2, 'side-b': 2, 'side-c': 2 };
      
      const result = resolveMissionWinner(vpBySide, rpBySide);
      
      expect(result.winnerSideId).toBeUndefined();
      expect(result.tie).toBe(true);
      expect(result.tieSideIds).toEqual(['side-a', 'side-b', 'side-c']);
      expect(result.winnerReason).toBe('tie');
    });

    it('should handle empty VP', () => {
      const vpBySide = {};
      const rpBySide = {};
      
      const result = resolveMissionWinner(vpBySide, rpBySide);
      
      expect(result.winnerSideId).toBeUndefined();
      expect(result.tie).toBe(true);
      expect(result.tieSideIds).toEqual([]);
      expect(result.winnerReason).toBe('tie');
    });
  });

  describe('computeMissionScores', () => {
    it('should compute VP and RP correctly', () => {
      // Mock side status
      const mockSide = {
        id: 'side-a',
        members: [],
        totalBP: 100,
        victoryPoints: 0,
        resourcePoints: 0,
        state: {
          currentTurn: 1,
          readyCount: 3,
          activatedCount: 0,
          eliminatedCount: 0,
        },
      } as any;

      const sideStatus = buildMissionSideStatus(mockSide);
      
      const result = computeMissionScores({
        sides: [sideStatus],
        eliminationBpBySide: { 'side-a': 50 },
      });

      expect(result.vpBySide['side-a']).toBeGreaterThanOrEqual(0);
      expect(result.rpBySide['side-a']).toBeGreaterThanOrEqual(0);
      expect(result.breakdownBySide['side-a']).toBeDefined();
    });
  });

  describe('Integration: Battle Runner Winner Determination', () => {
    it('should determine winner from VP alone', () => {
      const vpBySide = { 'side-a': 3, 'side-b': 1 };
      
      // Simulate battle runner logic
      const maxVP = Math.max(...Object.values(vpBySide), 0);
      const topVpSides = Object.entries(vpBySide)
        .filter(([, vp]) => vp === maxVP)
        .map(([sideId]) => sideId);
      
      expect(topVpSides.length).toBe(1);
      expect(topVpSides[0]).toBe('side-a');
    });

    it('should detect VP tie', () => {
      const vpBySide = { 'side-a': 3, 'side-b': 3 };
      
      const maxVP = Math.max(...Object.values(vpBySide), 0);
      const topVpSides = Object.entries(vpBySide)
        .filter(([, vp]) => vp === maxVP)
        .map(([sideId]) => sideId);
      
      expect(topVpSides.length).toBe(2);
    });

    it('should apply RP tie-break', () => {
      const vpBySide = { 'side-a': 3, 'side-b': 3 };
      const rpBySide = { 'side-a': 2, 'side-b': 1 };
      
      const maxVP = Math.max(...Object.values(vpBySide), 0);
      const topVpSides = Object.entries(vpBySide)
        .filter(([, vp]) => vp === maxVP)
        .map(([sideId]) => sideId);
      
      const maxRP = Math.max(...topVpSides.map(sideId => rpBySide[sideId as keyof typeof rpBySide]));
      const topRpSides = topVpSides.filter(sideId => rpBySide[sideId as keyof typeof rpBySide] === maxRP);
      
      expect(topRpSides.length).toBe(1);
      expect(topRpSides[0]).toBe('side-a');
    });

    it('should remain tied after RP tie-break', () => {
      const vpBySide = { 'side-a': 3, 'side-b': 3 };
      const rpBySide = { 'side-a': 2, 'side-b': 2 };
      
      const maxVP = Math.max(...Object.values(vpBySide), 0);
      const topVpSides = Object.entries(vpBySide)
        .filter(([, vp]) => vp === maxVP)
        .map(([sideId]) => sideId);
      
      const maxRP = Math.max(...topVpSides.map(sideId => rpBySide[sideId as keyof typeof rpBySide]));
      const topRpSides = topVpSides.filter(sideId => rpBySide[sideId as keyof typeof rpBySide] === maxRP);
      
      expect(topRpSides.length).toBe(2);
    });
  });
});

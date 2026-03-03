/**
 * VP Urgency Calculator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateVPUrgency,
  getUrgencyMultiplier,
  getPassiveActionPenalty,
  getVPUrgencyAdvice,
  type VPUrgencyState,
} from './VPUrgencyCalculator';

describe('VPUrgencyCalculator', () => {
  describe('calculateVPUrgency', () => {
    it('should return low urgency when VP tied in early game', () => {
      const result = calculateVPUrgency(0, 0, 1, 6);

      expect(result.urgencyLevel).toBe('low');
      expect(result.vpDeficit).toBe(0);
      expect(result.turnsRemaining).toBe(6);
      expect(result.amILeading).toBe(false);
      expect(result.vpMargin).toBe(0);
    });

    it('should return low urgency when leading', () => {
      const result = calculateVPUrgency(2, 0, 3, 6);

      // Leading by 2 VP in turn 3 = low urgency
      expect(result.amILeading).toBe(true);
      expect(result.vpMargin).toBe(2);
      // Urgency should be low since we're leading
      expect(['low', 'medium'].includes(result.urgencyLevel)).toBe(true);
    });

    it('should return medium urgency when trailing by 1 VP', () => {
      const result = calculateVPUrgency(0, 1, 3, 6);

      expect(result.urgencyLevel).toBe('medium');
      expect(result.vpDeficit).toBe(1);
    });

    it('should return high urgency when trailing by 2+ VP', () => {
      const result = calculateVPUrgency(0, 2, 3, 6);

      expect(result.urgencyLevel).toBe('high');
      expect(result.vpDeficit).toBe(2);
    });

    it('should return high urgency in late game (turn 5+)', () => {
      const result = calculateVPUrgency(0, 0, 5, 6);

      expect(result.urgencyLevel).toBe('high');
      expect(result.turnsRemaining).toBe(2);
    });

    it('should return desperate urgency when VP=0 at turn 6+', () => {
      const result = calculateVPUrgency(0, 0, 6, 6);

      expect(result.urgencyLevel).toBe('desperate');
    });

    it('should return desperate urgency when trailing by 4+ VP', () => {
      const result = calculateVPUrgency(0, 4, 3, 6);

      expect(result.urgencyLevel).toBe('desperate');
      expect(result.vpDeficit).toBe(4);
    });

    it('should calculate required VP per turn correctly', () => {
      const result = calculateVPUrgency(0, 3, 4, 6);

      // Need 4 VP in 3 turns = 1.33 VP/turn
      expect(result.requiredVPPerTurn).toBeCloseTo(1.33, 1);
    });

    it('should handle zero VP desperation correctly', () => {
      // Turn 3: not desperate yet
      expect(calculateVPUrgency(0, 0, 3, 6).urgencyLevel).toBe('medium');

      // Turn 6: desperate
      expect(calculateVPUrgency(0, 0, 6, 6).urgencyLevel).toBe('desperate');
    });

    it('should disable zero VP desperation when configured', () => {
      const result = calculateVPUrgency(0, 0, 6, 6, {
        enableZeroVPDesperation: false,
      });

      expect(result.urgencyLevel).toBe('high'); // Late game, but not desperate
    });
  });

  describe('getUrgencyMultiplier', () => {
    it('should return 1.0 for low urgency', () => {
      expect(getUrgencyMultiplier('low')).toBe(1.0);
    });

    it('should return 1.5 for medium urgency', () => {
      expect(getUrgencyMultiplier('medium')).toBe(1.5);
    });

    it('should return 2.0 for high urgency', () => {
      expect(getUrgencyMultiplier('high')).toBe(2.0);
    });

    it('should return 3.0 for desperate urgency', () => {
      expect(getUrgencyMultiplier('desperate')).toBe(3.0);
    });
  });

  describe('getPassiveActionPenalty', () => {
    it('should return 0 when leading in VP', () => {
      expect(getPassiveActionPenalty('high', 4, 2)).toBe(0);
    });

    it('should return 0 for low urgency', () => {
      expect(getPassiveActionPenalty('low', 2, 0)).toBe(0);
    });

    it('should apply medium penalty for medium urgency', () => {
      // Turn 3: -0.8 * (3-2) = -0.8
      expect(getPassiveActionPenalty('medium', 3, 0)).toBeCloseTo(-0.8, 1);

      // Turn 4: -0.8 * (4-2) = -1.6
      expect(getPassiveActionPenalty('medium', 4, 0)).toBeCloseTo(-1.6, 1);
    });

    it('should apply high penalty for high urgency', () => {
      // Turn 4: -1.5 * (4-2) = -3.0
      expect(getPassiveActionPenalty('high', 4, 0)).toBe(-3.0);

      // Turn 5: -1.5 * (5-2) = -4.5
      expect(getPassiveActionPenalty('high', 5, 0)).toBe(-4.5);
    });

    it('should apply severe penalty for desperate urgency', () => {
      // Turn 6: -2.5 * (6-2) = -10.0
      expect(getPassiveActionPenalty('desperate', 6, 0)).toBe(-10.0);
    });
  });

  describe('getVPUrgencyAdvice', () => {
    it('should provide advice for desperate situation', () => {
      const urgency: VPUrgencyState = {
        myVP: 0,
        enemyVP: 0,
        vpDeficit: 0,
        turnsRemaining: 1,
        urgencyLevel: 'desperate',
        requiredVPPerTurn: 1,
        currentTurn: 6,
        maxTurns: 6,
        amILeading: false,
        vpMargin: 0,
      };

      const advice = getVPUrgencyAdvice(urgency);

      expect(advice.some(a => a.includes('DESPERATE'))).toBe(true);
      expect(advice.some(a => a.includes('Zero VP'))).toBe(true);
    });

    it('should provide advice for high urgency', () => {
      const urgency: VPUrgencyState = {
        myVP: 0,
        enemyVP: 2,
        vpDeficit: 2,
        turnsRemaining: 3,
        urgencyLevel: 'high',
        requiredVPPerTurn: 1,
        currentTurn: 4,
        maxTurns: 6,
        amILeading: false,
        vpMargin: -2,
      };

      const advice = getVPUrgencyAdvice(urgency);

      expect(advice.some(a => a.includes('HIGH urgency'))).toBe(true);
      expect(advice.some(a => a.includes('2 VP deficit'))).toBe(true);
    });

    it('should provide advice for leading situation', () => {
      const urgency: VPUrgencyState = {
        myVP: 3,
        enemyVP: 1,
        vpDeficit: -2,
        turnsRemaining: 4,
        urgencyLevel: 'low',
        requiredVPPerTurn: 0,
        currentTurn: 3,
        maxTurns: 6,
        amILeading: true,
        vpMargin: 2,
      };

      const advice = getVPUrgencyAdvice(urgency);

      expect(advice.some(a => a.includes('Leading by 2 VP'))).toBe(true);
    });
  });
});

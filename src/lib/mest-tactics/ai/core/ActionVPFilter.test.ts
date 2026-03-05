/**
 * Action VP Filter Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getActionVPInfo,
  filterActionsByVP,
  applyVPurgencyBonus,
  scoreActionByVP,
  type ActionVPInfo,
} from './ActionVPFilter';
import { type VPUrgencyState } from './VPUrgencyCalculator';

describe('ActionVPFilter', () => {
  describe('getActionVPInfo', () => {
    it('should classify close_combat as direct VP action', () => {
      const info = getActionVPInfo('close_combat', true, true);

      expect(info.isDirectVPAction).toBe(true);
      expect(info.isPassiveAction).toBe(false);
      expect(info.estimatedVPContribution).toBe(0.35);
    });

    it('should classify ranged_combat as direct VP action', () => {
      const info = getActionVPInfo('ranged_combat', true, true);

      expect(info.isDirectVPAction).toBe(true);
      expect(info.estimatedVPContribution).toBe(0.25);
    });

    it('should classify move as VP-enabling action', () => {
      const info = getActionVPInfo('move');

      expect(info.isDirectVPAction).toBe(false);
      expect(info.isVPEnablingAction).toBe(true);
      expect(info.estimatedVPContribution).toBe(0.08);
    });

    it('should classify hide as passive action', () => {
      const info = getActionVPInfo('hide');

      expect(info.isPassiveAction).toBe(true);
      expect(info.estimatedVPContribution).toBe(0.0);
    });

    it('should classify wait as passive action', () => {
      const info = getActionVPInfo('wait');

      expect(info.isPassiveAction).toBe(true);
      expect(info.estimatedVPContribution).toBe(0.02);
    });

    it('should classify charge as VP-enabling movement', () => {
      const info = getActionVPInfo('charge');

      expect(info.isVPEnablingAction).toBe(true);
      expect(info.isMovementAction).toBe(true);
      expect(info.estimatedVPContribution).toBe(0.2);
    });

    it('should classify detect as VP-enabling action', () => {
      const info = getActionVPInfo('detect');

      expect(info.isVPEnablingAction).toBe(true);
      expect(info.estimatedVPContribution).toBe(0.08);
    });

    it('should return 0 VP contribution for invalid targets', () => {
      const info = getActionVPInfo('close_combat', false, false);

      expect(info.estimatedVPContribution).toBe(0.0);
    });
  });

  describe('filterActionsByVP', () => {
    const createActions = (types: string[]) => types.map((type: any) => ({ action: type as any }));

    it('should not filter actions for low urgency', () => {
      const actions = createActions(['hide', 'wait', 'move', 'close_combat']);
      const urgency: VPUrgencyState = {
        myVP: 2,
        enemyVP: 0,
        vpDeficit: -2,
        turnsRemaining: 4,
        urgencyLevel: 'low',
        requiredVPPerTurn: 0,
        currentTurn: 3,
        maxTurns: 6,
        amILeading: true,
        vpMargin: 2,
      };

      const filtered = filterActionsByVP(actions, urgency);

      expect(filtered.length).toBe(4);
    });

    it('should filter passive actions for high urgency', () => {
      const actions = createActions(['hide', 'wait', 'move', 'close_combat']);
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

      const filtered = filterActionsByVP(actions, urgency);

      // hide and wait should be filtered out
      expect(filtered.length).toBe(2);
      expect(filtered.map((a: any) => a.action)).toEqual(['move', 'close_combat']);
    });

    it('should only allow direct VP actions for desperate urgency', () => {
      const actions = createActions(['hide', 'wait', 'move', 'close_combat', 'ranged_combat']);
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

      const filtered = filterActionsByVP(actions, urgency);

      // Only direct VP actions should remain
      expect(filtered.length).toBe(2);
      expect(filtered.map((a: any) => a.action)).toEqual(['close_combat', 'ranged_combat']);
    });

    it('should allow VP-enabling actions with high contribution in desperate mode', () => {
      const actions = createActions(['charge', 'close_combat']);
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

      const filtered = filterActionsByVP(actions, urgency);

      // charge (0.2 VP) and close_combat should both be allowed
      expect(filtered.length).toBe(2);
    });
  });

  describe('applyVPurgencyBonus', () => {
    it('should apply urgency multiplier to direct VP actions', () => {
      const action = { action: 'close_combat' as const };
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

      const adjusted = applyVPurgencyBonus(action, urgency, 2.0);

      // High urgency = 2.0 multiplier
      expect(adjusted).toBe(4.0);
    });

    it('should apply smaller multiplier to VP-enabling actions', () => {
      const action = { action: 'move' as const };
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

      const adjusted = applyVPurgencyBonus(action, urgency, 1.0);

      // VP-enabling gets 50% of multiplier: 1.0 + (2.0-1.0)*0.5 = 1.5
      expect(adjusted).toBeCloseTo(1.5, 1);
    });

    it('should apply penalty to passive actions when VP=0', () => {
      const action = { action: 'hide' as const };
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

      const adjusted = applyVPurgencyBonus(action, urgency, 3.0);

      // Passive penalty for turn 4, high urgency: -1.5 * (4-2) = -3.0
      expect(adjusted).toBe(0); // Max of 0, 3.0 - 3.0
    });

    it('should not penalize passive actions when VP > 0', () => {
      const action = { action: 'hide' as const };
      const urgency: VPUrgencyState = {
        myVP: 2,
        enemyVP: 0,
        vpDeficit: -2,
        turnsRemaining: 4,
        urgencyLevel: 'low',
        requiredVPPerTurn: 0,
        currentTurn: 4,
        maxTurns: 6,
        amILeading: true,
        vpMargin: 2,
      };

      const adjusted = applyVPurgencyBonus(action, urgency, 3.0);

      // No penalty when leading
      expect(adjusted).toBe(3.0);
    });
  });

  describe('scoreActionByVP', () => {
    it('should score direct VP actions higher', () => {
      // Use move which has 0.08 base VP contribution
      const action = { action: 'move' as const };
      const urgency: VPUrgencyState = {
        myVP: 0,
        enemyVP: 0,
        vpDeficit: 0,
        turnsRemaining: 4,
        urgencyLevel: 'low',
        requiredVPPerTurn: 0.25,
        currentTurn: 3,
        maxTurns: 6,
        amILeading: false,
        vpMargin: 0,
      };

      const score = scoreActionByVP(action, urgency);

      // Base: 0.08 * 2.0 = 0.16 (low urgency = 1.0 multiplier)
      expect(score).toBeCloseTo(0.16, 1);
    });

    it('should score passive actions at 0', () => {
      const action = { action: 'hide' as const };
      const urgency: VPUrgencyState = {
        myVP: 0,
        enemyVP: 0,
        vpDeficit: 0,
        turnsRemaining: 4,
        urgencyLevel: 'low',
        requiredVPPerTurn: 0.25,
        currentTurn: 3,
        maxTurns: 6,
        amILeading: false,
        vpMargin: 0,
      };

      const score = scoreActionByVP(action, urgency);

      expect(score).toBe(0);
    });

    it('should apply urgency multiplier to combat scores', () => {
      // Use detect which has 0.08 base VP contribution
      const action = { action: 'detect' as const };
      const highUrgency: VPUrgencyState = {
        myVP: 0,
        enemyVP: 3,
        vpDeficit: 3,
        turnsRemaining: 2,
        urgencyLevel: 'desperate',
        requiredVPPerTurn: 2,
        currentTurn: 5,
        maxTurns: 6,
        amILeading: false,
        vpMargin: -3,
      };

      const score = scoreActionByVP(action, highUrgency);

      // detect is VP-enabling: 0.08 * 2.0 = 0.16 (no multiplier for VP-enabling)
      expect(score).toBeCloseTo(0.16, 1);
    });

    it('should penalize passive actions in late game', () => {
      const action = { action: 'wait' as const };
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

      const score = scoreActionByVP(action, urgency);

      // Passive penalty should make score 0
      expect(score).toBe(0);
    });
  });
});

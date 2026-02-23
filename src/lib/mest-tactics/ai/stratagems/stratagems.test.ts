/**
 * AI Tactical Doctrine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  TacticalDoctrine,
  DEFAULT_TACTICAL_DOCTRINE,
  calculateStratagemModifiers,
  TACTICAL_DOCTRINE_INFO,
  getDoctrinesByEngagement,
  validateStratagems,
  getDoctrineComponents,
  EngagementStyle,
  PlanningPriority,
  AggressionLevel,
} from './AIStratagems';
import {
  applyStratagemModifiersToActions,
  calculateOptimalEngagementRange,
  shouldRetreat,
  shouldCharge,
} from './StratagemIntegration';

describe('AI Tactical Doctrine', () => {
  describe('Default Doctrine', () => {
    it('should have Operative as default', () => {
      expect(DEFAULT_TACTICAL_DOCTRINE).toBe(TacticalDoctrine.Operative);
    });
  });

  describe('Doctrine Components', () => {
    it('should decompose Juggernaut correctly', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Juggernaut);
      expect(components.engagement).toBe(EngagementStyle.Melee);
      expect(components.planning).toBe(PlanningPriority.Aggressive);
      expect(components.aggression).toBe(AggressionLevel.Aggressive);
    });

    it('should decompose Sniper correctly', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Sniper);
      expect(components.engagement).toBe(EngagementStyle.Ranged);
      expect(components.planning).toBe(PlanningPriority.Aggressive);
      expect(components.aggression).toBe(AggressionLevel.Defensive);
    });

    it('should decompose Operative correctly', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Operative);
      expect(components.engagement).toBe(EngagementStyle.Balanced);
      expect(components.planning).toBe(PlanningPriority.Balanced);
      expect(components.aggression).toBe(AggressionLevel.Balanced);
    });

    it('should decompose Commander correctly', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Commander);
      expect(components.engagement).toBe(EngagementStyle.Balanced);
      expect(components.planning).toBe(PlanningPriority.KeysToVictory);
      expect(components.aggression).toBe(AggressionLevel.Balanced);
    });
  });

  describe('Doctrine Info', () => {
    it('should have info for all doctrines', () => {
      const allDoctrines = Object.values(TacticalDoctrine);
      for (const doctrine of allDoctrines) {
        expect(TACTICAL_DOCTRINE_INFO[doctrine]).toBeDefined();
        expect(TACTICAL_DOCTRINE_INFO[doctrine].name).toBeTruthy();
        expect(TACTICAL_DOCTRINE_INFO[doctrine].description).toBeTruthy();
        expect(TACTICAL_DOCTRINE_INFO[doctrine].icon).toBeTruthy();
      }
    });

    it('should have 27 doctrines', () => {
      expect(Object.values(TacticalDoctrine).length).toBe(27);
    });
  });

  describe('Doctrines by Engagement', () => {
    it('should group doctrines correctly', () => {
      const groups = getDoctrinesByEngagement();
      expect(groups.Melee.length).toBe(9);
      expect(groups.Ranged.length).toBe(9);
      expect(groups.Balanced.length).toBe(9);
    });

    it('should include Juggernaut in Melee', () => {
      const groups = getDoctrinesByEngagement();
      expect(groups.Melee).toContain(TacticalDoctrine.Juggernaut);
    });

    it('should include Sniper in Ranged', () => {
      const groups = getDoctrinesByEngagement();
      expect(groups.Ranged).toContain(TacticalDoctrine.Sniper);
    });

    it('should include Operative in Balanced', () => {
      const groups = getDoctrinesByEngagement();
      expect(groups.Balanced).toContain(TacticalDoctrine.Operative);
    });
  });

  describe('Stratagem Modifiers', () => {
    it('should calculate Juggernaut modifiers', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Juggernaut);
      expect(modifiers.meleePreference).toBeGreaterThan(1);
      expect(modifiers.rangePreference).toBeLessThan(1);
      expect(modifiers.chargeBonus).toBeGreaterThan(2); // Melee + Aggressive
      expect(modifiers.eliminationValue).toBeGreaterThan(1);
      expect(modifiers.riskTolerance).toBeGreaterThan(1);
    });

    it('should calculate Sniper modifiers', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Sniper);
      expect(modifiers.meleePreference).toBeLessThan(1);
      expect(modifiers.rangePreference).toBeGreaterThan(1);
      expect(modifiers.survivalValue).toBeGreaterThan(1);
      expect(modifiers.riskTolerance).toBeLessThan(1);
    });

    it('should calculate Operative modifiers (balanced)', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Operative);
      expect(modifiers.meleePreference).toBe(1);
      expect(modifiers.rangePreference).toBe(1);
      expect(modifiers.objectiveValue).toBe(1);
      expect(modifiers.riskTolerance).toBe(1);
    });

    it('should calculate Commander modifiers', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Commander);
      expect(modifiers.objectiveValue).toBeGreaterThan(1);
      expect(modifiers.eliminationValue).toBeLessThan(1);
    });

    it('should calculate Assault modifiers', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Assault);
      expect(modifiers.riskTolerance).toBeGreaterThan(1);
      expect(modifiers.pushAdvantage).toBe(true);
    });
  });

  describe('Stratagem Validation', () => {
    it('should accept all doctrines as valid', () => {
      const allDoctrines = Object.values(TacticalDoctrine);
      for (const doctrine of allDoctrines) {
        const result = validateStratagems({ tacticalDoctrine: doctrine });
        expect(result.valid).toBe(true);
      }
    });
  });
});

describe('Stratagem Integration', () => {
  describe('Action Scoring', () => {
    it('should boost melee actions for Juggernaut', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Juggernaut);

      const actions = applyStratagemModifiersToActions(
        [
          { action: 'close_combat', score: 5, target: null },
          { action: 'ranged_combat', score: 5, target: null },
        ],
        modifiers
      );

      expect(actions[0].score).toBeGreaterThan(actions[1].score);
    });

    it('should boost ranged actions for Sniper', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Sniper);

      const actions = applyStratagemModifiersToActions(
        [
          { action: 'close_combat', score: 5, target: null },
          { action: 'ranged_combat', score: 5, target: null },
        ],
        modifiers
      );

      expect(actions[1].score).toBeGreaterThan(actions[0].score);
    });
  });

  describe('Engagement Range', () => {
    it('should calculate optimal range for Sniper', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Sniper);

      const range = calculateOptimalEngagementRange(modifiers);
      expect(range).toBeGreaterThan(12);
    });

    it('should calculate optimal range for Juggernaut', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Juggernaut);

      const range = calculateOptimalEngagementRange(modifiers);
      expect(range).toBeLessThan(12);
    });
  });

  describe('Retreat Decision', () => {
    it('should retreat when heavily wounded', () => {
      const modifiers = calculateStratagemModifiers(DEFAULT_TACTICAL_DOCTRINE);

      const should = shouldRetreat(8, 10, modifiers, 1, 1);
      expect(should).toBe(true);
    });

    it('should rarely retreat for Juggernaut', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Juggernaut);

      const should = shouldRetreat(5, 10, modifiers, 1, 1);
      expect(should).toBe(false);
    });

    it('should retreat earlier for Watchman', () => {
      const modifiers = calculateStratagemModifiers(TacticalDoctrine.Watchman);

      const should = shouldRetreat(4, 10, modifiers, 2, 1); // Outnumbered
      expect(should).toBe(true);
    });
  });

  describe('Charge Decision', () => {
    it('should charge for Juggernaut', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Juggernaut);

      const should = shouldCharge(3, 4, {}, 1, 0, components.engagement, components.aggression);
      expect(should).toBe(true);
    });

    it('should charge for Assault', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Assault);

      const should = shouldCharge(3, 4, {}, 1, 0, components.engagement, components.aggression);
      expect(should).toBe(true);
    });

    it('should not charge if out of range', () => {
      const components = getDoctrineComponents(DEFAULT_TACTICAL_DOCTRINE);

      const should = shouldCharge(10, 4, {}, 1, 0, components.engagement, components.aggression);
      expect(should).toBe(false);
    });

    it('should only charge with advantage for Watchman', () => {
      const components = getDoctrineComponents(TacticalDoctrine.Watchman);

      // No advantage
      const shouldNot = shouldCharge(3, 4, {}, 1, 0, components.engagement, components.aggression);
      expect(shouldNot).toBe(false);

      // With advantage (enemy wounded)
      const should = shouldCharge(3, 4, {}, 0.3, 0, components.engagement, components.aggression);
      expect(should).toBe(true);
    });
  });
});

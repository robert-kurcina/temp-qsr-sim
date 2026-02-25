import { describe, it, expect, beforeEach } from 'vitest';
import { EngagementManager, createEngagementManager } from './engagement-manager';
import { ModelRegistry } from './model-registry';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Position } from '../Position';
import { SpatialModel } from './spatial-rules';

describe('EngagementManager', () => {
  let registry: ModelRegistry;
  let manager: EngagementManager;

  const createTestCharacter = (name: string, siz: number = 3): Character => {
    const profile: Profile = {
      name,
      archetype: 'Average',
      attributes: {
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
        str: 2, for: 2, mov: 2, siz,
      },
      traits: [],
      items: [],
    };
    return new Character(profile);
  };

  beforeEach(() => {
    registry = new ModelRegistry();
    manager = new EngagementManager(registry);
  });

  describe('isEngaged', () => {
    it('should return true for models in base contact', () => {
      const char1 = createTestCharacter('Model1');
      const char2 = createTestCharacter('Model2');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 }); // Within 1 MU (base contact)

      expect(manager.isEngaged('Model1', 'Model2')).toBe(true);
    });

    it('should return false for models not in base contact', () => {
      const char1 = createTestCharacter('Model1');
      const char2 = createTestCharacter('Model2');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 3, y: 0 }); // 3 MU apart

      expect(manager.isEngaged('Model1', 'Model2')).toBe(false);
    });

    it('should return false for unknown models', () => {
      expect(manager.isEngaged('Unknown1', 'Unknown2')).toBe(false);
    });
  });

  describe('getEngagedModels', () => {
    it('should return all models in base contact', () => {
      const char1 = createTestCharacter('Center');
      const char2 = createTestCharacter('Near1');
      const char3 = createTestCharacter('Near2');
      const char4 = createTestCharacter('Far');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });
      registry.register(char3, { x: -0.9, y: 0 });
      registry.register(char4, { x: 5, y: 0 });

      const engaged = manager.getEngagedModels('Center');

      expect(engaged.length).toBe(2);
      expect(engaged).toContain('Near1');
      expect(engaged).toContain('Near2');
    });

    it('should filter by opposing IDs', () => {
      const char1 = createTestCharacter('Ally1');
      const char2 = createTestCharacter('Ally2');
      const char3 = createTestCharacter('Enemy1');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });
      registry.register(char3, { x: -0.9, y: 0 });

      const opposingIds = new Set(['Enemy1']);
      const engaged = manager.getEngagedModels('Ally1', opposingIds);

      expect(engaged.length).toBe(1);
      expect(engaged).toContain('Enemy1');
      expect(engaged).not.toContain('Ally2');
    });
  });

  describe('queryEngagement', () => {
    it('should return complete engagement state', () => {
      const char1 = createTestCharacter('Center');
      const char2 = createTestCharacter('Enemy1');
      const char3 = createTestCharacter('Enemy2');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });
      registry.register(char3, { x: -0.9, y: 0 });

      const result = manager.queryEngagement('Center');

      expect(result.isEngaged).toBe(true);
      expect(result.engagedCount).toBe(2);
      expect(result.engagedModels).toContain('Enemy1');
      expect(result.engagedModels).toContain('Enemy2');
      expect(result.isSurrounded).toBe(true);
    });

    it('should return empty state for unengaged model', () => {
      const char1 = createTestCharacter('Lone');

      registry.register(char1, { x: 0, y: 0 });

      const result = manager.queryEngagement('Lone');

      expect(result.isEngaged).toBe(false);
      expect(result.engagedCount).toBe(0);
      expect(result.engagedModels).toEqual([]);
    });

    it('should return empty state for unknown model', () => {
      const result = manager.queryEngagement('Unknown');

      expect(result.isEngaged).toBe(false);
      expect(result.engagedCount).toBe(0);
    });
  });

  describe('isCornered', () => {
    it('should return true when engaged by multiple enemies', () => {
      const model: SpatialModel = {
        id: 'Center',
        position: { x: 0, y: 0 },
        baseDiameter: 1,
        siz: 3,
      };
      const engagedIds = ['Enemy1', 'Enemy2'];

      expect(manager.isCornered(model, engagedIds)).toBe(true);
    });

    it('should return false when engaged by single enemy', () => {
      const model: SpatialModel = {
        id: 'Center',
        position: { x: 0, y: 0 },
        baseDiameter: 1,
        siz: 3,
      };
      const engagedIds = ['Enemy1'];

      expect(manager.isCornered(model, engagedIds)).toBe(false);
    });
  });

  describe('isFlanked', () => {
    it('should return true for flanking positions', () => {
      const model: SpatialModel = {
        id: 'Center',
        position: { x: 0, y: 0 },
        baseDiameter: 1,
        siz: 3,
      };

      registry.register(createTestCharacter('Left'), { x: -0.9, y: 0 });
      registry.register(createTestCharacter('Right'), { x: 0.9, y: 0 });

      expect(manager.isFlanked(model, ['Left', 'Right'])).toBe(true);
    });

    it('should return false for same-side positions', () => {
      const model: SpatialModel = {
        id: 'Center',
        position: { x: 0, y: 0 },
        baseDiameter: 1,
        siz: 3,
      };

      registry.register(createTestCharacter('Near1'), { x: 0.5, y: 0 });
      registry.register(createTestCharacter('Near2'), { x: 0.7, y: 0 });

      expect(manager.isFlanked(model, ['Near1', 'Near2'])).toBe(false);
    });
  });

  describe('canAttackInMelee', () => {
    it('should return true if target is in reach', () => {
      const char1 = createTestCharacter('Attacker');
      const char2 = createTestCharacter('Target');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.8, y: 0 });

      expect(manager.canAttackInMelee('Attacker', 'Target')).toBe(true);
    });

    it('should return false if target is out of reach', () => {
      const char1 = createTestCharacter('Attacker');
      const char2 = createTestCharacter('Target');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 2, y: 0 });

      expect(manager.canAttackInMelee('Attacker', 'Target')).toBe(false);
    });

    it('should return false for unknown models', () => {
      expect(manager.canAttackInMelee('Unknown1', 'Unknown2')).toBe(false);
    });
  });

  describe('getAllEngagements', () => {
    it('should return all engagement pairs', () => {
      const char1 = createTestCharacter('A');
      const char2 = createTestCharacter('B');
      const char3 = createTestCharacter('C');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 }); // Engaged with A
      registry.register(char3, { x: 10, y: 0 }); // Not engaged

      const engagements = manager.getAllEngagements();

      expect(engagements.length).toBe(1);
      expect(engagements[0].modelA).toBe('A');
      expect(engagements[0].modelB).toBe('B');
      expect(engagements[0].inBaseContact).toBe(true);
    });

    it('should filter by opposing sides', () => {
      const char1 = createTestCharacter('A1');
      const char2 = createTestCharacter('A2');
      const char3 = createTestCharacter('B1');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 }); // Engaged with A1 (same side)
      registry.register(char3, { x: 1.8, y: 0 }); // Engaged with A2 (opposing)

      const sideA = new Set(['A1', 'A2']);
      const sideB = new Set(['B1']);

      const engagements = manager.getAllEngagements([sideA, sideB]);

      expect(engagements.length).toBe(1);
      expect(engagements[0].modelB).toBe('B1');
    });
  });

  describe('isInAnyThreatZone', () => {
    it('should return model if position is in threat zone', () => {
      const char1 = createTestCharacter('Threat');

      registry.register(char1, { x: 0, y: 0 });

      const result = manager.isInAnyThreatZone({ x: 0.4, y: 0 });

      expect(result).not.toBeNull();
      expect(result?.modelId).toBe('Threat');
    });

    it('should return null if position is not in any threat zone', () => {
      const char1 = createTestCharacter('Threat');

      registry.register(char1, { x: 0, y: 0 });

      const result = manager.isInAnyThreatZone({ x: 10, y: 10 });

      expect(result).toBeNull();
    });
  });

  describe('getPotentialEngagements', () => {
    it('should return models that would be engaged at new position', () => {
      const char1 = createTestCharacter('Mover');
      const char2 = createTestCharacter('Target');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 5, y: 0 });

      const potential = manager.getPotentialEngagements('Mover', { x: 4.9, y: 0 });

      expect(potential.length).toBe(1);
      expect(potential).toContain('Target');
    });

    it('should return empty array for unknown model', () => {
      const potential = manager.getPotentialEngagements('Unknown', { x: 0, y: 0 });
      expect(potential).toEqual([]);
    });
  });

  describe('wouldBreakEngagement', () => {
    it('should return true if move breaks engagement', () => {
      const char1 = createTestCharacter('Engaged');
      const char2 = createTestCharacter('Enemy');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });

      const result = manager.wouldBreakEngagement('Engaged', { x: 5, y: 0 });

      expect(result).toBe(true);
    });

    it('should return false if move maintains engagement', () => {
      const char1 = createTestCharacter('Engaged');
      const char2 = createTestCharacter('Enemy');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });

      const result = manager.wouldBreakEngagement('Engaged', { x: 0.5, y: 0 });

      expect(result).toBe(false);
    });

    it('should return false if not currently engaged', () => {
      const char1 = createTestCharacter('Lone');

      registry.register(char1, { x: 0, y: 0 });

      const result = manager.wouldBreakEngagement('Lone', { x: 5, y: 0 });

      expect(result).toBe(false);
    });
  });

  describe('isDisengageMove', () => {
    it('should return true if move breaks all engagements', () => {
      const char1 = createTestCharacter('Engaged');
      const char2 = createTestCharacter('Enemy');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });

      const result = manager.isDisengageMove('Engaged', { x: 5, y: 0 });

      expect(result).toBe(true);
    });

    it('should return false if move maintains any engagement', () => {
      const char1 = createTestCharacter('Engaged');
      const char2 = createTestCharacter('Enemy');

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });

      const result = manager.isDisengageMove('Engaged', { x: 0.5, y: 0 });

      expect(result).toBe(false);
    });

    it('should return false if not currently engaged', () => {
      const char1 = createTestCharacter('Lone');

      registry.register(char1, { x: 0, y: 0 });

      const result = manager.isDisengageMove('Lone', { x: 5, y: 0 });

      expect(result).toBe(false);
    });
  });
});

describe('createEngagementManager', () => {
  it('should create manager with registered characters', () => {
    const char1 = new Character({
      name: 'Test1',
      archetype: 'Average',
      attributes: {
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
        str: 2, for: 2, mov: 2, siz: 3,
      },
      traits: [],
      items: [],
    });
    const char2 = new Character({
      name: 'Test2',
      archetype: 'Average',
      attributes: {
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
        str: 2, for: 2, mov: 2, siz: 3,
      },
      traits: [],
      items: [],
    });

    const positions = new Map([
      ['Test1', { x: 0, y: 0 }],
      ['Test2', { x: 0.9, y: 0 }],
    ]);

    const manager = createEngagementManager([char1, char2], positions);

    expect(manager.isEngaged('Test1', 'Test2')).toBe(true);
  });
});

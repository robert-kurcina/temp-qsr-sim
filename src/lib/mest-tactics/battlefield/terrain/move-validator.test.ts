import { describe, it, expect, beforeEach } from 'vitest';
import { MoveValidator, createMoveValidator } from './move-validator';
import { Battlefield } from '../Battlefield';
import { ModelRegistry } from '../spatial/model-registry';
import { EngagementManager } from '../spatial/engagement-manager';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Position } from './Position';

const createCharacter = (id: string, siz: number = 3): Character => {
  const profile: Profile = {
    name: id,
    archetype: 'Average',
    attributes: {
      cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
      str: 2, for: 2, mov: 2, siz,
    },
    traits: [],
    items: [],
  };
  const char = new Character(profile);
  char.id = id;
  return char;
};

describe('MoveValidator', () => {
  let battlefield: Battlefield;
  let registry: ModelRegistry;
  let engagementManager: EngagementManager;
  let validator: MoveValidator;

  beforeEach(() => {
    battlefield = new Battlefield(20, 20);
    registry = new ModelRegistry();
    engagementManager = new EngagementManager(registry);
    validator = new MoveValidator(battlefield, registry, engagementManager);
  });

  describe('validateMove', () => {
    it('should validate a simple move', () => {
      const char = createCharacter('A');
      registry.register(char, { x: 5, y: 5 });

      const result = validator.validateMove(char, { x: 5, y: 5 }, { x: 7, y: 5 });

      expect(result.valid).toBe(true);
      expect(result.blocked).toBe(false);
    });

    it('should detect out of bounds movement', () => {
      const char = createCharacter('A');
      registry.register(char, { x: 5, y: 5 });

      const result = validator.validateMove(char, { x: 5, y: 5 }, { x: 25, y: 5 });

      expect(result.valid).toBe(false);
      expect(result.blocked).toBe(true);
    });

    it('should detect engagement breaking', () => {
      const char1 = createCharacter('A');
      const char2 = createCharacter('B');

      registry.register(char1, { x: 5, y: 5 });
      registry.register(char2, { x: 5.9, y: 5 }); // In base contact

      const result = validator.validateMove(char1, { x: 5, y: 5 }, { x: 10, y: 5 }, {
        checkEngagement: true,
      });

      expect(result.engagementBroken).toBe(true);
    });

    it('should detect engagement gaining', () => {
      const char1 = createCharacter('A');
      const char2 = createCharacter('B');

      registry.register(char1, { x: 5, y: 5 });
      registry.register(char2, { x: 10, y: 5 });

      const result = validator.validateMove(char1, { x: 5, y: 5 }, { x: 10.9, y: 5 }, {
        checkEngagement: true,
      });

      expect(result.engagementGained).toBe(true);
    });

    it('should detect threat zones', () => {
      const char1 = createCharacter('A');
      const char2 = createCharacter('B');

      registry.register(char1, { x: 5, y: 5 });
      registry.register(char2, { x: 10, y: 5 });

      // Move into threat zone of B
      const result = validator.validateMove(char1, { x: 5, y: 5 }, { x: 9.5, y: 5 }, {
        checkThreatZones: true,
      });

      expect(result.inThreatZone).toBe(true);
      expect(result.threatModels).toContain('B');
    });
  });

  describe('checkCompulsoryActions', () => {
    it('should trigger fall back when surrounded', () => {
      const char = createCharacter('Center');
      const enemy1 = createCharacter('E1');
      const enemy2 = createCharacter('E2');

      registry.register(char, { x: 5, y: 5 });
      registry.register(enemy1, { x: 5.9, y: 5 });
      registry.register(enemy2, { x: 4.1, y: 5 });

      const triggers = validator.checkCompulsoryActions(char);

      const fallBack = triggers.find(t => t.actionType === 'fall_back');
      expect(fallBack).toBeDefined();
      expect(fallBack?.triggered).toBe(true);
    });

    it('should trigger disengage when engaged', () => {
      const char = createCharacter('A');
      const enemy = createCharacter('E');

      registry.register(char, { x: 5, y: 5 });
      registry.register(enemy, { x: 5.9, y: 5 });

      const triggers = validator.checkCompulsoryActions(char);

      const disengage = triggers.find(t => t.actionType === 'disengage');
      expect(disengage).toBeDefined();
      expect(disengage?.triggered).toBe(true);
    });

    it('should trigger morale test for high fear', () => {
      const char = createCharacter('A');
      char.state.fearTokens = 3;

      registry.register(char, { x: 5, y: 5 });

      const triggers = validator.checkCompulsoryActions(char);

      const morale = triggers.find(t => t.actionType === 'morale_test');
      expect(morale).toBeDefined();
      expect(morale?.triggered).toBe(true);
    });
  });

  describe('isSafeRetreat', () => {
    it('should return true for non-engaged model', () => {
      const char = createCharacter('A');
      registry.register(char, { x: 5, y: 5 });

      const result = validator.isSafeRetreat(char, { x: 5, y: 5 }, { x: 10, y: 5 });

      expect(result).toBe(true);
    });

    it('should return true for moving away from enemies', () => {
      const char = createCharacter('A');
      const enemy = createCharacter('E');

      registry.register(char, { x: 5, y: 5 });
      registry.register(enemy, { x: 5.9, y: 5 });

      // Move away from enemy
      const result = validator.isSafeRetreat(char, { x: 5, y: 5 }, { x: 0, y: 5 });

      expect(result).toBe(true);
    });
  });
});

describe('createMoveValidator', () => {
  it('should create validator with registered characters', () => {
    const battlefield = new Battlefield(20, 20);
    const char1 = createCharacter('A');
    const char2 = createCharacter('B');

    const positions = new Map([
      ['A', { x: 5, y: 5 }],
      ['B', { x: 5.9, y: 5 }],
    ]);

    const validator = createMoveValidator(battlefield, [char1, char2], positions);

    const result = validator.validateMove(char1, { x: 5, y: 5 }, { x: 10, y: 5 });
    expect(result.engagementBroken).toBe(true);
  });
});

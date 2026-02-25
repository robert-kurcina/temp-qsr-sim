import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRegistry, MeasurementUtils } from './model-registry';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';
import { Position } from '../Position';
import { SpatialModel } from './spatial-rules';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  const createTestCharacter = (name: string, siz: number): Character => {
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
  });

  describe('register', () => {
    it('should register a character as a spatial model', () => {
      const character = createTestCharacter('Test', 3);
      const position: Position = { x: 5, y: 5 };

      registry.register(character, position);

      const model = registry.getModel(character.id);
      expect(model).toBeDefined();
      expect(model?.id).toBe('Test');
      expect(model?.position).toEqual(position);
      expect(model?.siz).toBe(3);
    });

    it('should calculate correct base diameter from SIZ', () => {
      const character = createTestCharacter('Test', 3);
      registry.register(character, { x: 0, y: 0 });

      const model = registry.getModel('Test');
      expect(model?.baseDiameter).toBe(1); // SIZ 3 = 1 MU
    });

    it('should set initial status flags from character state', () => {
      const character = createTestCharacter('Test', 3);
      character.state.isAttentive = false;
      character.state.isOrdered = false;

      registry.register(character, { x: 0, y: 0 });

      const model = registry.getModel('Test');
      expect(model?.isAttentive).toBe(false);
      expect(model?.isOrdered).toBe(false);
    });
  });

  describe('updatePosition', () => {
    it('should update a model position', () => {
      const character = createTestCharacter('Test', 3);
      registry.register(character, { x: 0, y: 0 });

      const result = registry.updatePosition('Test', { x: 10, y: 10 });

      expect(result).toBe(true);
      const model = registry.getModel('Test');
      expect(model?.position).toEqual({ x: 10, y: 10 });
    });

    it('should return false for unknown model', () => {
      const result = registry.updatePosition('Unknown', { x: 10, y: 10 });
      expect(result).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update status flags from character', () => {
      const character = createTestCharacter('Test', 3);
      registry.register(character, { x: 0, y: 0 });

      character.state.isAttentive = false;
      character.state.isOrdered = false;
      registry.updateStatus('Test', character);

      const model = registry.getModel('Test');
      expect(model?.isAttentive).toBe(false);
      expect(model?.isOrdered).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should remove a model from registry', () => {
      const character = createTestCharacter('Test', 3);
      registry.register(character, { x: 0, y: 0 });

      const result = registry.unregister('Test');

      expect(result).toBe(true);
      expect(registry.getModel('Test')).toBeUndefined();
    });

    it('should return false for unknown model', () => {
      const result = registry.unregister('Unknown');
      expect(result).toBe(false);
    });
  });

  describe('getModelsInRange', () => {
    it('should return models within range', () => {
      const char1 = createTestCharacter('Center', 3);
      const char2 = createTestCharacter('Near', 3);
      const char3 = createTestCharacter('Far', 3);

      registry.register(char1, { x: 5, y: 5 });
      registry.register(char2, { x: 7, y: 5 }); // 2 MU away
      registry.register(char3, { x: 20, y: 5 }); // 15 MU away

      const inRange = registry.getModelsInRange({ x: 5, y: 5 }, 5);

      expect(inRange.length).toBe(2); // Center and Near
      expect(inRange.map(m => m.id)).toContain('Near');
    });
  });

  describe('getModelsInBaseContact', () => {
    it('should return models in base contact', () => {
      const char1 = createTestCharacter('Model1', 3); // base = 1 MU
      const char2 = createTestCharacter('Model2', 3); // base = 1 MU

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 }); // Within 1 MU (base contact)

      const contacts = registry.getModelsInBaseContact('Model1');

      expect(contacts.length).toBe(1);
      expect(contacts[0].id).toBe('Model2');
    });

    it('should not return models not in base contact', () => {
      const char1 = createTestCharacter('Model1', 3);
      const char2 = createTestCharacter('Model2', 3);

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 2, y: 0 }); // 2 MU apart (not in contact)

      const contacts = registry.getModelsInBaseContact('Model1');

      expect(contacts.length).toBe(0);
    });
  });

  describe('getEngagedModels', () => {
    it('should return only opposing models in base contact', () => {
      const char1 = createTestCharacter('Ally1', 3);
      const char2 = createTestCharacter('Ally2', 3);
      const char3 = createTestCharacter('Enemy1', 3);

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 0.9, y: 0 });
      registry.register(char3, { x: -0.9, y: 0 });

      const opposingIds = new Set(['Enemy1']);
      const engaged = registry.getEngagedModels('Ally1', opposingIds);

      expect(engaged.length).toBe(1);
      expect(engaged[0].id).toBe('Enemy1');
    });
  });

  describe('getAllModels', () => {
    it('should return all registered models', () => {
      const char1 = createTestCharacter('Model1', 3);
      const char2 = createTestCharacter('Model2', 3);

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 10, y: 10 });

      const all = registry.getAllModels();

      expect(all.length).toBe(2);
      expect(all.map(m => m.id)).toEqual(expect.arrayContaining(['Model1', 'Model2']));
    });
  });

  describe('clear', () => {
    it('should remove all models', () => {
      const char1 = createTestCharacter('Model1', 3);
      const char2 = createTestCharacter('Model2', 3);

      registry.register(char1, { x: 0, y: 0 });
      registry.register(char2, { x: 10, y: 10 });

      registry.clear();

      expect(registry.getCount()).toBe(0);
      expect(registry.getAllModels().length).toBe(0);
    });
  });
});

describe('MeasurementUtils', () => {
  const createModel = (id: string, x: number, y: number, baseDiameter = 1, siz = 3): SpatialModel => ({
    id,
    position: { x, y },
    baseDiameter,
    siz,
  });

  describe('centerToCenter', () => {
    it('should calculate center-to-center distance', () => {
      const a = createModel('A', 0, 0);
      const b = createModel('B', 3, 4);

      const distance = MeasurementUtils.centerToCenter(a, b);

      expect(distance).toBe(5); // 3-4-5 triangle
    });
  });

  describe('edgeToEdge', () => {
    it('should calculate edge-to-edge distance', () => {
      const a = createModel('A', 0, 0, 1); // radius 0.5
      const b = createModel('B', 3, 0, 1); // radius 0.5

      const distance = MeasurementUtils.edgeToEdge(a, b);

      expect(distance).toBe(2); // 3 - 0.5 - 0.5 = 2
    });

    it('should return 0 for overlapping models', () => {
      const a = createModel('A', 0, 0, 2);
      const b = createModel('B', 0.5, 0, 2);

      const distance = MeasurementUtils.edgeToEdge(a, b);

      expect(distance).toBe(0);
    });
  });

  describe('isBaseContact', () => {
    it('should return true for models in base contact', () => {
      const a = createModel('A', 0, 0, 1);
      const b = createModel('B', 0.9, 0, 1);

      expect(MeasurementUtils.isBaseContact(a, b)).toBe(true);
    });

    it('should return false for models not in base contact', () => {
      const a = createModel('A', 0, 0, 1);
      const b = createModel('B', 2, 0, 1);

      expect(MeasurementUtils.isBaseContact(a, b)).toBe(false);
    });
  });

  describe('calculateMeleeReach', () => {
    it('should calculate melee reach with no weapon modifier', () => {
      const model = createModel('A', 0, 0, 1);

      const reach = MeasurementUtils.calculateMeleeReach(model);

      expect(reach).toBe(0.5); // baseDiameter / 2
    });

    it('should add weapon reach modifier', () => {
      const model = createModel('A', 0, 0, 1);

      const reach = MeasurementUtils.calculateMeleeReach(model, 0.5);

      expect(reach).toBe(1); // 0.5 + 0.5
    });
  });

  describe('canReachInMelee', () => {
    it('should return true if target is in reach', () => {
      const attacker = createModel('A', 0, 0, 1);
      const target = createModel('B', 0.8, 0, 1);

      expect(MeasurementUtils.canReachInMelee(attacker, target, 0)).toBe(true);
    });

    it('should return false if target is out of reach', () => {
      const attacker = createModel('A', 0, 0, 1);
      const target = createModel('B', 2, 0, 1);

      expect(MeasurementUtils.canReachInMelee(attacker, target, 0)).toBe(false);
    });

    it('should consider weapon reach modifier', () => {
      const attacker = createModel('A', 0, 0, 1);
      const target = createModel('B', 1.8, 0, 1); // edge-to-edge = 1.8 - 0.5 - 0.5 = 0.8

      expect(MeasurementUtils.canReachInMelee(attacker, target, 0)).toBe(false); // reach = 0.5
      expect(MeasurementUtils.canReachInMelee(attacker, target, 0.5)).toBe(true); // reach = 1.0
    });
  });

  describe('isInThreatZone', () => {
    it('should return true for positions in threat zone', () => {
      const model = createModel('A', 0, 0, 1);

      expect(MeasurementUtils.isInThreatZone(model, { x: 0.4, y: 0 })).toBe(true);
    });

    it('should return false for positions outside threat zone', () => {
      const model = createModel('A', 0, 0, 1);

      expect(MeasurementUtils.isInThreatZone(model, { x: 1, y: 0 })).toBe(false);
    });

    it('should consider weapon reach', () => {
      const model = createModel('A', 0, 0, 1);

      expect(MeasurementUtils.isInThreatZone(model, { x: 0.8, y: 0 }, 0.5)).toBe(true);
    });
  });

  describe('midpoint', () => {
    it('should calculate midpoint between two positions', () => {
      const a = { x: 0, y: 0 };
      const b = { x: 10, y: 10 };

      const mid = MeasurementUtils.midpoint(a, b);

      expect(mid).toEqual({ x: 5, y: 5 });
    });
  });

  describe('bearing', () => {
    it('should calculate bearing in degrees', () => {
      const from = { x: 0, y: 0 };
      const to = { x: 1, y: 0 };

      const angle = MeasurementUtils.bearing(from, to);

      expect(angle).toBe(0); // East
    });

    it('should handle different quadrants', () => {
      const from = { x: 0, y: 0 };

      expect(MeasurementUtils.bearing(from, { x: 0, y: 1 })).toBe(90); // North
      expect(MeasurementUtils.bearing(from, { x: -1, y: 0 })).toBe(180); // West
      expect(MeasurementUtils.bearing(from, { x: 0, y: -1 })).toBe(270); // South
    });
  });

  describe('angleBetweenPoints', () => {
    it('should calculate angle at middle point', () => {
      const a = { x: -1, y: 0 };
      const b = { x: 0, y: 0 };
      const c = { x: 1, y: 0 };

      const angle = MeasurementUtils.angleBetweenPoints(a, b, c);

      expect(angle).toBe(180); // Straight line through b
    });

    it('should return 90 degrees for right angle', () => {
      const a = { x: 0, y: -1 };
      const b = { x: 0, y: 0 };
      const c = { x: 1, y: 0 };

      const angle = MeasurementUtils.angleBetweenPoints(a, b, c);

      expect(angle).toBeCloseTo(90, 5);
    });
  });

  describe('isFlankingConfiguration', () => {
    it('should return true for flanking positions', () => {
      const attacker = createModel('A', -5, 0, 1);
      const ally = createModel('B', 5, 0, 1);
      const target = createModel('T', 0, 0, 1);

      expect(MeasurementUtils.isFlankingConfiguration(attacker, ally, target)).toBe(true);
    });

    it('should return false for same-side positions', () => {
      const attacker = createModel('A', -5, 0, 1);
      const ally = createModel('B', -3, 0, 1);
      const target = createModel('T', 0, 0, 1);

      expect(MeasurementUtils.isFlankingConfiguration(attacker, ally, target)).toBe(false);
    });
  });

  describe('isSurrounded', () => {
    it('should return true when engaged by multiple enemies', () => {
      const model = createModel('M', 0, 0, 1);
      const enemy1 = createModel('E1', 0.9, 0, 1);
      const enemy2 = createModel('E2', -0.9, 0, 1);

      expect(MeasurementUtils.isSurrounded(model, [enemy1, enemy2], 2)).toBe(true);
    });

    it('should return false when not surrounded', () => {
      const model = createModel('M', 0, 0, 1);
      const enemy1 = createModel('E1', 0.9, 0, 1);

      expect(MeasurementUtils.isSurrounded(model, [enemy1], 2)).toBe(false);
    });
  });

  describe('getCohesionDistance', () => {
    it('should return minimum distance to squad mates', () => {
      const model = createModel('M', 0, 0, 1);
      const squad1 = createModel('S1', 3, 0, 1);
      const squad2 = createModel('S2', 5, 0, 1);

      const distance = MeasurementUtils.getCohesionDistance(model, [squad1, squad2]);

      expect(distance).toBe(2); // Edge-to-edge to S1
    });

    it('should return Infinity for empty squad', () => {
      const model = createModel('M', 0, 0, 1);

      const distance = MeasurementUtils.getCohesionDistance(model, []);

      expect(distance).toBe(Infinity);
    });
  });

  describe('maintainsCohesion', () => {
    it('should return true when within cohesion distance', () => {
      const model = createModel('M', 0, 0, 1);
      const squad = createModel('S', 2, 0, 1);

      expect(MeasurementUtils.maintainsCohesion(model, [squad], 3)).toBe(true);
    });

    it('should return false when outside cohesion distance', () => {
      const model = createModel('M', 0, 0, 1);
      const squad = createModel('S', 10, 0, 1);

      expect(MeasurementUtils.maintainsCohesion(model, [squad], 3)).toBe(false);
    });
  });

  describe('findNearestSquadMate', () => {
    it('should find nearest squad mate', () => {
      const model = createModel('M', 0, 0, 1);
      const squad1 = createModel('S1', 10, 0, 1);
      const squad2 = createModel('S2', 3, 0, 1);

      const nearest = MeasurementUtils.findNearestSquadMate(model, [squad1, squad2]);

      expect(nearest?.id).toBe('S2');
    });

    it('should return null for empty squad', () => {
      const model = createModel('M', 0, 0, 1);

      const nearest = MeasurementUtils.findNearestSquadMate(model, []);

      expect(nearest).toBe(null);
    });
  });

  describe('getGroupCenter', () => {
    it('should calculate center of mass', () => {
      const models = [
        createModel('A', 0, 0, 1),
        createModel('B', 10, 0, 1),
        createModel('C', 5, 10, 1),
      ];

      const center = MeasurementUtils.getGroupCenter(models);

      expect(center.x).toBe(5);
      expect(center.y).toBeCloseTo(10 / 3, 3);
    });

    it('should return origin for empty group', () => {
      const center = MeasurementUtils.getGroupCenter([]);
      expect(center).toEqual({ x: 0, y: 0 });
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { LOSValidator, LOFValidator } from './los-validator';
import { Battlefield } from './Battlefield';
import { TerrainElement } from './TerrainElement';
import { SpatialModel } from './spatial-rules';
import { Position } from './Position';
import { Character } from '../Character';
import { Profile } from '../Profile';

describe('LOSValidator', () => {
  let battlefield: Battlefield;

  const createModel = (id: string, x: number, y: number, baseDiameter = 1, siz = 3): SpatialModel => ({
    id,
    position: { x, y },
    baseDiameter,
    siz,
  });

  const createCharacter = (id: string): Character => {
    const profile: Profile = {
      name: id,
      archetype: 'Average',
      attributes: {
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
        str: 2, for: 2, mov: 2, siz: 3,
      },
      traits: [],
      items: [],
    };
    const char = new Character(profile);
    char.id = id;
    return char;
  };

  beforeEach(() => {
    battlefield = new Battlefield(20, 20);
  });

  describe('checkLOS', () => {
    it('should return clear LOS between visible models', () => {
      const source = createModel('A', 0, 0);
      const target = createModel('B', 5, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 5, y: 0 });

      const result = LOSValidator.checkLOS(battlefield, source, target);

      expect(result.clear).toBe(true);
      expect(result.blockedByModel).toBeUndefined();
    });

    it('should detect model occlusion for KO models', () => {
      const source = createModel('A', 0, 0);
      const target = createModel('C', 6, 0);

      // Place a KO model in between (KO models block at reduced radius)
      const blocker = createCharacter('B');
      blocker.state.isKOd = true;

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(blocker, { x: 3, y: 0 });
      battlefield.placeCharacter(createCharacter('C'), { x: 6, y: 0 });

      const result = LOSValidator.checkLOS(battlefield, source, target);

      // KO model should block LOS
      expect(result.blockedByModel).toBe('B');
    });
  });

  describe('checkLOSToPosition', () => {
    it('should check LOS to a point', () => {
      const source = createModel('A', 0, 0);
      const targetPos: Position = { x: 5, y: 0 };

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });

      const result = LOSValidator.checkLOSToPosition(battlefield, source, targetPos);

      expect(result.clear).toBe(true);
    });
  });

  describe('findOccludingModel', () => {
    it('should find KO model blocking LOS', () => {
      const source = createModel('A', 0, 0);
      const target = createModel('C', 6, 0);

      // Place a KO model in between
      const blocker = createCharacter('B');
      blocker.state.isKOd = true;

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(blocker, { x: 3, y: 0 });
      battlefield.placeCharacter(createCharacter('C'), { x: 6, y: 0 });

      const occluder = LOSValidator.findOccludingModel(battlefield, source, target);

      expect(occluder).toBe('B');
    });

    it('should return null when no occlusion', () => {
      const source = createModel('A', 0, 0);
      const target = createModel('B', 5, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 5, y: 0 });

      const occluder = LOSValidator.findOccludingModel(battlefield, source, target);

      expect(occluder).toBeNull();
    });
  });

  describe('classifyCover', () => {
    it('should return no cover for open models', () => {
      const source = createModel('A', 0, 0);
      const target = createModel('B', 5, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 5, y: 0 });

      const cover = LOSValidator.classifyCover(battlefield, source, target);

      expect(cover.partial).toBe(false);
      expect(cover.soft).toBe(false);
      expect(cover.hard).toBe(false);
    });
  });

  describe('isVisibleFromAny', () => {
    it('should return true if visible from any observer', () => {
      const target: Position = { x: 5, y: 0 };
      const observer1 = createModel('A', 0, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });

      const result = LOSValidator.isVisibleFromAny(battlefield, target, [observer1]);

      expect(result.visible).toBe(true);
      expect(result.observerId).toBe('A');
    });
  });

  describe('getObserversOf', () => {
    it('should return all models that can see target', () => {
      const target = createModel('Target', 5, 0);
      const observer1 = createModel('A', 0, 0);
      const observer2 = createModel('B', 10, 0);

      battlefield.placeCharacter(createCharacter('Target'), { x: 5, y: 0 });
      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 10, y: 0 });

      const observers = LOSValidator.getObserversOf(battlefield, target, [observer1, observer2]);

      expect(observers.length).toBe(2);
      expect(observers).toContain('A');
      expect(observers).toContain('B');
    });
  });

  describe('hasMutualLOS', () => {
    it('should return true for mutual LOS', () => {
      const source = createModel('A', 0, 0);
      const target = createModel('B', 5, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 5, y: 0 });

      const result = LOSValidator.hasMutualLOS(battlefield, source, target);

      expect(result).toBe(true);
    });
  });

  describe('isInTheOpen', () => {
    it('should return true for model without cover', () => {
      const model = createModel('A', 5, 5);

      battlefield.placeCharacter(createCharacter('A'), { x: 5, y: 5 });

      const result = LOSValidator.isInTheOpen(battlefield, model);

      expect(result).toBe(true);
    });

    it('should return false for model in soft cover (Tree)', () => {
      const model = createModel('A', 5, 5);
      battlefield.placeCharacter(createCharacter('A'), { x: 5, y: 5 });
      battlefield.addTerrainElement(new TerrainElement('Tree', { x: 5, y: 5 }));

      const result = LOSValidator.isInTheOpen(battlefield, model);

      expect(result).toBe(false);
    });
  });

  describe('getBestCoverAt', () => {
    it('should return none when no cover', () => {
      const result = LOSValidator.getBestCoverAt(battlefield, { x: 5, y: 5 }, 1);

      expect(result.type).toBe('none');
    });

    it('should return soft cover type for Tree', () => {
      battlefield.addTerrainElement(new TerrainElement('Tree', { x: 5, y: 5 }));

      const result = LOSValidator.getBestCoverAt(battlefield, { x: 5, y: 5 }, 1);

      expect(result.type).toBe('soft');
    });

    it('should return hard cover type for Small Rocks', () => {
      battlefield.addTerrainElement(new TerrainElement('Small Rocks', { x: 5, y: 5 }));

      const result = LOSValidator.getBestCoverAt(battlefield, { x: 5, y: 5 }, 1);

      expect(result.type).toBe('hard');
    });
  });
});

describe('LOFValidator', () => {
  let battlefield: Battlefield;

  const createCharacter = (id: string): Character => {
    const profile: Profile = {
      name: id,
      archetype: 'Average',
      attributes: {
        cca: 2, rca: 2, ref: 2, int: 2, pow: 2,
        str: 2, for: 2, mov: 2, siz: 3,
      },
      traits: [],
      items: [],
    };
    const char = new Character(profile);
    char.id = id;
    return char;
  };

  const createModel = (id: string, x: number, y: number, baseDiameter = 1): SpatialModel => ({
    id,
    position: { x, y },
    baseDiameter,
    siz: 3,
  });

  beforeEach(() => {
    battlefield = new Battlefield(20, 20);
  });

  describe('checkLOF', () => {
    it('should return clear LOF with no blockers', () => {
      const attacker = createModel('A', 0, 0);
      const target = createModel('B', 5, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 5, y: 0 });

      const result = LOFValidator.checkLOF(battlefield, attacker, target);

      expect(result.clear).toBe(true);
      expect(result.friendlyFireRisk.candidates.length).toBe(0);
    });

    it('should detect models along LOF', () => {
      const attacker = createModel('A', 0, 0);
      const friendly = createModel('F', 2, 1); // Offset from LOF line
      const target = createModel('B', 5, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('F'), { x: 2, y: 1 });
      battlefield.placeCharacter(createCharacter('B'), { x: 5, y: 0 });

      const result = LOFValidator.checkLOF(battlefield, attacker, target, { lofWidthMu: 2, checkFriendlyFire: true });

      expect(result.clear).toBe(true);
      // With wider LOF, model F should be detected
      expect(result.friendlyFireRisk.candidates.length).toBeGreaterThan(0);
    });
  });

  describe('findBestTarget', () => {
    it('should find closest valid target', () => {
      const attacker = createModel('A', 0, 0);
      const target1 = createModel('B', 3, 0);
      const target2 = createModel('C', 6, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 3, y: 0 });
      battlefield.placeCharacter(createCharacter('C'), { x: 6, y: 0 });

      const best = LOFValidator.findBestTarget(
        battlefield,
        attacker,
        [target1, target2],
        10,
        { preferClosest: true }
      );

      expect(best?.id).toBe('B');
    });

    it('should return null if no valid targets', () => {
      const attacker = createModel('A', 0, 0);
      const target = createModel('B', 20, 0);

      battlefield.placeCharacter(createCharacter('A'), { x: 0, y: 0 });
      battlefield.placeCharacter(createCharacter('B'), { x: 20, y: 0 });

      const best = LOFValidator.findBestTarget(
        battlefield,
        attacker,
        [target],
        5,
        { preferClosest: true }
      );

      expect(best).toBeNull();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { Battlefield } from './Battlefield';
import { TerrainElement } from './TerrainElement';
import { SpatialRules } from './spatial-rules';
import { Character } from '../Character';
import { Profile } from '../Profile';

describe('SpatialRules', () => {
  it('should detect engagement via base contact', () => {
    const a = { id: 'a', position: { x: 0, y: 0 }, baseDiameter: 2 };
    const b = { id: 'b', position: { x: 1.5, y: 0 }, baseDiameter: 2 };
    const c = { id: 'c', position: { x: 4, y: 0 }, baseDiameter: 2 };

    expect(SpatialRules.isEngaged(a, b)).toBe(true);
    expect(SpatialRules.isEngaged(a, c)).toBe(false);
    expect(SpatialRules.getEngagedModels(a, [b, c]).map(model => model.id)).toEqual(['b']);
  });

  it('should detect direct cover when defender overlaps cover terrain', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2 };
    const defender = { id: 'defender', position: { x: 6, y: 6 }, baseDiameter: 2 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasDirectCover).toBe(true);
    expect(cover.hasInterveningCover).toBe(false);
  });

  it('should detect intervening cover when terrain sits between attacker and defender', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 5, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2 };
    const defender = { id: 'defender', position: { x: 9, y: 6 }, baseDiameter: 2 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasDirectCover).toBe(false);
    expect(cover.hasInterveningCover).toBe(true);
  });

  it('should report blocked LOS for obstacle terrain', () => {
    const battlefield = new Battlefield(12, 12);
    const wall = new TerrainElement('Medium Wall', { x: 6, y: 6 });
    battlefield.addTerrain(wall.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 2 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(false);
    expect(cover.blockingFeature).toBeTruthy();
    expect(cover.hasDirectCover).toBe(false);
    expect(cover.hasInterveningCover).toBe(false);
  });

  it('should block LOS for models larger than source and target', () => {
    const battlefield = new Battlefield(12, 12);
    const blockerProfile: Profile = {
      name: 'Blocker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 6 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 },
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: [],
      allTraits: [],
    };
    const blocker = new Character(blockerProfile);
    blocker.finalAttributes = blocker.attributes;

    battlefield.placeCharacter(blocker, { x: 6, y: 6 });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(false);
    expect(cover.blockingModelId).toBe(blocker.id);
  });

  it('should block LOS at half base diameter for KO models', () => {
    const battlefield = new Battlefield(12, 12);
    const blockerProfile: Profile = {
      name: 'KO Blocker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 6 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 },
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: [],
      allTraits: [],
    };
    const blocker = new Character(blockerProfile);
    blocker.finalAttributes = blocker.attributes;
    blocker.state.isKOd = true;

    battlefield.placeCharacter(blocker, { x: 6, y: 6 });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(false);
    expect(cover.blockingModelId).toBe(blocker.id);
  });

  it('should provide cover for targets SIZ - 3 or smaller from KO models', () => {
    const battlefield = new Battlefield(12, 12);
    const blockerProfile: Profile = {
      name: 'KO Cover',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 6 } },
      items: [],
      totalBp: 0,
      adjustedBp: 0,
      adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
      physicality: 0,
      adjPhysicality: 0,
      durability: 0,
      adjDurability: 0,
      burden: { totalLaden: 0, totalBurden: 0 },
      totalHands: 0,
      totalDeflect: 0,
      totalAR: 0,
      finalTraits: [],
      allTraits: [],
    };
    const blocker = new Character(blockerProfile);
    blocker.finalAttributes = blocker.attributes;
    blocker.state.isKOd = true;

    battlefield.placeCharacter(blocker, { x: 6, y: 7 });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasInterveningCover).toBe(true);
    expect(cover.coveringModelId).toBe(blocker.id);
  });
});

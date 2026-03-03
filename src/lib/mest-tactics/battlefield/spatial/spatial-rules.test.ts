import { describe, it, expect } from 'vitest';
import { Battlefield } from '../Battlefield';
import { TerrainElement } from '../terrain/TerrainElement';
import { TerrainType } from '../terrain/Terrain';
import { SpatialRules } from './spatial-rules';
import { Character } from '../../core/Character';
import { Profile } from '../../core/Profile';

describe('SpatialRules', () => {
  it('should detect engagement via base contact', () => {
    const a = { id: 'a', position: { x: 0, y: 0 }, baseDiameter: 2 };
    const b = { id: 'b', position: { x: 1.5, y: 0 }, baseDiameter: 2 };
    const c = { id: 'c', position: { x: 4, y: 0 }, baseDiameter: 2 };

    expect(SpatialRules.isEngaged(a, b)).toBe(true);
    expect(SpatialRules.isEngaged(a, c)).toBe(false);
    expect(SpatialRules.getEngagedModels(a, [b, c]).map(model => model.id)).toEqual(['b']);
  });

  it('should never engage when either model is Panicked (PN.5)', () => {
    const calm = { id: 'calm', position: { x: 0, y: 0 }, baseDiameter: 2, isPanicked: false };
    const panicked = { id: 'panicked', position: { x: 1.5, y: 0 }, baseDiameter: 2, isPanicked: true };

    expect(SpatialRules.isEngaged(calm, panicked)).toBe(false);
    expect(SpatialRules.isEngaged(panicked, calm)).toBe(false);
  });

  it('should block LOS when defender overlaps cover terrain for smaller models', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 3 };
    const defender = { id: 'defender', position: { x: 6, y: 6 }, baseDiameter: 2, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(false);
    expect(cover.blockingFeature).toBeTruthy();
  });

  it('should block LOS when cover terrain sits between attacker and defender for smaller models', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 5, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 3 };
    const defender = { id: 'defender', position: { x: 9, y: 6 }, baseDiameter: 2, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(false);
    expect(cover.blockingFeature).toBeTruthy();
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

  it('should allow LOS for cover terrain when models exceed cover SIZ', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 13 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 2, siz: 13 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
  });

  it('should keep LOS clear when terrain is exactly half base-height (LOS.5)', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain({
      id: 'rocks-band',
      type: TerrainType.Rough,
      vertices: [
        { x: 5.2, y: 5.2 },
        { x: 6.8, y: 5.2 },
        { x: 6.8, y: 6.8 },
        { x: 5.2, y: 6.8 },
      ],
      meta: {
        name: 'Small Rocks',
        movement: 'Rough',
        los: 'Hard',
        shape: 'rectangle',
        dimensions: { width: 1.6, length: 1.6 },
        category: 'rocks',
      },
    });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 1 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 1 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
  });

  it('should grant direct cover just beyond the cover footprint', () => {
    const battlefield = new Battlefield(12, 12);
    const tree = new TerrainElement('Tree', { x: 6, y: 6 });
    battlefield.addTerrain(tree.toFeature());

    const attacker = { id: 'attacker', position: { x: 9, y: 6 }, baseDiameter: 2 };
    const defender = { id: 'defender', position: { x: 7.6, y: 6 }, baseDiameter: 1 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasDirectCover).toBe(true);
  });

  it('should treat clear terrain as no cover and no LOS penalty (TR.1)', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain({
      id: 'clear-strip',
      type: TerrainType.Clear,
      vertices: [
        { x: 4, y: 5 },
        { x: 8, y: 5 },
        { x: 8, y: 7 },
        { x: 4, y: 7 },
      ],
      meta: {
        category: 'area',
        los: 'Clear',
        movement: 'Clear',
      },
    });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 2, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasDirectCover).toBe(false);
    expect(cover.hasInterveningCover).toBe(false);
  });

  it('should allow rough terrain to provide cover without hard LOS block (TR.2)', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain(new TerrainElement('Small Rocks', { x: 6, y: 6 }).toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 6 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 2, siz: 6 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasInterveningCover).toBe(true);
  });

  it('should allow difficult terrain to provide cover without hard LOS block (TR.3)', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain(new TerrainElement('Shrub', { x: 6, y: 6 }).toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 2, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 2, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasInterveningCover).toBe(true);
  });

  it('should compute ~half visible-area obscuration from terrain (CV.1)', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain({
      id: 'cover-plate',
      type: TerrainType.Rough,
      vertices: [
        { x: 8.6, y: 5.2 },
        { x: 9.8, y: 5.2 },
        { x: 9.8, y: 6.8 },
        { x: 8.6, y: 6.8 },
      ],
      meta: {
        name: 'Small Rocks',
        movement: 'Rough',
        los: 'Hard',
        shape: 'rectangle',
        dimensions: { width: 1.2, length: 1.6 },
        category: 'rocks',
      },
    });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.visibleAreaObscuredFraction).toBeGreaterThanOrEqual(0.4);
    expect(cover.isHalfVisibleAreaObscured).toBe(true);
    expect(cover.hasDirectCover || cover.hasInterveningCover).toBe(true);
  });

  it('should reduce obscuration fraction for taller visible area (LOS.2)', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain({
      id: 'cover-plate',
      type: TerrainType.Rough,
      vertices: [
        { x: 8.6, y: 5.2 },
        { x: 9.8, y: 5.2 },
        { x: 9.8, y: 6.8 },
        { x: 8.6, y: 6.8 },
      ],
      meta: {
        name: 'Small Rocks',
        movement: 'Rough',
        los: 'Hard',
        shape: 'rectangle',
        dimensions: { width: 1.2, length: 1.6 },
        category: 'rocks',
      },
    });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 3 };
    const shortTarget = { id: 'short', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 3 };
    const tallTarget = { id: 'tall', position: { x: 10, y: 6 }, baseDiameter: 2, siz: 3 };

    const shortCover = SpatialRules.getCoverResult(battlefield, attacker, shortTarget);
    const tallCover = SpatialRules.getCoverResult(battlefield, attacker, tallTarget);

    expect(shortCover.visibleAreaObscuredFraction).toBeGreaterThan(tallCover.visibleAreaObscuredFraction);
  });

  it('should not grant base-height-only cover when terrain is closer to attacker than target (CV.5)', () => {
    const battlefield = new Battlefield(14, 14);
    const rocks = new TerrainElement('Small Rocks', { x: 2, y: 7 });
    battlefield.addTerrain(rocks.toFeature());

    const attacker = { id: 'attacker', position: { x: 2, y: 7 }, baseDiameter: 1.6, siz: 5 };
    const defender = { id: 'defender', position: { x: 11, y: 7 }, baseDiameter: 1.6, siz: 5 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
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

  it('should provide intervening cover when LOF crosses a distracted model', () => {
    const battlefield = new Battlefield(12, 12);
    const distractProfile: Profile = {
      name: 'Distracted',
      archetype: { attributes: { cca: 0, rca: 0, ref: 0, int: 0, pow: 0, str: 0, for: 0, mov: 0, siz: 3 } },
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
    const distracted = new Character(distractProfile);
    distracted.finalAttributes = distracted.attributes;
    distracted.state.delayTokens = 1;
    distracted.refreshStatusFlags();

    battlefield.placeCharacter(distracted, { x: 6, y: 6 });

    const attacker = { id: 'attacker', position: { x: 2, y: 6 }, baseDiameter: 1, siz: 3 };
    const defender = { id: 'defender', position: { x: 10, y: 6 }, baseDiameter: 1, siz: 3 };

    const cover = SpatialRules.getCoverResult(battlefield, attacker, defender);
    expect(cover.hasLOS).toBe(true);
    expect(cover.hasInterveningCover).toBe(true);
    expect(cover.coveringModelId).toBe(distracted.id);
  });
});

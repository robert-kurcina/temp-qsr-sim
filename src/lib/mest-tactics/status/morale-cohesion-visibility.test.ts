import { describe, expect, it } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { applyFearFromAllyKO } from './morale';

function makeCharacter(name: string, siz = 3): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca: 0,
        rca: 0,
        ref: 2,
        int: 2,
        pow: 1,
        str: 2,
        for: 2,
        mov: 4,
        siz,
      },
      traits: [],
      bp: 0,
    },
    items: [],
    totalBp: 0,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 0,
    adjPhysicality: 0,
    durability: 0,
    adjDurability: 0,
    burden: { totalLaden: 0, totalBurden: 0 } as any,
    totalHands: 0,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return character;
}

describe('morale cohesion and visibility integration', () => {
  it('does not apply ally fear outside cohesion range', () => {
    const battlefield = new Battlefield(24, 24);
    const fallen = makeCharacter('fallen');
    const ally = makeCharacter('ally');

    battlefield.placeCharacter(fallen, { x: 6, y: 6 });
    battlefield.placeCharacter(ally, { x: 11, y: 6 }); // > 4 MU default cohesion

    const results = applyFearFromAllyKO(battlefield, fallen, [ally], {
      visibilityOrMu: 16,
      requireLOS: false,
      rollsById: { [ally.id]: [1, 1] },
    });

    expect(results.length).toBe(0);
    expect(ally.state.fearTokens).toBe(0);
  });

  it('does not apply ally fear when LOS to fallen model is blocked', () => {
    const battlefield = new Battlefield(24, 24);
    const fallen = makeCharacter('fallen');
    const ally = makeCharacter('ally');

    battlefield.placeCharacter(fallen, { x: 6, y: 6 });
    battlefield.placeCharacter(ally, { x: 9, y: 6 });
    battlefield.addTerrain({
      id: 'wall',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 7.2, y: 5.4 },
        { x: 7.8, y: 5.4 },
        { x: 7.8, y: 6.6 },
        { x: 7.2, y: 6.6 },
      ],
    });

    const results = applyFearFromAllyKO(battlefield, fallen, [ally], {
      visibilityOrMu: 16,
      requireLOS: true,
      rollsById: { [ally.id]: [1, 1] },
    });

    expect(results.length).toBe(0);
    expect(ally.state.fearTokens).toBe(0);
  });

  it('halves cohesion range when hidden fallen model is observed', () => {
    const battlefield = new Battlefield(24, 24);
    const fallen = makeCharacter('fallen');
    const ally = makeCharacter('ally');
    const opponent = makeCharacter('opponent');

    fallen.state.isHidden = true;
    battlefield.placeCharacter(fallen, { x: 6, y: 6 });
    battlefield.placeCharacter(ally, { x: 9, y: 6 }); // outside halved 2 MU range
    battlefield.placeCharacter(opponent, { x: 3, y: 6 }); // observes hidden fallen

    const results = applyFearFromAllyKO(battlefield, fallen, [ally], {
      visibilityOrMu: 16,
      requireLOS: false,
      opposingModels: [opponent],
      rollsById: { [ally.id]: [1, 1] },
    });

    expect(results.length).toBe(0);
    expect(ally.state.fearTokens).toBe(0);
  });

  it('still applies ally fear when within halved hidden cohesion range', () => {
    const battlefield = new Battlefield(24, 24);
    const fallen = makeCharacter('fallen');
    const ally = makeCharacter('ally');
    const opponent = makeCharacter('opponent');

    fallen.state.isHidden = true;
    battlefield.placeCharacter(fallen, { x: 6, y: 6 });
    battlefield.placeCharacter(ally, { x: 8, y: 6 }); // within halved 2 MU range
    battlefield.placeCharacter(opponent, { x: 3, y: 6 });

    const results = applyFearFromAllyKO(battlefield, fallen, [ally], {
      visibilityOrMu: 16,
      requireLOS: false,
      opposingModels: [opponent],
      rollsById: { [ally.id]: [1, 1] },
    });

    expect(results.length).toBe(1);
    expect(ally.state.fearTokens).toBeGreaterThanOrEqual(1);
  });

  it('does not apply ally fear when ally is engaged and not distracted', () => {
    const battlefield = new Battlefield(24, 24);
    const fallen = makeCharacter('fallen');
    const ally = makeCharacter('ally');

    ally.state.isEngaged = true;
    ally.state.delayTokens = 0;
    ally.state.isDistracted = false;

    battlefield.placeCharacter(fallen, { x: 6, y: 6 });
    battlefield.placeCharacter(ally, { x: 8, y: 6 });

    const results = applyFearFromAllyKO(battlefield, fallen, [ally], {
      visibilityOrMu: 16,
      requireLOS: false,
      rollsById: { [ally.id]: [1, 1] },
    });

    expect(results.length).toBe(0);
    expect(ally.state.fearTokens).toBe(0);
  });

  it('applies ally fear when ally is engaged but distracted', () => {
    const battlefield = new Battlefield(24, 24);
    const fallen = makeCharacter('fallen');
    const ally = makeCharacter('ally');
    ally.finalAttributes.pow = 0;

    ally.state.isEngaged = true;
    ally.state.delayTokens = 1;
    ally.refreshStatusFlags();
    ally.state.isEngaged = true;

    battlefield.placeCharacter(fallen, { x: 6, y: 6 });
    battlefield.placeCharacter(ally, { x: 8, y: 6 });

    const results = applyFearFromAllyKO(battlefield, fallen, [ally], {
      visibilityOrMu: 16,
      requireLOS: false,
      rollsById: { [ally.id]: [1, 1] },
    });

    expect(results.length).toBe(1);
    expect(ally.state.fearTokens).toBeGreaterThanOrEqual(1);
  });
});

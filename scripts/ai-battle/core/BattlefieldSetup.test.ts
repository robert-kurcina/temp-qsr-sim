import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import {
  deployModels,
  findOpenCellNear,
  getDeploymentBoundsForSide,
} from './BattlefieldSetup';

function createStubCharacter(id: string): Character {
  return { id } as Character;
}

describe('BattlefieldSetup', () => {
  it('computes deterministic opposing-edge deployment bounds', () => {
    const north = getDeploymentBoundsForSide(0, 18, 24, 4, 'opposing_edges');
    const south = getDeploymentBoundsForSide(1, 18, 24, 4, 'opposing_edges');
    expect(north).toEqual({ minX: 0, maxX: 3, minY: 0, maxY: 23 });
    expect(south).toEqual({ minX: 14, maxX: 17, minY: 0, maxY: 23 });
  });

  it('searches nearest open cell when preferred is occupied', () => {
    const battlefield = new Battlefield(8, 8);
    battlefield.placeCharacter(createStubCharacter('occupied'), { x: 3, y: 3 });
    const found = findOpenCellNear({ x: 3, y: 3 }, battlefield, 2);
    expect(found).not.toBeNull();
    expect(found).not.toEqual({ x: 3, y: 3 });
  });

  it('deploys all models within computed bounds without overlap', () => {
    const battlefield = new Battlefield(10, 10);
    const characters = ['a', 'b', 'c', 'd'].map(createStubCharacter);
    deployModels(
      { characters },
      battlefield,
      0,
      10,
      10,
      3,
      'opposing_edges'
    );

    const bounds = getDeploymentBoundsForSide(0, 10, 10, 3, 'opposing_edges');
    const positions = characters.map(character => battlefield.getCharacterPosition(character));
    expect(positions.every(Boolean)).toBe(true);

    const seen = new Set<string>();
    for (const position of positions) {
      const p = position!;
      expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(p.x).toBeLessThanOrEqual(bounds.maxX);
      expect(p.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(p.y).toBeLessThanOrEqual(bounds.maxY);
      const key = `${p.x},${p.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

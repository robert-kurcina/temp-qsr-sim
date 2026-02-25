import { describe, it, expect } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { applyBonusAction } from './bonus-actions';

const makeProfile = (
  name: string,
  attrs: { cca: number; rca: number; ref: number; int: number; pow: number; str: number; for: number; mov: number; siz: number }
): Profile => ({
  name,
  archetype: { attributes: attrs },
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
});

function addSquareTerrain(
  battlefield: Battlefield,
  id: string,
  type: TerrainType,
  center: { x: number; y: number }
) {
  battlefield.addTerrain({
    id,
    type,
    vertices: [
      { x: center.x - 0.5, y: center.y - 0.5 },
      { x: center.x + 0.5, y: center.y - 0.5 },
      { x: center.x + 0.5, y: center.y + 0.5 },
      { x: center.x - 0.5, y: center.y + 0.5 },
    ],
  });
}

describe('bonus actions', () => {
  it('applies Delay when PushBack moves target into degraded terrain', () => {
    const battlefield = new Battlefield(12, 12);
    addSquareTerrain(battlefield, 'rough-cell', TerrainType.Rough, { x: 5, y: 2 });
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 1, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 3, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 1, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 3, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 3, y: 2 });
    battlefield.placeCharacter(target, { x: 4, y: 2 });

    const outcome = applyBonusAction(
      {
        battlefield,
        attacker,
        target,
        cascades: 2,
        isCloseCombat: true,
        engaged: true,
      },
      { type: 'PushBack' }
    );

    expect(outcome.executed).toBe(true);
    expect(outcome.delayTokenApplied).toBe(true);
    expect(target.state.delayTokens).toBe(1);
    expect(battlefield.getCharacterPosition(target)).toEqual({ x: 5, y: 2 });
  });

  it('applies Delay when PushBack is blocked by obstacle terrain', () => {
    const battlefield = new Battlefield(12, 12);
    addSquareTerrain(battlefield, 'obstacle-cell', TerrainType.Obstacle, { x: 5, y: 2 });
    const attacker = new Character(makeProfile('attacker', { cca: 2, rca: 1, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 3, siz: 3 }));
    const target = new Character(makeProfile('target', { cca: 2, rca: 1, ref: 2, int: 1, pow: 1, str: 2, for: 2, mov: 3, siz: 3 }));
    battlefield.placeCharacter(attacker, { x: 3, y: 2 });
    battlefield.placeCharacter(target, { x: 4, y: 2 });

    const outcome = applyBonusAction(
      {
        battlefield,
        attacker,
        target,
        cascades: 2,
        isCloseCombat: true,
        engaged: true,
      },
      { type: 'PushBack' }
    );

    expect(outcome.executed).toBe(true);
    expect(outcome.delayTokenApplied).toBe(true);
    expect(target.state.delayTokens).toBe(1);
    expect(battlefield.getCharacterPosition(target)).toEqual({ x: 4, y: 2 });
  });
});


/**
 * Hide Mutual Exposure Tests (QSR Line 850)
 *
 * "If the Active model and one or more Passive models become without Cover from each other,
 *  allow the Passive models to first reposition. All models must lose their Hidden status,
 *  but the Active model may not reposition."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { TerrainType } from '../battlefield/terrain/Terrain';
import { resolveMutualHiddenExposure } from './concealment';

function makeTestProfile(name: string): Profile {
  return {
    name,
    archetype: {
      name: 'Average',
      attributes: {
        cca: 2,
        rca: 2,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov: 4,
        siz: 3,
      },
      traits: [],
      bp: 30,
    },
    items: [],
    totalBp: 30,
    adjustedBp: 0,
    adjustedItemCosts: { meleeBp: [], rangedBp: [], equipmentBp: [] },
    physicality: 3,
    adjPhysicality: 3,
    durability: 3,
    adjDurability: 3,
    burden: { totalLaden: 0, totalBurden: 0 },
    totalHands: 2,
    totalDeflect: 0,
    totalAR: 0,
    finalTraits: [],
    allTraits: [],
  };
}

function makeTestCharacter(name: string): Character {
  const character = new Character(makeTestProfile(name));
  character.finalAttributes = character.attributes;
  return character;
}

describe('Hide Mutual Exposure (QSR Line 850)', () => {
  let battlefield: Battlefield;
  let activeModel: Character;
  let passiveModel: Character;
  let opponent: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    activeModel = makeTestCharacter('Active');
    passiveModel = makeTestCharacter('Passive');
    opponent = makeTestCharacter('Opponent');

    battlefield.placeCharacter(activeModel, { x: 10, y: 12 });
    battlefield.placeCharacter(passiveModel, { x: 14, y: 12 });
    battlefield.placeCharacter(opponent, { x: 18, y: 12 });
  });

  it('should NOT trigger mutual exposure if character has Cover (QSR 850)', () => {
    // Setup: Both Hidden, but Passive has Cover
    activeModel.state.isHidden = true;
    passiveModel.state.isHidden = true;

    // Add terrain providing Cover to passive model (Obstacle blocks LOS)
    battlefield.addTerrain({
      id: 'wall1',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 13.5, y: 11.5 },
        { x: 14.5, y: 11.5 },
        { x: 14.5, y: 12.5 },
        { x: 13.5, y: 12.5 },
      ],
    });

    const result = resolveMutualHiddenExposure(battlefield, passiveModel, [activeModel, opponent], {
      isActiveModel: false,
    });

    // Should not trigger mutual exposure (Passive has Cover)
    expect(result.mustReveal).toBe(false);
    expect(result.canReposition).toBe(false);
  });

  it('should reveal Active model without reposition in mutual exposure (QSR 850.3)', () => {
    // Setup: Both Hidden, no Cover between them
    activeModel.state.isHidden = true;
    passiveModel.state.isHidden = true;

    const result = resolveMutualHiddenExposure(battlefield, activeModel, [passiveModel, opponent], {
      isActiveModel: true,
    });

    // Active model: must lose Hidden, may NOT reposition
    expect(result.mustReveal).toBe(true);
    expect(result.canReposition).toBe(false);
    expect(activeModel.state.isHidden).toBe(false);
    expect(result.reason).toContain('Active model');
  });

  it('should reveal Passive model with reposition option in mutual exposure (QSR 850.2)', () => {
    // Setup: Both Hidden, no Cover between them
    passiveModel.state.isHidden = true;
    passiveModel.finalAttributes.mov = 4;

    const result = resolveMutualHiddenExposure(battlefield, passiveModel, [activeModel, opponent], {
      isActiveModel: false,
      allowReposition: true,
    });

    // Passive model: may reposition first, then lose Hidden if still exposed
    expect(result.mustReveal).toBe(true);
    expect(result.canReposition).toBe(true);
    expect(passiveModel.state.isHidden).toBe(false);
    expect(result.reason).toContain('Passive model');
  });

  it('should handle multiple opponents in mutual exposure (QSR 850.1)', () => {
    // Setup: Hidden model exposed to multiple opponents
    passiveModel.state.isHidden = true;
    const opponent2 = makeTestCharacter('Opponent2');
    battlefield.placeCharacter(opponent2, { x: 14, y: 16 });

    const result = resolveMutualHiddenExposure(battlefield, passiveModel, [activeModel, opponent, opponent2], {
      isActiveModel: false,
    });

    // Should trigger mutual exposure (exposed to at least one opponent)
    expect(result.mustReveal).toBe(true);
    expect(passiveModel.state.isHidden).toBe(false);
  });

  it('should not trigger if no LOS to opponents (QSR 850)', () => {
    // Setup: Hidden model with no LOS to opponents
    passiveModel.state.isHidden = true;

    // Add terrain blocking LOS (Obstacle blocks LOS)
    battlefield.addTerrain({
      id: 'wall2',
      type: TerrainType.Obstacle,
      vertices: [
        { x: 15.5, y: 11.5 },
        { x: 16.5, y: 11.5 },
        { x: 16.5, y: 12.5 },
        { x: 15.5, y: 12.5 },
      ],
    });

    const result = resolveMutualHiddenExposure(battlefield, passiveModel, [opponent], {
      isActiveModel: false,
    });

    // Should not trigger (no LOS due to terrain)
    expect(result.mustReveal).toBe(false);
  });

  it('should not trigger if character is not Hidden (QSR 850)', () => {
    // Setup: Character not Hidden
    passiveModel.state.isHidden = false;

    const result = resolveMutualHiddenExposure(battlefield, passiveModel, [activeModel, opponent], {
      isActiveModel: false,
    });

    // Should not trigger (not Hidden)
    expect(result.mustReveal).toBe(false);
    expect(result.canReposition).toBe(false);
  });
});

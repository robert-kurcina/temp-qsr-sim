/**
 * Hide Voluntary and Forced Removal Tests (QSR Line 851)
 *
 * QSR 851.1: "The Active model may voluntarily remove Hidden status at the start or end of its Action."
 * QSR 851.2: "It must remove Hidden status when it is out of Cover."
 * QSR 851.3: "It will not reposition."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { voluntarilyRemoveHidden, forceRemoveHiddenIfExposed } from './concealment';

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

describe('Hide Voluntary Removal (QSR Line 851.1)', () => {
  let character: Character;

  beforeEach(() => {
    character = makeTestCharacter('Hider');
    character.state.isHidden = true;
  });

  it('should allow voluntary Hide removal at start of Action (QSR 851.1)', () => {
    expect(character.state.isHidden).toBe(true);

    voluntarilyRemoveHidden(character, 'start_of_action');

    expect(character.state.isHidden).toBe(false);
  });

  it('should allow voluntary Hide removal at end of Action (QSR 851.1)', () => {
    expect(character.state.isHidden).toBe(true);

    voluntarilyRemoveHidden(character, 'end_of_action');

    expect(character.state.isHidden).toBe(false);
  });

  it('should handle voluntary removal when already not Hidden', () => {
    character.state.isHidden = false;

    // Should not throw error
    expect(() => voluntarilyRemoveHidden(character, 'start_of_action')).not.toThrow();
    expect(character.state.isHidden).toBe(false);
  });
});

describe('Hide Forced Removal (QSR Lines 851.2-851.3)', () => {
  let battlefield: Battlefield;
  let hiddenCharacter: Character;
  let opponent: Character;

  beforeEach(() => {
    battlefield = new Battlefield(24, 24);

    hiddenCharacter = makeTestCharacter('Hider');
    opponent = makeTestCharacter('Opponent');

    battlefield.placeCharacter(hiddenCharacter, { x: 10, y: 12 });
    battlefield.placeCharacter(opponent, { x: 16, y: 12 });

    hiddenCharacter.state.isHidden = true;
  });

  it('should force remove Hidden when out of Cover from opponent (QSR 851.2)', () => {
    // Setup: Hidden character with no Cover between them and opponent
    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should be removed (no Cover)
    expect(result.removed).toBe(true);
    expect(hiddenCharacter.state.isHidden).toBe(false);
    expect(result.reason).toContain('Out of Cover');
  });

  it('should NOT remove Hidden if character has Cover (QSR 851.2)', () => {
    // Setup: Add terrain providing Cover
    battlefield.addTerrain({
      id: 'wall1',
      type: 'Obstacle',
      vertices: [
        { x: 12.5, y: 11.5 },
        { x: 13.5, y: 11.5 },
        { x: 13.5, y: 12.5 },
        { x: 12.5, y: 12.5 },
      ],
    });

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should NOT be removed (has Cover)
    expect(result.removed).toBe(false);
    expect(hiddenCharacter.state.isHidden).toBe(true);
    expect(result.reason).toBe('Still in Cover');
  });

  it('should NOT remove Hidden if no LOS to opponent (QSR 851.2)', () => {
    // Setup: Add terrain blocking LOS
    battlefield.addTerrain({
      id: 'wall2',
      type: 'Obstacle',
      vertices: [
        { x: 12.5, y: 11.5 },
        { x: 13.5, y: 11.5 },
        { x: 13.5, y: 12.5 },
        { x: 12.5, y: 12.5 },
      ],
    });

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should NOT be removed (no LOS)
    expect(result.removed).toBe(false);
    expect(hiddenCharacter.state.isHidden).toBe(true);
  });

  it('should NOT remove Hidden if opponent is Hidden (QSR 851.2)', () => {
    // Setup: Opponent is also Hidden
    opponent.state.isHidden = true;

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should NOT be removed (opponent Hidden)
    expect(result.removed).toBe(false);
    expect(hiddenCharacter.state.isHidden).toBe(true);
  });

  it('should NOT remove Hidden if opponent is KOd (QSR 851.2)', () => {
    // Setup: Opponent is KO'd
    opponent.state.isKOd = true;

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should NOT be removed (opponent KO'd)
    expect(result.removed).toBe(false);
    expect(hiddenCharacter.state.isHidden).toBe(true);
  });

  it('should NOT remove Hidden if opponent is Eliminated (QSR 851.2)', () => {
    // Setup: Opponent is Eliminated
    opponent.state.isEliminated = true;

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should NOT be removed (opponent Eliminated)
    expect(result.removed).toBe(false);
    expect(hiddenCharacter.state.isHidden).toBe(true);
  });

  it('should NOT remove Hidden if character is not Hidden (QSR 851.2)', () => {
    // Setup: Character not Hidden
    hiddenCharacter.state.isHidden = false;

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Should NOT be removed (already not Hidden)
    expect(result.removed).toBe(false);
    expect(result.reason).toBe('Not Hidden');
  });

  it('should handle multiple opponents - remove if exposed to any (QSR 851.2)', () => {
    // Setup: Add second opponent with LOS
    const opponent2 = makeTestCharacter('Opponent2');
    battlefield.placeCharacter(opponent2, { x: 10, y: 18 }); // Different angle, no Cover

    // Add Cover from first opponent but not second
    battlefield.addTerrain({
      id: 'wall3',
      type: 'Obstacle',
      vertices: [
        { x: 12.5, y: 11.5 },
        { x: 13.5, y: 11.5 },
        { x: 13.5, y: 12.5 },
        { x: 12.5, y: 12.5 },
      ],
    });

    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent, opponent2]);

    // Should be removed (exposed to opponent2)
    expect(result.removed).toBe(true);
    expect(hiddenCharacter.state.isHidden).toBe(false);
  });

  it('should NOT provide reposition option (QSR 851.3)', () => {
    // QSR 851.3: "It will not reposition."
    // The function only removes Hidden, no reposition logic
    const result = forceRemoveHiddenIfExposed(battlefield, hiddenCharacter, [opponent]);

    // Verify no reposition is offered (function only returns removed flag and reason)
    expect(result.removed).toBe(true);
    expect(result.reason).not.toContain('reposition');
  });
});

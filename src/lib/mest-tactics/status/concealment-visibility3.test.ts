/**
 * Hide Visibility×3 Rule Tests (QSR Line 852.1)
 *
 * "Models further than Visibility × 3 do not automatically lose Hidden status
 *  unless within LOS of Opposing models in Wait status."
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';
import { Battlefield } from '../battlefield/Battlefield';
import { resolveHiddenExposure } from './concealment';

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
    burden: { totalLaden: 0, totalBurden: 0 } as any,
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

describe('Hide Visibility×3 Rule (QSR Line 852.1)', () => {
  let battlefield: Battlefield;
  let hiddenCharacter: Character;
  let opponent: Character;
  let waitOpponent: Character;

  beforeEach(() => {
    battlefield = new Battlefield(72, 72); // Large battlefield for long-range tests

    hiddenCharacter = makeTestCharacter('Hider');
    opponent = makeTestCharacter('Opponent');
    waitOpponent = makeTestCharacter('Waiter');

    battlefield.placeCharacter(hiddenCharacter, { x: 36, y: 36 });
  });

  it('should NOT reveal Hidden model beyond Visibility×3 from non-Wait opponent (QSR 852.1)', () => {
    // Setup: Hidden character at (20, 36), opponent at (70, 36) = 50 MU away
    hiddenCharacter.state.isHidden = true;
    battlefield.placeCharacter(hiddenCharacter, { x: 20, y: 36 });
    battlefield.placeCharacter(opponent, { x: 70, y: 36 }); // 50 MU away

    // Visibility×3 = 48 MU (default visibility 16)
    const result = resolveHiddenExposure(battlefield, hiddenCharacter, [opponent], {
      visibilityOrMu: 16,
    });

    // Should NOT be revealed (beyond Visibility×3, opponent not in Wait)
    expect(result.revealed).toBe(false);
  });

  it('should reveal Hidden model beyond Visibility×3 if opponent is in Wait (QSR 852.1 exception)', () => {
    // Setup: Hidden character at center, Wait opponent 50 MU away
    // Battlefield is 72×72, so we need to place characters within bounds
    // Place hidden at (20, 36), Wait opponent at (70, 36) = 50 MU apart
    hiddenCharacter.state.isHidden = true;
    battlefield.placeCharacter(hiddenCharacter, { x: 20, y: 36 });
    battlefield.placeCharacter(waitOpponent, { x: 70, y: 36 }); // 50 MU away
    waitOpponent.state.isWaiting = true;

    // Visibility×3 = 48 MU (default visibility 16)
    const result = resolveHiddenExposure(battlefield, hiddenCharacter, [waitOpponent], {
      visibilityOrMu: 16,
    });

    // Should be revealed (Wait model can reveal beyond Visibility×3)
    expect(result.revealed).toBe(true);
  });

  it('should reveal Hidden model within Visibility×3 from any opponent (QSR 852.1)', () => {
    // Setup: Hidden character at (20, 36), opponent at (50, 36) = 30 MU away
    hiddenCharacter.state.isHidden = true;
    battlefield.placeCharacter(hiddenCharacter, { x: 20, y: 36 });
    battlefield.placeCharacter(opponent, { x: 50, y: 36 }); // 30 MU away (within 48 MU)

    const result = resolveHiddenExposure(battlefield, hiddenCharacter, [opponent], {
      visibilityOrMu: 16,
    });

    // Should be revealed (within Visibility×3)
    expect(result.revealed).toBe(true);
  });

  it('should respect custom Visibility OR for ×3 calculation (QSR 852.1)', () => {
    // Setup: Hidden character at (20, 36), opponent at (50, 36) = 30 MU away
    hiddenCharacter.state.isHidden = true;
    battlefield.placeCharacter(hiddenCharacter, { x: 20, y: 36 });
    battlefield.placeCharacter(opponent, { x: 50, y: 36 }); // 30 MU away

    // Twilight: Visibility×3 = 8×3 = 24 MU
    const result = resolveHiddenExposure(battlefield, hiddenCharacter, [opponent], {
      visibilityOrMu: 8, // Twilight
    });

    // Should NOT be revealed (30 MU > 24 MU threshold, opponent not in Wait)
    expect(result.revealed).toBe(false);
  });

  it('should reveal Hidden model within custom Visibility×3 (QSR 852.1)', () => {
    // Setup: Hidden character at (20, 36), opponent at (40, 36) = 20 MU away
    hiddenCharacter.state.isHidden = true;
    battlefield.placeCharacter(hiddenCharacter, { x: 20, y: 36 });
    battlefield.placeCharacter(opponent, { x: 40, y: 36 }); // 20 MU away

    // Twilight: Visibility×3 = 8×3 = 24 MU
    const result = resolveHiddenExposure(battlefield, hiddenCharacter, [opponent], {
      visibilityOrMu: 8, // Twilight
    });

    // Should be revealed (20 MU < 24 MU threshold)
    expect(result.revealed).toBe(true);
  });
});

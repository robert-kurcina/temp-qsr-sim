import { describe, expect, it } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import {
  areCharactersEngagedForRunner,
  computeDirectAdvanceStepForRunner,
  computeEngageMovePositionForRunner,
  hasLineOfSightForRunner,
  isFreeFromEngagementForRunner,
  snapToOpenCellForRunner,
} from './MovementPlanningSupport';

function createCharacter(id: string, mov = 2, siz = 3): Character {
  return {
    id,
    attributes: { mov, siz },
    finalAttributes: { mov, siz },
    state: {
      isKOd: false,
      isEliminated: false,
    },
  } as unknown as Character;
}

describe('MovementPlanningSupport', () => {
  it('computes direct advance step up to movement allowance', () => {
    const step = computeDirectAdvanceStepForRunner(
      { x: 0, y: 0 },
      { x: 6, y: 8 },
      5
    );
    expect(step).toEqual({ x: 3, y: 4 });
  });

  it('snaps to nearest open cell when preferred cell is occupied', () => {
    const battlefield = new Battlefield(8, 8);
    const actor = createCharacter('actor');
    const blocker = createCharacter('blocker');
    battlefield.placeCharacter(actor, { x: 1, y: 1 });
    battlefield.placeCharacter(blocker, { x: 3, y: 3 });

    const snapped = snapToOpenCellForRunner({ x: 3, y: 3 }, actor, battlefield);
    expect(snapped).not.toBeNull();
    expect(snapped).not.toEqual({ x: 3, y: 3 });
  });

  it('returns LOS true on empty board between two placed models', () => {
    const battlefield = new Battlefield(10, 10);
    const a = createCharacter('a');
    const b = createCharacter('b');
    battlefield.placeCharacter(a, { x: 1, y: 1 });
    battlefield.placeCharacter(b, { x: 8, y: 8 });

    const capture: { vectors?: any[] } = { vectors: [] };
    const hasLos = hasLineOfSightForRunner(a, b, battlefield, capture);

    expect(hasLos).toBe(true);
    expect(capture.vectors?.length).toBe(1);
    expect(capture.vectors?.[0].kind).toBe('los');
  });

  it('detects engagement and free state correctly', () => {
    const battlefield = new Battlefield(10, 10);
    const a = createCharacter('a');
    const b = createCharacter('b');
    const c = createCharacter('c');
    battlefield.placeCharacter(a, { x: 3, y: 3 });
    battlefield.placeCharacter(b, { x: 4, y: 3 });
    battlefield.placeCharacter(c, { x: 8, y: 8 });

    expect(areCharactersEngagedForRunner(a, b, battlefield)).toBe(true);
    expect(isFreeFromEngagementForRunner(a, [b], battlefield)).toBe(false);
    expect(isFreeFromEngagementForRunner(c, [a, b], battlefield)).toBe(true);
  });

  it('computes engage move position when target is reachable', () => {
    const battlefield = new Battlefield(12, 12);
    const attacker = createCharacter('attacker', 2, 3);
    const defender = createCharacter('defender', 2, 3);
    battlefield.placeCharacter(attacker, { x: 1, y: 1 });
    battlefield.placeCharacter(defender, { x: 4, y: 1 });

    const position = computeEngageMovePositionForRunner(attacker, defender, battlefield, {
      requireEngagement: true,
    });
    expect(position).not.toBeNull();
    expect(position!.x).toBeGreaterThan(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import type { Position } from '../battlefield/Position';
import { executeMoveAction, type MoveActionDeps } from './move-action';

function makeCharacter(name: string, mov = 4, traits: any[] = []): Character {
  const profile: Profile = {
    name,
    archetype: {
      name: 'Test',
      attributes: {
        cca: 0,
        rca: 0,
        ref: 2,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov,
        siz: 3,
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
    finalTraits: traits,
    allTraits: traits,
  };
  const character = new Character(profile);
  character.finalAttributes = character.attributes;
  return character;
}

function makeDeps(
  positions: Map<string, Position>,
  options: {
    terrain?: 'Clear' | 'Rough' | 'Difficult' | 'Impassable';
    canOccupy?: boolean;
    pathCost?: number | null;
    isWithinBounds?: boolean;
    spendApForSwap?: boolean;
  } = {}
): {
  deps: MoveActionDeps;
  executeCloseCombatAttack: ReturnType<typeof vi.fn>;
  eliminateOnFearExit: ReturnType<typeof vi.fn>;
  spendApForSwap: ReturnType<typeof vi.fn>;
} {
  const executeCloseCombatAttack = vi.fn(() => ({ hit: true }));
  const eliminateOnFearExit = vi.fn();
  const spendApForSwap = vi.fn(() => options.spendApForSwap ?? true);

  const deps: MoveActionDeps = {
    getCharacterPosition: (character: Character) => positions.get(character.id),
    moveCharacter: (character: Character, position: Position) => {
      positions.set(character.id, position);
      return true;
    },
    swapCharacters: (first: Character, second: Character) => {
      const firstPos = positions.get(first.id);
      const secondPos = positions.get(second.id);
      if (!firstPos || !secondPos) return false;
      positions.set(first.id, secondPos);
      positions.set(second.id, firstPos);
      return true;
    },
    spendApForSwap,
    getTerrainAt: () => options.terrain ?? 'Clear',
    isWithinBounds:
      options.isWithinBounds !== undefined
        ? () => options.isWithinBounds as boolean
        : undefined,
    eliminateOnFearExit,
    canOccupy: () => options.canOccupy ?? true,
    executeCloseCombatAttack,
    findPathCost:
      options.pathCost !== undefined
        ? (_start: Position, _end: Position) => options.pathCost ?? null
        : undefined,
  };

  return {  deps, executeCloseCombatAttack, eliminateOnFearExit, spendApForSwap  } as any;
}

describe('move action rules', () => {
  it('rejects movement beyond MOV + 2 allowance', () => {
    const mover = makeCharacter('mover', 4);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 7, y: 0 });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('out of range');
  });

  it('rejects movement into Impassable terrain', () => {
    const mover = makeCharacter('mover', 4);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions, { terrain: 'Impassable' });

    const result = executeMoveAction(deps, mover, { x: 1, y: 0 });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('impassable');
  });

  it('rejects movement if destination cannot fit model footprint', () => {
    const mover = makeCharacter('mover', 4);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions, { canOccupy: false });

    const result = executeMoveAction(deps, mover, { x: 1, y: 0 });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('Destination too small');
  });

  it('rejects movement when pathfinding reports blocked route', () => {
    const mover = makeCharacter('mover', 4);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions, { pathCost: null });

    const result = executeMoveAction(deps, mover, { x: 1, y: 0 });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('Path blocked');
  });

  it('uses segment path cost (MV.7) rather than straight-line shortcut', () => {
    const mover = makeCharacter('mover', 1);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 2, y: 2 }, {
      path: [
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ],
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('out of range');
  });

  it('allows up to MOV + 1 direction changes (MV.8/MV.9)', () => {
    const mover = makeCharacter('mover', 2);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 1, y: 1 }, {
      path: [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
      ],
    });

    expect(result.moved).toBe(true);
    expect(result.directionChangesApplied).toBe(3);
  });

  it('rejects movement with too many direction changes (MV.8)', () => {
    const mover = makeCharacter('mover', 2);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 1.2, y: 1.2 }, {
      path: [
        { x: 0.4, y: 0 },
        { x: 0.4, y: 0.4 },
        { x: 0.8, y: 0.4 },
        { x: 0.8, y: 0.8 },
        { x: 1.2, y: 0.8 },
        { x: 1.2, y: 1.2 },
      ],
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('Too many direction changes');
  });

  it('prevents moving past attentive opposing engagement (MV.6)', () => {
    const mover = makeCharacter('mover', 4);
    const opponent = makeCharacter('opponent', 4);
    opponent.state.isAttentive = true;
    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [opponent.id, { x: 2, y: 0 }],
    ]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 4, y: 0 }, {
      opponents: [opponent],
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('stop when engaged');
  });

  it('eliminates a Disordered/Panicked mover that exits battlefield bounds', () => {
    const mover = makeCharacter('mover', 4);
    mover.state.fearTokens = 2;
    mover.refreshStatusFlags();
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps, eliminateOnFearExit } = makeDeps(positions, { isWithinBounds: false });

    const result = executeMoveAction(deps, mover, { x: 50, y: 50 });

    expect(result.moved).toBe(true);
    expect(result.eliminated).toBe(true);
    expect(result.exitedBattlefield).toBe(true);
    expect(eliminateOnFearExit).toHaveBeenCalledTimes(1);
    expect(eliminateOnFearExit).toHaveBeenCalledWith(mover);
  });

  it('rejects out-of-bounds movement for non-Disordered movers', () => {
    const mover = makeCharacter('mover', 4);
    mover.state.fearTokens = 0;
    mover.refreshStatusFlags();
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps, eliminateOnFearExit } = makeDeps(positions, { isWithinBounds: false });

    const result = executeMoveAction(deps, mover, { x: 50, y: 50 });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('outside battlefield bounds');
    expect(eliminateOnFearExit).not.toHaveBeenCalled();
  });

  it('grants Sprint movement bonus for straight-line movement', () => {
    const mover = makeCharacter('sprinter', 4, ['Sprint']);
    mover.state.isAttentive = true;
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 10, y: 0 }, {
      isMovingStraight: true,
      isAtStartOrEndOfMovement: false,
    });

    expect(result.moved).toBe(true);
    expect(result.sprintBonusApplied).toBe(true);
  });

  it('applies Leap agility bonus only at start/end of movement (MV.5)', () => {
    const mover = makeCharacter('leaper', 4, ['Leap 2']);
    const positions = new Map<string, Position>([[mover.id, { x: 0, y: 0 }]]);
    const { deps } = makeDeps(positions);

    const noLeap = executeMoveAction(deps, mover, { x: 7, y: 0 }, {
      isAtStartOrEndOfMovement: false,
    });
    expect(noLeap.moved).toBe(false);
    expect(noLeap.reason).toContain('out of range');

    const withLeap = executeMoveAction(deps, mover, { x: 7, y: 0 }, {
      isAtStartOrEndOfMovement: true,
    });
    expect(withLeap.moved).toBe(true);
    expect(withLeap.leapBonusApplied).toBe(true);
  });

  it('triggers an opportunity attack when leaving engagement', () => {
    const mover = makeCharacter('mover', 4);
    const opponent = makeCharacter('opponent', 4);
    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [opponent.id, { x: 0.9, y: 0 }],
    ]);
    const { deps, executeCloseCombatAttack } = makeDeps(positions);

    const weapon = {
      name: 'Test Blade',
      class: 'Melee',
      classification: 'Melee',
      type: 'Melee',
      bp: 0,
      traits: [],
    } as any;

    const result = executeMoveAction(deps, mover, { x: 3, y: 0 }, {
      allowOpportunityAttack: true,
      opponents: [opponent],
      opportunityWeapon: weapon,
    });

    expect(result.moved).toBe(true);
    expect(result.opportunityAttack).toBeTruthy();
    expect(result.opportunityAttack && typeof result.opportunityAttack !== 'boolean'
      ? result.opportunityAttack.attacker.id
      : undefined).toBe(opponent.id);
    expect(executeCloseCombatAttack).toHaveBeenCalledTimes(1);
  });

  it('allows swap with Attentive Friendly Free model in base-contact (SW.1/SW.2)', () => {
    const mover = makeCharacter('mover', 4);
    const friendly = makeCharacter('friendly', 4);
    friendly.state.isAttentive = true;
    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [friendly.id, { x: 1, y: 0 }],
    ]);
    const { deps, spendApForSwap } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 1, y: 0 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [],
    });

    expect(result.moved).toBe(true);
    expect(result.swapped).toBe(true);
    expect(positions.get(mover.id)).toEqual({ x: 1, y: 0 });
    expect(positions.get(friendly.id)).toEqual({ x: 0, y: 0 });
    expect(spendApForSwap).not.toHaveBeenCalled();
  });

  it('rejects swap when target is not in base-contact (SW.2)', () => {
    const mover = makeCharacter('mover', 4);
    const friendly = makeCharacter('friendly', 4);
    friendly.state.isAttentive = true;
    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [friendly.id, { x: 3, y: 0 }],
    ]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 3, y: 0 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [],
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('base-contact');
  });

  it('applies Delay to a non-opposing participant if any swap participant is Disordered (SW.3)', () => {
    const mover = makeCharacter('mover', 4);
    const friendly = makeCharacter('friendly', 4);
    friendly.state.fearTokens = 2;
    friendly.state.delayTokens = 1;
    friendly.refreshStatusFlags();

    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [friendly.id, { x: 1, y: 0 }],
    ]);
    const { deps } = makeDeps(positions);

    const beforeDelay = friendly.state.delayTokens;
    const result = executeMoveAction(deps, mover, { x: 1, y: 0 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [],
    });

    expect(result.moved).toBe(true);
    expect(friendly.state.delayTokens).toBe(beforeDelay + 1);
    expect(result.delayAppliedToId).toBe(friendly.id);
  });

  it('charges 1 AP for additional swaps after first swap in same Initiative (SW.4/SW.5)', () => {
    const mover = makeCharacter('mover', 4);
    mover.state.swapsThisInitiative = 1;
    const friendly = makeCharacter('friendly', 4);
    friendly.state.isAttentive = true;
    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [friendly.id, { x: 1, y: 0 }],
    ]);
    const { deps, spendApForSwap } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 1, y: 0 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [],
    });

    expect(result.moved).toBe(true);
    expect(result.swapApCost).toBe(1);
    expect(spendApForSwap).toHaveBeenCalledTimes(1);
    expect(spendApForSwap).toHaveBeenCalledWith(mover, 1);
  });

  it('rejects swap when target is engaged to Attentive Ordered opposing model (SW.6)', () => {
    const mover = makeCharacter('mover', 4);
    const friendly = makeCharacter('friendly', 4);
    friendly.state.isAttentive = true;
    const opposing = makeCharacter('opposing', 4);
    opposing.state.isAttentive = true;
    opposing.state.isOrdered = true;
    const positions = new Map<string, Position>([
      [mover.id, { x: 0, y: 0 }],
      [friendly.id, { x: 1, y: 0 }],
      [opposing.id, { x: 2, y: 0 }],
    ]);
    const { deps } = makeDeps(positions);

    const result = executeMoveAction(deps, mover, { x: 1, y: 0 }, {
      swapTarget: friendly,
      isFriendlyToMover: () => true,
      opponents: [opposing],
    });

    expect(result.moved).toBe(false);
    expect(result.reason).toContain('Attentive Ordered opposing');
  });
});

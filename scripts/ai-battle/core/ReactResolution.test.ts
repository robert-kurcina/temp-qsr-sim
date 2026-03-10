import { afterEach, describe, expect, it, vi } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Profile } from '../../../src/lib/mest-tactics/core/Profile';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { resetRoller, setRoller } from '../../../src/lib/mest-tactics/subroutines/dice-roller';
import { processReactsForRunner } from './ReactResolution';

function createCharacter(id: string): Character {
  return {
    id,
    profile: {
      name: id,
      equipment: [{ name: 'Bow', classification: 'Bow' }],
      items: [{ name: 'Bow', classification: 'Bow' }],
    },
    state: { isWaiting: false },
  } as unknown as Character;
}

function makeProfile(name: string, ref = 2, mov = 4, items: any[] = []): Profile {
  return {
    name,
    archetype: {
      attributes: {
        cca: 2,
        rca: 2,
        ref,
        int: 2,
        pow: 2,
        str: 2,
        for: 2,
        mov,
        siz: 3,
      },
      bp: 30,
      traits: [],
    } as any,
    items,
    equipment: items,
    totalBp: 30,
    adjustedBp: 30,
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
  } as unknown as Profile;
}

function createLiveCharacter(name: string, ref = 2, mov = 4, items: any[] = []): Character {
  return new Character(makeProfile(name, ref, mov, items));
}

describe('ReactResolution', () => {
  afterEach(() => {
    resetRoller();
  });

  it('returns non-executed when no StandardReact options are available', () => {
    const active = createCharacter('active');
    const opponent = createCharacter('opponent');
    const getReactOptionsSorted = vi.fn(() => []);
    const gameManager = {
      battlefield: {},
      getReactOptionsSorted,
    } as unknown as GameManager;

    const trackChoiceWindow = vi.fn();
    const result = processReactsForRunner({
      active,
      opponents: [opponent],
      gameManager,
      trigger: 'Move',
      movedDistance: 1,
      reactingToEngaged: true,
      visibilityOrMu: 12,
      trackReactChoiceWindow: trackChoiceWindow,
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => undefined,
    });

    expect(result.executed).toBe(false);
    expect((result.details as any)?.reason).toBeUndefined();
    expect(trackChoiceWindow).toHaveBeenCalledTimes(1);
    expect(getReactOptionsSorted).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'Move',
        movedDistance: 1,
        reactingToEngaged: true,
      })
    );
  });

  it('executes StandardReact and returns vector/opposed test details', () => {
    const active = createCharacter('active');
    const reactor = createCharacter('reactor');
    const gameManager = {
      battlefield: {
        getCharacterPosition: (character: Character) => character.id === 'reactor'
          ? { x: 1, y: 1 }
          : { x: 4, y: 1 },
      },
      getReactOptionsSorted: () => [
        { available: true, type: 'StandardReact', actor: reactor },
      ],
      executeStandardReact: () => ({
        executed: true,
        result: { hitTestResult: { pass: true } },
      }),
    } as unknown as GameManager;

    const result = processReactsForRunner({
      active,
      opponents: [reactor],
      gameManager,
      trigger: 'NonMove',
      movedDistance: 0,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });

    expect(result.executed).toBe(true);
    expect(result.reactor?.id).toBe('reactor');
    expect((result.vector as any)?.kind).toBe('los');
    expect(result.opposedTest).toEqual({ pass: true });
    expect((result.details as any)?.requiredRef).toBeUndefined();
    expect((result.details as any)?.effectiveRef).toBeUndefined();
  });

  it('executes ReactAction branch for NonMove triggers (ranged)', () => {
    const active = createCharacter('active');
    const reactor = {
      ...createCharacter('reactor'),
      attributes: { siz: 3 },
      finalAttributes: { siz: 3 },
      profile: {
        name: 'reactor',
        equipment: [{ name: 'Rifle', classification: 'Range' }],
        items: [{ name: 'Rifle', classification: 'Range' }],
      },
      state: { isWaiting: true },
    } as unknown as Character;
    const gameManager = {
      battlefield: {
        getCharacterPosition: (character: Character) => character.id === 'reactor'
          ? { x: 1, y: 1 }
          : { x: 8, y: 1 },
      },
      getReactOptionsSorted: () => [
        { available: true, type: 'ReactAction', actor: reactor },
      ],
      executeRangedAttack: vi.fn(() => ({ result: { hitTestResult: { pass: true } } })),
      executeReactAction: vi.fn((_reactor: Character, callback: () => unknown) => ({
        executed: true,
        result: callback(),
      })),
    } as unknown as GameManager;

    const result = processReactsForRunner({
      active,
      opponents: [reactor],
      gameManager,
      trigger: 'NonMove',
      movedDistance: 0,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });

    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('react=true:action:ranged');
    expect(result.reactor?.id).toBe('reactor');
    expect((result.details as any)?.requiredRef).toBeUndefined();
    expect((result.details as any)?.effectiveRef).toBeUndefined();
    expect((gameManager.executeReactAction as any)).toHaveBeenCalledTimes(1);
    expect((gameManager.executeRangedAttack as any)).toHaveBeenCalledTimes(1);
  });

  it('rejects available react option when its target is not the active abrupt model', () => {
    const active = createCharacter('active');
    const wrongTarget = createCharacter('wrong-target');
    const reactor = createCharacter('reactor');
    const gameManager = {
      battlefield: {
        getCharacterPosition: () => ({ x: 1, y: 1 }),
      },
      getReactOptionsSorted: () => [
        {
          available: true,
          type: 'ReactAction',
          actor: reactor,
          target: wrongTarget,
          requiredRef: 5,
          effectiveRef: 6,
          reason: undefined,
        },
      ],
    } as unknown as GameManager;

    const result = processReactsForRunner({
      active,
      opponents: [reactor],
      gameManager,
      trigger: 'NonMove',
      movedDistance: 0,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });

    expect(result.executed).toBe(false);
    expect((result.details as any)?.reason).toBe('react-target-mismatch');
    expect((result.details as any)?.expectedTargetId).toBe(active.id);
    expect((result.details as any)?.targetId).toBe(wrongTarget.id);
  });

  it('sanity: executes StandardReact in a deterministic Move-trigger scenario', () => {
    setRoller(() => Array(20).fill(6));
    const battlefield = new Battlefield(12, 12);
    const active = createLiveCharacter('active', 2, 4);
    const reactor = createLiveCharacter('reactor', 4, 4, [
      {
        name: 'Test Rifle',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        or: 8,
        accuracy: '-',
        impact: 0,
        dmg: '2',
        traits: [],
      },
    ]);
    reactor.state.isWaiting = true;
    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    const gameManager = new GameManager([active, reactor], battlefield);

    const result = processReactsForRunner({
      active,
      opponents: [reactor],
      gameManager,
      trigger: 'Move',
      movedDistance: 1,
      reactingToEngaged: false,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });

    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('react=true:standard');
    expect(result.reactor?.id).toBe(reactor.id);
  });

  it('sanity: move-react does not execute when movement is below Standard react threshold', () => {
    setRoller(() => Array(20).fill(6));
    const battlefield = new Battlefield(12, 12);
    const active = createLiveCharacter('active', 2, 4);
    const reactor = createLiveCharacter('reactor', 6, 4, [
      {
        name: 'Test Rifle',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        or: 8,
        accuracy: '-',
        impact: 0,
        dmg: '2',
        traits: [],
      },
    ]);
    reactor.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    const gameManager = new GameManager([active, reactor], battlefield);

    const result = processReactsForRunner({
      active,
      opponents: [reactor],
      gameManager,
      trigger: 'Move',
      movedDistance: 0.25, // below baseDiameter/2 threshold for SIZ 3 base
      reactingToEngaged: false,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => undefined,
    });

    expect(result.executed).toBe(false);
    expect(result.choicesGiven).toBe(0);
  });

  it('sanity: chooses highest effective REF reactor (including overreach penalty)', () => {
    setRoller(() => Array(20).fill(6));
    const battlefield = new Battlefield(12, 12);
    const active = createLiveCharacter('active', 2, 4);
    const reactorPenalized = createLiveCharacter('reactor-penalized', 5, 4, [
      {
        name: 'Penalized Rifle',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        or: 8,
        accuracy: '-',
        impact: 0,
        dmg: '2',
        traits: [],
      },
    ]);
    const reactorClean = createLiveCharacter('reactor-clean', 5, 4, [
      {
        name: 'Clean Rifle',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        or: 8,
        accuracy: '-',
        impact: 0,
        dmg: '2',
        traits: [],
      },
    ]);

    reactorPenalized.state.isWaiting = true;
    reactorPenalized.state.isOverreach = true; // -1 REF while waiting
    reactorClean.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactorPenalized, { x: 2, y: 6 });
    battlefield.placeCharacter(reactorClean, { x: 2, y: 8 });

    const gameManager = new GameManager([active, reactorPenalized, reactorClean], battlefield);

    const result = processReactsForRunner({
      active,
      opponents: [reactorPenalized, reactorClean],
      gameManager,
      trigger: 'Move',
      movedDistance: 1,
      reactingToEngaged: false,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });

    expect(result.executed).toBe(true);
    expect(result.resultCode).toBe('react=true:standard');
    expect(result.reactor?.id).toBe(reactorClean.id);
  });

  it('prioritizes engaged react exploit when active model is over-committed', () => {
    const spear = {
      name: 'Spear, Medium',
      classification: 'Melee',
      class: 'Melee',
      type: 'Weapon',
      bp: 0,
      traits: ['[2H]'],
    };
    const shield = {
      name: 'Shield, Small',
      classification: 'Shield',
      class: 'Shield',
      type: 'Shield',
      bp: 0,
      traits: ['[1H]'],
    };
    const active = createLiveCharacter('active', 4, 4, [spear as any, shield as any]);
    active.profile.totalHands = 2;
    active.profile.inHandItems = [spear as any, shield as any];

    const reactorEngaged = createLiveCharacter('reactor-engaged', 4, 4, [
      {
        name: 'Sword, Broad',
        classification: 'Melee',
        class: 'Melee',
        type: 'Weapon',
        bp: 0,
        traits: ['[1H]'],
      },
    ]);
    reactorEngaged.state.isWaiting = true;

    const reactorRanged = createLiveCharacter('reactor-ranged', 7, 4, [
      {
        name: 'Rifle',
        classification: 'Range',
        class: 'Range',
        type: 'Ranged',
        bp: 0,
        traits: [],
      },
    ]);
    reactorRanged.state.isWaiting = true;

    const gameManager = {
      battlefield: {
        getCharacterPosition: (character: Character) => {
          if (character.id === active.id) return { x: 6, y: 6 };
          if (character.id === reactorEngaged.id) return { x: 7, y: 6 }; // engaged
          return { x: 2, y: 6 };
        },
      },
      getReactOptionsSorted: () => [
        {
          available: true,
          type: 'ReactAction',
          actor: reactorRanged,
          target: active,
          requiredRef: 4,
          effectiveRef: 8,
        },
        {
          available: true,
          type: 'ReactAction',
          actor: reactorEngaged,
          target: active,
          requiredRef: 4,
          effectiveRef: 5,
        },
      ],
      executeCloseCombatAttack: vi.fn(() => ({ result: { hitTestResult: { pass: true } } })),
      executeRangedAttack: vi.fn(() => ({ result: { hitTestResult: { pass: true } } })),
      executeReactAction: vi.fn((_reactor: Character, callback: () => unknown) => ({
        executed: true,
        result: callback(),
      })),
    } as unknown as GameManager;

    const result = processReactsForRunner({
      active,
      opponents: [reactorEngaged, reactorRanged],
      gameManager,
      trigger: 'NonMove',
      movedDistance: 0,
      visibilityOrMu: 12,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });

    expect(result.executed).toBe(true);
    expect(result.reactor?.id).toBe(reactorEngaged.id);
    expect(result.resultCode).toBe('react=true:action:close');
    expect((result.details as any)?.selectionReason).toBe('overcommitted_react_exploit');
    expect((result.details as any)?.reactExploitOpportunity).toBe(true);
  });
});

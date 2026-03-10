import { afterEach, describe, expect, it, vi } from 'vitest';
import { Battlefield } from '../../../src/lib/mest-tactics/battlefield/Battlefield';
import { TerrainElement } from '../../../src/lib/mest-tactics/battlefield/terrain/TerrainElement';
import { Character } from '../../../src/lib/mest-tactics/core/Character';
import type { Profile } from '../../../src/lib/mest-tactics/core/Profile';
import { GameManager } from '../../../src/lib/mest-tactics/engine/GameManager';
import { setRoller, resetRoller } from '../../../src/lib/mest-tactics/subroutines/dice-roller';
import { getBaseDiameterFromSiz } from '../../../src/lib/mest-tactics/battlefield/spatial/size-utils';
import { SpatialRules } from '../../../src/lib/mest-tactics/battlefield/spatial/spatial-rules';
import {
  checkHiddenAtInitiativeStart,
  forceRemoveHiddenIfExposed,
  resolveHiddenExposure,
} from '../../../src/lib/mest-tactics/status/concealment';
import { buildReactOptions } from '../../../src/lib/mest-tactics/actions/react-actions';
import { assessBestMeleeLegality } from '../../../src/lib/mest-tactics/ai/shared/MeleeLegality';
import { executeWaitActionForRunner } from './WaitActionResolution';
import { processReactsForRunner } from './ReactResolution';

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

function createCharacter(name: string, ref = 2, mov = 4, items: any[] = []): Character {
  return new Character(makeProfile(name, ref, mov, items));
}

describe('QSR conditional sanity scenarios', () => {
  afterEach(() => {
    resetRoller();
  });

  it('sanity: wait status can create a react window when an opposing model crosses into effective LOS/visibility', () => {
    setRoller(() => Array(20).fill(6));
    const battlefield = new Battlefield(12, 12);
    const active = createCharacter('active', 2, 4);
    const reactor = createCharacter('reactor', 4, 4, [
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

    battlefield.placeCharacter(active, { x: 10, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    const gameManager = new GameManager([active, reactor], battlefield);

    const waitResult = executeWaitActionForRunner({
      allowWaitAction: true,
      character: reactor,
      opponents: [active],
      gameManager,
      visibilityOrMu: 4,
      selectionSource: 'utility',
      trackAttempt: vi.fn(),
      incrementWaitAction: vi.fn(),
      trackWaitChoiceTaken: vi.fn(),
      trackSuccess: vi.fn(),
      sanitizeForAudit: value => value,
    });
    expect(waitResult.executed).toBe(true);
    expect(reactor.state.isWaiting).toBe(true);

    const reactResult = processReactsForRunner({
      active,
      opponents: [reactor],
      gameManager,
      trigger: 'Move',
      movedDistance: 1,
      reactingToEngaged: false,
      visibilityOrMu: 4,
      trackReactChoiceWindow: vi.fn(),
      trackCombatExtras: vi.fn(),
      sanitizeForAudit: value => value,
      toOpposedTestAudit: () => ({ pass: true }),
    });
    expect(reactResult.executed).toBe(true);
    expect(reactResult.resultCode).toBe('react=true:standard');
  });

  it('sanity: hidden model reveal lifecycle supports initiative-start reposition and later forced reveal without reposition', () => {
    const battlefield = new Battlefield(12, 12);
    const hidden = createCharacter('hidden');
    const opponent = createCharacter('opponent');
    hidden.state.isHidden = true;
    battlefield.placeCharacter(hidden, { x: 6, y: 6 });
    battlefield.placeCharacter(opponent, { x: 10, y: 6 });

    const initiativeReveal = checkHiddenAtInitiativeStart(battlefield, hidden, [opponent], {
      allowReposition: true,
      revealReposition: () => ({ position: { x: 6, y: 4 } }),
    });
    expect(initiativeReveal.mustReveal).toBe(true);
    expect(initiativeReveal.repositioned).toBe(true);
    expect(hidden.state.isHidden).toBe(false);
    expect(battlefield.getCharacterPosition(hidden)).toEqual({ x: 6, y: 4 });

    hidden.state.isHidden = true;
    const beforeForced = battlefield.getCharacterPosition(hidden);
    const forcedReveal = forceRemoveHiddenIfExposed(battlefield, hidden, [opponent]);
    expect(forcedReveal.removed).toBe(true);
    expect(hidden.state.isHidden).toBe(false);
    expect(battlefield.getCharacterPosition(hidden)).toEqual(beforeForced);
  });

  it('sanity: hidden model can remain concealed out of LOS, then be revealed after moving into LOS', () => {
    const battlefield = new Battlefield(12, 12);
    const hidden = createCharacter('hidden');
    const opponent = createCharacter('opponent');
    hidden.state.isHidden = true;
    battlefield.placeCharacter(hidden, { x: 10, y: 6 });
    battlefield.placeCharacter(opponent, { x: 2, y: 6 });
    battlefield.addTerrain(new TerrainElement('Medium Wall', { x: 6, y: 6 }).toFeature());

    const toSpatialModelAt = (character: Character, position?: { x: number; y: number }) => {
      const resolved = position ?? battlefield.getCharacterPosition(character)!;
      const siz = character.finalAttributes.siz ?? character.attributes.siz ?? 3;
      return {
        id: character.id,
        position: resolved,
        baseDiameter: getBaseDiameterFromSiz(siz),
        siz,
      };
    };

    expect(SpatialRules.hasLineOfSight(battlefield, toSpatialModelAt(opponent), toSpatialModelAt(hidden))).toBe(false);
    const beforeMoveExposure = resolveHiddenExposure(battlefield, hidden, [opponent], { allowReposition: false });
    expect(beforeMoveExposure.revealed).toBe(false);
    expect(hidden.state.isHidden).toBe(true);

    let revealDestination: { x: number; y: number } | null = null;
    for (let y = 1; y <= 11; y += 1) {
      for (let x = 1; x <= 11; x += 1) {
        const candidate = { x, y };
        const hasLos = SpatialRules.hasLineOfSight(
          battlefield,
          toSpatialModelAt(opponent),
          toSpatialModelAt(hidden, candidate)
        );
        if (hasLos && battlefield.canOccupy(candidate, 1, hidden.id)) {
          revealDestination = candidate;
          break;
        }
      }
      if (revealDestination) break;
    }
    expect(revealDestination).not.toBeNull();
    battlefield.moveCharacter(hidden, revealDestination!);
    expect(SpatialRules.hasLineOfSight(battlefield, toSpatialModelAt(opponent), toSpatialModelAt(hidden))).toBe(true);
    const afterMoveExposure = resolveHiddenExposure(battlefield, hidden, [opponent], { allowReposition: false });
    expect(afterMoveExposure.revealed).toBe(true);
    expect(hidden.state.isHidden).toBe(false);
  });

  it('sanity: wait upkeep interacts with delay/AP correctly while engaged', () => {
    const battlefieldA = new Battlefield(12, 12);
    const waiterA = createCharacter('waiterA');
    const enemyA = createCharacter('enemyA');
    battlefieldA.placeCharacter(waiterA, { x: 6, y: 6 });
    battlefieldA.placeCharacter(enemyA, { x: 7, y: 6 }); // engaged
    const managerA = new GameManager([waiterA, enemyA], battlefieldA);
    waiterA.state.isWaiting = true;
    waiterA.state.delayTokens = 1; // leaves 1 AP before upkeep
    const apMaintained = managerA.beginActivation(waiterA);
    expect(apMaintained).toBe(0); // 1 AP consumed for wait upkeep while not free
    expect(waiterA.state.isWaiting).toBe(true);

    const battlefieldB = new Battlefield(12, 12);
    const waiterB = createCharacter('waiterB');
    const enemyB = createCharacter('enemyB');
    battlefieldB.placeCharacter(waiterB, { x: 6, y: 6 });
    battlefieldB.placeCharacter(enemyB, { x: 7, y: 6 }); // engaged
    const managerB = new GameManager([waiterB, enemyB], battlefieldB);
    waiterB.state.isWaiting = true;
    waiterB.state.delayTokens = 2; // 0 AP after delay
    const apDropped = managerB.beginActivation(waiterB);
    expect(apDropped).toBe(0);
    expect(waiterB.state.isWaiting).toBe(false); // cannot pay upkeep, wait removed
  });

  it('sanity: react precedence stack applies engaged/reactingToReact requirements and overreach REF penalty', () => {
    const battlefield = new Battlefield(12, 12);
    const active = createCharacter('active', 4, 4);
    const plain = createCharacter('plain', 5, 4); // +1 wait => 6
    const overreach = createCharacter('overreach', 6, 4); // +1 wait -1 overreach => 6
    const low = createCharacter('low', 4, 4); // +1 wait => 5
    plain.state.isWaiting = true;
    overreach.state.isWaiting = true;
    overreach.state.isOverreach = true;
    low.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(plain, { x: 7, y: 6 });
    battlefield.placeCharacter(overreach, { x: 6, y: 7 });
    battlefield.placeCharacter(low, { x: 5, y: 6 });

    const options = buildReactOptions({
      battlefield,
      active,
      opponents: [plain, overreach, low],
      trigger: 'Move',
      movedDistance: 1,
      reactingToEngaged: true,
      reactingToReact: true,
    });
    const required = options.map(option => option.requiredRef);
    expect(required.every(value => value === 6)).toBe(true); // MOV 4 + engaged 1 + reactingToReact 1

    const availableIds = new Set(options.filter(option => option.available).map(option => option.actor.id));
    expect(availableIds.has(plain.id)).toBe(true);
    expect(availableIds.has(overreach.id)).toBe(true);
    expect(availableIds.has(low.id)).toBe(false);
  });

  it('sanity: Move-react threshold requires meaningful displacement, while NonMove reacts use REF vs active REF', () => {
    const battlefield = new Battlefield(12, 12);
    const active = createCharacter('active', 4, 4);
    const reactor = createCharacter('reactor', 5, 4, [
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
    const reactorLow = createCharacter('reactor-low', 3, 4, [
      {
        name: 'Test Rifle 2',
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
    reactorLow.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });
    battlefield.placeCharacter(reactorLow, { x: 2, y: 5 });

    const moveOptionsBelowThreshold = buildReactOptions({
      battlefield,
      active,
      opponents: [reactor],
      trigger: 'Move',
      movedDistance: 0.25, // below base-diameter/2 threshold
      reactingToEngaged: false,
      reactingToReact: false,
    });
    expect(moveOptionsBelowThreshold).toHaveLength(1);
    expect(moveOptionsBelowThreshold[0].available).toBe(false);
    expect(moveOptionsBelowThreshold[0].reason).toBe('Move did not trigger Standard react threshold.');

    const nonMoveOptions = buildReactOptions({
      battlefield,
      active,
      opponents: [reactor, reactorLow],
      trigger: 'NonMove',
      movedDistance: 0,
      reactingToEngaged: false,
      reactingToReact: false,
    });
    const readyOption = nonMoveOptions.find(option => option.actor.id === reactor.id)!;
    const lowOption = nonMoveOptions.find(option => option.actor.id === reactorLow.id)!;
    expect(readyOption.type).toBe('ReactAction');
    expect(readyOption.requiredRef).toBe(5); // active REF 4 + abrupt 1
    expect(readyOption.effectiveRef).toBe(6); // reactor REF + Wait
    expect(readyOption.available).toBe(true);
    expect(lowOption.requiredRef).toBe(5);
    expect(lowOption.effectiveRef).toBe(4); // lower REF + Wait
    expect(lowOption.available).toBe(false);
  });

  it('sanity: overreach-only melee is first-action legal but second-action illegal', () => {
    const battlefield = new Battlefield(24, 24);
    const attacker = createCharacter('attacker');
    const defender = createCharacter('defender');
    attacker.state.isAttentive = true;
    attacker.profile.items = [
      {
        name: 'Spear',
        class: 'Melee',
        classification: 'Melee',
        type: 'Weapon',
        bp: 5,
        traits: [],
      } as any,
    ];
    attacker.profile.equipment = [...attacker.profile.items];

    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // 1 MU edge distance

    const firstActionLegality = assessBestMeleeLegality(attacker, defender, battlefield, {
      isFirstAction: true,
      isFreeAtStart: true,
    });
    expect(firstActionLegality.canAttack).toBe(true);
    expect(firstActionLegality.requiresOverreach).toBe(true);

    const secondActionLegality = assessBestMeleeLegality(attacker, defender, battlefield, {
      isFirstAction: false,
      isFreeAtStart: true,
    });
    expect(secondActionLegality.canAttack).toBe(false);
    expect(secondActionLegality.canUseOverreach).toBe(false);
  });

  it('sanity: Reach enables legal melee at 1 MU edge distance without overreach', () => {
    const battlefield = new Battlefield(24, 24);
    const attacker = createCharacter('attacker');
    const defender = createCharacter('defender');
    attacker.state.isAttentive = true;
    attacker.profile.items = [
      {
        name: 'Long Spear',
        class: 'Melee',
        classification: 'Melee',
        type: 'Weapon',
        bp: 5,
        traits: ['Reach 1'],
      } as any,
    ];
    attacker.profile.equipment = [...attacker.profile.items];

    battlefield.placeCharacter(attacker, { x: 6, y: 12 });
    battlefield.placeCharacter(defender, { x: 8, y: 12 }); // 1 MU edge distance

    const reachLegality = assessBestMeleeLegality(attacker, defender, battlefield, {
      isFirstAction: false,
      isFreeAtStart: true,
    });
    expect(reachLegality.canAttack).toBe(true);
    expect(reachLegality.requiresReach).toBe(true);
    expect(reachLegality.requiresOverreach).toBe(false);
    expect(reachLegality.canUseOverreach).toBe(false);
  });

  it('sanity: ranged attack can be cancelled when declared Take Cover breaks LOS', () => {
    const battlefield = new Battlefield(12, 12);
    battlefield.addTerrain(new TerrainElement('Tree', { x: 8, y: 5 }).toFeature());

    const attacker = createCharacter('attacker', 3, 4);
    const defender = createCharacter('defender', 3, 8);
    battlefield.placeCharacter(attacker, { x: 2, y: 2 });
    battlefield.placeCharacter(defender, { x: 8, y: 2 });
    const gameManager = new GameManager([attacker, defender], battlefield);

    const weapon = {
      name: 'Test Rifle',
      class: 'Range',
      classification: 'Range',
      type: 'Ranged',
      bp: 0,
      or: 8,
      accuracy: '-',
      impact: 0,
      dmg: '1',
      traits: [],
    };

    const outcome = gameManager.executeRangedAttack(attacker, defender, weapon as any, {
      allowTakeCover: true,
      takeCoverPosition: { x: 8, y: 5 },
    });

    expect(outcome.takeCover?.cancelled).toBe(true);
    expect(outcome.result.hit).toBe(false);
  });
});

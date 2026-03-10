import { describe, it, expect, afterEach } from 'vitest';
import { Battlefield } from '../battlefield/Battlefield';
import { Character } from '../core/Character';
import type { Profile } from '../core/Profile';
import { buildReactOptions, sortReactOptions } from './react-actions';
import { GameManager } from '../engine/GameManager';
import { setRoller, resetRoller } from '../subroutines/dice-roller';

const makeProfile = (name: string, ref = 2, mov = 4): Profile => ({
  name,
  archetype: { attributes: { cca: 0, rca: 0, ref, int: 0, pow: 0, str: 0, for: 0, mov, siz: 3 } },
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
});

describe('react-actions', () => {
  afterEach(() => {
    resetRoller();
  });

  it('should offer an available Standard react option when wait + LOS + movement threshold met', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 4, 4));
    reactor.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });

    const options = buildReactOptions({
      battlefield,
      active,
      opponents: [reactor],
      trigger: 'Move',
      movedDistance: 1,
    });

    expect(options[0].available).toBe(true);
  });

  it('should block react if already reacted this turn', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 2, 4));
    reactor.state.isWaiting = true;

    const manager = new GameManager([active, reactor], battlefield);
    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });

    const first = manager.executeReactAction(reactor, () => true);
    expect(first.executed).toBe(true);
    const second = manager.executeReactAction(reactor, () => true);
    expect(second.executed).toBe(false);
  });

  it('should temporarily assign reacting model as active during another model initiative', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 2, 4));
    reactor.state.isWaiting = true;

    const manager = new GameManager([active, reactor], battlefield);
    manager.beginActivation(active);
    expect(manager.getActiveCharacterId()).toBe(active.id);

    let activeIdDuringReact: string | null = null;
    const react = manager.executeReactAction(reactor, () => {
      activeIdDuringReact = manager.getActiveCharacterId();
      return true;
    });

    expect(react.executed).toBe(true);
    expect(activeIdDuringReact).toBe(reactor.id);
    expect(manager.getActiveCharacterId()).toBe(active.id);
  });

  it('should allow a model to become active again during another model initiative', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 2, 4));

    const manager = new GameManager([active, reactor], battlefield);
    const ownAp = manager.beginActivation(reactor);
    expect(ownAp).toBe(2);
    manager.endActivation(reactor);

    reactor.state.isWaiting = true;
    manager.beginActivation(active);

    let activeIdDuringReact: string | null = null;
    const react = manager.executeReactAction(reactor, () => {
      activeIdDuringReact = manager.getActiveCharacterId();
      return true;
    });

    expect(react.executed).toBe(true);
    expect(activeIdDuringReact).toBe(reactor.id);
    expect(manager.getActiveCharacterId()).toBe(active.id);
  });

  it('should sort react options by effective ref then initiative', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const r1 = new Character(makeProfile('R1', 3, 4));
    const r2 = new Character(makeProfile('R2', 3, 4));
    r1.initiative = 5;
    r2.initiative = 2;
    r1.state.isWaiting = true;
    r2.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(r1, { x: 2, y: 6 });
    battlefield.placeCharacter(r2, { x: 2, y: 5 });

    const options = buildReactOptions({ battlefield, active, opponents: [r2, r1], trigger: 'Move', movedDistance: 2 });
    const sorted = sortReactOptions(options);
    expect(sorted[0].actor.id).toBe(r1.id);
  });

  it('should use doubled wait visibility for Standard react range gating', () => {
    const battlefield = new Battlefield(20, 20);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 4, 4));
    reactor.state.isWaiting = true;
    reactor.profile.items = [{
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
    } as any];

    const manager = new GameManager([active, reactor], battlefield);
    battlefield.placeCharacter(active, { x: 10, y: 2 });
    battlefield.placeCharacter(reactor, { x: 2, y: 2 });

    const weapon = reactor.profile.items[0] as any;
    const blockedByVisibility = manager.executeStandardReact(reactor, active, weapon, { visibilityOrMu: 2 });
    expect(blockedByVisibility.executed).toBe(false);

    const allowedByWaitVisibility = manager.executeStandardReact(reactor, active, weapon, { visibilityOrMu: 4 });
    expect(allowedByWaitVisibility.executed).toBe(true);
  });

  it('should require +1 REF when reacting to being Engaged on movement abrupt', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const lowReactor = new Character(makeProfile('LowReactor', 3, 4)); // +1 wait => 4
    const highReactor = new Character(makeProfile('HighReactor', 4, 4)); // +1 wait => 5
    lowReactor.state.isWaiting = true;
    highReactor.state.isWaiting = true;

    // Active is in base-contact with both reactors => reacting to being Engaged
    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(lowReactor, { x: 7, y: 6 });
    battlefield.placeCharacter(highReactor, { x: 6, y: 7 });

    const options = buildReactOptions({
      battlefield,
      active,
      opponents: [lowReactor, highReactor],
      trigger: 'Move',
      movedDistance: 1,
    });

    const low = options.find(option => option.actor.id === lowReactor.id)!;
    const high = options.find(option => option.actor.id === highReactor.id)!;

    expect(low.requiredRef).toBe(5);   // MOV 4 + 1 engaged
    expect(high.requiredRef).toBe(5);  // MOV 4 + 1 engaged
    expect(low.effectiveRef).toBe(4);  // 3 + wait
    expect(high.effectiveRef).toBe(5); // 4 + wait
    expect(low.available).toBe(false);
    expect(high.available).toBe(true);
  });

  it('should not add engaged bonus requirement when movement does not engage reactor', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 3, 4)); // +1 wait => 4
    reactor.state.isWaiting = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 }); // not engaged

    const options = buildReactOptions({
      battlefield,
      active,
      opponents: [reactor],
      trigger: 'Move',
      movedDistance: 1,
    });

    expect(options[0].requiredRef).toBe(4); // MOV only, no +1 engaged
    expect(options[0].effectiveRef).toBe(4);
    expect(options[0].available).toBe(true);
  });

  it('should apply overreach penalty and reactingToReact requirement on NonMove React actions', () => {
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 4, 4));
    const readyReactor = new Character(makeProfile('ReadyReactor', 5, 4)); // +1 wait => 6
    const overreachReactor = new Character(makeProfile('OverreachReactor', 5, 4)); // +1 wait -1 overreach => 5
    readyReactor.state.isWaiting = true;
    overreachReactor.state.isWaiting = true;
    overreachReactor.state.isOverreach = true;

    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(readyReactor, { x: 2, y: 6 });
    battlefield.placeCharacter(overreachReactor, { x: 2, y: 5 });

    const options = buildReactOptions({
      battlefield,
      active,
      opponents: [readyReactor, overreachReactor],
      trigger: 'NonMove',
      movedDistance: 0,
      reactingToReact: true,
    });

    const ready = options.find(option => option.actor.id === readyReactor.id)!;
    const overreach = options.find(option => option.actor.id === overreachReactor.id)!;

    expect(ready.type).toBe('ReactAction');
    expect(ready.requiredRef).toBe(6); // active REF 4 + abrupt 1 + reactingToReact 1
    expect(ready.effectiveRef).toBe(6);
    expect(ready.available).toBe(true);

    expect(overreach.requiredRef).toBe(6);
    expect(overreach.effectiveRef).toBe(5);
    expect(overreach.available).toBe(false);
  });

  it('should enforce declared weapon on Standard react attacks', () => {
    setRoller(() => Array(20).fill(6));
    const battlefield = new Battlefield(12, 12);
    const active = new Character(makeProfile('Active', 2, 4));
    const reactor = new Character(makeProfile('Reactor', 4, 4));
    const declaredWeapon = {
      name: 'Declared Rifle',
      classification: 'Range',
      class: 'Range',
      type: 'Ranged',
      bp: 0,
      or: 8,
      accuracy: '-',
      impact: 0,
      dmg: '4',
      traits: ['[Reveal]'],
    };
    const fallbackWeapon = {
      name: 'Fallback Rifle',
      classification: 'Range',
      class: 'Range',
      type: 'Ranged',
      bp: 0,
      or: 8,
      accuracy: '-',
      impact: 0,
      dmg: '4',
      traits: [],
    };
    reactor.profile.items = [declaredWeapon as any];
    reactor.state.activeWeaponIndex = 0;
    reactor.state.isWaiting = true;
    reactor.state.isHidden = true;

    const manager = new GameManager([active, reactor], battlefield);
    battlefield.placeCharacter(active, { x: 6, y: 6 });
    battlefield.placeCharacter(reactor, { x: 2, y: 6 });

    const result = manager.executeStandardReact(reactor, active, fallbackWeapon as any, {} as any);
    expect(result.executed).toBe(true);
    expect(reactor.state.isHidden).toBe(false);
  });
});

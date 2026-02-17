import { describe, it, expect } from 'vitest';
import { Battlefield } from './battlefield/Battlefield';
import { Character } from './Character';
import type { Profile } from './Profile';
import { buildReactOptions, sortReactOptions } from './react-actions';
import { GameManager } from './GameManager';

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
  burden: { totalLaden: 0, totalBurden: 0 },
  totalHands: 0,
  totalDeflect: 0,
  totalAR: 0,
  finalTraits: [],
  allTraits: [],
});

describe('react-actions', () => {
  it('should offer an available Overwatch option when wait + LOS + movement threshold met', () => {
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
});

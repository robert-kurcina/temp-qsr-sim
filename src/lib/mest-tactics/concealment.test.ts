import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { Battlefield } from './battlefield/Battlefield';
import { TerrainElement } from './battlefield/TerrainElement';
import { setRoller, resetRoller } from './dice-roller';
import { attemptHide, attemptDetect, resolveHiddenExposure, resolveWaitReveal } from './concealment';
import type { Profile } from './Profile';

describe('concealment', () => {
  let battlefield: Battlefield;
  let attacker: any;
  let defender: any;

  beforeEach(async () => {
    battlefield = new Battlefield(12, 12);
    const attackerProfile: Profile = {
      name: 'Attacker',
      archetype: { attributes: { cca: 0, rca: 0, ref: 4, int: 0, pow: 0, str: 0, for: 0, mov: 4, siz: 3 } },
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
    };
    const defenderProfile: Profile = {
      name: 'Defender',
      archetype: { attributes: { cca: 0, rca: 0, ref: 3, int: 0, pow: 0, str: 0, for: 0, mov: 4, siz: 3 } },
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
    };
    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);
    battlefield.placeCharacter(attacker, { x: 2, y: 6 });
    battlefield.placeCharacter(defender, { x: 10, y: 6 });
    resetRoller();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should not allow hide when exposed to LOS without cover', () => {
    const result = attemptHide(battlefield, defender, [attacker], () => true);
    expect(result.canHide).toBe(false);
  });

  it('should allow hide when no opposing LOS', () => {
    const wall = new TerrainElement('Medium Wall', { x: 6, y: 6 });
    battlefield.addTerrain(wall.toFeature());
    const result = attemptHide(battlefield, defender, [attacker], () => true);
    expect(result.canHide).toBe(true);
    expect(defender.state.isHidden).toBe(true);
  });

  it('should reveal hidden target on successful detect', () => {
    defender.state.isHidden = true;
    setRoller(() => [6, 6]);
    const result = attemptDetect(battlefield, attacker, defender, [attacker, defender]);
    expect(result.success).toBe(true);
    expect(defender.state.isHidden).toBe(false);
  });

  it('should reveal hidden target when exposed at start of activation', () => {
    defender.state.isHidden = true;
    const exposure = resolveHiddenExposure(battlefield, defender, [attacker], { allowReposition: false });
    expect(exposure.revealed).toBe(true);
    expect(defender.state.isHidden).toBe(false);
  });

  it('should reveal hidden targets in LOS while waiting', () => {
    defender.state.isHidden = true;
    attacker.state.isWaiting = true;
    const result = resolveWaitReveal(battlefield, attacker, [defender], { allowReposition: false });
    expect(result.revealed.length).toBe(1);
    expect(defender.state.isHidden).toBe(false);
  });
});

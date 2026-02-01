
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeRangedCombatAttack } from './ranged-combat';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import type { TestContext } from './TestContext';
import { gameData } from '../data';

const { archetypes, ranged_weapons, armors } = gameData;

describe('makeRangedCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(() => {
    const attackerArchetype = { name: "Marksman", ...archetypes["Marksman"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };
    attackerWeapon = { name: "Crossbow", ...ranged_weapons["Crossbow"] };
    const defenderArmor = { name: "Armor, Light Leather", ...armors["Armor, Light Leather"] };
    const attackerProfile: Profile = { archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { archetype: defenderArchetype, equipment: [defenderArmor] };
    attacker = createCharacter(attackerProfile, 'Attacker');
    defender = createCharacter(defenderProfile, 'Defender');
  });

  afterEach(() => {
    resetRoller();
    metricsService.clearEvents();
  });

  it('should force a successful hit and create a damage resolution', () => {
    let rollResults = [5, 1, 5, 1];
    const mockRoller: Roller = () => rollResults.shift() || 0;
    setRoller(mockRoller);

    const result = makeRangedCombatAttack(attacker, defender, attackerWeapon, { forceHit: true });

    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
  });

  it('should force a miss and not create a damage resolution', () => {
    let rollResults = [1, 5];
    const mockRoller: Roller = () => rollResults.shift() || 0;
    setRoller(mockRoller);

    const result = makeRangedCombatAttack(attacker, defender, attackerWeapon, {});

    expect(result.hit).toBe(false);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a point-blank bonus for the attacker', () => {
    setRoller(() => 0);
    const context: TestContext = { isPointBlank: true };

    makeRangedCombatAttack(attacker, defender, attackerWeapon, context);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should add a cover bonus for the defender with direct cover', () => {
    setRoller(() => 0);
    const context: TestContext = { hasDirectCover: true };

    makeRangedCombatAttack(attacker, defender, attackerWeapon, context);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should add a cover bonus for the defender with intervening cover', () => {
    setRoller(() => 0);
    const context: TestContext = { hasInterveningCover: true };

    makeRangedCombatAttack(attacker, defender, attackerWeapon, context);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should apply an ORM penalty to the attacker', () => {
    setRoller(() => 0);
    const context: TestContext = { orm: 2 }; // -2m penalty

    makeRangedCombatAttack(attacker, defender, attackerWeapon, context);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p1FinalPenalty[DiceType.Modifier]).toBe(2);
  });
});

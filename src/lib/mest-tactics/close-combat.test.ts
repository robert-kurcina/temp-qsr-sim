
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeCloseCombatAttack } from './close-combat';
import { setRoller, resetRoller, DiceType } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import { gameData } from '../data';

const { archetypes, melee_weapons, armors } = gameData;

describe('makeCloseCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(async () => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };
    attackerWeapon = { name: "Sword, Broad", ...melee_weapons["Sword, Broad"] };
    const defenderArmor = { name: "Armor, Medium Mail", ...armors["Armor, Medium Mail"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [defenderArmor] };

    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);

    metricsService.clearEvents();
    resetRoller();
  });

  afterEach(() => {
    resetRoller();
  });

  it('should force a successful hit and create a damage resolution', () => {
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, { forceHit: true }, [6, 6, 6, 6], [6, 6, 6, 6]);
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
    expect(result.damageResolution.woundsAdded).toBe(2);
  });

  it('should pass the hit test and create a damage resolution', () => {
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {}, [6, 6], [1, 1]);
    expect(result.hit).toBe(true);
    expect(result.hitTestResult.score).toBe(4);
    expect(result.damageResolution).toBeDefined();
  });

  it('should fail the hit test and not create a damage resolution', () => {
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {}, [1, 1], [6, 6]);
    expect(result.hit).toBe(false);
    expect(result.hitTestResult.score).toBe(-4);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a bonus die to the attacker for a Charge', () => {
    const context = { isCharge: true };
    makeCloseCombatAttack(attacker, defender, attackerWeapon, context, [1,1,1], [1,1]);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThan(0);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should add a bonus die to the defender for Defending', () => {
    const context = { isDefending: true };
    makeCloseCombatAttack(attacker, defender, attackerWeapon, context, [1,1], [1,1,1]);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThan(0);
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should correctly apply impact modifier from assisting models', () => {
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, { forceHit: true, assistingModels: 2 }, [6, 6, 6, 6], [6, 6, 6, 6]);
    expect(result.damageResolution.impact).toBe(3);
  });
});

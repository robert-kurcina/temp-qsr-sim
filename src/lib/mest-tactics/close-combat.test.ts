
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeCloseCombatAttack } from './close-combat';
import { setRoller, resetRoller, DiceType, Roller } from './dice-roller';
import { metricsService } from './MetricsService';
import type { Profile } from './Profile';
import type { Item } from './Item';
import type { Character } from './Character';
import type { TestContext } from './TestContext';
import { gameData } from '../data';

const { archetypes, melee_weapons, armors } = gameData;

describe('makeCloseCombatAttack', () => {
  let attacker: Character;
  let defender: Character;
  let attackerWeapon: Item;

  beforeEach(async () => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] }; // CCA 4
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] }; // REF 3

    attackerWeapon = { name: "Sword, Broad", ...melee_weapons["Sword, Broad"] };
    const defenderWeapon = { name: "Axe", ...melee_weapons["Axe"] };
    const defenderArmor = { name: "Armor, Medium Mail", ...armors["Armor, Medium Mail"] };

    const attackerProfile: Profile = { name: 'Attacker Profile', archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { name: 'Defender Profile', archetype: defenderArchetype, equipment: [defenderWeapon, defenderArmor] };

    attacker = await createCharacter(attackerProfile);
    defender = await createCharacter(defenderProfile);
  });

  afterEach(() => {
    resetRoller();
    metricsService.clearEvents();
  });

  it('should force a successful hit and create a damage resolution', () => {
    setRoller(() => [1]);
    const context: TestContext = { forceHit: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
  });

  it('should pass the hit test and create a damage resolution', () => {
    // Attacker has CCA:4 and rolls 2 base dice. Defender has REF:3 and rolls 2 base dice.
    const rolls = [[6, 6], [1, 1]]; // Attacker rolls [6,6], Defender rolls [1,1]
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
    // Attacker successes: 2 (from 6) + 2 (from 6) = 4. Score: 4 (CCA) + 4 = 8.
    // Defender successes: 0 (from 1) + 0 (from 1) = 0. Score: 3 (REF) + 0 = 3.
    // Final score: 8 - 3 = 5. HIT.
    expect(result.hit).toBe(true);
    expect(result.hitTestResult.score).toBe(5);
    expect(result.damageResolution).toBeDefined();
  });

  it('should fail the hit test and not create a damage resolution', () => {
    // Attacker has CCA:4 and rolls 2 base dice. Defender has REF:3 and rolls 2 base dice.
    const rolls = [[1, 1], [6, 6]]; // Attacker rolls [1,1], Defender rolls [6,6]
    const statefulRoller: Roller = () => rolls.shift() || [1];
    setRoller(statefulRoller);

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});

    // Attacker successes: 0. Score: 4 (CCA) + 0 = 4.
    // Defender successes: 4. Score: 3 (REF) + 4 = 7.
    // Final score: 4 - 7 = -3. MISS.
    expect(result.hit).toBe(false);
    expect(result.hitTestResult.score).toBe(-3);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a bonus die to the attacker for a Charge', () => {
    setRoller(() => [1]);
    const context: TestContext = { isCharge: true };
    makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const hitEventData = diceEvents[0].data as any;
    // Attacker gets +1 Modifier die for charge.
    expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should add a bonus die to the defender for Defending', () => {
    setRoller(() => [1]);
    const context: TestContext = { isDefending: true };
    makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const hitEventData = diceEvents[0].data as any;
    // Defender gets +1 Base die for defending.
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should correctly apply impact modifier from assisting models', () => {
    setRoller(() => [1]);
    const context: TestContext = { forceHit: true, assistingModels: 2 };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
    // Base impact of Broad Sword is 1. 2 assisting models add +2.
    expect(result.damageResolution?.impact).toBe(3);
  });
});

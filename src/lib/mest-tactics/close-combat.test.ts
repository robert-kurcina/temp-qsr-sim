
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

  beforeEach(() => {
    const attackerArchetype = { name: "Veteran, Fighter", ...archetypes["Veteran, Fighter"] };
    const defenderArchetype = { name: "Militia", ...archetypes["Militia"] };

    attackerWeapon = { name: "Sword, Broad", ...melee_weapons["Sword, Broad"] };
    const defenderWeapon = { name: "Axe", ...melee_weapons["Axe"] };
    const defenderArmor = { name: "Armor, Medium Mail", ...armors["Armor, Medium Mail"] };

    const attackerProfile: Profile = { archetype: attackerArchetype, equipment: [attackerWeapon] };
    const defenderProfile: Profile = { archetype: defenderArchetype, equipment: [defenderWeapon, defenderArmor] };

    attacker = createCharacter(attackerProfile, 'Attacker');
    defender = createCharacter(defenderProfile, 'Defender');
  });

  afterEach(() => {
    resetRoller();
    metricsService.clearEvents();
  });

  it('should force a successful hit and create a damage resolution', () => {
    setRoller(() => 1);
    const context: TestContext = { forceHit: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
  });

  it('should pass the hit test and create a damage resolution', () => {
    // Force a win for the attacker with the roller
    const attackerDiceCount = attacker.finalAttributes.cca;
    setRoller((count) => (count === attackerDiceCount ? [6, 6, 6, 6] : [1, 1, 1]));
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
  });

  it('should fail the hit test and not create a damage resolution', () => {
    // Force a loss for the attacker with the roller
    const attackerDiceCount = attacker.finalAttributes.cca;
    setRoller((count) => (count === attackerDiceCount ? [1, 1, 1, 1] : [6, 6, 6]));
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
    expect(result.hit).toBe(false);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a bonus die to the attacker for a Charge', () => {
    setRoller(() => 1);
    const context: TestContext = { isCharge: true };
    makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p1FinalBonus[DiceType.Modifier] || 0).toBe(1);
  });

  it('should add a bonus die to the defender for Defending', () => {
    setRoller(() => 1);
    const context: TestContext = { isDefending: true };
    makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should correctly apply impact modifier from assisting models', () => {
    setRoller(() => 1);
    const context: TestContext = { forceHit: true, assistingModels: 2 };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
    // Base impact of Broad Sword is 1. 2 assisting models add +2.
    expect(result.damageResolution?.impact).toBe(3);
  });
});

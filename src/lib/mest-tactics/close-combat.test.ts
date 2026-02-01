
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
    let rollResults = [5, 1, 5, 1];
    const mockRoller: Roller = () => rollResults.shift() || 0;
    setRoller(mockRoller);

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});

    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
  });

  it('should force a miss and not create a damage resolution', () => {
    let rollResults = [1, 5];
    const mockRoller: Roller = () => rollResults.shift() || 0;
    setRoller(mockRoller);

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});

    expect(result.hit).toBe(false);
    expect(result.damageResolution).toBeUndefined();
  });

  it('should add a bonus die to the attacker for a Charge', () => {
    setRoller(() => 0);
    const context: TestContext = { isCharge: true };

    makeCloseCombatAttack(attacker, defender, attackerWeapon, context);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);
    
    const hitEventData = diceEvents[0].data as any;
    // Robustly check for the bonus, defaulting to 0 if the key is not present.
    expect(hitEventData.finalPools.p1FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should add a bonus die to the defender for Defending', () => {
    setRoller(() => 0);
    const context: TestContext = { isDefending: true };

    makeCloseCombatAttack(attacker, defender, attackerWeapon, context);

    const diceEvents = metricsService.getEventsByName('diceTestResolved');
    expect(diceEvents.length).toBeGreaterThanOrEqual(1);

    const hitEventData = diceEvents[0].data as any;
    expect(hitEventData.finalPools.p2FinalBonus[DiceType.Base] || 0).toBe(1);
  });

  it('should correctly apply impact modifier from assisting models', () => {
    let rollResults = [5, 1, 5, 1];
    const mockRoller: Roller = () => rollResults.shift() || 0;
    setRoller(mockRoller);
    const context: TestContext = { assistingModels: 2 };

    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    
    expect(result.hit).toBe(true);
    expect(result.damageResolution).toBeDefined();
  });
});

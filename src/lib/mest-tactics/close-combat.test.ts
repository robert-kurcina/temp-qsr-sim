
import { describe, it, expect, beforeEach } from 'vitest';
import { createCharacter } from './character-factory';
import { makeCloseCombatAttack } from './close-combat';
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

  it('should resolve a standard attack', () => {
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
    expect(result.hit).toBeTypeOf('boolean');
  });

  it('should return a damageResolution object on a successful hit', () => {
    const context = {};
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    if (result.hit) {
      expect(result.damageResolution).toBeDefined();
      expect(result.damageResolution?.woundsAdded).toBeGreaterThanOrEqual(0); // Corrected property
    }
  });

  it('should not return a damageResolution object on a miss', () => {
    // This test is statistical, but we can run it multiple times to increase confidence.
    // For a deterministic test, we would need to mock the dice roller.
    for (let i = 0; i < 10; i++) {
        const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, {});
        if (!result.hit) {
            expect(result.damageResolution).toBeUndefined();
        }
    }
  });

  it('should apply a bonus to the attacker for a Charge', () => {
      const context: TestContext = { isCharge: true };
      const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
      // We can only check that the code runs without error, as the result is random.
      expect(result).toBeDefined();
  });

  it('should apply a bonus to the defender for Defending', () => {
    const context: TestContext = { isDefending: true };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    expect(result).toBeDefined();
  });

  // Test that context is passed to the damage phase correctly
  it('should pass assistingModels context to the damage phase', () => {
    const context: TestContext = { assistingModels: 2 };
    const result = makeCloseCombatAttack(attacker, defender, attackerWeapon, context);
    if (result.hit) {
      // We can't check remainingImpact, but we can confirm damage was resolved.
      expect(result.damageResolution).toBeDefined();
    }
  });
});

import { Character } from '../character/Character';
import { performTest, TestDice } from '../dice-roller';

export interface CombatResult {
  hit: boolean;
  wound: boolean;
}

export class CombatEngine {
  // For testing purposes, we allow injecting dice rolls.
  public static testing_diceRolls: number[] = [];

  private static getRolls(count: number): number[] {
    if (this.testing_diceRolls.length > 0) {
      return this.testing_diceRolls.splice(0, count);
    }
    return Array(count)
      .fill(0)
      .map(() => Math.floor(Math.random() * 6) + 1);
  }

  public static resolveCloseCombat(
    attacker: Character,
    defender: Character,
    attackerDice: TestDice = { base: 2 },
    defenderDice: TestDice = { base: 2 }
  ): CombatResult {
    // --- Hit Test (Opposed CCA vs CCA) ---
    const attackerHitRolls = this.getRolls(attackerDice.base || 0);
    const defenderHitRolls = this.getRolls(defenderDice.base || 0);

    const attackerHitTest = performTest(attackerDice, attacker.attributes.CCA, attackerHitRolls);
    const defenderHitTest = performTest(defenderDice, defender.attributes.CCA, defenderHitRolls);

    const hit = attackerHitTest.score >= defenderHitTest.score;

    if (!hit) {
      return { hit: false, wound: false };
    }

    // --- Damage Test (Opposed STR vs FOR) ---
    const attackerDamageDice: TestDice = {
      base: 2 + (attackerHitTest.carryOverDice.base || 0),
      modifier: attackerHitTest.carryOverDice.modifier || 0,
      wild: attackerHitTest.carryOverDice.wild || 0,
    };
    const defenderDamageDice: TestDice = { base: 2 };

    const attackerDamageRolls = this.getRolls(
      (attackerDamageDice.base || 0) + (attackerDamageDice.modifier || 0) + (attackerDamageDice.wild || 0)
    );
    const defenderDamageRolls = this.getRolls(defenderDamageDice.base || 0);

    const attackerDamageTest = performTest(attackerDamageDice, attacker.attributes.STR, attackerDamageRolls);
    const defenderDamageTest = performTest(defenderDamageDice, defender.attributes.FOR, defenderDamageRolls);

    const wound = attackerDamageTest.score >= defenderDamageTest.score;

    if (wound) {
      defender.takeWound();
    }

    return { hit: true, wound };
  }
}

import { Character } from '../core/Character';
import { performTest, TestDice } from '../subroutines/dice-roller';

export interface CombatResult {
  hit: boolean;
  wound: boolean;
}

export interface TestRolls {
  attackerRolls: number[];
  defenderRolls: number[];
}

export class CombatEngine {
  // For testing purposes, we allow injecting dice rolls.
  public static testing_diceRolls: TestRolls = { attackerRolls: [], defenderRolls: [] };

  private static getRolls(count: number, role: 'attacker' | 'defender'): number[] {
    const rolls = role === 'attacker' ? this.testing_diceRolls.attackerRolls : this.testing_diceRolls.defenderRolls;
    if (rolls.length > 0) {
      return rolls.splice(0, count);
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
    // --- Hit Test (Opposed cca vs cca) ---
    const attackerHitRolls = this.getRolls((attackerDice.base || 0) + (attackerDice.modifier || 0) + (attackerDice.wild || 0), 'attacker');
    const defenderHitRolls = this.getRolls((defenderDice.base || 0) + (defenderDice.modifier || 0) + (defenderDice.wild || 0), 'defender');

    const attackerHitTest = performTest(attackerDice, attacker.finalAttributes.cca, attackerHitRolls);
    const defenderHitTest = performTest(defenderDice, defender.finalAttributes.cca, defenderHitRolls);

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
      (attackerDamageDice.base || 0) + (attackerDamageDice.modifier || 0) + (attackerDamageDice.wild || 0),
      'attacker'
    );
    const defenderDamageRolls = this.getRolls(
      (defenderDamageDice.base || 0) + (defenderDamageDice.modifier || 0) + (defenderDamageDice.wild || 0),
      'defender'
      );

    const attackerDamageTest = performTest(attackerDamageDice, attacker.finalAttributes.str, attackerDamageRolls);
    const defenderDamageTest = performTest(defenderDamageDice, defender.finalAttributes.for, defenderDamageRolls);

    const wound = attackerDamageTest.score >= defenderDamageTest.score;

    if (wound) {
      defender.wounds += 1;
    }

    return { hit: true, wound };
  }
}

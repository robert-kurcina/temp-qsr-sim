
import type { Character } from '../core/Character';
import type { Item } from '../core/Item';
import { resolveTest } from '../subroutines/dice-roller';
import { parseDamage } from './damage-parser';

export interface DamageResult {
  wounds: number; // Represents the number of wounds *added* in this single resolution
  stun: number;
  effects: string[];
}

/**
 * Resolves a damage test after a successful hit.
 * @param attacker The character performing the attack.
 * @param defender The character being attacked.
 * @param weapon The weapon used for the attack.
 * @param hitCascades The number of cascades from the successful hit test.
 * @returns A DamageResult object detailing wounds, stun, and other effects.
 */
export function resolveDamageTest(
  attacker: Character,
  defender: Character,
  weapon: Item,
  hitCascades: number
): DamageResult {
  const damageResult: DamageResult = { wounds: 0, stun: 0, effects: [] };

  // 1. Determine Damage Rating from weapon
  const damageSpec = weapon.dmg ?? (weapon as unknown as { damage?: string }).damage ?? '';
  const { value: damageValue, dice: damageDice } = parseDamage(damageSpec, attacker.finalAttributes);

  // 2. Calculate effective Armor Rating (AR)
  const totalAR = defender.state.armor?.total || 0;
  const weaponImpact = weapon.impact || 0;
  const effectiveAR = Math.max(0, totalAR - weaponImpact);

  // 3. Perform the Opposed Damage Test
  const damageTestResult = resolveTest({
    attributeValue: damageValue,
    bonusDice: damageDice,
    carryOverDice: { base: hitCascades, modifier: 0, wild: 0 } // Use hit cascades as carry-over
  }, {
    attributeValue: defender.finalAttributes.for,
  });

  // 4. Calculate and apply wounds if the test passes
  if (damageTestResult.pass) {
    // Per the rules, Wounds = cascades from the Damage Test, reduced by effective AR.
    const cascades = damageTestResult.cascades || 0;
    const woundsToApply = Math.max(0, cascades - effectiveAR);

    if (woundsToApply > 0) {
        defender.state.wounds += woundsToApply;
        damageResult.wounds = woundsToApply;
    }
  }

  // 5. Update KO and Elimination status based on the new total wounds
  const size = defender.finalAttributes.siz;
  if (defender.state.wounds >= size) {
    defender.state.isKOd = true;
    damageResult.effects.push('KOd');
  }
  if (defender.state.wounds >= size + 3) {
    defender.state.isEliminated = true;
    damageResult.effects.push('Eliminated');
  }

  return damageResult;
}

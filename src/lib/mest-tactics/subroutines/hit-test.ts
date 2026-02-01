
import { Character } from '../Character';
import { resolveTest, TestParticipant, DicePool } from '../dice-roller';
import { Item } from '../Item';
import { parseAccuracy } from './accuracy-parser';

/**
 * Resolves the opposed hit test in a close combat attack.
 * @param attacker The attacking character.
 * @param defender The defending character.
 * @param weapon The weapon being used.
 * @param attackerBonus Base bonus dice for the attacker from context.
 * @param attackerPenalty Base penalty dice for the attacker from context.
 * @param defenderBonus Base bonus dice for the defender from context.
 * @param defenderPenalty Base penalty dice for the defender from context.
 * @returns The result of the opposed test.
 */
export function resolveHitTest(
  attacker: Character,
  defender: Character,
  weapon: Item,
  attackerBonus: DicePool,
  attackerPenalty: DicePool,
  defenderBonus: DicePool,
  defenderPenalty: DicePool,
) {
  // 1. Get accuracy modifiers from the weapon
  const { bonusDice: accBonus, penaltyDice: accPenalty, scoreModifier } = parseAccuracy(weapon.accuracy);

  // 2. Combine base modifiers with accuracy modifiers
  const finalAttackerBonus = { ...attackerBonus, ...accBonus };
  const finalAttackerPenalty = { ...attackerPenalty, ...accPenalty };

  // 3. Define the participants for the test
  const hitTestAttacker: TestParticipant = {
    attributeValue: attacker.finalAttributes.cca,
    bonusDice: finalAttackerBonus,
    penaltyDice: finalAttackerPenalty,
  };

  const hitTestDefender: TestParticipant = {
    attributeValue: defender.finalAttributes.cca,
    bonusDice: defenderBonus,
    penaltyDice: defenderPenalty,
  };

  // 4. Resolve the test, applying the score modifier from accuracy
  return resolveTest(hitTestAttacker, hitTestDefender, -scoreModifier);
}

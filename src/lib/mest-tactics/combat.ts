
import { Character } from './Character';
import { resolveTest, TestParticipant, DiceType, DicePool } from './dice-roller';
import { Item } from './Item';
import { TestContext } from './TestContext';

/**
 * Represents the outcome of a full combat attack sequence.
 */
export interface AttackResult {
  hit: boolean;
  woundsInflicted: number;
  remainingImpact: number; // Impact left over after being absorbed by armor.
  hitTestResult: any; // For debugging and logging
  damageTestResult?: any; // For debugging and logging
}

/**
 * Parses a dice string (e.g., "+1w", "-2m") into a dice pool.
 * @param diceString The string to parse.
 * @returns A DicePool object.
 */
const parseDiceString = (diceString: string): DicePool => {
  const dice: DicePool = {};
  const value = parseInt(diceString.slice(1, -1), 10) || 1;

  if (diceString.endsWith('m')) {
    dice[DiceType.Modifier] = value;
  } else if (diceString.endsWith('b')) {
    dice[DiceType.Base] = value;
  } else if (diceString.endsWith('w')) {
    dice[DiceType.Wild] = value;
  }
  return dice;
};

/**
 * Parses a weapon's accuracy value into dice pools and score modifiers.
 * @param accuracy The accuracy value from the weapon item.
 * @returns An object with bonus/penalty dice and a score modifier.
 */
function parseAccuracy(accuracy: string | number | undefined): { bonusDice: DicePool, penaltyDice: DicePool, scoreModifier: number } {
  const result = { bonusDice: {}, penaltyDice: {}, scoreModifier: 0 };
  if (accuracy === undefined || accuracy === '-') return result;

  if (typeof accuracy === 'number') {
    result.scoreModifier = accuracy;
    return result;
  }

  if (accuracy.endsWith('m') || accuracy.endsWith('b') || accuracy.endsWith('w')) {
    if (accuracy.startsWith('-')) {
      result.penaltyDice = parseDiceString(accuracy);
    } else {
      // Assumes '+' or no sign for bonus dice
      result.bonusDice = parseDiceString(accuracy.startsWith('+') ? accuracy : '+' + accuracy);
    }
  } else {
    result.scoreModifier = parseInt(accuracy, 10) || 0;
  }

  return result;
}


/**
 * Parses a damage formula string (e.g., "STR+1w", "2+1b") into a base value and a dice pool.
 * @param formula The damage formula string from an item.
 * @param attacker The character to get attribute values from (e.g., for "STR").
 * @returns A base value and a bonus dice pool.
 */
function parseDamageFormula(formula: string, attacker: Character): { value: number; dice: DicePool } {
  let value = 0;
  const dice: DicePool = {};
  const parts = formula.split('+');

  for (const part of parts) {
    if (part.toUpperCase() === 'STR') {
      value += attacker.finalAttributes.str;
    } else if (part.endsWith('w') || part.endsWith('b') || part.endsWith('m')) {
      const parsed = parseDiceString('+' + part); // Treat all as bonus
      for(const key in parsed) {
        const type = key as DiceType;
        dice[type] = (dice[type] || 0) + parsed[type]!;
      }
    } else {
      value += parseInt(part, 10) || 0;
    }
  }
  return { value, dice };
}

/**
 * Calculates the penalty dice for a character based on their Hindrance status.
 * @param character The character to check.
 * @returns A DicePool containing the penalty dice.
 */
function getHindrancePenalty(character: Character): DicePool {
  const penalty: DicePool = {};
  let hindranceTypes = 0;
  if (character.state.wounds > 0) hindranceTypes++;
  if (character.state.delayTokens > 0) hindranceTypes++;
  if (character.state.fearTokens > 0) hindranceTypes++;

  if (hindranceTypes > 0) {
    penalty[DiceType.Modifier] = hindranceTypes;
  }
  return penalty;
}

/**
 * Executes a complete Close Combat attack sequence between two characters.
 * @param attacker The character initiating the attack.
 * @param defender The character being attacked.
 * @param weapon The weapon being used for the attack.
 * @param context The situational context of the attack.
 * @returns An AttackResult summarizing the outcome.
 */
export function makeCloseCombatAttack(
  attacker: Character,
  defender: Character,
  weapon: Item,
  context: TestContext = {}
): AttackResult {
  // 1. Perform the Hit Test (Opposed CCA vs. CCA)
  const { bonusDice: accBonus, penaltyDice: accPenalty, scoreModifier } = parseAccuracy(weapon.accuracy);

  const hitTestAttacker: TestParticipant = {
    attributeValue: attacker.finalAttributes.cca,
    bonusDice: accBonus,
    penaltyDice: { ...getHindrancePenalty(attacker), ...accPenalty },
  };
  const hitTestDefender: TestParticipant = {
    attributeValue: defender.finalAttributes.cca,
    penaltyDice: getHindrancePenalty(defender),
  };

  // A positive scoreModifier for the attacker acts as a negative DR for the defender.
  const hitTestDR = -scoreModifier;
  const hitTestResult = resolveTest(hitTestAttacker, hitTestDefender, hitTestDR, context);

  if (!hitTestResult.pass) {
    return { hit: false, woundsInflicted: 0, remainingImpact: 0, hitTestResult };
  }

  // 2. Perform the Damage Test (Unopposed) if the attack hits.
  const damageFormula = weapon.dmg || 'STR';
  const { value: damageValue, dice: damageDice } = parseDamageFormula(damageFormula, attacker);
  
  const damageTestAttacker: TestParticipant = {
    attributeValue: damageValue,
    bonusDice: { ...damageDice, ...hitTestResult.carryOverDice },
  };
  
  const damageTestDefender: TestParticipant = { attributeValue: 0, isSystemPlayer: true };
  const damageDR = defender.finalAttributes.for;

  const damageTestResult = resolveTest(damageTestAttacker, damageTestDefender, damageDR, {});
  
  // 3. Calculate Final Wounds based on Armor Rating and Impact
  const impact = weapon.impact || 0;
  const defenderAR = defender.state.armor.total;
  
  const effectiveAR = Math.max(0, defenderAR - impact);
  const remainingImpact = Math.max(0, impact - defenderAR);
  
  const woundsDealtByRoll = damageTestResult.cascades;
  const woundsInflicted = Math.max(0, woundsDealtByRoll - effectiveAR);

  defender.state.wounds += woundsInflicted;

  return {
    hit: true,
    woundsInflicted,
    remainingImpact,
    hitTestResult,
    damageTestResult,
  };
}

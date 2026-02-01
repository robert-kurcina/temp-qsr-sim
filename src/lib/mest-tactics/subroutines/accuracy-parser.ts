
import { DicePool, DiceType } from '../dice-roller';

const parseDiceString = (diceString: string): DicePool => {
    const dice: DicePool = {};
    const value = parseInt(diceString.slice(1, -1), 10) || 1;
    const type = diceString.endsWith('m') ? DiceType.Modifier : diceString.endsWith('b') ? DiceType.Base : DiceType.Wild;
    dice[type] = value;
    return dice;
  };
  

/**
 * Parses the accuracy value of a weapon.
 * @param accuracy The accuracy value from the weapon item.
 * @returns An object containing bonus dice, penalty dice, and score modifier.
 */
export function parseAccuracy(accuracy: string | number | undefined): { bonusDice: DicePool, penaltyDice: DicePool, scoreModifier: number } {
    const result = { bonusDice: {}, penaltyDice: {}, scoreModifier: 0 };
    if (accuracy === undefined || accuracy === '-') return result;
  
    if (typeof accuracy === 'number') {
      result.scoreModifier = accuracy;
    } else if (accuracy.endsWith('m') || accuracy.endsWith('b') || accuracy.endsWith('w')) {
      if (accuracy.startsWith('-')) {
        result.penaltyDice = parseDiceString(accuracy);
      } else {
        result.bonusDice = parseDiceString(accuracy.startsWith('+') ? accuracy : '+' + accuracy);
      }
    } else {
      result.scoreModifier = parseInt(accuracy, 10) || 0;
    }
    return result;
  }

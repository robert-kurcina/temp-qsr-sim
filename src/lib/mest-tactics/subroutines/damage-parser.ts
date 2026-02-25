
import type { TestDice } from '../dice-roller';
import type { Attributes } from '../Attributes';

/**
 * Parses a damage string (e.g., "STR+1", "POW+2b", "int-1m") into a numeric value and a dice pool.
 * This implementation avoids regular expressions in favor of robust string manipulation.
 * @param damage The damage string to parse.
 * @param attributes The character's attributes to resolve attribute-based damage.
 * @returns An object containing the base damage value and any bonus dice.
 */
export function parseDamage(damage: string, attributes: Attributes): { value: number; dice: TestDice } {
  const dice: TestDice = { base: 0, modifier: 0, wild: 0 };
  let value = 0;

  if (!damage) {
    return { value, dice };
  }

  // To handle case-insensitivity, we work with an uppercase version of the string.
  let remaining = damage.trim().toUpperCase();

  // 1. Extract Attribute (case-insensitive)
  const attributeKeys: Array<{ token: string; key: keyof Attributes }> = [
    { token: 'STR', key: 'str' },
    { token: 'POW', key: 'pow' },
    { token: 'INT', key: 'int' },
    { token: 'FOR', key: 'for' },
  ];
  const attributePart = attributeKeys.find(attr => remaining.startsWith(attr.token));
  if (attributePart) {
    value = attributes[attributePart.key] || 0;
    remaining = remaining.substring(attributePart.token.length).trim();
  }

  // 2. Loop through and parse all modifiers (+-1, +-1b, etc.)
  while (remaining.length > 0) {
    const signChar = remaining[0];
    if (signChar !== '+' && signChar !== '-') {
      break; // Invalid format or end of string, stop parsing.
    }
    const sign = signChar === '+' ? 1 : -1;
    remaining = remaining.substring(1).trim();

    // Find the number part of the modifier
    let numStr = '';
    while (remaining.length > 0 && !isNaN(parseInt(remaining[0], 10))) {
      numStr += remaining[0];
      remaining = remaining.substring(1);
    }

    if (numStr.length === 0) {
      break; // Invalid format: sign not followed by a number.
    }
    const num = parseInt(numStr, 10);
    remaining = remaining.trim();

    // Check for a whitelisted dice specifier: 'B', 'M', or 'W'
    const diceSpecifier = remaining.length > 0 ? remaining[0] : null;
    const validDiceSpecifiers = ['B', 'M', 'W'];

    if (diceSpecifier && validDiceSpecifiers.includes(diceSpecifier)) {
      // It is a dice modifier.
      const count = num * sign;
      if (diceSpecifier === 'B') {
        dice.base = (dice.base || 0) + count;
      } else if (diceSpecifier === 'M') {
        dice.modifier = (dice.modifier || 0) + count;
      } else if (diceSpecifier === 'W') {
        dice.wild = (dice.wild || 0) + count;
      }
      remaining = remaining.substring(1).trim(); // Consume the specifier
    } else {
      // It is a numeric modifier.
      value += (num * sign);
    }
  }

  return { value, dice };
}

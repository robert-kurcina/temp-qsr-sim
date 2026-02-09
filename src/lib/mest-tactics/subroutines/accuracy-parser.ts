
import { TestDice, DiceType } from "../dice-roller";

/**
 * Parses a weapon's accuracy string (e.g., "+1b") into a TestDice object.
 */
export function parseAccuracy(accuracyString: string | undefined): { bonusDice: TestDice, penaltyDice: TestDice } {
    const bonusDice: TestDice = {};
    const penaltyDice: TestDice = {};

    if (!accuracyString || accuracyString === "-") {
        return { bonusDice, penaltyDice };
    }

    const regex = /([+-])(\d+)([bmw])/;
    const match = accuracyString.match(regex);

    if (match) {
        const sign = match[1];
        const value = parseInt(match[2], 10);
        const typeChar = match[3];

        let diceType: DiceType;
        switch (typeChar) {
            case 'b':
                diceType = DiceType.Base;
                break;
            case 'm':
                diceType = DiceType.Modifier;
                break;
            case 'w':
                diceType = DiceType.Wild;
                break;
            default:
                // Should not happen with the regex
                return { bonusDice, penaltyDice };
        }

        if (sign === '+') {
            bonusDice[diceType] = (bonusDice[diceType] || 0) + value;
        } else {
            penaltyDice[diceType] = (penaltyDice[diceType] || 0) + value;
        }
    }

    return { bonusDice, penaltyDice };
}

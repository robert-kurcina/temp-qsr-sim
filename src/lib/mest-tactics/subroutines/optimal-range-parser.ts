
import { FinalAttributes } from '../Attributes';

/**
 * Parses a weapon's optimal range string (e.g., "OR(12)" or "OR(Agi+2)") 
 * and calculates the final range value.
 */
export function parseOptimalRange(orString: string | undefined, attributes: FinalAttributes): number {
    if (!orString) {
        return 0;
    }

    const regex = /OR\(([^)]+)\)/;
    const match = orString.match(regex);

    if (match) {
        const expression = match[1];
        const parts = expression.split('+');
        let totalRange = 0;

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (isNaN(Number(trimmedPart))) {
                switch (trimmedPart.toLowerCase()) {
                    case 'str':
                        totalRange += attributes.str;
                        break;
                    case 'agi':
                        totalRange += attributes.agi;
                        break;
                    case 'int':
                        totalRange += attributes.int;
                        break;
                    case 'per':
                        totalRange += attributes.per;
                        break;
                }
            } else {
                totalRange += parseInt(trimmedPart, 10);
            }
        }
        return totalRange;
    }

    return 0;
}


import { FinalAttributes } from '../core/Attributes';

/**
 * Parses a weapon's optimal range string (e.g., "OR(12)" or "OR(Agi+2)" or "OR(STR-1)")
 * and calculates the final range value.
 * 
 * Supports:
 * - Plain numbers: "12"
 * - Attribute expressions: "STR+2", "STR-1", "AGI+3", "INT-2", "PER+1"
 * - Multiple terms: "STR+2-1" (evaluated left to right)
 */
export function parseOptimalRange(orString: string | undefined, attributes: FinalAttributes): number {
    if (!orString) {
        return 0;
    }

    const regex = /OR\(([^)]+)\)/;
    const match = orString.match(regex);

    if (match) {
        const expression = match[1];
        // Parse expression with + and - operators
        // Split by + or - while keeping the operator
        const tokens = expression.split(/([+\-])/);
        let totalRange = 0;
        let currentOperator: '+' | '-' = '+';

        for (const token of tokens) {
            const trimmedToken = token.trim();
            if (trimmedToken === '+') {
                currentOperator = '+';
            } else if (trimmedToken === '-') {
                currentOperator = '-';
            } else if (trimmedToken) {
                // Check if it's an attribute or a number
                const lowerToken = trimmedToken.toLowerCase();
                let value = 0;
                
                switch (lowerToken) {
                    case 'str':
                        value = attributes.str;
                        break;
                    case 'agi':
                        value = attributes.agi;
                        break;
                    case 'int':
                        value = attributes.int;
                        break;
                    case 'per':
                        value = attributes.per;
                        break;
                    default:
                        // Try to parse as number
                        value = parseInt(trimmedToken, 10);
                        if (isNaN(value)) {
                            value = 0;
                        }
                        break;
                }
                
                // Apply the current operator
                if (currentOperator === '+') {
                    totalRange += value;
                } else {
                    totalRange -= value;
                }
            }
        }
        return totalRange;
    }

    return 0;
}

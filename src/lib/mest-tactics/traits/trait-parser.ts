
import { Trait } from '../core/Trait';

// A set of traits that can be leveled up by summing their levels.
const stackableTraits = new Set([
    'Armor', 'Brawn', 'Tough', 'Deflect', 'ROF', '[1H]', '[2H] '
]);

/**
 * Parses a raw trait string into a structured Trait object.
 * @param source The raw string from the JSON data.
 * @returns A structured Trait object.
 */
export function parseTrait(source: string): Trait {
    let workingString = source.trim();
    const trait: Trait = { name: '', source };

    // Check for disability
    if (workingString.startsWith('[') && workingString.endsWith(']')) {
        trait.isDisability = true;
        // unwrap the brackets
        workingString = workingString.substring(1, workingString.length - 1).trim();
    }

    // Check for type or list
    const typeSeparator = ' > ';
    const typeIndex = workingString.indexOf(typeSeparator);
    let rest = workingString;

    if (typeIndex !== -1) {
        const typePart = workingString.substring(typeIndex + typeSeparator.length).trim();
        rest = workingString.substring(0, typeIndex).trim();

        if ((typePart.startsWith('{') && typePart.endsWith('}')) || (typePart.startsWith('[') && typePart.endsWith(']'))) {
            // It's a list
            const listContent = typePart.substring(1, typePart.length - 1).trim();
            trait.list = listContent.split(',').map(item => item.trim());
        } else {
            // It's a type
            trait.type = typePart;
        }
    }

    // Parse name and level from the rest of the string
    const nameLevelMatch = rest.match(/^(.*?)(?:\s+(\d+))?$/);
    if (nameLevelMatch) {
        trait.name = nameLevelMatch[1].trim();
        if (nameLevelMatch[2]) {
            trait.level = parseInt(nameLevelMatch[2], 10);
        }
    } else {
        trait.name = rest;
    }
    
    if (!trait.name) {
        trait.name = workingString;
    }

    return trait;
}

/**
 * Combines an array of trait strings by parsing, merging, and leveling them up.
 * @param traitStrings An array of raw trait strings.
 * @returns An array of combined and leveled-up Trait objects.
 */
export function processTraits(traitStrings: string[]): Trait[] {
    const combined = new Map<string, Trait>();

    for (const source of traitStrings) {
        const trait = parseTrait(source);
        const existing = combined.get(trait.name);

        if (existing) {
            if (stackableTraits.has(trait.name)) {
                existing.level = (existing.level || 1) + (trait.level || 1);
            } else {
                // For non-stackable traits, we just keep the first one we see.
            }
        } else {
            combined.set(trait.name, { ...trait, level: trait.level || (stackableTraits.has(trait.name) ? 1 : undefined) });
        }
    }

    return Array.from(combined.values());
}

/**
 * Formats a Trait object back into a clean string representation.
 * @param trait The Trait object to format.
 * @returns A formatted string, e.g., "Grit 2" or "[Laden 3]".
 */
export function formatTrait(trait: Trait): string {
    if (trait.level && trait.level > 1 && stackableTraits.has(trait.name)) {
        return `${trait.name} ${trait.level}`;
    }
    return trait.name;
}

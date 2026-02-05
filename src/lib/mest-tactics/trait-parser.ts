
import { Trait } from './Trait';

/**
 * Parses a raw trait string into a structured Trait object.
 * Handles formats like "Sturdy 3", "[Laden 2]", "[2H]", and "Grit".
 * @param source The raw string from the JSON data.
 * @returns A structured Trait object.
 */
export function parseTrait(source: string): Trait {
    const trimmedSource = source.trim();

    // Regex for bracketed traits, e.g., "[Laden 2]", "[2H]"
    // Captures the name inside the brackets and an optional level.
    const bracketRegex = /^\[([a-zA-Z\s/,-]+?)(?: (\d+))?\]$/;
    let match = trimmedSource.match(bracketRegex);

    if (match) {
        const name = `[${match[1]}]`;
        const level = match[2] ? parseInt(match[2], 10) : 1;
        return { name, level, source: trimmedSource };
    }

    // Regex for plain traits, e.g., "Sturdy 3", "Grit", "ROF 2"
    // Captures the name and an optional level.
    const plainRegex = /^([a-zA-Z\s/,-]+?)(?: (\d+))?$/;
    match = trimmedSource.match(plainRegex);
    
    if (match) {
        const name = match[1].trim();
        const level = match[2] ? parseInt(match[2], 10) : 1;
        return { name, level, source: trimmedSource };
    }

    // Fallback for any traits that don't match the patterns
    return { name: trimmedSource, level: 1, source: trimmedSource };
}

/**
 * Combines an array of trait strings by parsing, merging, and leveling them up.
 * @param traitStrings An array of raw trait strings.
 * @returns An array of combined and leveled-up Trait objects.
 */
export function processTraits(traitStrings: string[]): Trait[] {
    const parsedTraits = traitStrings.map(parseTrait);
    const combined = new Map<string, Trait>();

    for (const trait of parsedTraits) {
        const existing = combined.get(trait.name);
        if (existing) {
            existing.level = (existing.level || 1) + (trait.level || 1);
        } else {
            combined.set(trait.name, { ...trait });
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
    const { name, level } = trait;
    
    if (level && level > 1) {
        if (name.startsWith('[') && name.endsWith(']')) {
            const baseName = name.slice(1, -1);
            return `[${baseName} ${level}]`;
        }
        return `${name} ${level}`;
    }
    
    return name;
}

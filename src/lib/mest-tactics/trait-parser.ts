import { Trait } from './Trait';

/**
 * Parses a raw trait string into a structured Trait object.
 * Handles various formats, e.g., "Sturdy 3", "Damper 4 > Fear", "Augment 2 > [Grit, Fight]".
 * @param source The raw string from the JSON data.
 * @returns A structured Trait object.
 */
export function parseTrait(source: string): Trait {
  const trait: Trait = { name: '', source };

  // Handle lists first, e.g., "Augment 2 > [Grit, Fight]"
  const listMatch = source.match(/(\[.*\])/);
  if (listMatch) {
    trait.list = listMatch[1].replace(/[\[\]]/g, '').split(',').map(s => s.trim());
    source = source.replace(listMatch[0], '').trim();
  }

  // Handle types, e.g., "Damper 4 > Fear"
  const typeMatch = source.match(/(.*) > (.*)/);
  if (typeMatch) {
    source = typeMatch[1].trim();
    trait.type = typeMatch[2].trim();
  }

  // Handle values, e.g., "Sturdy 3"
  const valueMatch = source.match(/(.*) (\d+)/);
  if (valueMatch) {
    trait.name = valueMatch[1].trim();
    trait.value = parseInt(valueMatch[2], 10);
  } else {
    trait.name = source.trim();
  }

  return trait;
}

/**
 * Parses a trait string into a structured object.
 * @param {string} traitString - The trait string to parse (e.g., "Reach 2", "[Laden]").
 * @returns {{name: string, value: number, isDisability: boolean}} - The parsed trait object.
 */
export function parseTrait(traitString) {
  if (!traitString) {
    return null;
  }

  const isDisability = traitString.startsWith('[') && traitString.endsWith(']');
  const cleanedString = isDisability ? traitString.slice(1, -1) : traitString;

  const parts = cleanedString.split(/\s+|X=/).filter(Boolean);
  const name = parts[0];
  let value = 1; // Default value

  if (parts.length > 1) {
    const parsedValue = parseInt(parts[1], 10);
    if (!isNaN(parsedValue)) {
      value = parsedValue;
    }
  }

  return {
    name,
    value,
    isDisability,
  };
}

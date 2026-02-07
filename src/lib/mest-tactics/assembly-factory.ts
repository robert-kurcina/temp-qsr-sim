
import { Assembly } from './Assembly';
import { Character } from './Character';
import { createCharacter } from './character-factory';
import { generateRandomProfile } from './profile-generator';
import { databaseService } from './database';

interface AssemblyConstraints {
  minCharacters?: number;
  maxCharacters?: number;
  minBP?: number;
  maxBP?: number;
}

/**
 * Generates a unique assembly name and ensures it doesn't already exist in the database.
 * @returns A unique assembly name string.
 */
async function generateUniqueAssemblyName(): Promise<string> {
    await databaseService.read();
    const existingNames = new Set(databaseService.assemblies.map(a => a.name));
    let counter = databaseService.assemblies.length + 1;
    let assemblyName = `Assembly-${counter}`;

    while (existingNames.has(assemblyName)) {
        counter++;
        assemblyName = `Assembly-${counter}`;
    }

    return assemblyName;
}


export async function createAssembly(constraints: AssemblyConstraints = {}): Promise<Assembly> {
  await databaseService.read();

  const {
    minCharacters = 4,
    maxCharacters = 8,
    minBP = 250,
    maxBP = 500,
  } = constraints;

  const characters: Character[] = [];
  let totalBP = 0;
  let totalCharacters = 0;

  while (totalCharacters < maxCharacters && totalBP < maxBP) {
    const profile = generateRandomProfile();

    // Stop if adding even a character with 0 BP would exceed constraints.
    // A more sophisticated check might look at the cheapest possible character.
    if (totalBP + (profile.adjustedBp || 0) > maxBP && totalCharacters < minCharacters) {
        continue; // Try a different profile if we haven't met the minimums.
    }

    if (totalBP + (profile.adjustedBp || 0) > maxBP) {
        break; // Stop if the next character will exceed the max BP.
    }

    const character = await createCharacter(profile);

    characters.push(character);
    totalBP += character.profile.adjustedBp;
    totalCharacters++;

    if (totalCharacters >= minCharacters && totalBP >= minBP) {
        // Optional: decide if you want to stop as soon as constraints are met
        // or continue until you hit the max.
    }
  }
  
  const assemblyName = await generateUniqueAssemblyName();
  const assembly: Assembly = {
    name: assemblyName,
    characters: characters.map(c => c.id), // Store character IDs
    totalBP,
    totalCharacters,
  };

  // Persist the assembly
  databaseService.assemblies.push(assembly);
  await databaseService.write();

  return assembly;
}

import * as fs from 'fs';
import * as path from 'path';
import { Assembly } from './Assembly';
import { Character } from './Character';
import { createCharacter } from './character-factory';
import { generateRandomProfile } from './profile-generator';
import { generateNextName, readState, writeState, NameGeneratorState } from './name-generator';

interface AssemblyConstraints {
  minCharacters?: number;
  maxCharacters?: number;
  minBP?: number;
  maxBP?: number;
}

let assemblyCounter = 0;

export function createAssembly(constraints: AssemblyConstraints = {}): Assembly {
  const nameGenState = readState();
  let currentNameGenState: NameGeneratorState = nameGenState;

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
    const { name, nextState } = generateNextName(currentNameGenState);
    currentNameGenState = nextState;

    const character = createCharacter(profile, name);

    if (totalBP + character.profile.adjustedBp > maxBP) {
      break; // Stop if adding the character exceeds the max BP
    }

    characters.push(character);
    totalBP += character.profile.adjustedBp;
    totalCharacters++;

    if (totalCharacters >= minCharacters && totalBP >= minBP) {
        break;
    }
  }
  
  assemblyCounter++;
  const assemblyName = `Assembly-${assemblyCounter}`;
  const assembly: Assembly = {
    name: assemblyName,
    characters,
    totalBP,
    totalCharacters,
  };

  // Persist the generated objects
  characters.forEach(character => {
    fs.writeFileSync(path.join('./characters', `${character.name}.json`), JSON.stringify(character, null, 2));
    fs.writeFileSync(path.join('./profiles', `${character.profile.name}.json`), JSON.stringify(character.profile, null, 2));
  });
  fs.writeFileSync(path.join('./assemblies', `${assemblyName}.json`), JSON.stringify(assembly, null, 2));

  writeState(currentNameGenState);

  return assembly;
}

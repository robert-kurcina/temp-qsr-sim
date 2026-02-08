
import { Character } from './Character';
import { Profile } from './Profile';

let characterCounter = 0;
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateCharacterName(): string {
  const letterIndex = Math.floor(characterCounter / 100);
  const number = characterCounter % 100;
  characterCounter++;
  return `${letters[letterIndex]}${String(number).padStart(2, '0')}`;
}

export function createCharacter(profile: Profile): Character {
    const archetypeKey = Object.keys(profile.archetype)[0];
    const archetype = profile.archetype[archetypeKey];

    const character: Character = {
        ...profile,
        name: generateCharacterName(),
        traits: archetype.traits ? [...archetype.traits] : []
    };

    return character;
}

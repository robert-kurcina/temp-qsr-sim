
import { Character } from '../core/Character';
import { Profile } from '../core/Profile';

let characterCounter = 0;
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateCharacterName(): string {
  const letterIndex = Math.floor(characterCounter / 100);
  const number = characterCounter % 100;
  characterCounter++;
  return `${letters[letterIndex]}${String(number).padStart(2, '0')}`;
}

export function createCharacter(profile: Profile): Character {
    const archetypeKey = Object.keys(profile.archetype as any)[0];
    const archetype = (profile.archetype as any)[archetypeKey];

    const character: Character = {
        ...profile,
        name: generateCharacterName(),
    } as any;

    return character;
}

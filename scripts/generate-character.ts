
import { createCharacter } from '../src/lib/mest-tactics/character-generator';
import { createProfiles } from '../src/lib/mest-tactics/profile-generator';
import { gameData } from '../src/lib/data';

const archetype = gameData.archetypes.Veteran;

const [profile] = createProfiles('Veteran', archetype, [], ['Sword, Broad']);
const character = createCharacter(profile);

console.log(JSON.stringify(character, null, 2));

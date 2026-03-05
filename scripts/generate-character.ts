
import { createCharacter } from '../src/lib/mest-tactics/utils/character-generator';
import { createProfiles } from '../src/lib/mest-tactics/utils/profile-generator';
import { gameData } from '../src/lib/data';

const archetype = gameData.archetypes.Veteran;

const [profile] = createProfiles('Veteran', archetype, [], ['Sword, Broad']);
const character = createCharacter(profile);

console.log(JSON.stringify(character, null, 2));


import { createCharacter } from '../src/lib/mest-tactics/character-generator';
import { createProfiles } from '../src/lib/mest-tactics/profile-generator';
import { gameData } from '../src/lib/data';
import { Archetype } from '../src/lib/mest-tactics/Archetype';

const archetype: Archetype = {
  species: 'Humanoid',
  ...gameData.archetypes.Veteran,
};

const [profile] = createProfiles(archetype, [], 'Sword, Broad');
const character = createCharacter(profile);

console.log(JSON.stringify(character, null, 2));

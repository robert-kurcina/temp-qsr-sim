
import { databaseService } from '../src/lib/mest-tactics/database';
import { gameData } from '../src/lib/data';
import { Profile } from '../src/lib/mest-tactics/Profile';
import { Character } from '../src/lib/mest-tactics/Character';
import { Assembly } from '../src/lib/mest-tactics/Assembly';
import { createCharacter } from '../src/lib/mest-tactics/character-generator';
import { Archetype } from '../src/lib/mest-tactics/Archetype';
import { createProfiles } from '../src/lib/mest-tactics/profile-generator';

async function seedDatabase() {
  const profiles: Profile[] = [];
  for (const key in gameData.archetypes) {
    const archetype = (gameData.archetypes as { [key: string]: Archetype })[key];
    const [profile] = createProfiles(key, archetype, [], []);
    profiles.push(profile);
  }

  const characters: Character[] = [];
  for (const profile of profiles) {
    const character = createCharacter(profile);
    characters.push(character);
  }

  const assemblies: Assembly[] = [];
  for (let i = 0; i < 20; i++) {
    const characterIds = characters.slice(i * 5, i * 5 + 5).map(c => c.id);
    const assembly: Assembly = {
      name: `Assembly ${i + 1}`,
      characters: characterIds,
      totalBP: 0,
      totalCharacters: characterIds.length,
    };
    assemblies.push(assembly);
  }

  databaseService.profiles.push(...profiles);
  databaseService.characters.push(...characters);
  databaseService.assemblies.push(...assemblies);

  await databaseService.write();
}

seedDatabase();

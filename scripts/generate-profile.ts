
import { createProfiles } from '../src/lib/mest-tactics/profile-generator';
import { gameData } from '../src/lib/data';

const archetypeName = 'Veteran, Fighter';
const archetypeData = gameData.archetypes[archetypeName];

const [profile] = createProfiles(archetypeName, archetypeData, [], 'Sword, Broad');

console.log(JSON.stringify(profile, null, 2));

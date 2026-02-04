
import { createProfiles } from '../src/lib/mest-tactics/profile-generator';
import { gameData } from '../src/lib/data';

const archetypeName = 'Veteran, Fighter';
const archetypeData = gameData.archetypes[archetypeName];

const itemNames = [
    'Sword, Broad',
    'Axe, Battle',
    'Pistol, Medium, Auto',
    'Rifle, Medium, Semi/A',
    'Armor, Medium',
    'Shield, Medium'
];

const [profile] = createProfiles(archetypeName, archetypeData, [], itemNames);

console.log(JSON.stringify(profile, null, 2));

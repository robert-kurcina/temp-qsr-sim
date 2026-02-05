
import { createProfiles } from '../src/lib/mest-tactics/profile-generator';
import { gameData } from '../src/lib/data';

// Default values
let archetypeName = 'Average';
let itemNames = ['Sword, Broad', 'Armor, Light'];

// Parse command line arguments
const args = process.argv.slice(2);
const archetypeIndex = args.indexOf('-a');
if (archetypeIndex !== -1 && args[archetypeIndex + 1]) {
    archetypeName = args[archetypeIndex + 1];
}

const itemsIndex = args.indexOf('-i');
if (itemsIndex !== -1) {
    // Collect all arguments after -i until the next switch (starts with -) or end of array
    const nextSwitchIndex = args.slice(itemsIndex + 1).findIndex(arg => arg.startsWith('-'));
    if (nextSwitchIndex !== -1) {
        itemNames = args.slice(itemsIndex + 1, itemsIndex + 1 + nextSwitchIndex);
    } else {
        itemNames = args.slice(itemsIndex + 1);
    }
}

const archetypeData = gameData.archetypes[archetypeName];

if (!archetypeData) {
    console.error(`Archetype "${archetypeName}" not found.`);
    process.exit(1);
}

try {
    const [profile] = createProfiles(archetypeName, archetypeData, [], itemNames);
    console.log(JSON.stringify(profile, null, 2));
} catch (error) {
    console.error(error.message);
}

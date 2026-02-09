
import { createCharacter } from './src/lib/mest-tactics/character-factory';
import { gameData } from './src/lib/data';
import { Profile } from './src/lib/mest-tactics/Profile';
import { Archetype } from './src/lib/mest-tactics/Archetype';
import { Item } from './src/lib/mest-tactics/Item';

// 1. Define the spec for the character we want to build
const characterSpec = {
    name: "Veteran Test",
    archetype: "Veteran",
    equipment: ["Sword, Broad", "Armor, Medium", "Shield, Medium"],
};

// 2. Find the archetype object from gameData.
// The JSON is a record, but the Profile expects an object with a `name` property.
const archetypeData = (gameData.archetypes as any)[characterSpec.archetype];
if (!archetypeData) {
    throw new Error(`Archetype "${characterSpec.archetype}" not found.`);
}
// Manually construct the full Archetype object
const archetype: Archetype = { name: characterSpec.archetype, ...archetypeData };


// 3. Find all equipment objects from their respective data files.
const allItems: Item[] = [
    ...(gameData.weapons as any).data,
    ...(gameData.armor as any).data,
    ...(gameData.items as any).data,
];

const equipment: Item[] = characterSpec.equipment.map(name => {
    const item = allItems.find(i => i.name === name);
    if (!item) {
        // Throw an error if an item isn't found to ensure correctness.
        throw new Error(`Item "${name}" not found in game data.`);
    }
    return item;
});

// 4. Calculate the total build points (BP) for the profile.
const totalBp = archetype.bp + equipment.reduce((sum, item) => sum + (item.bp || 0), 0);

// 5. Assemble the complete Profile object.
const profile: Profile = {
    archetype: archetype,
    equipment: equipment,
    bp: totalBp,
};

// 6. Call the validated `createCharacter` function to generate the final character object.
const character = createCharacter(profile, characterSpec.name);

// 7. Calculate Derived Stats based on validated rules
const physicality = Math.max(character.finalAttributes.siz, character.finalAttributes.str);
const durability = Math.max(character.finalAttributes.siz, character.finalAttributes.for);
const agility = Math.floor(character.finalAttributes.mov / 2);


// 8. Print the generated character sheet to the console.
console.log("========================================");
console.log("    CHARACTER SHEET - MEST TACTICS");
console.log("========================================");

console.log(`
> Name:      ${character.name}`);
console.log(`> Archetype: ${character.profile.archetype.name}`);
console.log(`> Total BP:  ${character.profile.bp}\n`);

console.log("--- Core Stats ---");
console.log(`Wound Threshold (SIZ): ${character.finalAttributes.siz}`);
console.log(`Wounds Sustained:      ${character.state.wounds}\n`);

console.log("--- Derived Stats ---");
console.log(`Physicality: ${physicality} (Higher of SIZ or STR)`);
console.log(`Durability:  ${durability} (Higher of SIZ or FOR)`);
console.log(`Agility:     ${agility} (MOV / 2)\n`);


console.log("--- Combat Attributes ---");
console.log(`Close Combat (CCA): ${character.finalAttributes.cca}`);
console.log(`Ranged Combat (RCA): ${character.finalAttributes.rca}`);
console.log(`Reflex (REF):         ${character.finalAttributes.ref}`);
console.log(`Fortitude (FOR):      ${character.finalAttributes.for}\n`);

console.log("--- Physical Attributes ---");
console.log(`Strength (STR): ${character.finalAttributes.str}`);
console.log(`Movement (MOV): ${character.finalAttributes.mov}\n`);

console.log("--- Mental Attributes ---");
console.log(`Intelligence (INT): ${character.finalAttributes.int}`);
console.log(`Power (POW):        ${character.finalAttributes.pow}\n`);

console.log("--- Armor ---");
console.log(`Total AR: ${character.state.armor.total}`);
console.log(`  - Suit:   ${character.state.armor.suit}`);
console.log(`  - Shield: ${character.state.armor.shield}`);
console.log(`  - Helm:   ${character.state.armor.helm}`);
console.log(`  - Gear:   ${character.state.armor.gear}\n`);

console.log(`--- Equipment [${equipment.length}] ---`);
character.profile.equipment.forEach(item => {
    console.log(`- ${item.name} (${item.class}) [${item.bp || 0} BP]`);
});
console.log("");

console.log(`--- Traits [${character.allTraits.length}] ---`);
character.allTraits.forEach(trait => {
    const level = trait.level ? ` (Level: ${trait.level})` : '';
    console.log(`- ${trait.name}${level}`);
});
console.log("\n========================================");


import { Character, ArmorState } from './Character';
import { Profile } from './Profile';
import { Item } from './Item';
import { parseTrait } from './trait-parser';
import { traitLogicRegistry } from './trait-logic-registry';
import { Trait } from './Trait';
import { databaseService } from './database';
import { Attributes, FinalAttributes } from './Attributes';

/**
 * Generates a unique character name based on the specified format.
 * Checks the database to ensure the name is not already in use.
 * @returns A unique character name string.
 */
async function generateUniqueCharacterName(): Promise<string> {
    await databaseService.read();
    const existingNames = new Set(databaseService.characters.map(c => c.name));

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    let baseName = `${randomLetter}-${randomNumber}`;
    let finalName = baseName;
    let suffixCounter = 0;

    while (existingNames.has(finalName)) {
        const suffixChars = 'abcdefghijklmnopqrstuvwxyz';
        const randomChar = suffixChars[suffixCounter % suffixChars.length];
        const randomDigit = Math.floor(suffixCounter / suffixChars.length) % 10;
        finalName = `${baseName}-${randomChar}${randomDigit}`;
        suffixCounter++;
    }

    return finalName;
}


/**
 * Creates a new Character instance from a Profile and persists it to the database.
 * @param profile The profile to instantiate.
 * @returns A fully initialized and persisted Character object.
 */
export async function createCharacter(profile: Profile): Promise<Character> {
  await databaseService.read();

  const primaryArchetype = Object.values(profile.archetype)[0];
  if (!primaryArchetype) {
    throw new Error('Profile does not contain a valid primary archetype.');
  }
  
  const items = profile.items || [];

  // 1. Combine all raw trait strings from archetype and equipment.
  const rawTraits = [
    ...(primaryArchetype.traits || []),
    ...items.flatMap(item => item.traits || []),
  ];

  // 2. Parse all raw strings into structured Trait objects.
  const allTraits: Trait[] = rawTraits.map(parseTrait);

  // 3. Start with a deep copy of the base archetype attributes.
  const finalAttributes: FinalAttributes = { ...primaryArchetype.attributes };

  // 4. Apply attribute-modifying trait logic.
  for (const trait of allTraits) {
    const logic = traitLogicRegistry[trait.name.toLowerCase()];
    if (logic?.onAttributeCalculation) {
      logic.onAttributeCalculation(finalAttributes, trait);
    }
  }

  // 5. Calculate armor state directly from the profile's equipment.
  const armorState: ArmorState = { total: 0, suit: 0, gear: 0, shield: 0, helm: 0 };
  for (const item of items) {
    const itemTraits = (item.traits || []).map(parseTrait);
    const armorTrait = itemTraits.find(t => t.name.toLowerCase() === 'armor');

    if (armorTrait && typeof armorTrait.level === 'number' && armorTrait.level > 0) {
      const arValue = armorTrait.level;
      const lowerCaseClass = (item.classification || '').toLowerCase();
      let assigned = false;

      if (lowerCaseClass.includes('suit')) {
        armorState.suit += arValue;
        assigned = true;
      } else if (lowerCaseClass.includes('helm')) {
        armorState.helm += arValue;
        assigned = true;
      } else if (lowerCaseClass.includes('shield')) {
        armorState.shield += arValue;
        assigned = true;
      } else if (lowerCaseClass.includes('gear')) {
        armorState.gear += arValue;
        assigned = true;
      } else if (lowerCaseClass.includes('armor')) {
        // Fallback for general armor types
        armorState.suit += arValue;
        assigned = true;
      }

      if (assigned) {
        armorState.total += arValue;
      }
    }
  }

  // 6. Generate a unique name for the character.
  const characterName = await generateUniqueCharacterName();

  // 7. Assemble the final Character object.
  const character: any = {
    id: Date.now().toString() + Math.random().toString(), // Basic unique ID
    name: characterName,
    profile,
    allTraits,
    finalAttributes,
    state: {
      wounds: 0,
      delayTokens: 0,
      fearTokens: 0,
      isHidden: false,
      isWaiting: false,
      isDisordered: false,
      isDistracted: false,
      isEngaged: false,
      isInCover: false,
      isKOd: false,
      isEliminated: false,
      statusEffects: [],
      armor: armorState, // Assign the calculated armor state
    },
  };

  // 8. Persist the new character and its profile to the database.
  if (!databaseService.profiles.find(p => p.name === profile.name)) {
      databaseService.profiles.push(profile);
  }
  databaseService.characters.push(character);
  await databaseService.write();

  return character;
}

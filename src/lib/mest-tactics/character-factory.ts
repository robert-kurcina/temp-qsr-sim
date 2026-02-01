
import { Character, ArmorState } from './Character';
import { Profile } from './Profile';
import { Item } from './Item';
import { parseTrait } from './trait-parser';
import { traitLogicRegistry } from './trait-logic-registry';
import { Trait } from './Trait';

/**
 * Calculates the character's armor state based on their equipped items.
 * It now correctly reads the 'ar' property from items and also handles "Armor X" traits.
 * @param equipment The list of items equipped by the character.
 * @returns An ArmorState object with the calculated values.
 */
function calculateArmorState(equipment: Item[]): ArmorState {
  const armorState: ArmorState = {
    total: 0,
    suit: 0,
    gear: 0,
    shield: 0,
    helm: 0,
  };

  for (const item of equipment) {
    let arValue = 0;

    // 1. Check for the direct 'ar' property on the item.
    if (item.ar) {
      arValue = parseInt(String(item.ar), 10) || 0;
    }

    // 2. Also check for an "Armor X" trait for flexibility, adding to any base 'ar' value.
    const itemTraits = (item.traits || []).map(parseTrait);
    const armorTrait = itemTraits.find(t => t.name.toLowerCase() === 'armor');
    if (armorTrait && typeof armorTrait.value === 'number') {
      arValue += armorTrait.value;
    }

    // If we found any armor value, assign it to the correct slot.
    if (arValue > 0) {
      let armorType: keyof Omit<ArmorState, 'total'> | null = null;
      const lowerCaseClass = item.class.toLowerCase();

      if (lowerCaseClass.includes('suit') || lowerCaseClass.includes('armor')) {
        armorType = 'suit';
      } else if (lowerCaseClass.includes('shield')) {
        armorType = 'shield';
      } else if (lowerCaseClass.includes('helm')) {
        armorType = 'helm';
      } else if (lowerCaseClass.includes('gear')) {
        armorType = 'gear';
      }

      if (armorType) {
        armorState[armorType] += arValue;
        armorState.total += arValue;
      }
    }
  }

  return armorState;
}


/**
 * Creates a new Character instance from a Profile.
 * This is the primary function for taking a template and making it a usable entity.
 * @param profile The profile to instantiate.
 * @param characterName The unique name for this character.
 * @returns A fully initialized Character object.
 */
export function createCharacter(profile: Profile, characterName: string): Character {
  // 1. Combine all raw trait strings from archetype and equipment.
  const rawTraits = [
    ...(profile.archetype.traits || []),
    ...profile.equipment.flatMap(item => item.traits || []),
  ];

  // 2. Parse all raw strings into structured Trait objects.
  const allTraits: Trait[] = rawTraits.map(parseTrait);

  // 3. Start with a deep copy of the base archetype attributes.
  const finalAttributes = { ...profile.archetype.attributes };

  // 4. Apply attribute-modifying trait logic.
  for (const trait of allTraits) {
    const logic = traitLogicRegistry[trait.name.toLowerCase()];
    if (logic?.onAttributeCalculation) {
      logic.onAttributeCalculation(finalAttributes, trait);
    }
  }

  // 5. Calculate armor state from equipment.
  const armor = calculateArmorState(profile.equipment);

  // 6. Assemble the final Character object.
  const character: Character = {
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
      statusEffects: [],
      armor, // Assign the calculated armor state
    },
  };

  return character;
}

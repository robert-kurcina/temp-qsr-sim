
import { Character, ArmorState } from './Character';
import { Profile } from './Profile';
import { Item } from './Item';
import { parseTrait } from './trait-parser';
import { traitLogicRegistry } from './trait-logic-registry';
import { Trait } from './Trait';

/**
 * Creates a new Character instance from a Profile.
 * This is the primary function for taking a template and making it a usable entity.
 * @param profile The profile to instantiate.
 * @param characterName The unique name for this character.
 * @returns A fully initialized Character object.
 */
export function createCharacter(profile: Profile, characterName?: string): Character {
  const primaryArchetype = Object.values(profile.archetype)[0];
  if (!primaryArchetype) {
    throw new Error('Profile does not contain a valid primary archetype.');
  }
  // 1. Combine all raw trait strings from archetype and equipment.
  const rawTraits = [
    ...(primaryArchetype.traits || []),
    ...profile.items.flatMap(item => item.traits || []),
  ];

  // 2. Parse all raw strings into structured Trait objects.
  const allTraits: Trait[] = rawTraits.map(parseTrait);

  // 3. Start with a deep copy of the base archetype attributes.
  const finalAttributes = { ...primaryArchetype.attributes };

  // 4. Apply attribute-modifying trait logic.
  for (const trait of allTraits) {
    const logic = traitLogicRegistry[trait.name.toLowerCase()];
    if (logic?.onAttributeCalculation) {
      logic.onAttributeCalculation(finalAttributes, trait);
    }
  }

  // 5. Calculate armor state directly from the profile's equipment.
  const armorState: ArmorState = { total: 0, suit: 0, gear: 0, shield: 0, helm: 0 };
  for (const item of profile.items) {
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

  // 6. Assemble the final Character object.
  const character: Character = {
    id: Date.now().toString() + Math.random().toString(), // Basic unique ID
    name: characterName || profile.name,
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
      armor: armorState, // Assign the calculated armor state
    },
  };

  return character;
}

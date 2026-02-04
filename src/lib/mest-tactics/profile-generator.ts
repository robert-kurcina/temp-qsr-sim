
import { Archetype } from './Archetype';
import { Item } from './Item';
import { Profile } from './Profile';
import { gameData } from '../data';

let profileCounter = 0;

function generateProfileId(archetypeName: string, primaryItem?: Item): string {
  const safeArchetypeName = archetypeName.replace(/, /g, '-').toLowerCase();
  if (primaryItem) {
    const safeItemName = primaryItem.name.replace(/, /g, '-').toLowerCase();
    return `${safeArchetypeName}-${safeItemName}`;
  }
  profileCounter++;
  return `${safeArchetypeName}-${String(profileCounter).padStart(4, '0')}`;
}

// Helper function to combine and level up traits
function combineAndLevelTraits(allTraits: string[]): string[] {
    const traitLevels: Record<string, number> = {};

    for (const traitString of allTraits) {
        const match = traitString.match(/^(.+?)(?: (\d+))?$/);
        if (match) {
            const [, name, levelStr] = match;
            const level = levelStr ? parseInt(levelStr, 10) : 1;
            traitLevels[name] = (traitLevels[name] || 0) + level;
        }
    }

    return Object.entries(traitLevels).map(([name, level]) => {
        return level > 1 ? `${name} ${level}` : name;
    });
}

const UNARMED_ITEM: Item = {
  name: 'Unarmed',
  class: 'Natural',
  classification: 'Natural',
  type: 'Natural',
  bp: 0,
  dmg: 'STR+0',
  traits: ['[Natural]'],
};

const IMPROVISED_ITEM: Item = {
  name: 'Improvised Weapon',
  class: 'Melee',
  classification: 'Melee',
  type: 'Melee',
  bp: 0,
  dmg: 'STR+1w',
  traits: ['[Laden]'],
};

export function createProfiles(
  archetypeName: string, 
  archetypeData: Archetype,
  allowedItemClasses: string[],
  primaryItemName?: string
): Profile[] {
  const itemCategories = [
    gameData.armors,
    gameData.bow_weapons,
    gameData.equipment,
    gameData.grenade_weapons,
    gameData.melee_weapons,
    gameData.ranged_weapons,
    gameData.support_weapons,
    gameData.thrown_weapons,
  ];

  const allItems: Item[] = itemCategories.flatMap(category =>
    Object.entries(category).map(([name, itemData]) => ({
      ...(itemData as Omit<Item, 'name'>),
      name: name,
    }))
  );

  // Always include Unarmed and Improvised items as per QSR.
  allItems.push(UNARMED_ITEM, IMPROVISED_ITEM);

  const createProfileObject = (item: Item): Profile => {
    // finalTraits should only include traits from the archetype.
    const finalTraits = combineAndLevelTraits(archetypeData.traits);

    return {
      name: generateProfileId(archetypeName, item),
      archetype: { [archetypeName]: archetypeData },
      items: [item],
      totalBp: archetypeData.bp + item.bp,
      finalTraits: finalTraits,
    };
  };

  if (primaryItemName) {
    const primaryItem = allItems.find(item => item.name === primaryItemName);
    if (!primaryItem) {
      throw new Error(`Primary item "${primaryItemName}" not found.`);
    }
    return [createProfileObject(primaryItem)];
  }

  const allowedItems = allItems.filter(item => {
    const isClassAllowed = allowedItemClasses.some(allowedClass => item.classification.includes(allowedClass));
    const isDefaultItem = item.name === 'Unarmed' || item.name === 'Improvised Weapon';

    return isClassAllowed || isDefaultItem;
  });

  return allowedItems.map(createProfileObject);
}

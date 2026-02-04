
import { Archetype } from './Archetype';
import { Item } from './Item';
import { Profile } from './Profile';
import { gameData } from '../data';

let profileCounter = 0;

function generateProfileId(archetypeName: string, primaryItem?: Item): string {
  if (primaryItem) {
    return `${archetypeName}-${primaryItem.name.replace(/, /g, '-').toLowerCase()}`;
  }
  profileCounter++;
  return `${archetypeName}-${String(profileCounter).padStart(4, '0')}`;
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
  archetype: Archetype,
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


  if (primaryItemName) {
    const primaryItem = allItems.find(item => item.name === primaryItemName);
    if (!primaryItem) {
      throw new Error(`Primary item "${primaryItemName}" not found.`);
    }
    const profile: Profile = {
      name: generateProfileId(archetype.species, primaryItem),
      archetype,
      equipment: [primaryItem],
      totalBp: archetype.bp + primaryItem.bp,
    };
    return [profile];
  }

  const allowedItems = allItems.filter(item => {
    const isClassAllowed = allowedItemClasses.some(allowedClass => item.classification.includes(allowedClass));
    const isDefaultItem = item.name === 'Unarmed' || item.name === 'Improvised Weapon';

    return isClassAllowed || isDefaultItem;
  });

  return allowedItems.map(item => {
    const profile: Profile = {
      name: generateProfileId(archetype.species, item),
      archetype,
      equipment: [item],
      totalBp: archetype.bp + item.bp,
    };
    return profile;
  });
}


import { Archetype } from './Archetype';
import { Item } from './Item';
import { Profile } from './Profile';
import { gameData } from '../data';

let profileCounter = 0;

function generateProfileId(archetypeName: string, items: Item[]): string {
  const safeArchetypeName = archetypeName.replace(/, /g, '-').toLowerCase();
  if (items.length === 1) {
    const safeItemName = items[0].name.replace(/, /g, '-').toLowerCase();
    return `${safeArchetypeName}-${safeItemName}`;
  } else if (items.length > 1) {
    const safeItemName = items[0].name.replace(/, /g, '-').toLowerCase();
    return `${safeArchetypeName}-${safeItemName}-loadout`;
  }
  profileCounter++;
  return `${safeArchetypeName}-${String(profileCounter).padStart(4, '0')}`;
}

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

function calculateAdjustedBp(items: Item[], archetypeBp: number): {
  adjustedBp: number, 
  adjustedItemCosts: { meleeBp: number[], rangedBp: number[], equipmentBp: number[] }
} {
  const meleeWeapons: Item[] = [];
  const rangedWeapons: Item[] = [];
  const equipment: Item[] = [];

  items.forEach(item => {
    if (['Melee', 'Natural'].includes(item.class)) {
      meleeWeapons.push(item);
    } else if (['Bow', 'Firearm - Archaic', 'Firearm - Modern', 'Range - Archaic', 'Range - Energy', 'Range - Futuristic', 'Range - Magic', 'Range - Modern', 'Support - Archaic', 'Support - Energy', 'Support - Futuristic', 'Support - Modern', 'Thrown', 'Thrown (Grenade)'].includes(item.class)) {
      rangedWeapons.push(item);
    } else if (item.classification !== 'Armor') { // Equipment is everything not a weapon or armor
      equipment.push(item);
    }
  });

  const sortAndGetBp = (itemList: Item[]) => itemList.sort((a, b) => b.bp - a.bp).map(i => i.bp);

  const meleeBp = sortAndGetBp(meleeWeapons);
  const rangedBp = sortAndGetBp(rangedWeapons);
  const equipmentBp = sortAndGetBp(equipment);

  const calculateDiscountedBp = (bpList: number[]) => {
    if (bpList.length === 0) return 0;
    const [first, ...rest] = bpList;
    return first + rest.reduce((sum, bp) => sum + Math.ceil(bp / 2), 0);
  };

  const armorBp = items.filter(i => i.classification === 'Armor').reduce((sum, item) => sum + item.bp, 0);

  const adjustedBp = archetypeBp + 
                     calculateDiscountedBp(meleeBp) + 
                     calculateDiscountedBp(rangedBp) + 
                     calculateDiscountedBp(equipmentBp) + 
                     armorBp; // Armors are not discounted based on the rules

  return { adjustedBp, adjustedItemCosts: { meleeBp, rangedBp, equipmentBp } };
}

export function createProfiles(
  archetypeName: string, 
  archetypeData: Archetype,
  allowedItemClasses: string[],
  itemNames?: string[]
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

  allItems.push(UNARMED_ITEM, IMPROVISED_ITEM);

  const createProfileObject = (items: Item[]): Profile => {
    const allTraits = [...archetypeData.traits, ...items.flatMap(i => i.traits)];
    const finalTraits = combineAndLevelTraits(allTraits);

    const physicality = Math.max(archetypeData.attributes.str, archetypeData.attributes.siz);
    const durability = Math.max(archetypeData.attributes.for, archetypeData.attributes.siz);

    let adjPhysicality = physicality;
    finalTraits.forEach(trait => {
        const brawnMatch = trait.match(/Brawn (\d+)/);
        if (brawnMatch) {
            adjPhysicality += parseInt(brawnMatch[1], 10);
        }
    });

    const totalLaden = items.reduce((sum, item) => {
        const ladenTrait = item.traits.find(t => t.startsWith('[Laden'));
        if (ladenTrait) {
            const match = ladenTrait.match(/Laden(?: (\d+))?/);
            return sum + (match ? (parseInt(match[1] || '1', 10)) : 0);
        }
        return sum;
    }, 0);

    const totalBurden = Math.max(0, totalLaden - adjPhysicality);

    const handsRequired = items.reduce((sum, item) => {
        if (item.traits.includes('[2H]')) return sum + 2;
        if (item.traits.includes('[1H]')) return sum + 1;
        return sum;
    }, 0);

    if (handsRequired > 4) {
        throw new Error(`Invalid loadout: Exceeds maximum of 4 hands required.`);
    }

    const totalItemBp = items.reduce((sum, item) => sum + item.bp, 0);
    const { adjustedBp, adjustedItemCosts } = calculateAdjustedBp(items, archetypeData.bp);

    const armorTypes = new Set<string>();
    items.filter(i => i.classification === 'Armor').forEach(armor => {
      if (armorTypes.has(armor.type)) {
        throw new Error(`Invalid loadout: Multiple armor pieces of type "${armor.type}" are not allowed.`);
      }
      armorTypes.add(armor.type);
    });
    
    if (adjustedItemCosts.equipmentBp.length > 3) {
        throw new Error(`Invalid loadout: A maximum of 3 equipment items are allowed.`);
    }

    return {
      name: generateProfileId(archetypeName, items),
      archetype: { [archetypeName]: archetypeData },
      items: items,
      totalBp: archetypeData.bp + totalItemBp,
      adjustedBp,
      adjustedItemCosts,
      physicality,
      adjPhysicality,
      durability,
      adjDurability: durability, // No traits affect durability yet
      burden: {
        totalLaden,
        totalBurden
      },
      finalTraits: finalTraits,
    };
  };

  if (itemNames && itemNames.length > 0) {
    const selectedItems = itemNames.map(itemName => {
      const item = allItems.find(i => i.name === itemName);
      if (!item) {
        throw new Error(`Item "${itemName}" not found.`);
      }
      return item;
    });
    return [createProfileObject(selectedItems)];
  }

  const allowedItems = allItems.filter(item => {
    const isClassAllowed = allowedItemClasses.some(allowedClass => item.classification.includes(allowedClass));
    const isDefaultItem = item.name === 'Unarmed' || item.name === 'Improvised Weapon';
    return isClassAllowed || isDefaultItem;
  });

  return allowedItems.map(item => createProfileObject([item]));
}

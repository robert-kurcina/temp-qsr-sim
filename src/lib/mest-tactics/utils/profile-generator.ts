
import { gameData } from '../../data';
import { Archetype } from '../core/Archetype';
import { Item } from '../core/Item';
import { Profile } from '../core/Profile';
import { processTraits, formatTrait } from '../traits/trait-parser';
import { isItemAvailableAtTechLevel, filterItemsByTechLevel } from './tech-level-filter';

const itemDataMapping: {
    [key: string]: keyof typeof gameData | null
} = {
    'Melee': 'melee_weapons',
    'Firearm': 'ranged_weapons',
    'Ordnance': 'ranged_weapons',
    'Bow': 'bow_weapons',
    'Thrown': 'thrown_weapons',
    'Support': 'support_weapons',
    'Grenade': 'grenade_weapons',
    'Armor': 'armors',
    'Equipment': 'equipment',
};

const weaponDataKeys = new Set<string>([
    'melee_weapons',
    'ranged_weapons',
    'bow_weapons',
    'thrown_weapons',
    'support_weapons',
    'grenade_weapons',
]);

export function generateRandomProfile(): Profile {
    const archetypeNames = Object.keys(gameData.archetypes);
    const primaryArchetypeName = getRandomElement(archetypeNames);
    const primaryArchetypeData = gameData.archetypes[primaryArchetypeName];

    const meleeWeaponNames = Object.keys(gameData.melee_weapons);
    const rangedWeaponNames = Object.keys(gameData.ranged_weapons);
    const armorNames = Object.keys(gameData.armors);
    const equipmentNames = Object.keys(gameData.equipment);

    let selectedItems: string[] = [];
    let generatedProfile: Profile | null = null;
    let attempts = 0;

    while (!generatedProfile && attempts < 20) {
        attempts++;
        selectedItems = [];

        // Randomly select items with a degree of randomness to create variety
        if (Math.random() > 0.3) {
            selectedItems.push(getRandomElement(meleeWeaponNames));
        }
        if (Math.random() > 0.3) {
            selectedItems.push(getRandomElement(rangedWeaponNames));
        }
        if (Math.random() > 0.3) {
            selectedItems.push(getRandomElement(armorNames));
        }
        
        const equipment = getRandomSubset(equipmentNames, 3);
        selectedItems.push(...equipment);

        try {
            const profiles = createProfiles(primaryArchetypeName, primaryArchetypeData, [], selectedItems);
            if (profiles.length > 0) {
                generatedProfile = profiles[0];
            }
        } catch (error) {
            // Invalid loadout, just try again.
        }
    }

    if (!generatedProfile) {
        // Fallback to a profile with no items if we fail to generate a valid one.
        try {
            const profiles = createProfiles(primaryArchetypeName, primaryArchetypeData, [], []);
            if (profiles.length > 0) {
                generatedProfile = profiles[0];
            } else {
                 throw new Error('Failed to generate a random profile even with no items.');
            }
        } catch(e) {
             throw new Error('Failed to generate a random profile after multiple attempts.');
        }
    }
    
    return generatedProfile;
}


export function createProfiles(
    primaryArchetypeName: string,
    primaryArchetypeData: Archetype,
    secondaryArchetypeNames: string[] = [],
    itemNames: string[] = [],
    techLevelConfig?: { early?: number; latest?: number }
): Profile[] {

    // Filter items by tech level if config provided
    let filteredItemNames = itemNames;
    if (techLevelConfig) {
        const maxTechLevel = techLevelConfig.latest ?? 20;
        const minTechLevel = techLevelConfig.early ?? 1;
        
        filteredItemNames = filterItemsByTechLevel(itemNames, {
            maxTechLevel,
            minTechLevel,
            allowAnyTech: true,
        });
        
        // Warn about filtered items
        const invalidItems = itemNames.filter(name => 
            !isItemAvailableAtTechLevel(name, maxTechLevel)
        );
        if (invalidItems.length > 0) {
            console.warn(
                `Tech Level ${minTechLevel}-${maxTechLevel}: ` +
                `Filtered out ${invalidItems.length} items not available: ${invalidItems.join(', ')}`
            );
        }
    }

    const archetype: { [key: string]: Archetype } = { [primaryArchetypeName]: primaryArchetypeData };
    let totalBp = primaryArchetypeData.bp;
    const archetypeTraits = [...primaryArchetypeData.traits];

    secondaryArchetypeNames.forEach(name => {
        const data = gameData.archetypes[name];
        if (data) {
            archetype[name] = data;
            totalBp += data.bp;
            archetypeTraits.push(...data.traits);
        }
    });

    const items: Item[] = [];
    const weaponItems: Item[] = [];
    const shieldItems: Item[] = [];
    const equipmentItems: Item[] = [];
    const itemTraits: string[] = [];
    
    let meleeBp: number[] = [];
    let rangedBp: number[] = [];
    let equipmentBp: number[] = [];

    let totalHands = 0;
    let weaponCount = 0;
    let equipmentCount = 0;
    let totalLaden = 0;

    filteredItemNames.forEach(itemName => {
        let itemFound = false;
        for (const key in itemDataMapping) {
            const dataKey = itemDataMapping[key] as keyof typeof gameData;
            if (dataKey && dataKey in gameData && itemName in gameData[dataKey]) {
                const item = { name: itemName, ...gameData[dataKey][itemName] } as Item;
                items.push(item);
                itemTraits.push(...(item.traits || []));
                totalBp += item.bp;

                if (weaponDataKeys.has(dataKey)) {
                    weaponItems.push(item);
                    weaponCount += 1;
                }

                if (item.class && item.class.includes('Shield')) {
                    shieldItems.push(item);
                }

                if (dataKey === 'equipment') {
                    equipmentItems.push(item);
                }

                const ladenTrait = item.traits.find(t => t.startsWith('[Laden'));
                if (ladenTrait) {
                    const match = ladenTrait.match(/\d+/);
                    totalLaden += match ? parseInt(match[0]) : 1;
                }

                if (key === 'Equipment') equipmentCount++;

                const handTrait = item.traits.find(t => t.startsWith('[') && t.endsWith('H]'));
                if (handTrait) {
                    if (handTrait.includes('1H')) totalHands += 1;
                    if (handTrait.includes('2H')) totalHands += 2;
                }

                if (item.classification === 'Melee') {
                    meleeBp.push(item.bp);
                } else if (item.classification === 'Firearm' || item.classification === 'Ordnance') {
                    rangedBp.push(item.bp);
                } else if (item.classification === 'Equipment' || (item.classification && item.classification.includes('Shield'))) {
                    equipmentBp.push(item.bp);
                }

                itemFound = true;
                break;
            }
        }
        if (!itemFound) {
            console.warn(`Item not found: ${itemName}`);
        }
    });

    const armorTypes = items.filter(i => i.classification === 'Armor' && i.type !== 'Shield').map(i => i.type);
    if (new Set(armorTypes).size < armorTypes.length) {
        throw new Error('Invalid loadout: Cannot wear more than one armor of the same type.');
    }

    if (weaponCount > 3) throw new Error('Invalid loadout: A maximum of 3 weapons are allowed.');
    if (totalHands > 4) throw new Error('Invalid loadout: Exceeds maximum of 4 hands required.');
    if (equipmentCount > 3) throw new Error('Invalid loadout: A maximum of 3 equipment items are allowed.');
    
    meleeBp.sort((a, b) => b - a);
    rangedBp.sort((a, b) => b - a);
    equipmentBp.sort((a, b) => b - a);

    const discount = (bp: number, index: number) => (index > 0 ? Math.ceil(bp / 2) : bp);

    const adjustedMeleeBp = meleeBp.map(discount);
    const adjustedRangedBp = rangedBp.map(discount);
    const adjustedEquipmentBp = equipmentBp.map(discount);

    const adjustedItemBp = [...adjustedMeleeBp, ...adjustedRangedBp, ...adjustedEquipmentBp].reduce((a, b) => a + b, 0);
    const nonDiscountedItemBp = items
        .filter(i => i.classification !== 'Melee' && i.classification !== 'Firearm' && i.classification !== 'Ordnance' && i.classification !== 'Equipment' && !(i.classification && i.classification.includes('Shield')))
        .reduce((acc, item) => acc + item.bp, 0);

    const adjustedBp = primaryArchetypeData.bp + nonDiscountedItemBp + adjustedItemBp;

    const profileName = [primaryArchetypeName.toLowerCase().replace(/, /g, '-'), ...itemNames.slice(0, 2).map(name => name.toLowerCase().replace(/, /g, '-'))].join('-').replace(/[\s_]/g, '-');

    const str = primaryArchetypeData.attributes.str;
    const siz = primaryArchetypeData.attributes.siz;
    const physicality = Math.max(str, siz);

    const fort = primaryArchetypeData.attributes.for;
    const durability = Math.max(fort, siz);

    const allCombinedTraits = processTraits([...archetypeTraits, ...itemTraits]);

    let adjPhysicality = physicality;
    let adjDurability = durability;
    let totalDeflect = 0;
    let totalAR = 0;

    allCombinedTraits.forEach(trait => {
        if (trait.name === 'Brawn') adjPhysicality += trait.level || 0;
        if (trait.name === 'Tough') adjDurability += trait.level || 0;
        if (trait.name === 'Deflect') totalDeflect += trait.level || 0;
        if (trait.name === 'Armor') totalAR += trait.level || 0;
    });

    const totalBurden = Math.max(0, totalLaden - adjPhysicality);
    if (totalBurden > 2) {
        throw new Error('Invalid loadout: Exceeds maximum burden of 2.');
    }

    const getHandsRequired = (item: Item): number => {
        const handTrait = item.traits.find(t => t.startsWith('[') && t.endsWith('H]'));
        if (!handTrait) return 0;
        if (handTrait.includes('2H')) return 2;
        if (handTrait.includes('1H')) return 1;
        return 0;
    };

    const profile: Profile = {
        name: profileName + '-loadout',
        archetype,
        items,
        inHandItems: [],
        stowedItems: [],
        totalBp,
        adjustedBp,
        adjustedItemCosts: {
            meleeBp: adjustedMeleeBp,
            rangedBp: adjustedRangedBp,
            equipmentBp: adjustedEquipmentBp,
        },
        physicality,
        adjPhysicality,
        durability,
        adjDurability,
        burden: {
            totalLaden,
            totalBurden
        },
        totalHands,
        totalDeflect,
        totalAR,
        finalTraits: allCombinedTraits.map(formatTrait),
        allTraits: allCombinedTraits.map(formatTrait)
    };

    const handsAvailable = 2;
    let handsInUse = 0;
    const inHandItems: Item[] = [];
    const stowedItems: Item[] = [];

    const tryEquipInHand = (item: Item): boolean => {
        const handsRequired = getHandsRequired(item);
        if (handsRequired === 0) {
            inHandItems.push(item);
            return true;
        }
        if (handsInUse + handsRequired <= handsAvailable) {
            handsInUse += handsRequired;
            inHandItems.push(item);
            return true;
        }
        stowedItems.push(item);
        return false;
    };

    const weaponsTwoHanded = weaponItems.filter(item => getHandsRequired(item) === 2);
    const weaponsOneHanded = weaponItems.filter(item => getHandsRequired(item) === 1);
    const shieldsOneHanded = shieldItems.filter(item => getHandsRequired(item) === 1);
    const shieldsOther = shieldItems.filter(item => getHandsRequired(item) !== 1);

    [
        ...weaponsTwoHanded,
        ...weaponsOneHanded,
        ...shieldsOneHanded,
        ...shieldsOther
    ].forEach(item => {
        tryEquipInHand(item);
    });

    equipmentItems.forEach(item => {
        const handsRequired = getHandsRequired(item);
        if (handsRequired === 0) {
            stowedItems.push(item);
            return;
        }
        if (handsInUse + handsRequired <= handsAvailable) {
            handsInUse += handsRequired;
            inHandItems.push(item);
            return;
        }
        stowedItems.push(item);
    });

    items.forEach(item => {
        if (inHandItems.includes(item) || stowedItems.includes(item)) return;
        stowedItems.push(item);
    });

    profile.inHandItems = inHandItems;
    profile.stowedItems = stowedItems;

    return [profile];
}

// Helper functions for generateRandomProfile
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomSubset<T>(arr: T[], maxCount: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    const count = Math.floor(Math.random() * (maxCount + 1));
    return shuffled.slice(0, count);
}

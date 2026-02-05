
import { gameData } from '../data';
import { Archetype } from './Archetype';
import { Item } from './Item';
import { Trait } from './Trait';
import { processTraits, formatTrait, parseTrait } from './trait-parser';

const itemDataMapping: {
    [key: string]: keyof typeof gameData | null
} = {
    'Melee': 'melee_weapons',
    'Firearm': 'ranged_weapons',
    'Ordnance': 'ranged_weapons',
    'Armor': 'armors',
    'Equipment': 'equipment',
};

export interface Profile {
    name: string;
    archetype: { [key: string]: Archetype };
    items: Item[];
    totalBp: number;
    adjustedBp: number;
    adjustedItemCosts: { 
        meleeBp: number[],
        rangedBp: number[],
        equipmentBp: number[]
    };
    physicality: number;
    adjPhysicality: number;
    durability: number;
    adjDurability: number;
    burden: { totalLaden: number; totalBurden: number; };
    totalHands: number;
    totalDeflect: number;
    totalAR: number;
    finalTraits: string[];
    allTraits: string[];
}

export function createProfiles(
    primaryArchetypeName: string,
    primaryArchetypeData: Archetype,
    secondaryArchetypeNames: string[] = [],
    itemNames: string[] = []
): Profile[] {

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
    const itemTraits: string[] = [];
    
    let meleeBp: number[] = [];
    let rangedBp: number[] = [];
    let equipmentBp: number[] = [];

    let totalHands = 0;
    let equipmentCount = 0;
    let totalLaden = 0;

    itemNames.forEach(itemName => {
        let itemFound = false;
        for (const key in itemDataMapping) {
            const dataKey = itemDataMapping[key] as keyof typeof gameData;
            if (dataKey && dataKey in gameData && itemName in gameData[dataKey]) {
                const item = { name: itemName, ...gameData[dataKey][itemName] } as Item;
                items.push(item);
                itemTraits.push(...(item.traits || []));
                totalBp += item.bp;

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

    const profile: Profile = {
        name: profileName + '-loadout',
        archetype,
        items,
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

    return [profile];
}

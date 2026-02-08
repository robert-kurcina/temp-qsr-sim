
import { Item } from './Item';
import { Archetype } from './Archetype';

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

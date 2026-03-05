
import { Item } from './Item';
import { Archetype } from './Archetype';
import { Attributes } from './Attributes';
import type { FinalAttributes } from './Attributes';

export interface Profile {
    name: string;
    archetype: { [key: string]: any } | Archetype;
    attributes?: Attributes;
    finalAttributes?: FinalAttributes;
    items?: Item[];
    equipment?: Item[];
    inHandItems?: Item[];
    stowedItems?: Item[];
    totalBp?: number;
    bp?: number; // Alias for totalBp for backward compatibility
    adjustedBp?: number;
    adjustedItemCosts?: {
        meleeBp: number[],
        rangedBp: number[],
        equipmentBp: number[]
    };
    physicality?: number;
    adjPhysicality?: number;
    durability?: number;
    adjDurability?: number;
    burden?: { totalLaden?: number; totalBurden: number; items?: Item[] };
    totalHands?: number;
    totalDeflect?: number;
    totalAR?: number;
    traits?: string[]; // Backward compatibility for older tests
    finalTraits?: string[];
    allTraits?: string[];
    // Computed/derived properties for backward compatibility
    siz?: number; // Alias for attributes?.siz
}

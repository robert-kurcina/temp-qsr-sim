import type { TechnologicalAge } from '../../../src/lib/mest-tactics/utils/tech-level-filter';

export type ArmorWeight = 'light' | 'medium' | 'heavy';
export type WeaponStyle = 'melee_centric' | 'ranged_centric' | 'balanced';
export type HandConfiguration = '1h' | '2h';

export interface ArmorLoadoutEntry {
  id: string;
  armorWeight: ArmorWeight;
  variation: 'no_gear_no_shield' | 'gear_no_shield' | 'shield_no_gear' | 'shield_and_gear';
  hasGear: boolean;
  hasShield: boolean;
  hasHelmet: boolean;
  items: string[];
  bp: {
    base: number;
    adjusted: number;
  };
}

export interface WeaponLoadoutEntry {
  id: string;
  style: WeaponStyle;
  optionIndex: 1 | 2 | 3;
  handConfiguration: HandConfiguration;
  optionalStowedItem: string | null;
  items: string[];
  bp: {
    base: number;
    adjusted: number;
  };
}

export interface LoadoutCombinationEntry {
  id: string;
  armorLoadoutId: string;
  weaponLoadoutId: string;
  armorWeight: ArmorWeight;
  weaponStyle: WeaponStyle;
  handConfiguration: HandConfiguration;
  compatible: boolean;
  compatibilityReason: 'ok' | 'shield_requires_1h_weapon';
  items: string[];
  bp: {
    base: number;
    adjusted: number;
  };
}

export interface TechAgeLoadoutCatalog {
  techAge: TechnologicalAge;
  techLevel: number;
  generatedAt: string;
  armorLoadouts: ArmorLoadoutEntry[];
  weaponLoadouts: WeaponLoadoutEntry[];
  combinations: LoadoutCombinationEntry[];
}

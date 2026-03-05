/**
 * Technology Level Filtering System
 * 
 * Filters items, weapons, armor, and equipment based on technological age.
 * 
 * Source: rules-technology-genres.md, tech_level.json, item_tech_window.json
 */

import { gameData } from '../../data';
import { getCanonicalTechLevelForAge } from './canonical-metadata';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Human-readable technological age labels
 * Maps to tech_level numbers for filtering
 */
export type TechnologicalAge =
  | 'Stone'        // Tech 1
  | 'Bronze'       // Tech 2
  | 'Iron'         // Tech 3
  | 'Medieval'     // Tech 5 (QSR default)
  | 'Renaissance'  // Tech 6
  | 'Colonial'     // Tech 7
  | 'Sail'         // Tech 8
  | 'Industrial'   // Tech 9
  | 'Machine'      // Tech 10
  | 'Modern'       // Tech 11
  | 'Atomic'       // Tech 12
  | 'Information'  // Tech 13
  | 'Robotics'     // Tech 14
  | 'Fusion'       // Tech 15
  | 'Quantum'      // Tech 16
  | 'Energy'       // Tech 17
  | 'Gravity'      // Tech 18
  | 'Symbolic'     // Tech 19-20 (Magic)
  | 'ANY';         // All tech levels (upgrades/packages)

/**
 * Tech period grouping
 */
export type TechPeriod =
  | 'Ancient'      // Tech 1-3
  | 'Archaic'      // Tech 5-7
  | 'Expansionist' // Tech 8-10
  | 'Modern'       // Tech 11-13
  | 'Near'         // Tech 14-15
  | 'Far'          // Tech 16-18
  | 'Fantastic'    // Tech 19-20
  | 'ANY';

/**
 * Tech window for an item
 * Defines earliest and latest tech level the item can appear in
 */
export interface TechWindow {
  early: number;
  latest: number;
}

/**
 * Configuration for tech level filtering
 */
export interface TechLevelConfig {
  /** Maximum tech level allowed (items with early > maxTechLevel are excluded) */
  maxTechLevel: number;
  /** Minimum tech level allowed (items with latest < minTechLevel are excluded) */
  minTechLevel?: number;
  /** Allow ANY tech level items (upgrades, packages) */
  allowAnyTech?: boolean;
}

// ============================================================================
// AGE TO TECH LEVEL MAPPING
// ============================================================================

/**
 * Map human-readable age to tech level
 * 
 * Per rules-technology-genres.md:
 * - Default QSR: Tech 1-3 (Ancient: Stone to Iron)
 * - Extended QSR: Tech 1-5 (Ancient to Medieval)
 * - Default battle: Medieval (Tech 5, Archaic period)
 */
function canonicalTechLevel(age: Exclude<TechnologicalAge, 'ANY'>, fallback: number): number {
  const level = getCanonicalTechLevelForAge(age);
  return typeof level === 'number' ? level : fallback;
}

export const AGE_TO_TECH_LEVEL: Record<TechnologicalAge, number> = {
  'Stone': canonicalTechLevel('Stone', 1),
  'Bronze': canonicalTechLevel('Bronze', 2),
  'Iron': canonicalTechLevel('Iron', 3),
  'Medieval': canonicalTechLevel('Medieval', 5),
  'Renaissance': canonicalTechLevel('Renaissance', 6),
  'Colonial': canonicalTechLevel('Colonial', 7),
  'Sail': canonicalTechLevel('Sail', 8),
  'Industrial': canonicalTechLevel('Industrial', 9),
  'Machine': canonicalTechLevel('Machine', 10),
  'Modern': canonicalTechLevel('Modern', 11),
  'Atomic': canonicalTechLevel('Atomic', 12),
  'Information': canonicalTechLevel('Information', 13),
  'Robotics': canonicalTechLevel('Robotics', 14),
  'Fusion': canonicalTechLevel('Fusion', 15),
  'Quantum': canonicalTechLevel('Quantum', 16),
  'Energy': canonicalTechLevel('Energy', 17),
  'Gravity': canonicalTechLevel('Gravity', 18),
  'Symbolic': canonicalTechLevel('Symbolic', 19),
  'ANY': null as any,
};

/**
 * Map tech level to period
 */
export function getTechPeriod(techLevel: number): TechPeriod {
  if (techLevel >= 1 && techLevel <= 3) return 'Ancient';
  if (techLevel >= 5 && techLevel <= 7) return 'Archaic';
  if (techLevel >= 8 && techLevel <= 10) return 'Expansionist';
  if (techLevel >= 11 && techLevel <= 13) return 'Modern';
  if (techLevel >= 14 && techLevel <= 15) return 'Near';
  if (techLevel >= 16 && techLevel <= 18) return 'Far';
  if (techLevel >= 19 && techLevel <= 20) return 'Fantastic';
  return 'ANY';
}

/**
 * Get default tech level for QSR games
 */
export function getDefaultQSRMaxTechLevel(extended: boolean = false): number {
  return extended ? 5 : 3; // Extended QSR allows Medieval (Tech 5)
}

// ============================================================================
// TECH WINDOW LOOKUP
// ============================================================================

/**
 * Get tech window for an item by name
 * 
 * Uses item_tech_window.json data aggregated into gameData
 */
export function getItemTechWindow(itemName: string): TechWindow | null {
  const techWindows = gameData.item_tech_window || [];
  const entry = techWindows.find((e: any) => e.item === itemName);
  
  if (!entry || !entry.tech_window) {
    // Item not found - assume available at all tech levels
    return { early: 1, latest: 20 };
  }

  return {
    early: entry.tech_window.early ?? 1,
    latest: entry.tech_window.latest ?? 5,
  };
}

/**
 * Check if an item is available at a given tech level
 */
export function isItemAvailableAtTechLevel(
  itemName: string,
  techLevel: number,
  allowAnyTech: boolean = true
): boolean {
  const techWindow = getItemTechWindow(itemName);
  
  if (!techWindow) {
    // No tech window data - assume available
    return true;
  }
  
  // Check if item's tech window includes this tech level
  const isInWindow = techLevel >= techWindow.early && techLevel <= techWindow.latest;
  
  // Handle ANY tech level items (upgrades, packages)
  if (techWindow.early === null || techWindow.latest === null) {
    return allowAnyTech;
  }
  
  return isInWindow;
}

// ============================================================================
// ITEM FILTERING
// ============================================================================

/**
 * Filter items by tech level
 * 
 * @param items - Array of item names to filter
 * @param config - Tech level configuration
 * @returns Filtered array of item names
 */
export function filterItemsByTechLevel(
  items: string[],
  config: TechLevelConfig
): string[] {
  return items.filter(itemName => {
    const techWindow = getItemTechWindow(itemName);
    
    if (!techWindow) {
      // No tech window data - include if allowAnyTech
      return config.allowAnyTech !== false;
    }
    
    // Handle ANY tech level items
    if (techWindow.early === null || techWindow.latest === null) {
      return config.allowAnyTech !== false;
    }
    
    // Check if item's early tech level is within allowed range
    if (techWindow.early > config.maxTechLevel) {
      return false;
    }
    
    // Check minimum tech level if specified
    if (config.minTechLevel && techWindow.latest < config.minTechLevel) {
      return false;
    }
    
    return true;
  });
}

/**
 * Filter weapons by tech level
 */
export function filterWeaponsByTechLevel(
  weaponNames: string[],
  config: TechLevelConfig
): string[] {
  return filterItemsByTechLevel(weaponNames, config);
}

/**
 * Filter armor by tech level
 */
export function filterArmorByTechLevel(
  armorNames: string[],
  config: TechLevelConfig
): string[] {
  return filterItemsByTechLevel(armorNames, config);
}

/**
 * Filter equipment by tech level
 */
export function filterEquipmentByTechLevel(
  equipmentNames: string[],
  config: TechLevelConfig
): string[] {
  return filterItemsByTechLevel(equipmentNames, config);
}

// ============================================================================
// TECH LEVEL CONFIG FROM AGE
// ============================================================================

/**
 * Create tech level config from human-readable age
 * 
 * @param age - Human-readable technological age
 * @param extended - Allow extended tech range (for QSR)
 * @returns TechLevelConfig for filtering
 */
export function createTechConfigFromAge(
  age: TechnologicalAge,
  extended: boolean = false
): TechLevelConfig {
  const maxTechLevel = AGE_TO_TECH_LEVEL[age];
  
  // For QSR games, allow items from tech level 1 up to max
  return {
    maxTechLevel,
    minTechLevel: 1,
    allowAnyTech: true,
  };
}

/**
 * Get available items for a technological age
 * 
 * @param age - Human-readable technological age
 * @param extended - Allow extended tech range
 * @returns Object with filtered weapons, armor, and equipment
 */
export function getAvailableItemsForAge(
  age: TechnologicalAge,
  extended: boolean = false
): {
  weapons: string[];
  armor: string[];
  equipment: string[];
} {
  const config = createTechConfigFromAge(age, extended);

  // Get all available items from gameData
  const allWeapons = Object.keys((gameData as any).melee_weapons || {});
  const allArmor = Object.keys((gameData as any).armors || {});
  const allEquipment = Object.keys((gameData as any).equipment || {});
  
  return {
    weapons: filterWeaponsByTechLevel(allWeapons, config),
    armor: filterArmorByTechLevel(allArmor, config),
    equipment: filterEquipmentByTechLevel(allEquipment, config),
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that all items in a profile are available at the given tech level
 * 
 * @param itemNames - Array of item names to validate
 * @param techLevel - Maximum tech level allowed
 * @returns Array of invalid item names (empty if all valid)
 */
export function validateItemsForTechLevel(
  itemNames: string[],
  techLevel: number
): string[] {
  const invalid: string[] = [];
  
  for (const itemName of itemNames) {
    if (!isItemAvailableAtTechLevel(itemName, techLevel)) {
      invalid.push(itemName);
    }
  }
  
  return invalid;
}

/**
 * Get tech level violation details for an item
 */
export function getTechLevelViolation(itemName: string, maxTechLevel: number): string {
  const techWindow = getItemTechWindow(itemName);
  
  if (!techWindow) {
    return '';
  }
  
  if (techWindow.early > maxTechLevel) {
    return `${itemName} requires Tech ${techWindow.early}, but max is Tech ${maxTechLevel}`;
  }
  
  return '';
}

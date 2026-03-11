import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameData } from '../../../src/lib/data';
import { getItemHandRequirement } from '../../../src/lib/mest-tactics/actions/hand-requirements';
import { buildProfile } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { getCanonicalItemClassification } from '../../../src/lib/mest-tactics/utils/canonical-metadata';
import {
  AGE_TO_TECH_LEVEL,
  createTechConfigFromAge,
  isItemAvailableAtTechLevel,
  type TechnologicalAge,
} from '../../../src/lib/mest-tactics/utils/tech-level-filter';
import type { Item } from '../../../src/lib/mest-tactics/core/Item';
import type {
  ArmorLoadoutEntry,
  ArmorWeight,
  HandConfiguration,
  LoadoutCombinationEntry,
  TechAgeLoadoutCatalog,
  WeaponLoadoutEntry,
  WeaponStyle,
} from './types';

interface IndexedItem {
  name: string;
  item: Item;
  itemClass: string;
  itemType: string | null;
  bp: number;
  hands: number;
  laden: number;
}

const ITEM_DATA_KEYS = [
  'melee_weapons',
  'ranged_weapons',
  'bow_weapons',
  'thrown_weapons',
  'support_weapons',
  'grenade_weapons',
  'armors',
  'equipment',
] as const;

const NATURAL_MELEE_PATTERN = /^(bite|claw|claws|pummel|unarmed)\b/i;
const STOWED_OPTION_PATTERN = /(dagger|daggers|stiletto|throwing|knife)/i;
const GEAR_NAME_PATTERN = /(gear|harness|reinforced|bracer|padding|vaumbrace|collar)/i;
const UNARMED_ITEM_PATTERN = /^unarmed\b/i;

const SUIT_WEIGHT_PATTERNS: Record<ArmorWeight, RegExp[]> = {
  light: [/armor,\s*light/i, /light mail/i, /\blight\b/i],
  medium: [/armor,\s*medium/i, /medium mail/i, /\bmedium\b/i],
  heavy: [/armor,\s*heavy/i, /heavy mail/i, /\bheavy\b/i],
};

const SHIELD_WEIGHT_PATTERNS: Record<ArmorWeight, RegExp[]> = {
  light: [/\blight\b/i, /\bsmall\b/i, /\bbuckle\b/i],
  medium: [/\bmedium\b/i],
  heavy: [/\bheavy\b/i, /\blarge\b/i],
};

// Support weapons are reserved for future side-level assignment and must not be attached to individual profiles.
const RANGED_ITEM_CLASSES = new Set(['Firearm', 'Bow', 'Thrown', 'Ordnance', 'Grenade']);

const BASE_ARCHETYPE_BP = Number((gameData as any).archetypes?.Average?.bp ?? 30);

function extractLaden(traits: string[] | undefined): number {
  if (!Array.isArray(traits)) return 0;
  let total = 0;
  for (const trait of traits) {
    const ladenMatch = /\[Laden(?:\s+(\d+))?\]/i.exec(trait);
    if (ladenMatch) {
      total += ladenMatch[1] ? Number.parseInt(ladenMatch[1], 10) : 1;
    }
  }
  return total;
}

function compareItems(a: IndexedItem, b: IndexedItem): number {
  if (a.laden !== b.laden) return a.laden - b.laden;
  if (a.bp !== b.bp) return a.bp - b.bp;
  return a.name.localeCompare(b.name);
}

function uniqueByName(items: IndexedItem[]): IndexedItem[] {
  const byName = new Map<string, IndexedItem>();
  for (const item of items) {
    if (!byName.has(item.name)) {
      byName.set(item.name, item);
    }
  }
  return [...byName.values()];
}

function dedupeNames(names: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    deduped.push(name);
  }
  return deduped;
}

function isUnarmedItemName(name: string): boolean {
  return UNARMED_ITEM_PATTERN.test(name.trim());
}

function pickFromPool(pool: IndexedItem[], optionIndex: number): IndexedItem {
  if (pool.length === 0) {
    throw new Error('Cannot pick from empty pool');
  }
  const sorted = [...pool].sort(compareItems);
  if (sorted.length === 1) return sorted[0];
  const idx = Math.round((optionIndex / 2) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function pickDistinctFromPool(pool: IndexedItem[], primary: IndexedItem, optionIndex: number): IndexedItem | null {
  const filtered = pool.filter(item => item.name !== primary.name);
  if (filtered.length === 0) return null;
  return pickFromPool(filtered, optionIndex);
}

function pickByPatternsOrQuantile(
  pool: IndexedItem[],
  patterns: RegExp[],
  quantile: number
): IndexedItem {
  const patternMatches = pool.filter(item => patterns.some(pattern => pattern.test(item.name)));
  if (patternMatches.length > 0) {
    return [...patternMatches].sort(compareItems)[0];
  }
  const sorted = [...pool].sort(compareItems);
  const idx = Math.round((sorted.length - 1) * quantile);
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function indexAllItems(): IndexedItem[] {
  const map = new Map<string, IndexedItem>();
  for (const key of ITEM_DATA_KEYS) {
    const source = (gameData as any)[key] as Record<string, Record<string, unknown>> | undefined;
    if (!source) continue;
    for (const [name, raw] of Object.entries(source)) {
      if (map.has(name)) continue;
      const item = { name, ...(raw as object) } as Item;
      const canonicalClass = getCanonicalItemClassification(item.class);
      const itemClass = canonicalClass?.itemClass ?? item.classification ?? '';
      const itemType = canonicalClass?.itemType ?? item.type ?? null;
      const traits = Array.isArray(item.traits) ? item.traits : [];
      map.set(name, {
        name,
        item,
        itemClass,
        itemType,
        bp: Number(item.bp ?? 0),
        hands: getItemHandRequirement(item),
        laden: extractLaden(traits),
      });
    }
  }
  return [...map.values()];
}

function adjustedBpForItemNames(
  itemNames: string[],
  techAge: TechnologicalAge,
  cache: Map<string, number>,
  fallbackValue: number
): number {
  const key = [...itemNames].sort().join('|');
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let adjustedItems = fallbackValue;
  try {
    const profile = buildProfile('Average', {
      itemNames,
      technologicalAge: techAge,
    });
    const adjustedTotal = Number(profile.adjustedBp ?? profile.totalBp ?? BASE_ARCHETYPE_BP);
    adjustedItems = Math.max(0, Math.round((adjustedTotal - BASE_ARCHETYPE_BP) * 100) / 100);
  } catch {
    adjustedItems = fallbackValue;
  }
  cache.set(key, adjustedItems);
  return adjustedItems;
}

function baseBpForNames(names: string[], byName: Map<string, IndexedItem>): number {
  return Math.round(
    names.reduce((sum, name) => sum + Number(byName.get(name)?.bp ?? 0), 0) * 100
  ) / 100;
}

function totalLadenForNames(names: string[], byName: Map<string, IndexedItem>): number {
  return names.reduce((sum, name) => sum + Number(byName.get(name)?.laden ?? 0), 0);
}

function requiredPhysicalityForNames(names: string[], byName: Map<string, IndexedItem>): number {
  // QSR burden comparison baseline: 1 + total laden is compared against Physicality (max STR/SIZ).
  return totalLadenForNames(names, byName) + 1;
}

function hasSupportWeapon(names: string[], byName: Map<string, IndexedItem>): boolean {
  return names.some(name => byName.get(name)?.itemClass === 'Support');
}

function buildArmorLoadouts(
  techAge: TechnologicalAge,
  available: IndexedItem[],
  byName: Map<string, IndexedItem>,
  adjustedBpCache: Map<string, number>
): ArmorLoadoutEntry[] {
  const suits = available.filter(item => item.itemClass === 'Armor' && item.itemType === 'Suit');
  const shields = available.filter(item => item.itemClass === 'Armor' && item.itemType === 'Shield' && item.hands <= 1);
  const helmets = available.filter(item => item.itemClass === 'Armor' && item.itemType === 'Helm');
  const armorGears = available.filter(item => item.itemClass === 'Armor' && item.itemType === 'Gear');
  const equipmentGears = available.filter(item => item.itemClass === 'Equipment' && GEAR_NAME_PATTERN.test(item.name));
  const gearPool = uniqueByName([...armorGears, ...equipmentGears]).sort(compareItems);

  if (suits.length === 0) {
    throw new Error(`No armor suits available for tech age ${techAge}`);
  }
  if (shields.length === 0) {
    throw new Error(`No shields available for tech age ${techAge}`);
  }

  const suitByWeight: Record<ArmorWeight, IndexedItem> = {
    light: pickByPatternsOrQuantile(suits, SUIT_WEIGHT_PATTERNS.light, 0),
    medium: pickByPatternsOrQuantile(suits, SUIT_WEIGHT_PATTERNS.medium, 0.5),
    heavy: pickByPatternsOrQuantile(suits, SUIT_WEIGHT_PATTERNS.heavy, 1),
  };

  const shieldByWeight: Record<ArmorWeight, IndexedItem> = {
    light: pickByPatternsOrQuantile(shields, SHIELD_WEIGHT_PATTERNS.light, 0),
    medium: pickByPatternsOrQuantile(shields, SHIELD_WEIGHT_PATTERNS.medium, 0.5),
    heavy: pickByPatternsOrQuantile(shields, SHIELD_WEIGHT_PATTERNS.heavy, 1),
  };

  const gear = gearPool[0] ?? null;
  const helmet = helmets.sort(compareItems)[0] ?? null;

  const variations: Array<{
    id: ArmorLoadoutEntry['variation'];
    hasGear: boolean;
    hasShield: boolean;
  }> = [
    { id: 'no_gear_no_shield', hasGear: false, hasShield: false },
    { id: 'gear_no_shield', hasGear: true, hasShield: false },
    { id: 'shield_no_gear', hasGear: false, hasShield: true },
    { id: 'shield_and_gear', hasGear: true, hasShield: true },
  ];

  const entries: ArmorLoadoutEntry[] = [];
  for (const armorWeight of ['light', 'medium', 'heavy'] as const) {
    for (const hasHelmet of [false, true]) {
      for (const variation of variations) {
        const items: string[] = [suitByWeight[armorWeight].name];
        if (variation.hasShield) {
          items.push(shieldByWeight[armorWeight].name);
        }
        if (variation.hasGear && gear) {
          items.push(gear.name);
        }
        if (hasHelmet && helmet) {
          items.push(helmet.name);
        }
        const dedupedItems = dedupeNames(items);
        const baseBp = baseBpForNames(dedupedItems, byName);
        const adjustedBp = adjustedBpForItemNames(dedupedItems, techAge, adjustedBpCache, baseBp);
        const requiredPhysicality = requiredPhysicalityForNames(dedupedItems, byName);
        entries.push({
          id: `${armorWeight}-${variation.id}-${hasHelmet ? 'helmet' : 'no_helmet'}`,
          armorWeight,
          variation: variation.id,
          requiredPhysicality,
          hasGear: variation.hasGear && Boolean(gear),
          hasShield: variation.hasShield,
          hasHelmet: hasHelmet && Boolean(helmet),
          items: dedupedItems,
          bp: {
            base: baseBp,
            adjusted: adjustedBp,
          },
        });
      }
    }
  }

  if (entries.length !== 24) {
    throw new Error(`Expected 24 armor loadouts for ${techAge}, received ${entries.length}`);
  }

  return entries;
}

function buildWeaponLoadouts(
  techAge: TechnologicalAge,
  available: IndexedItem[],
  byName: Map<string, IndexedItem>,
  adjustedBpCache: Map<string, number>
): WeaponLoadoutEntry[] {
  const melee = available
    .filter(item =>
      item.itemClass === 'Melee' &&
      !NATURAL_MELEE_PATTERN.test(item.name) &&
      !isUnarmedItemName(item.name)
    )
    .sort(compareItems);
  const ranged = available
    .filter(item => RANGED_ITEM_CLASSES.has(item.itemClass) && !isUnarmedItemName(item.name))
    .sort(compareItems);

  if (melee.length === 0 || ranged.length === 0) {
    throw new Error(`Insufficient melee/ranged items for ${techAge}: melee=${melee.length}, ranged=${ranged.length}`);
  }

  const melee1h = melee.filter(item => item.hands <= 1);
  const melee2h = melee.filter(item => item.hands >= 2);
  const ranged1h = ranged.filter(item => item.hands <= 1);
  const ranged2h = ranged.filter(item => item.hands >= 2);

  const stowedOptions = uniqueByName(
    available.filter(item =>
      item.hands <= 1 &&
      (item.itemClass === 'Melee' || RANGED_ITEM_CLASSES.has(item.itemClass)) &&
      STOWED_OPTION_PATTERN.test(item.name) &&
      !isUnarmedItemName(item.name)
    )
  ).sort(compareItems);

  const fallbackStowedOptions = stowedOptions.length > 0
    ? stowedOptions
    : uniqueByName([...ranged1h, ...melee1h]).sort(compareItems);

  const entries: WeaponLoadoutEntry[] = [];
  const styles: WeaponStyle[] = ['melee_centric', 'ranged_centric', 'balanced'];
  const hands: HandConfiguration[] = ['1h', '2h'];

  for (const style of styles) {
    for (const handConfiguration of hands) {
      for (let optionIndex = 0; optionIndex < 3; optionIndex++) {
        const selected: IndexedItem[] = [];
        const require2h = handConfiguration === '2h';
        const meleePrimaryPool = require2h ? (melee2h.length > 0 ? melee2h : melee) : (melee1h.length > 0 ? melee1h : melee);
        const rangedPrimaryPool = require2h ? (ranged2h.length > 0 ? ranged2h : ranged) : (ranged1h.length > 0 ? ranged1h : ranged);

        if (style === 'melee_centric') {
          const primary = pickFromPool(meleePrimaryPool, optionIndex);
          selected.push(primary);
          const secondaryPool = require2h ? melee1h : melee1h;
          const secondary = pickDistinctFromPool(secondaryPool, primary, optionIndex);
          if (secondary) selected.push(secondary);
        } else if (style === 'ranged_centric') {
          const primary = pickFromPool(rangedPrimaryPool, optionIndex);
          selected.push(primary);
          const secondaryPool = require2h ? ranged1h : ranged1h;
          const secondary = pickDistinctFromPool(secondaryPool, primary, optionIndex);
          if (secondary) selected.push(secondary);
        } else {
          const meleePrimary = pickFromPool(meleePrimaryPool, optionIndex);
          const rangedPrimary = pickFromPool(rangedPrimaryPool, (optionIndex + 1) % 3);
          selected.push(meleePrimary);
          if (rangedPrimary.name !== meleePrimary.name) {
            selected.push(rangedPrimary);
          }
        }

        let optionalStowedItem: string | null = null;
        if (optionIndex > 0 && fallbackStowedOptions.length > 0) {
          const stowedCandidate = pickFromPool(fallbackStowedOptions, optionIndex);
          const currentHands = selected.reduce((sum, item) => sum + item.hands, 0);
          if (
            selected.length < 3 &&
            currentHands + stowedCandidate.hands <= 4 &&
            !selected.some(item => item.name === stowedCandidate.name) &&
            !isUnarmedItemName(stowedCandidate.name)
          ) {
            selected.push(stowedCandidate);
            optionalStowedItem = stowedCandidate.name;
          }
        }

        const itemNames = dedupeNames(selected.map(item => item.name))
          .filter(name => !isUnarmedItemName(name));
        if (hasSupportWeapon(itemNames, byName)) {
          throw new Error(`Support weapons must not appear in individual weapon loadouts: ${itemNames.join(', ')}`);
        }
        const baseBp = baseBpForNames(itemNames, byName);
        const adjustedBp = adjustedBpForItemNames(itemNames, techAge, adjustedBpCache, baseBp);
        const requiredPhysicality = requiredPhysicalityForNames(itemNames, byName);

        entries.push({
          id: `${style}-${handConfiguration}-opt${optionIndex + 1}`,
          style,
          optionIndex: (optionIndex + 1) as 1 | 2 | 3,
          handConfiguration,
          requiredPhysicality,
          optionalStowedItem,
          items: itemNames,
          bp: {
            base: baseBp,
            adjusted: adjustedBp,
          },
        });
      }
    }
  }

  if (entries.length !== 18) {
    throw new Error(`Expected 18 weapon loadouts for ${techAge}, received ${entries.length}`);
  }

  return entries;
}

function buildCombinations(
  techAge: TechnologicalAge,
  armorLoadouts: ArmorLoadoutEntry[],
  weaponLoadouts: WeaponLoadoutEntry[],
  byName: Map<string, IndexedItem>,
  adjustedBpCache: Map<string, number>
): LoadoutCombinationEntry[] {
  const combinations: LoadoutCombinationEntry[] = [];
  for (const armor of armorLoadouts) {
    for (const weapon of weaponLoadouts) {
      const compatible = !(armor.hasShield && weapon.handConfiguration === '2h');
      const compatibilityReason: LoadoutCombinationEntry['compatibilityReason'] = compatible
        ? 'ok'
        : 'shield_requires_1h_weapon';
      const items = dedupeNames([...armor.items, ...weapon.items]);
      if (hasSupportWeapon(items, byName)) {
        throw new Error(`Support weapons must not appear in individual loadout combinations: ${armor.id}__${weapon.id}`);
      }
      if (armor.items.length > 0 && items.some(isUnarmedItemName)) {
        throw new Error(`Invalid loadout combination includes Unarmed with armor: ${armor.id}__${weapon.id}`);
      }
      const baseBp = baseBpForNames(items, byName);
      const adjustedBp = adjustedBpForItemNames(items, techAge, adjustedBpCache, baseBp);
      const requiredPhysicality = requiredPhysicalityForNames(items, byName);
      combinations.push({
        id: `${armor.id}__${weapon.id}`,
        armorLoadoutId: armor.id,
        weaponLoadoutId: weapon.id,
        armorWeight: armor.armorWeight,
        weaponStyle: weapon.style,
        handConfiguration: weapon.handConfiguration,
        requiredPhysicality,
        compatible,
        compatibilityReason,
        items,
        bp: {
          base: baseBp,
          adjusted: adjustedBp,
        },
      });
    }
  }
  return combinations;
}

function generateCatalogForAge(
  techAge: TechnologicalAge,
  allItems: IndexedItem[],
  outputDir: string
): void {
  const techLevel = Number(AGE_TO_TECH_LEVEL[techAge]);
  const config = createTechConfigFromAge(techAge);
  const availableItems = allItems.filter(item => {
    if (!isItemAvailableAtTechLevel(item.name, techLevel, config.allowAnyTech !== false)) {
      return false;
    }
    return true;
  });
  const byName = new Map<string, IndexedItem>(availableItems.map(item => [item.name, item]));
  const adjustedBpCache = new Map<string, number>();

  const armorLoadouts = buildArmorLoadouts(techAge, availableItems, byName, adjustedBpCache);
  const weaponLoadouts = buildWeaponLoadouts(techAge, availableItems, byName, adjustedBpCache);
  const combinations = buildCombinations(techAge, armorLoadouts, weaponLoadouts, byName, adjustedBpCache);

  const catalog: TechAgeLoadoutCatalog = {
    techAge,
    techLevel,
    generatedAt: new Date().toISOString(),
    armorLoadouts,
    weaponLoadouts,
    combinations,
  };

  const filename = `${techAge.toLowerCase()}.loadout.json`;
  const outputPath = resolve(outputDir, filename);
  writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Generated ${filename}: armor=${armorLoadouts.length}, weapons=${weaponLoadouts.length}, combinations=${combinations.length}`);
}

function main(): void {
  const allItems = indexAllItems();
  const currentFile = fileURLToPath(import.meta.url);
  const outputDir = dirname(currentFile);
  mkdirSync(outputDir, { recursive: true });

  const techAges = Object.keys(AGE_TO_TECH_LEVEL)
    .filter((age): age is TechnologicalAge => age !== 'ANY');

  for (const age of techAges) {
    generateCatalogForAge(age, allItems, outputDir);
  }
}

main();

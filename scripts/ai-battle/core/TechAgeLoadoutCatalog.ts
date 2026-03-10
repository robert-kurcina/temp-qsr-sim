import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { TechnologicalAge } from '../../../src/lib/mest-tactics/utils/tech-level-filter';
import { AGE_TO_TECH_LEVEL } from '../../../src/lib/mest-tactics/utils/tech-level-filter';
import type {
  LoadoutCombinationEntry,
  TechAgeLoadoutCatalog,
  WeaponStyle,
} from '../loadouts/types';

export type RunnerLoadoutProfile = 'default' | 'melee_only';

const DEFAULT_TECH_AGE: TechnologicalAge = 'Medieval';
const CATALOG_CACHE = new Map<TechnologicalAge, TechAgeLoadoutCatalog>();

const STYLE_WEIGHTS_DEFAULT: Record<WeaponStyle, number> = {
  melee_centric: 3,
  ranged_centric: 2,
  balanced: 3,
};

function isTechAge(value: string): value is TechnologicalAge {
  return value in AGE_TO_TECH_LEVEL && value !== 'ANY';
}

export function normalizeTechnologicalAge(value: string | undefined): TechnologicalAge {
  if (!value) return DEFAULT_TECH_AGE;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_TECH_AGE;

  const direct = trimmed as TechnologicalAge;
  if (isTechAge(direct)) return direct;

  const titleCase = `${trimmed[0]?.toUpperCase() ?? ''}${trimmed.slice(1).toLowerCase()}`;
  if (isTechAge(titleCase)) return titleCase;

  const upper = trimmed.toUpperCase();
  for (const age of Object.keys(AGE_TO_TECH_LEVEL)) {
    if (age === 'ANY') continue;
    if (age.toUpperCase() === upper) {
      return age as TechnologicalAge;
    }
  }

  return DEFAULT_TECH_AGE;
}

function readCatalogFromDisk(techAge: TechnologicalAge): TechAgeLoadoutCatalog {
  const url = new URL(`../loadouts/${techAge.toLowerCase()}.loadout.json`, import.meta.url);
  const filePath = resolve(fileURLToPath(url));
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as TechAgeLoadoutCatalog;
}

export function getTechAgeLoadoutCatalogForRunner(techAge: TechnologicalAge): TechAgeLoadoutCatalog {
  const cached = CATALOG_CACHE.get(techAge);
  if (cached) return cached;
  const catalog = readCatalogFromDisk(techAge);
  CATALOG_CACHE.set(techAge, catalog);
  return catalog;
}

function pickWeightedStyle(styles: WeaponStyle[], random: () => number): WeaponStyle {
  const weighted: Array<{ style: WeaponStyle; weight: number }> = styles.map(style => ({
    style,
    weight: STYLE_WEIGHTS_DEFAULT[style] ?? 1,
  }));
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return styles[Math.floor(random() * styles.length)] ?? 'balanced';
  }

  let cursor = random() * totalWeight;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.style;
    }
  }
  return weighted[weighted.length - 1]?.style ?? 'balanced';
}

function randomPick<T>(items: T[], random: () => number): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from empty array');
  }
  const idx = Math.floor(random() * items.length);
  return items[Math.max(0, Math.min(items.length - 1, idx))];
}

export function selectLoadoutCombinationForRunner(params: {
  catalog: TechAgeLoadoutCatalog;
  loadoutProfile: RunnerLoadoutProfile;
  random?: () => number;
}): LoadoutCombinationEntry {
  const random = params.random ?? Math.random;
  const compatible = params.catalog.combinations.filter(entry => entry.compatible);
  if (compatible.length === 0) {
    throw new Error(`No compatible loadout combinations found for ${params.catalog.techAge}`);
  }

  const styleFiltered = params.loadoutProfile === 'melee_only'
    ? compatible.filter(entry => entry.weaponStyle === 'melee_centric')
    : compatible;
  const pool = styleFiltered.length > 0 ? styleFiltered : compatible;

  if (params.loadoutProfile === 'default') {
    const presentStyles = [...new Set(pool.map(entry => entry.weaponStyle))];
    const pickedStyle = pickWeightedStyle(presentStyles, random);
    const sameStyle = pool.filter(entry => entry.weaponStyle === pickedStyle);
    if (sameStyle.length > 0) {
      return randomPick(sameStyle, random);
    }
  }

  return randomPick(pool, random);
}

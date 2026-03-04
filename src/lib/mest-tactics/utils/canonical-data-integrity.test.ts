import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { gameData } from '../../data';
import { createProfiles } from './profile-generator';
import { AGE_TO_TECH_LEVEL } from './tech-level-filter';
import type { Archetype } from '../core/Archetype';

const veteranArchetypeName = 'Veteran';
const veteranArchetypeData: Archetype = {
  species: 'Humanoid',
  attributes: { cca: 3, rca: 3, ref: 3, int: 2, pow: 3, str: 2, for: 2, mov: 2, siz: 3 },
  traits: ['Grit'],
  bp: 61,
  class: 'Common'
};

const require = createRequire(import.meta.url);
const { loadBundledDataFromJson } = require('../../../../scripts/bundle-data.cjs') as {
  loadBundledDataFromJson: (dataDir: string) => Record<string, unknown>;
};

function loadCanonicalBundledData() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dataDir = path.resolve(here, '../../../data');
  return loadBundledDataFromJson(dataDir);
}

function buildSingleItemProfile(itemName: string) {
  const profiles = createProfiles(veteranArchetypeName, veteranArchetypeData, [], [itemName]);
  expect(profiles).toHaveLength(1);
  return profiles[0];
}

describe('Canonical Data Integrity', () => {
  it('keeps generated src/lib/data.ts synchronized with src/data/*.json', () => {
    expect(gameData).toEqual(loadCanonicalBundledData());
  });

  it('loads support weapons through profile generation', () => {
    const itemName = 'Mortar, Light';
    const profile = buildSingleItemProfile(itemName);

    expect(profile.items.map(i => i.name)).toContain(itemName);
    expect(profile.totalBp).toBe(veteranArchetypeData.bp + gameData.support_weapons[itemName].bp);
  });

  it('loads grenade weapons through profile generation', () => {
    const itemName = 'Grenade, Flash';
    const profile = buildSingleItemProfile(itemName);

    expect(profile.items.map(i => i.name)).toContain(itemName);
    expect(profile.totalBp).toBe(veteranArchetypeData.bp + gameData.grenade_weapons[itemName].bp);
  });

  it('maps all item class labels through item_classifications', () => {
    const classificationMap = gameData.item_classifications as Record<string, unknown>;
    const pools = [
      gameData.armors,
      gameData.bow_weapons,
      gameData.equipment,
      gameData.grenade_weapons,
      gameData.melee_weapons,
      gameData.ranged_weapons,
      gameData.support_weapons,
      gameData.thrown_weapons
    ];

    const missingClasses = new Set<string>();

    for (const pool of pools) {
      for (const item of Object.values(pool) as Array<{ class?: string }>) {
        if (typeof item.class !== 'string') continue;
        if (!(item.class in classificationMap)) {
          missingClasses.add(item.class);
        }
      }
    }

    expect(Array.from(missingClasses)).toEqual([]);
  });

  it('keeps keyword descriptions complete for core classifier terms', () => {
    const keywords = gameData.keyword_descriptions as Array<{ name?: string; description?: string }>;
    const byName = new Map<string, string>();

    for (const keyword of keywords) {
      if (typeof keyword.name !== 'string' || typeof keyword.description !== 'string') continue;
      byName.set(keyword.name, keyword.description);
    }

    const required = [
      'Asset',
      'Attack Effect',
      'Intrinsic',
      'Magic',
      'Movement',
      'Natural Weapon',
      'Psychology',
      'Skill'
    ];

    for (const name of required) {
      const description = byName.get(name);
      expect(description).toBeTruthy();
      expect((description ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps AGE_TO_TECH_LEVEL aligned with tech_level entries', () => {
    const techRows = gameData.tech_level as Array<{ tech_age?: string; tech_level?: number | null }>;
    const ageToLevels = new Map<string, Set<number>>();

    for (const row of techRows) {
      if (typeof row.tech_age !== 'string' || typeof row.tech_level !== 'number') continue;
      const levels = ageToLevels.get(row.tech_age) ?? new Set<number>();
      levels.add(row.tech_level);
      ageToLevels.set(row.tech_age, levels);
    }

    for (const [age, level] of Object.entries(AGE_TO_TECH_LEVEL)) {
      if (typeof level !== 'number') continue;
      expect(ageToLevels.get(age)?.has(level)).toBe(true);
    }

    expect(techRows.some(row => row.tech_level === null)).toBe(true);
  });
});

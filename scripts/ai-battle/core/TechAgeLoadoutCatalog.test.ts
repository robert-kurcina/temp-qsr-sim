import { describe, expect, it } from 'vitest';
import { AGE_TO_TECH_LEVEL } from '../../../src/lib/mest-tactics/utils/tech-level-filter';
import type { TechnologicalAge } from '../../../src/lib/mest-tactics/utils/tech-level-filter';
import type { TechAgeLoadoutCatalog } from '../loadouts/types';
import {
  getTechAgeLoadoutCatalogForRunner,
  normalizeTechnologicalAge,
  selectLoadoutCombinationForRunner,
} from './TechAgeLoadoutCatalog';

function techAges(): TechnologicalAge[] {
  return Object.keys(AGE_TO_TECH_LEVEL)
    .filter((age): age is TechnologicalAge => age !== 'ANY');
}

describe('TechAgeLoadoutCatalog', () => {
  it('normalizes common age formats and falls back for unknown values', () => {
    expect(normalizeTechnologicalAge('modern')).toBe('Modern');
    expect(normalizeTechnologicalAge('MODERN')).toBe('Modern');
    expect(normalizeTechnologicalAge(' Medieval ')).toBe('Medieval');
    expect(normalizeTechnologicalAge('unknown-age')).toBe('Medieval');
    expect(normalizeTechnologicalAge(undefined)).toBe('Medieval');
  });

  it('loads each tech age catalog with expected shape', () => {
    for (const age of techAges()) {
      const catalog = getTechAgeLoadoutCatalogForRunner(age);
      expect(catalog.techAge).toBe(age);
      expect(catalog.armorLoadouts).toHaveLength(24);
      expect(catalog.weaponLoadouts).toHaveLength(18);
      expect(catalog.combinations).toHaveLength(432);
    }
  });

  it('keeps shield compatibility constrained to 1h loadouts', () => {
    for (const age of techAges()) {
      const catalog = getTechAgeLoadoutCatalogForRunner(age);
      const armorById = new Map(catalog.armorLoadouts.map(entry => [entry.id, entry]));

      for (const combination of catalog.combinations) {
        const armor = armorById.get(combination.armorLoadoutId);
        expect(armor).toBeDefined();
        if (armor?.hasShield && combination.handConfiguration === '2h') {
          expect(combination.compatible).toBe(false);
          expect(combination.compatibilityReason).toBe('shield_requires_1h_weapon');
        }
      }
    }
  });

  it('selects only compatible combinations and honors melee_only profile', () => {
    const medieval = getTechAgeLoadoutCatalogForRunner('Medieval');
    const defaultSelection = selectLoadoutCombinationForRunner({
      catalog: medieval,
      loadoutProfile: 'default',
      random: () => 0.42,
    });
    expect(defaultSelection.compatible).toBe(true);

    const meleeOnlySelection = selectLoadoutCombinationForRunner({
      catalog: medieval,
      loadoutProfile: 'melee_only',
      random: () => 0.42,
    });
    expect(meleeOnlySelection.compatible).toBe(true);
    expect(meleeOnlySelection.weaponStyle).toBe('melee_centric');
  });

  it('falls back to compatible pool if melee styles are unavailable', () => {
    const catalog = getTechAgeLoadoutCatalogForRunner('Medieval');
    const rangedOnlyCatalog: TechAgeLoadoutCatalog = {
      ...catalog,
      combinations: catalog.combinations.filter(
        entry => entry.compatible && entry.weaponStyle === 'ranged_centric'
      ),
    };

    const selection = selectLoadoutCombinationForRunner({
      catalog: rangedOnlyCatalog,
      loadoutProfile: 'melee_only',
      random: () => 0.2,
    });

    expect(selection.compatible).toBe(true);
    expect(selection.weaponStyle).toBe('ranged_centric');
  });
});

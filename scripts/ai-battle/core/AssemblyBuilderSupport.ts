import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import { gameData } from '../../../src/lib/data';
import { buildAssembly, buildProfile } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { SideConfig } from '../../shared/BattleReportTypes';
import {
  getTechAgeLoadoutCatalogForRunner,
  normalizeTechnologicalAge,
  selectLoadoutCombinationForRunner,
  type RunnerLoadoutProfile,
} from './TechAgeLoadoutCatalog';
import type { LoadoutCombinationEntry, TechAgeLoadoutCatalog } from '../loadouts/types';

const VALIDATED_COMBINATION_CACHE = new Map<string, LoadoutCombinationEntry[]>();

function normalizeLoadoutProfile(value: SideConfig['loadoutProfile']): RunnerLoadoutProfile {
  return value === 'melee_only' ? 'melee_only' : 'default';
}

function sanitizeProfileItems(profile: ReturnType<typeof buildProfile>): void {
  if (!profile.equipment && profile.items) {
    profile.equipment = profile.items;
  }
  if (Array.isArray(profile.items)) {
    profile.items = profile.items.filter(Boolean);
  }
  if (Array.isArray(profile.equipment)) {
    profile.equipment = profile.equipment.filter(Boolean);
  }
}

function chooseWeightedArchetype(
  options: Array<{ archetypeName: string; weight: number }>
): { archetypeName: string; weight: number } {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) {
      return option;
    }
  }
  return options[options.length - 1] ?? { archetypeName: 'Average', weight: 1 };
}

function getArchetypePhysicality(archetypeName: string): number {
  const attributes = (gameData as any).archetypes?.[archetypeName]?.attributes ?? {};
  const str = Number(attributes.str ?? 0);
  const siz = Number(attributes.siz ?? 0);
  return Math.max(str, siz);
}

function getValidatedCombinationsForArchetype(params: {
  archetypeName: string;
  catalog: TechAgeLoadoutCatalog;
  loadoutProfile: RunnerLoadoutProfile;
}): LoadoutCombinationEntry[] {
  const { archetypeName, catalog, loadoutProfile } = params;
  const archetypePhysicality = getArchetypePhysicality(archetypeName);
  const cacheKey = `${catalog.techAge}|${loadoutProfile}|${archetypeName}|phys:${archetypePhysicality}`;
  const cached = VALIDATED_COMBINATION_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const compatible = catalog.combinations.filter(entry => entry.compatible);
  const styleFiltered = loadoutProfile === 'melee_only'
    ? compatible.filter(entry => entry.weaponStyle === 'melee_centric')
    : compatible;
  const pool = styleFiltered.length > 0 ? styleFiltered : compatible;
  const validated = pool.filter(entry => entry.requiredPhysicality <= archetypePhysicality);

  VALIDATED_COMBINATION_CACHE.set(cacheKey, validated);
  return validated;
}

function selectValidatedCombinationForArchetype(params: {
  archetypeName: string;
  catalog: TechAgeLoadoutCatalog;
  loadoutProfile: RunnerLoadoutProfile;
}): LoadoutCombinationEntry | null {
  const validatedCombinations = getValidatedCombinationsForArchetype(params);
  if (validatedCombinations.length === 0) {
    return null;
  }

  return selectLoadoutCombinationForRunner({
    catalog: {
      ...params.catalog,
      combinations: validatedCombinations,
    },
    loadoutProfile: params.loadoutProfile,
  });
}

export async function createAssemblyForRunner(
  sideConfig: SideConfig
): Promise<{ characters: Character[]; totalBP: number; id: string }> {
  const techAge = normalizeTechnologicalAge(sideConfig.technologicalAge);
  const loadoutProfile = normalizeLoadoutProfile(sideConfig.loadoutProfile);
  const seededModels = Array.isArray((sideConfig as any).models) ? ((sideConfig as any).models as Array<{
    archetypeId?: string;
    archetypeName?: string;
    items?: string[];
  }>) : [];

  const profiles = [];
  if (seededModels.length > 0) {
    for (const seeded of seededModels) {
      const archetype = String(seeded.archetypeId || seeded.archetypeName || 'Average');
      const items = Array.isArray(seeded.items) ? seeded.items.filter(Boolean) : [];
      const profile = buildProfile(archetype, { itemNames: items, technologicalAge: techAge });
      sanitizeProfileItems(profile);
      profiles.push(profile);
    }
  } else {
    const compositions = loadoutProfile === 'melee_only'
      ? [
          { archetypeName: 'Average', weight: 6 },
          { archetypeName: 'Militia', weight: 2 },
          { archetypeName: 'Veteran', weight: 1 },
        ]
      : [
          { archetypeName: 'Average', weight: 3 },
          { archetypeName: 'Militia', weight: 2 },
          { archetypeName: 'Veteran', weight: 3 },
          { archetypeName: 'Elite', weight: 1 },
        ];
    const catalog = getTechAgeLoadoutCatalogForRunner(techAge);

    for (let i = 0; i < sideConfig.modelCount; i++) {
      const selected = chooseWeightedArchetype(compositions);
      const combination = selectValidatedCombinationForArchetype({
        archetypeName: selected.archetypeName,
        catalog,
        loadoutProfile,
      });
      let profile;
      if (combination) {
        profile = buildProfile(selected.archetypeName, {
          itemNames: combination.items,
          technologicalAge: techAge,
        });
      } else {
        profile = buildProfile(selected.archetypeName, {
          itemNames: [],
          technologicalAge: techAge,
        });
      }
      sanitizeProfileItems(profile);
      profiles.push(profile);
    }
  }

  const assembly = buildAssembly(sideConfig.assemblyName, profiles);
  assembly.characters.forEach((character, index) => {
    character.id = `${sideConfig.assemblyName}-${index + 1}-${character.id}`;
  });
  return { characters: assembly.characters, totalBP: assembly.assembly.totalBP, id: sideConfig.assemblyName };
}

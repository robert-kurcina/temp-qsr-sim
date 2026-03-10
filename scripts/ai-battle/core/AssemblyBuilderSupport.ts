import type { Character } from '../../../src/lib/mest-tactics/core/Character';
import { buildAssembly, buildProfile } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import type { SideConfig } from '../../shared/BattleReportTypes';
import {
  getTechAgeLoadoutCatalogForRunner,
  normalizeTechnologicalAge,
  selectLoadoutCombinationForRunner,
  type RunnerLoadoutProfile,
} from './TechAgeLoadoutCatalog';

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
    const compatibleFallback = catalog.combinations.find(entry => entry.compatible)?.items ?? ['Sword, Broad'];

    for (let i = 0; i < sideConfig.modelCount; i++) {
      const selected = chooseWeightedArchetype(compositions);
      const combination = selectLoadoutCombinationForRunner({
        catalog,
        loadoutProfile,
      });
      const itemNames = combination.items;
      let profile;
      try {
        profile = buildProfile(selected.archetypeName, {
          itemNames,
          technologicalAge: techAge,
        });
      } catch {
        profile = buildProfile(selected.archetypeName, {
          itemNames: compatibleFallback,
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

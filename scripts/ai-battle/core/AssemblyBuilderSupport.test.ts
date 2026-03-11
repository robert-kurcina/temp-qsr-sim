import { afterEach, describe, expect, it, vi } from 'vitest';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { SideConfig } from '../../shared/BattleReportTypes';
import type { TechAgeLoadoutCatalog } from '../loadouts/types';
import { createAssemblyForRunner } from './AssemblyBuilderSupport';
import * as TechAgeLoadoutCatalogSupport from './TechAgeLoadoutCatalog';

function buildSideConfig(overrides: Partial<SideConfig> = {}): SideConfig {
  return {
    name: 'Alpha',
    bp: 125,
    modelCount: 5,
    tacticalDoctrine: TacticalDoctrine.Balanced,
    loadoutProfile: 'default',
    technologicalAge: 'Medieval',
    assemblyName: 'Assembly Alpha',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AssemblyBuilderSupport', () => {
  it('creates an assembly from tech-age catalogs', async () => {
    const result = await createAssemblyForRunner(buildSideConfig());

    expect(result.characters).toHaveLength(5);
    expect(result.totalBP).toBeGreaterThan(0);
    expect(result.id).toBe('Assembly Alpha');
  });

  it('does not emit tech-level filtering warnings for generated catalogs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await createAssemblyForRunner(
      buildSideConfig({
        technologicalAge: 'Quantum',
        modelCount: 10,
        loadoutProfile: 'melee_only',
      })
    );

    const warningMessages = warnSpy.mock.calls
      .map(call => call.map(arg => String(arg)).join(' '))
      .filter(message => message.includes('Filtered out') || message.includes('Tech Level'));

    expect(warningMessages).toHaveLength(0);
  });

  it('keeps random runner assembly generation resilient with physicality-based loadout filtering', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.35);

    const stressedAges: Array<NonNullable<SideConfig['technologicalAge']>> = [
      'Atomic',
      'Bronze',
      'Colonial',
      'Industrial',
      'Information',
      'Machine',
      'Modern',
      'Sail',
      'Stone',
    ];

    for (const technologicalAge of stressedAges) {
      const result = await createAssemblyForRunner(
        buildSideConfig({
          technologicalAge,
          modelCount: 1,
        })
      );
      const [character] = result.characters;
      expect(character?.profile?.archetype).toHaveProperty('Militia');
      const totalLaden = character?.profile?.burden?.totalLaden ?? 0;
      const physicality = character?.profile?.physicality ?? 0;
      expect(totalLaden).toBeLessThanOrEqual(Math.max(0, physicality - 1));
    }
  });

  it('does not assign improvised combinations to non-Militia/Untrained archetypes', async () => {
    const catalog: TechAgeLoadoutCatalog = {
      techAge: 'Symbolic',
      techLevel: 20,
      generatedAt: '2026-03-11T00:00:00.000Z',
      armorLoadouts: [],
      weaponLoadouts: [],
      combinations: [
        {
          id: 'improvised',
          armorLoadoutId: 'a1',
          weaponLoadoutId: 'w1',
          armorWeight: 'light',
          weaponStyle: 'melee_centric',
          handConfiguration: '1h',
          requiredPhysicality: 1,
          compatible: true,
          compatibilityReason: 'ok',
          items: ['Armor, Light', 'Improvised Melee'],
          bp: { base: 0, adjusted: 0 },
        },
        {
          id: 'standard',
          armorLoadoutId: 'a2',
          weaponLoadoutId: 'w2',
          armorWeight: 'light',
          weaponStyle: 'melee_centric',
          handConfiguration: '1h',
          requiredPhysicality: 1,
          compatible: true,
          compatibilityReason: 'ok',
          items: ['Armor, Light', 'Sword, Broad'],
          bp: { base: 0, adjusted: 0 },
        },
      ],
    };

    vi.spyOn(Math, 'random').mockReturnValue(0); // Weighted composition chooses Average
    vi.spyOn(TechAgeLoadoutCatalogSupport, 'getTechAgeLoadoutCatalogForRunner').mockReturnValue(catalog);
    vi.spyOn(TechAgeLoadoutCatalogSupport, 'selectLoadoutCombinationForRunner').mockImplementation(params => {
      expect(params.catalog.combinations.some(entry => entry.items.includes('Improvised Melee'))).toBe(false);
      return params.catalog.combinations[0]!;
    });

    const result = await createAssemblyForRunner(
      buildSideConfig({
        technologicalAge: 'Symbolic',
        modelCount: 1,
      })
    );
    const equippedItemNames = result.characters[0]?.profile?.equipment?.map((item: any) => item.name) ?? [];
    expect(equippedItemNames).not.toContain('Improvised Melee');
  });

  it('allows improvised combinations for Militia archetypes', async () => {
    const catalog: TechAgeLoadoutCatalog = {
      techAge: 'Symbolic',
      techLevel: 20,
      generatedAt: '2026-03-11T00:00:00.000Z',
      armorLoadouts: [],
      weaponLoadouts: [],
      combinations: [
        {
          id: 'improvised',
          armorLoadoutId: 'a1',
          weaponLoadoutId: 'w1',
          armorWeight: 'light',
          weaponStyle: 'melee_centric',
          handConfiguration: '1h',
          requiredPhysicality: 1,
          compatible: true,
          compatibilityReason: 'ok',
          items: ['Armor, Light', 'Improvised Melee'],
          bp: { base: 0, adjusted: 0 },
        },
      ],
    };

    vi.spyOn(Math, 'random').mockReturnValue(0.45); // Weighted composition chooses Militia
    vi.spyOn(TechAgeLoadoutCatalogSupport, 'getTechAgeLoadoutCatalogForRunner').mockReturnValue(catalog);
    vi.spyOn(TechAgeLoadoutCatalogSupport, 'selectLoadoutCombinationForRunner').mockImplementation(params => {
      expect(params.catalog.combinations.some(entry => entry.items.includes('Improvised Melee'))).toBe(true);
      return params.catalog.combinations[0]!;
    });

    const result = await createAssemblyForRunner(
      buildSideConfig({
        technologicalAge: 'Symbolic',
        modelCount: 1,
      })
    );
    const equippedItemNames = result.characters[0]?.profile?.equipment?.map((item: any) => item.name) ?? [];
    expect(equippedItemNames).toContain('Improvised Melee');
  });
});

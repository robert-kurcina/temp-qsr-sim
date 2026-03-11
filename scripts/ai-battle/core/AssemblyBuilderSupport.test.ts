import { afterEach, describe, expect, it, vi } from 'vitest';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import type { SideConfig } from '../../shared/BattleReportTypes';
import { createAssemblyForRunner } from './AssemblyBuilderSupport';

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
});

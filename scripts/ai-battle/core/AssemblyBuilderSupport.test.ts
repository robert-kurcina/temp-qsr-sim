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
});

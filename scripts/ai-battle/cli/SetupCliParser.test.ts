import { describe, expect, it } from 'vitest';
import { parseAiBattleCliArgs, resolveQuickBattleCliDefaults } from './SetupCliParser';

describe('parseAiBattleCliArgs', () => {
  it('treats --help as a positional command flag', () => {
    const parsed = parseAiBattleCliArgs(['--help']);
    expect(parsed.command).toBe('help');
    expect(parsed.positionalArgs).toEqual(['--help']);
  });

  it('strips audit/viewer/seed/battlefield flags from positional args', () => {
    const parsed = parseAiBattleCliArgs([
      '--audit',
      '--viewer',
      '--seed',
      '123',
      '--battlefield',
      'data/battlefields/default/simple/VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json',
      'VERY_SMALL',
      '0',
    ]);

    expect(parsed.command).toBe('quick');
    expect(parsed.flags.enableAudit).toBe(true);
    expect(parsed.flags.enableViewer).toBe(true);
    expect(parsed.flags.seed).toBe(123);
    expect(parsed.flags.battlefieldPath).toContain('VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json');
    expect(parsed.positionalArgs).toEqual(['VERY_SMALL', '0']);
  });

  it('parses initiative-card tie-break flags and strips them from positional args', () => {
    const parsed = parseAiBattleCliArgs([
      '--initiative-card-holder',
      'Alpha',
      '--no-initiative-card-tiebreak',
      'VERY_SMALL',
      '50',
    ]);

    expect(parsed.command).toBe('quick');
    expect(parsed.flags.initiativeCardHolderSideId).toBe('Alpha');
    expect(parsed.flags.initiativeCardTieBreakerOnTie).toBe(false);
    expect(parsed.positionalArgs).toEqual(['VERY_SMALL', '50']);
  });
});

describe('resolveQuickBattleCliDefaults', () => {
  it('defaults quick battles to VERY_SMALL + density 50', () => {
    const resolved = resolveQuickBattleCliDefaults([]);
    expect(resolved.sizeArg).toBe('VERY_SMALL');
    expect(resolved.densityArg).toBe(50);
  });

  it('supports explicit quick command token before size and density', () => {
    const parsed = parseAiBattleCliArgs(['quick', 'VERY_SMALL', '0']);
    expect(parsed.command).toBe('quick');

    const resolved = resolveQuickBattleCliDefaults(parsed.positionalArgs);
    expect(resolved.sizeArg).toBe('VERY_SMALL');
    expect(resolved.densityArg).toBe(0);
  });

  it('supports --quick command flag before size and density', () => {
    const parsed = parseAiBattleCliArgs(['--quick', 'VERY_SMALL', '25']);
    expect(parsed.command).toBe('quick');

    const resolved = resolveQuickBattleCliDefaults(parsed.positionalArgs);
    expect(resolved.sizeArg).toBe('VERY_SMALL');
    expect(resolved.densityArg).toBe(25);
  });
});

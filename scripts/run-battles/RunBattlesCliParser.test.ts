import { describe, expect, it } from 'vitest';
import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { parseRunBattlesCliArgs, RunBattlesCliError } from './RunBattlesCliParser';

describe('parseRunBattlesCliArgs', () => {
  it('defaults to very-small with console output', () => {
    const parsed = parseRunBattlesCliArgs([]);
    expect(parsed.configName).toBe('very-small');
    expect(parsed.configFile).toBeUndefined();
    expect(parsed.outputFormat).toBe('console');
    expect(parsed.overrides).toEqual({});
    expect(parsed.showHelp).toBe(false);
  });

  it('parses explicit flags and viewer implies audit', () => {
    const parsed = parseRunBattlesCliArgs([
      '--config',
      'small',
      '--gameSize',
      'VERY_SMALL',
      '--mission',
      'QAI_12',
      '--terrain',
      '40',
      '--seed',
      '424242',
      '--battlefield',
      'data/battlefields/default/simple/VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json',
      '--viewer',
      '--output',
      'json',
    ]);

    expect(parsed.configName).toBe('small');
    expect(parsed.outputFormat).toBe('json');
    expect(parsed.overrides.gameSize).toBe(GameSize.VERY_SMALL);
    expect(parsed.overrides.missionId).toBe('QAI_12');
    expect(parsed.overrides.terrainDensity).toBe(0.4);
    expect(parsed.overrides.seed).toBe(424242);
    expect(parsed.overrides.battlefieldPath).toContain('VERY_SMALL-battlefield_A0-B0-W0-R0-S0-T0.json');
    expect(parsed.overrides.audit).toBe(true);
    expect(parsed.overrides.viewer).toBe(true);
  });

  it('recognizes help aliases', () => {
    const longHelp = parseRunBattlesCliArgs(['--help']);
    const shortHelp = parseRunBattlesCliArgs(['-h']);
    expect(longHelp.showHelp).toBe(true);
    expect(shortHelp.showHelp).toBe(true);
  });

  it('throws for invalid --output values', () => {
    expect(() => parseRunBattlesCliArgs(['--output', 'yaml'])).toThrow(RunBattlesCliError);
  });
});

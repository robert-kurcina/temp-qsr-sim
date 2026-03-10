import { describe, expect, it } from 'vitest';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import { VERY_SMALL_CONFIG } from './configs/very-small';
import {
  mapDoctrine,
  resolveLegacyEndGameReason,
  toCanonicalGameConfig,
  toCanonicalSideConfig
} from './index';
import type { SideConfig as LegacySideConfig } from './types';

describe('run-battles canonical adapter', () => {
  it('maps legacy doctrine names to canonical tactical doctrine ids', () => {
    expect(mapDoctrine('Aggressive')).toBe(TacticalDoctrine.Aggressive);
    expect(mapDoctrine('Defensive')).toBe(TacticalDoctrine.Defensive);
    expect(mapDoctrine('Objective')).toBe(TacticalDoctrine.Objective);
    expect(mapDoctrine('Opportunistic')).toBe(TacticalDoctrine.Opportunistic);
    expect(mapDoctrine('Balanced')).toBe(TacticalDoctrine.Balanced);
  });

  it('converts run-battles config to canonical game config', () => {
    const converted = toCanonicalGameConfig(VERY_SMALL_CONFIG, 'json');
    expect(converted.gameSize).toBe('VERY_SMALL');
    expect(converted.missionId).toBe('QAI_11');
    expect(converted.sides.length).toBe(2);
    expect(converted.sides[0].modelCount).toBe(3);
    expect(converted.sides[0].tacticalDoctrine).toBe(TacticalDoctrine.Balanced);
    expect(converted.verbose).toBe(false);
  });

  it('flattens multi-assembly side definitions into seeded side models', () => {
    const side: LegacySideConfig = {
      id: 'side-a',
      name: 'Side A',
      assemblies: [
        { name: 'A1', archetypeName: 'Average', count: 2, itemNames: ['Sword, Broad'] },
        { name: 'A2', archetypeName: 'Veteran', count: 1, itemNames: ['Rifle, Light, Semi/A'] },
      ],
      ai: { count: 1, doctrine: 'Aggressive' },
    };

    const converted = toCanonicalSideConfig(side, GameSize.VERY_SMALL);
    expect(converted.modelCount).toBe(3);
    expect(converted.assemblyName).toBe('A1');
    expect(converted.tacticalDoctrine).toBe(TacticalDoctrine.Aggressive);
    expect(Array.isArray((converted as any).models)).toBe(true);
    expect(((converted as any).models as any[]).length).toBe(3);
  });

  it('resolves legacy endGameReason from actual termination cause', () => {
    const baseReport = {
      config: { maxTurns: 10 },
      stats: { turnsCompleted: 8 },
      finalCounts: [
        { name: 'Alpha', remaining: 5 },
        { name: 'Bravo', remaining: 5 }
      ],
      missionRuntime: {},
    } as any;

    expect(resolveLegacyEndGameReason(baseReport)).toBe('trigger');
    expect(resolveLegacyEndGameReason({
      ...baseReport,
      finalCounts: [
        { name: 'Alpha', remaining: 5 },
        { name: 'Bravo', remaining: 0 }
      ],
    } as any)).toBe('elimination');
    expect(resolveLegacyEndGameReason({
      ...baseReport,
      stats: { turnsCompleted: 10 },
    } as any)).toBe('max-turn');
    expect(resolveLegacyEndGameReason({
      ...baseReport,
      missionRuntime: { immediateWinnerSideId: 'Alpha' },
    } as any)).toBe('mission-immediate');
  });
});

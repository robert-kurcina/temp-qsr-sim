import { describe, expect, it } from 'vitest';
import { TacticalDoctrine } from '../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { GameSize } from '../../src/lib/mest-tactics/mission/assembly-builder';
import {
  buildCanonicalGameConfig,
  createDefaultHeadToHeadSides,
  mapDoctrine,
  toCanonicalSideConfig,
} from './CanonicalBattleConfigAdapter';

describe('CanonicalBattleConfigAdapter', () => {
  it('maps legacy doctrine aliases', () => {
    expect(mapDoctrine('Aggressive')).toBe(TacticalDoctrine.Aggressive);
    expect(mapDoctrine('Defensive')).toBe(TacticalDoctrine.Defensive);
    expect(mapDoctrine('Balanced')).toBe(TacticalDoctrine.Balanced);
  });

  it('builds seeded model side from assembly inputs', () => {
    const converted = toCanonicalSideConfig(
      {
        name: 'Side A',
        assemblies: [
          { name: 'A1', archetypeName: 'Average', count: 2, itemNames: ['Sword, Broad'] },
          { name: 'A2', archetypeName: 'Veteran', count: 1, itemNames: ['Rifle, Light, Semi/A'] },
        ],
        ai: { doctrine: 'Aggressive' },
      },
      GameSize.VERY_SMALL
    );

    expect(converted.modelCount).toBe(3);
    expect(converted.assemblyName).toBe('A1');
    expect(converted.tacticalDoctrine).toBe(TacticalDoctrine.Aggressive);
    expect(((converted as any).models as any[]).length).toBe(3);
  });

  it('normalizes density and applies defaults in canonical config', () => {
    const config = buildCanonicalGameConfig({
      gameSize: GameSize.VERY_SMALL,
      missionId: 'QAI_11',
      sides: createDefaultHeadToHeadSides(GameSize.VERY_SMALL),
      densityRatio: 0.75,
      lighting: 'Day, Clear',
    });

    expect(config.densityRatio).toBe(75);
    expect(config.missionName).toBe('Elimination');
    expect(config.sides.length).toBe(2);
  });
});

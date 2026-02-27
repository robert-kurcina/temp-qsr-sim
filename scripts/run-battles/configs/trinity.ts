/**
 * TRINITY 3-Side Battle Configuration
 *
 * QAI_17 Trinity Mission - Requires minimum 3 sides
 * MEDIUM game size for balanced play
 * Battlefield: 48"×48"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const TRINITY_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.MEDIUM,
  terrainDensity: 0.50, // 50% as decimal (0.0-1.0)
  lighting: LIGHTING_PRESETS['Day, Clear'],
  missionId: 'QAI_17',
  sides: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblies: [
        {
          name: 'Assembly A',
          archetypeName: 'Elite',
          count: 6,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Medium'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Balanced',
      },
    },
    {
      id: 'side-b',
      name: 'Side B',
      assemblies: [
        {
          name: 'Assembly B',
          archetypeName: 'Elite',
          count: 6,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Medium'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Balanced',
      },
    },
    {
      id: 'side-c',
      name: 'Side C',
      assemblies: [
        {
          name: 'Assembly C',
          archetypeName: 'Elite',
          count: 6,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Medium'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Balanced',
      },
    },
  ],
  instrumentationGrade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
};

export default TRINITY_CONFIG;

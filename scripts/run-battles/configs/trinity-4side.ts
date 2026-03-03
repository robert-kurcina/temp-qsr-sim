/**
 * TRINITY 4-Side Battle Configuration
 *
 * QAI_17 Trinity Mission - Supports up to 4 sides
 * LARGE game size for epic battles
 * Battlefield: 48×48 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const TRINITY_4SIDE_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.LARGE,
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
          archetypeName: 'Veteran',
          count: 8,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Aggressive',
      },
    },
    {
      id: 'side-b',
      name: 'Side B',
      assemblies: [
        {
          name: 'Assembly B',
          archetypeName: 'Veteran',
          count: 8,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Light'],
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
          archetypeName: 'Veteran',
          count: 8,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Defensive',
      },
    },
    {
      id: 'side-d',
      name: 'Side D',
      assemblies: [
        {
          name: 'Assembly D',
          archetypeName: 'Veteran',
          count: 8,
          itemNames: ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Opportunistic',
      },
    },
  ],
  instrumentationGrade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
};

export default TRINITY_4SIDE_CONFIG;

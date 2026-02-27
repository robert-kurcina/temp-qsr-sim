/**
 * CONVERGENCE 3-Side Battle Configuration
 *
 * QAI_12 Convergence Mission - 2-4 sides
 * This configuration uses 3 sides
 * SMALL game size for faster play
 * Battlefield: 36"×36"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const CONVERGENCE_3SIDE_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.SMALL,
  terrainDensity: 50,
  lighting: LIGHTING_PRESETS['Day, Clear'],
  missionId: 'QAI_12',
  sides: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblies: [
        {
          name: 'Assembly A',
          archetypeName: 'Veteran',
          count: 4,
          itemNames: ['Rifle, Light, Semi/A', 'Armored Gear', 'Armor, Light'],
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
          count: 4,
          itemNames: ['Rifle, Light, Semi/A', 'Armored Gear', 'Armor, Light'],
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
          count: 4,
          itemNames: ['Rifle, Light, Semi/A', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 1,
        doctrine: 'Defensive',
      },
    },
  ],
  instrumentationGrade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
};

export default CONVERGENCE_3SIDE_CONFIG;

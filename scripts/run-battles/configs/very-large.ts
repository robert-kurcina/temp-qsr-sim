/**
 * VERY_LARGE Battle Configuration
 *
 * QSR Standard: 16-24 models per side
 * End-Game Trigger: Turn 7
 * Battlefield: 72"×72"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const VERY_LARGE_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.VERY_LARGE,
  terrainDensity: 50,
  lighting: LIGHTING_PRESETS['Day, Clear'],
  missionId: 'QAI_11',
  sides: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblies: [
        {
          name: 'Assembly A',
          archetypeName: 'Veteran',
          count: 16,
          itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
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
          archetypeName: 'Veteran',
          count: 16,
          itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
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

export default VERY_LARGE_CONFIG;

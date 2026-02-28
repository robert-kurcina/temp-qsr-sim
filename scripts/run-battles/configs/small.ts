/**
 * SMALL Battle Configuration
 *
 * QSR Standard: 4-8 models per side, 250-500 BP
 * End-Game Trigger: Turn 4
 * Battlefield: 36"×36"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const SMALL_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.SMALL,
  terrainDensity: 0.50, // 50% as decimal (0.0-1.0)
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
          count: 4,
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
          count: 4,
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

export default SMALL_CONFIG;

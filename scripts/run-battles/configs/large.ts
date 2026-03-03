/**
 * LARGE Battle Configuration
 *
 * Canonical (src/data/game_sizes.json): 8-12 models per side
 * End-Game Trigger: Turn 8
 * Battlefield: 48×48 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const LARGE_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.LARGE,
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
          count: 8,
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
          count: 8,
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

export default LARGE_CONFIG;

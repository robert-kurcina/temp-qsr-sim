/**
 * MEDIUM Battle Configuration
 *
 * QSR Standard: 6-12 models per side
 * End-Game Trigger: Turn 5
 * Battlefield: 48"×48"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const MEDIUM_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.MEDIUM,
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
          count: 6,
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
          count: 6,
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

export default MEDIUM_CONFIG;

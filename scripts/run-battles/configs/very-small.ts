/**
 * VERY_SMALL Battle Configuration
 * 
 * QSR Standard: 2-4 models per side, 125-250 BP
 * End-Game Trigger: Turn 3
 * Battlefield: 24"×24"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { TacticalDoctrine } from '../../../src/lib/mest-tactics/ai/stratagems/AIStratagems';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleConfig } from '../battle-runner';

export const VERY_SMALL_CONFIG: BattleConfig = {
  gameSize: GameSize.VERY_SMALL,
  battlefieldSize: 24,
  maxTurns: 10,
  
  terrainDensity: 50,
  lighting: LIGHTING_PRESETS['Day, Clear'],
  
  missionId: 'QAI_11',
  
  sides: [
    {
      name: 'Side A',
      doctrine: TacticalDoctrine.Balanced,
      assembly: {
        archetypeName: 'Average',
        itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
        count: 3,
      },
      aggression: 0.5,
      caution: 0.5,
    },
    {
      name: 'Side B',
      doctrine: TacticalDoctrine.Balanced,
      assembly: {
        archetypeName: 'Average',
        itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
        count: 3,
      },
      aggression: 0.5,
      caution: 0.5,
    },
  ],
  
  instrumentation: {
    grade: InstrumentationGrade.BY_ACTION_WITH_TESTS,
    outputFormat: 'console',
    verbose: true,
  },
};

export default VERY_SMALL_CONFIG;

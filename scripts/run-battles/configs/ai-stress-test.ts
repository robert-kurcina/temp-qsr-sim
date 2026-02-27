/**
 * AI STRESS TEST Configuration
 *
 * Maximum AI controllers: 2 per side × 4 sides = 8 AI total
 * QAI_12 Convergence Mission (supports 2-4 sides)
 * MEDIUM game size for manageable performance
 * Battlefield: 48"×48"
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { LIGHTING_PRESETS } from '../lighting-presets';
import type { BattleRunnerConfig } from '../battle-runner';

export const AI_STRESS_TEST_CONFIG: BattleRunnerConfig = {
  gameSize: GameSize.MEDIUM,
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
          count: 6,
          itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 2, // Strategic + Tactical AI
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
          count: 6,
          itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 2, // Strategic + Tactical AI
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
          count: 6,
          itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 2, // Strategic + Tactical AI
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
          count: 6,
          itemNames: ['Rifle, Light, Semi/A', 'Sword, Broad', 'Armored Gear', 'Armor, Light'],
        },
      ],
      ai: {
        count: 2, // Strategic + Tactical AI
        doctrine: 'Opportunistic',
      },
    },
  ],
  instrumentationGrade: InstrumentationGrade.SUMMARY, // Lower grade for performance
};

export default AI_STRESS_TEST_CONFIG;

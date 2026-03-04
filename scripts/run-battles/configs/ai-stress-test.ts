/**
 * AI STRESS TEST Configuration
 *
 * Maximum AI controllers: 2 per side × 4 sides = 8 AI total
 * QAI_12 Convergence Mission (supports 2-4 sides)
 * MEDIUM game size for manageable performance
 * Battlefield: 36×36 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { InstrumentationGrade } from '../../../src/lib/mest-tactics/instrumentation/QSRInstrumentation';
import { createPresetBattleConfig } from './shared';

const AI_STRESS_LOADOUT = ['Rifle, Light, Semi/A', 'Sword, Broad', 'Armored Gear', 'Armor, Light'];

export const AI_STRESS_TEST_CONFIG = createPresetBattleConfig({
  gameSize: GameSize.MEDIUM,
  missionId: 'QAI_12',
  sideTemplates: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblyName: 'Assembly A',
      archetypeName: 'Veteran',
      modelCount: 6,
      itemNames: AI_STRESS_LOADOUT,
      aiCount: 2,
      doctrine: 'Aggressive',
    },
    {
      id: 'side-b',
      name: 'Side B',
      assemblyName: 'Assembly B',
      archetypeName: 'Veteran',
      modelCount: 6,
      itemNames: AI_STRESS_LOADOUT,
      aiCount: 2,
      doctrine: 'Balanced',
    },
    {
      id: 'side-c',
      name: 'Side C',
      assemblyName: 'Assembly C',
      archetypeName: 'Veteran',
      modelCount: 6,
      itemNames: AI_STRESS_LOADOUT,
      aiCount: 2,
      doctrine: 'Defensive',
    },
    {
      id: 'side-d',
      name: 'Side D',
      assemblyName: 'Assembly D',
      archetypeName: 'Veteran',
      modelCount: 6,
      itemNames: AI_STRESS_LOADOUT,
      aiCount: 2,
      doctrine: 'Opportunistic',
    },
  ],
  instrumentationGrade: InstrumentationGrade.SUMMARY,
});

export default AI_STRESS_TEST_CONFIG;

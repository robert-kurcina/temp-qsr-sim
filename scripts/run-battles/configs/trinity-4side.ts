/**
 * TRINITY 4-Side Battle Configuration
 *
 * QAI_17 Trinity Mission - Supports up to 4 sides
 * LARGE game size for epic battles
 * Battlefield: 48×48 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createPresetBattleConfig } from './shared';

const TRINITY_4SIDE_LOADOUT = ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Light'];

export const TRINITY_4SIDE_CONFIG = createPresetBattleConfig({
  gameSize: GameSize.LARGE,
  missionId: 'QAI_17',
  sideTemplates: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblyName: 'Assembly A',
      archetypeName: 'Veteran',
      modelCount: 8,
      itemNames: TRINITY_4SIDE_LOADOUT,
      doctrine: 'Aggressive',
    },
    {
      id: 'side-b',
      name: 'Side B',
      assemblyName: 'Assembly B',
      archetypeName: 'Veteran',
      modelCount: 8,
      itemNames: TRINITY_4SIDE_LOADOUT,
      doctrine: 'Balanced',
    },
    {
      id: 'side-c',
      name: 'Side C',
      assemblyName: 'Assembly C',
      archetypeName: 'Veteran',
      modelCount: 8,
      itemNames: TRINITY_4SIDE_LOADOUT,
      doctrine: 'Defensive',
    },
    {
      id: 'side-d',
      name: 'Side D',
      assemblyName: 'Assembly D',
      archetypeName: 'Veteran',
      modelCount: 8,
      itemNames: TRINITY_4SIDE_LOADOUT,
      doctrine: 'Opportunistic',
    },
  ],
});

export default TRINITY_4SIDE_CONFIG;

/**
 * TRINITY 3-Side Battle Configuration
 *
 * QAI_17 Trinity Mission - Requires minimum 3 sides
 * MEDIUM game size for balanced play
 * Battlefield: 36×36 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createPresetBattleConfig } from './shared';

const TRINITY_LOADOUT = ['Rifle, Medium, Semi/A', 'Armored Gear', 'Armor, Medium'];

export const TRINITY_CONFIG = createPresetBattleConfig({
  gameSize: GameSize.MEDIUM,
  missionId: 'QAI_17',
  sideTemplates: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblyName: 'Assembly A',
      archetypeName: 'Elite',
      modelCount: 6,
      itemNames: TRINITY_LOADOUT,
      doctrine: 'Balanced',
    },
    {
      id: 'side-b',
      name: 'Side B',
      assemblyName: 'Assembly B',
      archetypeName: 'Elite',
      modelCount: 6,
      itemNames: TRINITY_LOADOUT,
      doctrine: 'Balanced',
    },
    {
      id: 'side-c',
      name: 'Side C',
      assemblyName: 'Assembly C',
      archetypeName: 'Elite',
      modelCount: 6,
      itemNames: TRINITY_LOADOUT,
      doctrine: 'Balanced',
    },
  ],
});

export default TRINITY_CONFIG;

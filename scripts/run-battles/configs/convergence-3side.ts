/**
 * CONVERGENCE 3-Side Battle Configuration
 *
 * QAI_12 Convergence Mission - 2-4 sides
 * This configuration uses 3 sides
 * SMALL game size for faster play
 * Battlefield: 24×24 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createPresetBattleConfig } from './shared';

const CONVERGENCE_LOADOUT = ['Rifle, Light, Semi/A', 'Armored Gear', 'Armor, Light'];

export const CONVERGENCE_3SIDE_CONFIG = createPresetBattleConfig({
  gameSize: GameSize.SMALL,
  missionId: 'QAI_12',
  sideTemplates: [
    {
      id: 'side-a',
      name: 'Side A',
      assemblyName: 'Assembly A',
      archetypeName: 'Veteran',
      modelCount: 4,
      itemNames: CONVERGENCE_LOADOUT,
      doctrine: 'Aggressive',
    },
    {
      id: 'side-b',
      name: 'Side B',
      assemblyName: 'Assembly B',
      archetypeName: 'Veteran',
      modelCount: 4,
      itemNames: CONVERGENCE_LOADOUT,
      doctrine: 'Balanced',
    },
    {
      id: 'side-c',
      name: 'Side C',
      assemblyName: 'Assembly C',
      archetypeName: 'Veteran',
      modelCount: 4,
      itemNames: CONVERGENCE_LOADOUT,
      doctrine: 'Defensive',
    },
  ],
});

export default CONVERGENCE_3SIDE_CONFIG;

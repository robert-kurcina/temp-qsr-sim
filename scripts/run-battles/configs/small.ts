/**
 * SMALL Battle Configuration
 *
 * Canonical (src/data/game_sizes.json): 4-8 models per side, 250-500 BP
 * End-Game Trigger: Turn 4
 * Battlefield: 24×24 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createSymmetricEliminationConfig } from './shared';

export const SMALL_CONFIG = createSymmetricEliminationConfig({
  gameSize: GameSize.SMALL,
  modelCount: 4,
  archetypeName: 'Veteran',
  itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
});

export default SMALL_CONFIG;

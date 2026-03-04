/**
 * VERY_SMALL Battle Configuration
 *
 * Canonical (src/data/game_sizes.json): 2-4 models per side, 125-250 BP
 * End-Game Trigger: Turn 3
 * Battlefield: 18×24 MU
 */

import { GameSize } from '../../../src/lib/mest-tactics/mission/assembly-builder';
import { createSymmetricEliminationConfig } from './shared';

export const VERY_SMALL_CONFIG = createSymmetricEliminationConfig({
  gameSize: GameSize.VERY_SMALL,
  modelCount: 3,
  archetypeName: 'Average',
  itemNames: ['Sword, Broad', 'Armored Gear', 'Armor, Light', 'Shield, Small'],
});

export default VERY_SMALL_CONFIG;
